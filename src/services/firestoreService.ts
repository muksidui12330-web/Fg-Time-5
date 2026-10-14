import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  increment,
  writeBatch,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  PostItem,
  CommentItem,
  StoryItem,
  ReelItem,
  UserProfile,
  ConversationItem,
  MessageItem,
  NotificationItem,
  ReportItem,
  CoupleItem,
  LoveMemoryItem,
  LoveNoteItem,
  RelationshipMilestone,
} from '../types';

// ==================== POSTS ====================

export function subscribePosts(
  callback: (posts: PostItem[]) => void,
  categoryFilter?: string,
  onError?: (err: Error) => void
) {
  const postsRef = collection(db, 'posts');
  // Order by createdAt descending (uses single-field index)
  const q = query(postsRef, orderBy('createdAt', 'desc'), limit(60));

  return onSnapshot(
    q,
    (snapshot) => {
      let posts: PostItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PostItem, 'id'>),
      }));

      // In-memory category filter prevents missing composite index errors
      if (categoryFilter && categoryFilter !== 'all') {
        posts = posts.filter((p) => p.category === categoryFilter);
      }
      callback(posts);
    },
    (error) => {
      console.warn('[FG TIME] subscribePosts snapshot warning:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      } else {
        callback([]);
      }
    }
  );
}

/**
 * Dedicated subscription for author posts to guarantee all of a user's posts
 * load reliably on their profile without being cut off by the global feed limit.
 */
export function subscribeUserPosts(
  authorId: string,
  callback: (posts: PostItem[]) => void
) {
  const postsRef = collection(db, 'posts');
  const q = query(postsRef, where('authorId', '==', authorId));

  return onSnapshot(
    q,
    (snapshot) => {
      const posts: PostItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PostItem, 'id'>),
      }));
      posts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(posts);
    },
    (error) => {
      console.warn('[FG TIME] subscribeUserPosts warning for:', authorId, error);
      callback([]);
    }
  );
}

export async function createPost(postData: Omit<PostItem, 'id' | 'likesCount' | 'commentsCount' | 'sharesCount'>): Promise<string> {
  const postsRef = collection(db, 'posts');
  const postDocRef = doc(postsRef);
  const postId = postDocRef.id;

  const rawPost: Record<string, any> = {
    id: postId,
    authorId: postData.authorId,
    authorName: postData.authorName,
    authorUsername: postData.authorUsername || '',
    authorPhoto: postData.authorPhoto || '',
    content: postData.content ?? '',
    tags: Array.isArray(postData.tags) ? postData.tags : [],
    category: postData.category || 'nature',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    savesCount: 0,
    createdAt: postData.createdAt || new Date().toISOString(),
  };

  if (postData.imageUrl && postData.imageUrl.trim()) {
    rawPost.imageUrl = postData.imageUrl.trim();
  }
  if (Array.isArray(postData.mediaUrls) && postData.mediaUrls.length > 0) {
    rawPost.mediaUrls = postData.mediaUrls;
  }
  if (Array.isArray(postData.mentions) && postData.mentions.length > 0) {
    rawPost.mentions = postData.mentions;
  }
  if (postData.music && postData.music.title) {
    rawPost.music = {
      title: postData.music.title,
      artist: postData.music.artist || 'FG TIME Sounds',
      ...(postData.music.audioUrl ? { audioUrl: postData.music.audioUrl } : {}),
    };
  }
  if (postData.mediaType) {
    rawPost.mediaType = postData.mediaType;
  }
  if (postData.location && postData.location.trim()) {
    rawPost.location = postData.location.trim();
  }

  // Eliminate any undefined properties that Firestore rejects
  const newPost: Record<string, any> = {};
  for (const [k, v] of Object.entries(rawPost)) {
    if (v !== undefined) {
      newPost[k] = v;
    }
  }

  try {
    await setDoc(postDocRef, newPost);
    // Increment user postsCount
    const userRef = doc(db, 'users', postData.authorId);
    await updateDoc(userRef, { postsCount: increment(1) }).catch(() => {});
    return postId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `posts/${postId}`);
  }
}

export async function deletePost(postId: string, authorId: string) {
  try {
    await deleteDoc(doc(db, 'posts', postId));
    const userRef = doc(db, 'users', authorId);
    await updateDoc(userRef, { postsCount: increment(-1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
  }
}

export async function checkIsPostLiked(postId: string, userId: string): Promise<boolean> {
  try {
    const likeDoc = await getDoc(doc(db, 'posts', postId, 'likes', userId));
    return likeDoc.exists();
  } catch {
    return false;
  }
}

export async function toggleLikePost(
  postId: string,
  userId: string,
  postAuthorId: string,
  currentUserProfile?: UserProfile
): Promise<boolean> {
  const likeDocRef = doc(db, 'posts', postId, 'likes', userId);
  const postDocRef = doc(db, 'posts', postId);

  try {
    const likeSnap = await getDoc(likeDocRef);
    if (likeSnap.exists()) {
      // Unlike
      await deleteDoc(likeDocRef);
      await updateDoc(postDocRef, { likesCount: increment(-1) });
      return false;
    } else {
      // Like
      await setDoc(likeDocRef, {
        userId,
        postId,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(postDocRef, { likesCount: increment(1) });

      // Notify post author if not self
      if (postAuthorId !== userId && currentUserProfile) {
        await createNotification({
          userId: postAuthorId,
          senderId: userId,
          senderName: currentUserProfile.displayName,
          senderPhoto: currentUserProfile.photoURL,
          type: 'like',
          targetId: postId,
          read: false,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${postId}/likes/${userId}`);
  }
}

// ==================== COMMENTS ====================

export function subscribeComments(
  postId: string,
  callback: (comments: CommentItem[]) => void
) {
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'asc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const comments: CommentItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CommentItem, 'id'>),
      }));
      callback(comments);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `posts/${postId}/comments`);
    }
  );
}

export async function addComment(
  postId: string,
  authorProfile: UserProfile,
  text: string,
  postAuthorId: string
): Promise<CommentItem> {
  const commentsRef = collection(db, 'posts', postId, 'comments');
  const commentDocRef = doc(commentsRef);
  const commentId = commentDocRef.id;

  const newComment: CommentItem = {
    id: commentId,
    postId,
    authorId: authorProfile.id,
    authorName: authorProfile.displayName,
    authorPhoto: authorProfile.photoURL,
    text,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(commentDocRef, newComment);
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });

    if (postAuthorId !== authorProfile.id) {
      await createNotification({
        userId: postAuthorId,
        senderId: authorProfile.id,
        senderName: authorProfile.displayName,
        senderPhoto: authorProfile.photoURL,
        type: 'comment',
        targetId: postId,
        read: false,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return newComment;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/comments/${commentId}`);
  }
}

export async function deleteComment(postId: string, commentId: string) {
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
  }
}

// ==================== STORIES ====================

export function subscribeStories(callback: (stories: StoryItem[]) => void) {
  const storiesRef = collection(db, 'stories');
  const now = Date.now();
  const q = query(storiesRef, orderBy('createdAt', 'desc'), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const stories: StoryItem[] = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<StoryItem, 'id'>) }))
        .filter((s) => !s.expiresAt || s.expiresAt > now);
      callback(stories);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stories');
    }
  );
}

export async function createStory(storyData: Omit<StoryItem, 'id'>): Promise<string> {
  const storiesRef = collection(db, 'stories');
  const storyDocRef = doc(storiesRef);
  const storyId = storyDocRef.id;

  const item: StoryItem = {
    ...storyData,
    id: storyId,
  };

  try {
    await setDoc(storyDocRef, item);
    return storyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `stories/${storyId}`);
  }
}

// ==================== REELS ====================

export function subscribeReels(callback: (reels: ReelItem[]) => void) {
  const reelsRef = collection(db, 'reels');
  const q = query(reelsRef, orderBy('createdAt', 'desc'), limit(30));

  return onSnapshot(
    q,
    (snapshot) => {
      const reels: ReelItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReelItem, 'id'>),
      }));
      callback(reels);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reels');
    }
  );
}

export async function createReel(reelData: Omit<ReelItem, 'id' | 'likesCount' | 'commentsCount'>): Promise<string> {
  const reelsRef = collection(db, 'reels');
  const reelDocRef = doc(reelsRef);
  const reelId = reelDocRef.id;

  const item: ReelItem = {
    ...reelData,
    id: reelId,
    likesCount: 0,
    commentsCount: 0,
  };

  try {
    await setDoc(reelDocRef, item);
    return reelId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reels/${reelId}`);
  }
}

export async function toggleLikeReel(reelId: string, incrementValue: number) {
  try {
    await updateDoc(doc(db, 'reels', reelId), {
      likesCount: increment(incrementValue),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reels/${reelId}`);
  }
}

// ==================== FOLLOWS ====================

export async function checkIsFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleFollowUser(
  currentUserId: string,
  targetUserId: string,
  currentUserProfile: UserProfile
): Promise<boolean> {
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const currentUserDoc = doc(db, 'users', currentUserId);
  const targetUserDoc = doc(db, 'users', targetUserId);

  try {
    const followingSnap = await getDoc(followingRef);
    if (followingSnap.exists()) {
      // Unfollow
      await deleteDoc(followingRef);
      await deleteDoc(followerRef);
      await updateDoc(currentUserDoc, { followingCount: increment(-1) }).catch(() => {});
      await updateDoc(targetUserDoc, { followersCount: increment(-1) }).catch(() => {});
      return false;
    } else {
      // Follow
      const now = new Date().toISOString();
      await setDoc(followingRef, { userId: currentUserId, targetUserId, createdAt: now });
      await setDoc(followerRef, { followerId: currentUserId, followedId: targetUserId, createdAt: now });
      await updateDoc(currentUserDoc, { followingCount: increment(1) }).catch(() => {});
      await updateDoc(targetUserDoc, { followersCount: increment(1) }).catch(() => {});

      // Notify
      await createNotification({
        userId: targetUserId,
        senderId: currentUserId,
        senderName: currentUserProfile.displayName,
        senderPhoto: currentUserProfile.photoURL,
        type: 'follow',
        targetId: currentUserId,
        read: false,
        createdAt: now,
      }).catch(() => {});
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${currentUserId}/following/${targetUserId}`);
  }
}

// ==================== MESSAGING & GROUP CHATS ====================

export interface CanMessageResult {
  allowed: boolean;
  reason?: 'blocked' | 'follow_required' | 'private_account_mutual_required' | 'cannot_message_self';
  message?: string;
}

/**
 * Checks whether current user is permitted to start/send a DM to targetUser
 * based on follow relationship, privacy controls, and block lists.
 */
export async function checkCanMessage(
  currentUserId: string,
  targetUser: UserProfile,
  currentUserProfile?: UserProfile
): Promise<CanMessageResult> {
  if (currentUserId === targetUser.id) {
    return { allowed: false, reason: 'cannot_message_self', message: 'You cannot message your own garden profile.' };
  }

  // 1. Check if either user has blocked the other
  const currentUserBlocked = currentUserProfile?.blockedUsers || [];
  const targetUserBlocked = targetUser.blockedUsers || [];
  if (currentUserBlocked.includes(targetUser.id) || targetUserBlocked.includes(currentUserId)) {
    return {
      allowed: false,
      reason: 'blocked',
      message: 'Unable to message this gardener due to blocking restrictions.',
    };
  }

  // 2. Check if current user follows target user
  const isFollowing = await checkIsFollowing(currentUserId, targetUser.id);
  if (!isFollowing) {
    return {
      allowed: false,
      reason: 'follow_required',
      message: `Follow @${targetUser.username} first to start a mindful conversation.`,
    };
  }

  // 3. If target user has a private account, verify mutual follow
  if (targetUser.isPrivate) {
    const isTargetFollowingBack = await checkIsFollowing(targetUser.id, currentUserId);
    if (!isTargetFollowingBack) {
      return {
        allowed: false,
        reason: 'private_account_mutual_required',
        message: `@${targetUser.username}'s account is private. They must also follow you back before you can exchange direct whispers.`,
      };
    }
  }

  return { allowed: true };
}

export async function getOrCreateConversation(
  userId1: string,
  userId2: string,
  user1Profile?: UserProfile,
  user2Profile?: UserProfile
): Promise<string> {
  const convId = [userId1, userId2].sort().join('_');
  const convRef = doc(db, 'conversations', convId);

  try {
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      const participantProfiles: Record<string, { displayName: string; username: string; photoURL: string }> = {};
      if (user1Profile) {
        participantProfiles[user1Profile.id] = {
          displayName: user1Profile.displayName,
          username: user1Profile.username,
          photoURL: user1Profile.photoURL,
        };
      }
      if (user2Profile) {
        participantProfiles[user2Profile.id] = {
          displayName: user2Profile.displayName,
          username: user2Profile.username,
          photoURL: user2Profile.photoURL,
        };
      }

      const now = new Date().toISOString();
      await setDoc(convRef, {
        id: convId,
        isGroup: false,
        participants: [userId1, userId2],
        participantProfiles,
        lastMessage: 'Conversation started 🍃',
        lastMessageTime: now,
        updatedAt: now,
        readBy: { [userId1]: now },
      });
    }
    return convId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${convId}`);
  }
}

export async function createGroupConversation(
  creatorProfile: UserProfile,
  groupName: string,
  groupPhoto: string,
  members: UserProfile[]
): Promise<string> {
  const convRef = doc(collection(db, 'conversations'));
  const convId = convRef.id;
  const now = new Date().toISOString();

  const allMembers = [creatorProfile, ...members.filter((m) => m.id !== creatorProfile.id)];
  const participantIds = allMembers.map((m) => m.id);

  const participantProfiles: Record<string, { displayName: string; username: string; photoURL: string }> = {};
  allMembers.forEach((m) => {
    participantProfiles[m.id] = {
      displayName: m.displayName,
      username: m.username,
      photoURL: m.photoURL,
    };
  });

  const auditEvent = {
    id: `audit_${Date.now()}`,
    text: `${creatorProfile.displayName} sprouted group "${groupName}" 🌿`,
    createdAt: now,
  };

  try {
    await setDoc(convRef, {
      id: convId,
      isGroup: true,
      name: groupName,
      photoURL: groupPhoto || 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=150',
      creatorId: creatorProfile.id,
      adminIds: [creatorProfile.id],
      participants: participantIds,
      participantProfiles,
      adminsOnlySettings: false,
      lastMessage: `${creatorProfile.displayName} created group "${groupName}"`,
      lastMessageTime: now,
      lastSenderId: creatorProfile.id,
      updatedAt: now,
      readBy: { [creatorProfile.id]: now },
      systemAuditLog: [auditEvent],
    });

    // Post initial system message
    const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId: convId,
      senderId: creatorProfile.id,
      senderName: 'FG TIME System',
      text: `🌿 Welcome to ${groupName}! Feel free to share botanical ideas, plant care tips, and mindful moments.`,
      mediaType: 'system',
      createdAt: now,
    });

    return convId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `conversations/${convId}`);
  }
}

export async function updateGroupDetails(
  conversationId: string,
  updates: { name?: string; photoURL?: string; adminsOnlySettings?: boolean },
  actorName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const desc = updates.name
    ? `${actorName} renamed group to "${updates.name}"`
    : `${actorName} updated group info`;

  const audit = {
    id: `audit_${Date.now()}`,
    text: desc,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      ...updates,
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function addGroupMembers(
  conversationId: string,
  newMembers: UserProfile[],
  actorName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const addedNames = newMembers.map((m) => m.displayName).join(', ');
  const newIds = newMembers.map((m) => m.id);

  const profileUpdates: Record<string, any> = {};
  newMembers.forEach((m) => {
    profileUpdates[`participantProfiles.${m.id}`] = {
      displayName: m.displayName,
      username: m.username,
      photoURL: m.photoURL,
    };
  });

  const audit = {
    id: `audit_${Date.now()}`,
    text: `${actorName} welcomed ${addedNames} to the group 🌱`,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      participants: arrayUnion(...newIds),
      ...profileUpdates,
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
      lastMessage: `${actorName} added ${addedNames}`,
      lastMessageTime: now,
    });

    // Add a system announcement message
    const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId,
      senderId: 'system',
      senderName: 'FG TIME System',
      text: `🍃 ${actorName} added ${addedNames} to the conversation.`,
      mediaType: 'system',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function removeGroupMember(
  conversationId: string,
  memberId: string,
  memberName: string,
  actorName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const audit = {
    id: `audit_${Date.now()}`,
    text: `${actorName} removed ${memberName} from the group`,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      participants: arrayRemove(memberId),
      adminIds: arrayRemove(memberId),
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
      lastMessage: `${memberName} was removed from the group`,
      lastMessageTime: now,
    });

    const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId,
      senderId: 'system',
      senderName: 'FG TIME System',
      text: `🍂 ${memberName} was removed from the group by ${actorName}.`,
      mediaType: 'system',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function promoteGroupAdmin(
  conversationId: string,
  memberId: string,
  memberName: string,
  actorName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const audit = {
    id: `audit_${Date.now()}`,
    text: `${actorName} promoted ${memberName} to Group Admin 🌟`,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      adminIds: arrayUnion(memberId),
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
    });

    const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId,
      senderId: 'system',
      senderName: 'FG TIME System',
      text: `🌟 ${memberName} is now a Group Admin.`,
      mediaType: 'system',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function demoteGroupAdmin(
  conversationId: string,
  memberId: string,
  memberName: string,
  actorName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const audit = {
    id: `audit_${Date.now()}`,
    text: `${actorName} removed admin privileges from ${memberName}`,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      adminIds: arrayRemove(memberId),
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function leaveGroup(
  conversationId: string,
  userId: string,
  userName: string
) {
  const convRef = doc(db, 'conversations', conversationId);
  const now = new Date().toISOString();
  const audit = {
    id: `audit_${Date.now()}`,
    text: `${userName} left the group`,
    createdAt: now,
  };

  try {
    await updateDoc(convRef, {
      participants: arrayRemove(userId),
      adminIds: arrayRemove(userId),
      updatedAt: now,
      systemAuditLog: arrayUnion(audit),
      lastMessage: `${userName} left the group`,
      lastMessageTime: now,
    });

    const msgRef = doc(collection(db, 'conversations', conversationId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      conversationId,
      senderId: 'system',
      senderName: 'FG TIME System',
      text: `🍃 ${userName} has left the group.`,
      mediaType: 'system',
      createdAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `conversations/${conversationId}`);
  }
}

export async function deleteGroup(conversationId: string) {
  try {
    await deleteDoc(doc(db, 'conversations', conversationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `conversations/${conversationId}`);
  }
}

export async function deleteMessage(conversationId: string, messageId: string) {
  try {
    await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `conversations/${conversationId}/messages/${messageId}`);
  }
}

export function subscribeUserConversations(
  userId: string,
  callback: (conversations: ConversationItem[]) => void
) {
  const convRef = collection(db, 'conversations');
  const q = query(convRef, where('participants', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ConversationItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ConversationItem, 'id'>),
      }));
      // In-memory sort avoids composite index requirement
      items.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      callback(items);
    },
    (error) => {
      console.warn('[FG TIME] subscribeUserConversations warning:', error);
      callback([]);
    }
  );
}

export function subscribeMessages(
  conversationId: string,
  callback: (messages: MessageItem[]) => void
) {
  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(msgRef, orderBy('createdAt', 'asc'), limit(150));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: MessageItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MessageItem, 'id'>),
      }));
      callback(msgs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${conversationId}/messages`);
    }
  );
}

export async function sendMessage(
  conversationId: string,
  senderProfile: UserProfile,
  text: string,
  imageUrl?: string,
  mediaType: 'text' | 'image' | 'system' = imageUrl ? 'image' : 'text'
) {
  const msgRef = collection(db, 'conversations', conversationId, 'messages');
  const msgDoc = doc(msgRef);
  const now = new Date().toISOString();

  const newMsg: MessageItem = {
    id: msgDoc.id,
    conversationId,
    senderId: senderProfile.id,
    senderName: senderProfile.displayName,
    senderPhoto: senderProfile.photoURL,
    text,
    imageUrl: imageUrl || undefined,
    mediaType,
    createdAt: now,
    readBy: [senderProfile.id],
  };

  // Remove undefined properties
  const cleanMsg: Record<string, any> = {};
  for (const [k, v] of Object.entries(newMsg)) {
    if (v !== undefined) cleanMsg[k] = v;
  }

  try {
    await setDoc(msgDoc, cleanMsg);
    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: imageUrl && !text ? '📷 Shared a photo' : text,
      lastMessageTime: now,
      lastSenderId: senderProfile.id,
      updatedAt: now,
      [`readBy.${senderProfile.id}`]: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `conversations/${conversationId}/messages/${msgDoc.id}`);
  }
}

export async function markConversationAsRead(
  conversationId: string,
  userId: string
) {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`readBy.${userId}`]: now,
    });
  } catch {
    // Non-blocking read receipt update
  }
}

// ==================== NOTIFICATIONS ====================

export function subscribeNotifications(
  userId: string,
  callback: (notifications: NotificationItem[]) => void
) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NotificationItem, 'id'>),
      }));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`);
    }
  );
}

export async function createNotification(notifData: Omit<NotificationItem, 'id'>) {
  const notifRef = collection(db, 'users', notifData.userId, 'notifications');
  const notifDoc = doc(notifRef);

  await setDoc(notifDoc, {
    ...notifData,
    id: notifDoc.id,
  });
}

export async function markNotificationRead(userId: string, notifId: string) {
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notifId), {
      read: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/notifications/${notifId}`);
  }
}

// ==================== USER PROFILES ====================

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      if (!data.fgTimeId) {
        data.fgTimeId = `FG-${userId.slice(0, 6).toUpperCase()}`;
      }
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${userId}`);
  }
}

export async function searchUsers(searchTerm: string): Promise<UserProfile[]> {
  try {
    const trimmed = searchTerm.trim();
    const lower = trimmed.toLowerCase();
    const upper = trimmed.toUpperCase();

    // 1. If empty query, return top 20 users
    if (!trimmed) {
      const q = query(collection(db, 'users'), limit(20));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const u = d.data() as UserProfile;
        if (!u.fgTimeId) u.fgTimeId = `FG-${d.id.slice(0, 6).toUpperCase()}`;
        return u;
      });
    }

    // 2. Direct exact check if user passed exact UID or FG-XXXX ID
    const resultsMap = new Map<string, UserProfile>();

    // Check direct UID doc
    try {
      const directSnap = await getDoc(doc(db, 'users', trimmed));
      if (directSnap.exists()) {
        const u = directSnap.data() as UserProfile;
        if (!u.fgTimeId) u.fgTimeId = `FG-${directSnap.id.slice(0, 6).toUpperCase()}`;
        resultsMap.set(u.id, u);
      }
    } catch {
      // not a direct document ID, continue
    }

    // 3. Query all users (up to 50) and evaluate matches
    const q = query(collection(db, 'users'), limit(50));
    const snap = await getDocs(q);

    snap.docs.forEach((d) => {
      const u = d.data() as UserProfile;
      if (!u.fgTimeId) u.fgTimeId = `FG-${d.id.slice(0, 6).toUpperCase()}`;

      const uIdLower = u.id.toLowerCase();
      const fgIdUpper = (u.fgTimeId || '').toUpperCase();
      const uNameLower = (u.username || '').toLowerCase();
      const dNameLower = (u.displayName || '').toLowerCase();
      const bioLower = (u.bio || '').toLowerCase();

      // Check for exact or partial matches
      const isExactId = uIdLower === lower || fgIdUpper === upper || fgIdUpper === `FG-${upper}`;
      const isExactUsername = uNameLower === lower || uNameLower === lower.replace(/^@/, '');
      const isPartialMatch =
        fgIdUpper.includes(upper) ||
        uNameLower.includes(lower.replace(/^@/, '')) ||
        dNameLower.includes(lower) ||
        bioLower.includes(lower);

      if (isExactId || isExactUsername || isPartialMatch) {
        resultsMap.set(u.id, u);
      }
    });

    const allMatches = Array.from(resultsMap.values());

    // Sort: Exact FG TIME ID / Username matches first
    return allMatches.sort((a, b) => {
      const aExact =
        a.id.toLowerCase() === lower ||
        a.fgTimeId?.toUpperCase() === upper ||
        a.username.toLowerCase() === lower.replace(/^@/, '');
      const bExact =
        b.id.toLowerCase() === lower ||
        b.fgTimeId?.toUpperCase() === upper ||
        b.username.toLowerCase() === lower.replace(/^@/, '');
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'users');
    return [];
  }
}

// ==================== REPORTS & BLOCKING ====================

export async function submitReport(report: Omit<ReportItem, 'id'>) {
  const reportsRef = collection(db, 'reports');
  const reportDoc = doc(reportsRef);

  try {
    await setDoc(reportDoc, {
      ...report,
      id: reportDoc.id,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reports/${reportDoc.id}`);
  }
}

export async function blockUser(
  currentUserId: string,
  targetUserId: string,
  currentBlocked: string[] = []
) {
  if (currentBlocked.includes(targetUserId)) return;
  const updated = [...currentBlocked, targetUserId];
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      blockedUsers: updated,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}`);
  }
}

export async function unblockUser(
  currentUserId: string,
  targetUserId: string,
  currentBlocked: string[] = []
) {
  const updated = currentBlocked.filter((id) => id !== targetUserId);
  try {
    await updateDoc(doc(db, 'users', currentUserId), {
      blockedUsers: updated,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${currentUserId}`);
  }
}

// ==================== SEED INITIAL COMMUNITY ====================

export const INITIAL_CURATED_POSTS: PostItem[] = [
  {
    id: 'post-welcome-verdant',
    authorId: 'fg_botanist_system',
    authorName: 'Aria Verdant',
    authorUsername: 'aria_leaf',
    authorPhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    content: 'Welcome to FG TIME! 🌿 Sprouting a community grounded in nature, mindfulness, and green living. Take a deep breath, share your green spaces, and let roots connect us all.',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1200&auto=format&fit=crop&q=80',
    music: {
      title: 'Forest Sunlight Melody',
      artist: 'FG TIME Ambient Records',
      audioUrl: '/audio/forest-sunlight-melody.mp3',
    },
    tags: ['#FGTime', '#WelcomeRoots', '#GreenLiving', '#FloraCommunity'],
    category: 'nature',
    likesCount: 24,
    commentsCount: 3,
    sharesCount: 5,
    savesCount: 8,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'post-stream-clip',
    authorId: 'fg_forest_guide',
    authorName: 'Kai Greenwood',
    authorUsername: 'kai_forest',
    authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    content: 'Watch the gentle forest sunlight stream through the ancient mossy oaks. Tap the clip to immerse yourself in the natural river frequency 🌲💧',
    imageUrl: '/videos/forest-stream.mp4',
    mediaType: 'video',
    music: {
      title: 'Dewdrop Stream Flow',
      artist: 'Botanical Waves',
      audioUrl: '/audio/dewdrop-stream-flow.mp3',
    },
    tags: ['#ForestVibes', '#RiverMelody', '#MorningWalk', '#PlantSanctuary'],
    category: 'vibes',
    likesCount: 42,
    commentsCount: 6,
    sharesCount: 12,
    savesCount: 15,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'post-monstera-propagation',
    authorId: 'fg_urban_sprout',
    authorName: 'Mira Patel',
    authorUsername: 'mira_urbanplants',
    authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    content: 'Transplanted my Monstera Deliciosa cuttings today! Look at those healthy root nodules thriving in leca clay pebbles. Sustainable balcony gardening is pure therapy 🌱🏡',
    imageUrl: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1200&auto=format&fit=crop&q=80',
    tags: ['#UrbanJungle', '#Monstera', '#IndoorPlants', '#GreenThumb'],
    category: 'green-tech',
    likesCount: 19,
    commentsCount: 2,
    sharesCount: 3,
    savesCount: 7,
    createdAt: new Date().toISOString(),
  },
];

export async function seedCommunityDataIfEmpty(currentUserProfile?: UserProfile | null) {
  // Only attempt seeding when a user is signed in to avoid permission-denied errors
  if (!currentUserProfile) return;

  try {
    const existingSnap = await getDocs(query(collection(db, 'posts'), limit(1)));
    if (!existingSnap.empty) {
      return; // already has content!
    }

    const defaultAuthor = currentUserProfile;

    const initialPosts: Array<Omit<PostItem, 'id' | 'likesCount' | 'commentsCount' | 'sharesCount'>> = [
      {
        authorId: defaultAuthor.id,
        authorName: defaultAuthor.displayName,
        authorUsername: defaultAuthor.username,
        authorPhoto: defaultAuthor.photoURL,
        content: 'Welcome to FG TIME! 🌿 Sprouting a community grounded in nature, mindfulness, and green living. Take a deep breath, share your green spaces, and let roots connect us all.',
        imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1200&auto=format&fit=crop&q=80',
        music: {
          title: 'Forest Sunlight Melody',
          artist: 'FG TIME Ambient Records',
          audioUrl: '/audio/forest-sunlight-melody.mp3',
        },
        tags: ['#FGTime', '#WelcomeRoots', '#GreenLiving', '#FloraCommunity'],
        category: 'nature',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        authorId: 'fg_forest_guide',
        authorName: 'Kai Greenwood',
        authorUsername: 'kai_forest',
        authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        content: 'Watch the gentle forest sunlight stream through the ancient mossy oaks. Tap the clip to immerse yourself in the natural river frequency 🌲💧',
        imageUrl: '/videos/forest-stream.mp4',
        mediaType: 'video',
        music: {
          title: 'Dewdrop Stream Flow',
          artist: 'Botanical Waves',
          audioUrl: '/audio/dewdrop-stream-flow.mp3',
        },
        tags: ['#ForestVibes', '#RiverMelody', '#MorningWalk', '#PlantSanctuary'],
        category: 'vibes',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        authorId: 'fg_urban_sprout',
        authorName: 'Mira Patel',
        authorUsername: 'mira_urbanplants',
        authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        content: 'Transplanted my Monstera Deliciosa cuttings today! Look at those healthy root nodules thriving in leca clay pebbles. Sustainable balcony gardening is pure therapy 🌱🏡',
        imageUrl: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1200&auto=format&fit=crop&q=80',
        tags: ['#UrbanJungle', '#Monstera', '#IndoorPlants', '#GreenThumb'],
        category: 'green-tech',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const post of initialPosts) {
      await createPost(post);
    }

    // Seed initial stories
    const initialStories: Array<Omit<StoryItem, 'id'>> = [
      {
        authorId: defaultAuthor.id,
        authorName: defaultAuthor.displayName,
        authorPhoto: defaultAuthor.photoURL,
        mediaUrl: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80',
        caption: 'First rays through the leaves 🍃',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 86400000,
      },
      {
        authorId: 'fg_forest_guide',
        authorName: 'Kai Greenwood',
        authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        mediaUrl: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=800&auto=format&fit=crop&q=80',
        caption: 'Deep canopy quietness 🌲',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 86400000,
      },
      {
        authorId: 'fg_urban_sprout',
        authorName: 'Mira Patel',
        authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        mediaUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
        caption: 'Watering day rituals 💧🪴',
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 86400000,
      },
    ];

    for (const story of initialStories) {
      await createStory(story);
    }

    // Seed initial reels
    const initialReels: Array<Omit<ReelItem, 'id' | 'likesCount' | 'commentsCount'>> = [
      {
        authorId: 'fg_forest_guide',
        authorName: 'Kai Greenwood',
        authorPhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        videoUrl: '/videos/forest-stream.mp4',
        caption: 'Listen to the natural river frequency 🌊 Ambient water & rustling emerald pine trees.',
        soundTitle: 'Original Audio - Forest Stream Melody',
        createdAt: new Date().toISOString(),
      },
      {
        authorId: 'fg_urban_sprout',
        authorName: 'Mira Patel',
        authorPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        videoUrl: '/videos/monstera-leaves.mp4',
        caption: 'Rain droplets drumming on broad Monstera leaves 🌧️ Pure organic bliss.',
        soundTitle: 'Monsoon Rain Lo-fi Ambient',
        createdAt: new Date().toISOString(),
      },
    ];

    for (const reel of initialReels) {
      await createReel(reel);
    }
  } catch (error) {
    console.warn('Seed community warning:', error);
  }
}

// ==================== SAVED POSTS (BOOKMARKS) ====================

export async function checkIsPostSaved(userId: string, postId: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'saved', postId));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function toggleSavePost(
  userId: string,
  post: PostItem
): Promise<boolean> {
  const saveDocRef = doc(db, 'users', userId, 'saved', post.id);
  const postDocRef = doc(db, 'posts', post.id);

  try {
    const snap = await getDoc(saveDocRef);
    if (snap.exists()) {
      // Unsave
      await deleteDoc(saveDocRef);
      await updateDoc(postDocRef, { savesCount: increment(-1) }).catch(() => {});
      return false;
    } else {
      // Save
      await setDoc(saveDocRef, {
        postId: post.id,
        savedAt: new Date().toISOString(),
        authorId: post.authorId,
        authorName: post.authorName,
        imageUrl: post.imageUrl || '',
        content: post.content.slice(0, 150),
      });
      await updateDoc(postDocRef, { savesCount: increment(1) }).catch(() => {});
      return true;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/saved/${post.id}`);
  }
}

export function subscribeSavedPosts(
  userId: string,
  callback: (savedPosts: PostItem[]) => void
) {
  const savedRef = collection(db, 'users', userId, 'saved');
  const q = query(savedRef, orderBy('savedAt', 'desc'), limit(50));

  return onSnapshot(
    q,
    async (snapshot) => {
      const postIds = snapshot.docs.map((d) => d.id);
      if (postIds.length === 0) {
        callback([]);
        return;
      }

      const fetchedList: PostItem[] = [];
      for (const id of postIds) {
        try {
          const postSnap = await getDoc(doc(db, 'posts', id));
          if (postSnap.exists()) {
            fetchedList.push({ id: postSnap.id, ...(postSnap.data() as Omit<PostItem, 'id'>), isSavedByMe: true });
          }
        } catch {
          // ignore deleted post
        }
      }
      callback(fetchedList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/saved`);
    }
  );
}

// ==================== STORY VIEWS ====================

export async function recordStoryView(storyId: string, viewerId: string) {
  try {
    const viewRef = doc(db, 'stories', storyId, 'views', viewerId);
    await setDoc(viewRef, {
      viewerId,
      viewedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'stories', storyId), {
      viewsCount: increment(1),
    }).catch(() => {});
  } catch {
    // Non-blocking view tracking
  }
}

// ==================== LOVE & COUPLE CONNECT ====================

/**
 * Subscribes to the active or pending couple connection for the current user.
 */
export function subscribeUserCouple(
  userId: string,
  callback: (couple: CoupleItem | null) => void,
  onError?: (err: Error) => void
) {
  const couplesRef = collection(db, 'couples');
  const q = query(couplesRef, where('participants', 'array-contains', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }

      const couples = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CoupleItem, 'id'>),
      }));

      // Prioritize active connected couple, then pending couple request
      const active = couples.find((c) => c.status === 'connected');
      if (active) {
        callback(active);
        return;
      }

      const pending = couples.find((c) => c.status === 'pending');
      if (pending) {
        callback(pending);
        return;
      }

      callback(null);
    },
    (error) => {
      console.warn('[FG TIME] subscribeUserCouple warning:', error);
      if (onError) onError(error instanceof Error ? error : new Error(String(error)));
      else callback(null);
    }
  );
}

/**
 * Sends a mutual-consent couple invitation to another user.
 */
export async function sendCoupleInvitation(
  fromUser: UserProfile,
  toUser: UserProfile,
  anniversaryDate?: string,
  invitationNote?: string,
  partnerNickname?: string
): Promise<string> {
  const couplesRef = collection(db, 'couples');
  const newCoupleDoc = doc(couplesRef);

  const coupleData: any = {
    id: newCoupleDoc.id,
    user1Id: fromUser.id,
    user2Id: toUser.id,
    participants: [fromUser.id, toUser.id],
    requestedBy: fromUser.id,
    requestedTo: toUser.id,
    status: 'pending',
    partner1Name: fromUser.displayName,
    partner2Name: toUser.displayName,
    partner1Username: fromUser.username,
    partner2Username: toUser.username,
    partner1Avatar: fromUser.photoURL || '',
    partner2Avatar: toUser.photoURL || '',
    partner1Nickname: partnerNickname || fromUser.displayName,
    partner2Nickname: toUser.displayName,
    anniversaryDate: anniversaryDate || new Date().toISOString().split('T')[0],
    invitationNote: invitationNote || `I'd love to share our FG TIME journey together 🌿💖`,
    loveNotes: [
      {
        id: `note-${Date.now()}`,
        senderId: fromUser.id,
        senderName: fromUser.displayName,
        senderPhoto: fromUser.photoURL || '',
        text: invitationNote || `Connected our botanical hearts on FG TIME! 🌸`,
        reaction: '💖',
        createdAt: new Date().toISOString(),
      },
    ],
    customMilestones: [
      {
        id: `m-1`,
        title: 'The Day We Sprouted 🌿',
        date: anniversaryDate || new Date().toISOString().split('T')[0],
        icon: '🌱',
        description: 'First day blooming together on FG TIME.',
        isCustom: false,
      },
    ],
    coupleTheme: 'botanical-rose',
    isPublicBadge: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(newCoupleDoc, coupleData);

    // Send direct in-app notification to the invited partner
    const notifRef = collection(db, 'users', toUser.id, 'notifications');
    await addDoc(notifRef, {
      userId: toUser.id,
      senderId: fromUser.id,
      senderName: fromUser.displayName,
      senderPhoto: fromUser.photoURL || '',
      type: 'couple_request',
      targetId: newCoupleDoc.id,
      note: invitationNote || '',
      anniversaryDate: anniversaryDate || '',
      read: false,
      createdAt: new Date().toISOString(),
    });

    return newCoupleDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'couples');
    throw error;
  }
}

/**
 * Responds to a pending couple invitation (Accept or Decline).
 */
export async function respondToCoupleInvitation(
  couple: CoupleItem,
  accept: boolean,
  currentUser: UserProfile
): Promise<void> {
  const coupleRef = doc(db, 'couples', couple.id);

  try {
    if (accept) {
      await updateDoc(coupleRef, {
        status: 'connected',
        updatedAt: new Date().toISOString(),
      });

      // Update both user profiles with the verified couple status
      const isUser1 = currentUser.id === couple.user1Id;
      const partnerId = isUser1 ? couple.user2Id : couple.user1Id;
      const partnerName = isUser1 ? couple.partner2Name : couple.partner1Name;
      const partnerUsername = isUser1 ? couple.partner2Username : couple.partner1Username;
      const partnerAvatar = isUser1 ? couple.partner2Avatar : couple.partner1Avatar;

      // Update current user's profile
      await updateDoc(doc(db, 'users', currentUser.id), {
        coupleId: couple.id,
        partnerId,
        partnerDisplayName: partnerName,
        partnerUsername,
        partnerAvatar,
        coupleStatus: 'connected',
        anniversaryDate: couple.anniversaryDate,
      }).catch((err) => console.warn('Could not update user couple status:', err));

      // Update partner's profile
      await updateDoc(doc(db, 'users', partnerId), {
        coupleId: couple.id,
        partnerId: currentUser.id,
        partnerDisplayName: currentUser.displayName,
        partnerUsername: currentUser.username,
        partnerAvatar: currentUser.photoURL || '',
        coupleStatus: 'connected',
        anniversaryDate: couple.anniversaryDate,
      }).catch((err) => console.warn('Could not update partner couple status:', err));

      // Notify the requester that proposal was accepted
      const notifRef = collection(db, 'users', couple.requestedBy, 'notifications');
      await addDoc(notifRef, {
        userId: couple.requestedBy,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL || '',
        type: 'couple_accepted',
        targetId: couple.id,
        read: false,
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    } else {
      await updateDoc(coupleRef, {
        status: 'rejected',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `couples/${couple.id}`);
    throw error;
  }
}

/**
 * Disconnects / unlinks an active couple space with mutual safety.
 */
export async function disconnectCouple(
  coupleId: string,
  user1Id: string,
  user2Id: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'couples', coupleId), {
      status: 'disconnected',
      updatedAt: new Date().toISOString(),
    });

    // Clear couple attributes from both user profiles
    await updateDoc(doc(db, 'users', user1Id), {
      coupleId: null,
      partnerId: null,
      partnerDisplayName: null,
      partnerUsername: null,
      partnerAvatar: null,
      coupleStatus: null,
    }).catch(() => {});

    await updateDoc(doc(db, 'users', user2Id), {
      coupleId: null,
      partnerId: null,
      partnerDisplayName: null,
      partnerUsername: null,
      partnerAvatar: null,
      coupleStatus: null,
    }).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `couples/${coupleId}`);
    throw error;
  }
}

/**
 * Updates couple metadata (anniversary date, theme, public badge toggle, nicknames).
 */
export async function updateCoupleDetails(
  coupleId: string,
  updates: Partial<CoupleItem>
): Promise<void> {
  try {
    const coupleRef = doc(db, 'couples', coupleId);
    await updateDoc(coupleRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `couples/${coupleId}`);
    throw error;
  }
}

/**
 * Appends a daily love note or sweet whisper to the couple board.
 */
export async function addDailyLoveNote(
  coupleId: string,
  note: LoveNoteItem
): Promise<void> {
  try {
    const coupleRef = doc(db, 'couples', coupleId);
    await updateDoc(coupleRef, {
      loveNotes: arrayUnion(note),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `couples/${coupleId}/loveNotes`);
    throw error;
  }
}

/**
 * Adds a custom relationship milestone.
 */
export async function addRelationshipMilestone(
  coupleId: string,
  milestone: RelationshipMilestone
): Promise<void> {
  try {
    const coupleRef = doc(db, 'couples', coupleId);
    await updateDoc(coupleRef, {
      customMilestones: arrayUnion(milestone),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `couples/${coupleId}/milestones`);
    throw error;
  }
}

// ==================== PRIVATE LOVE MEMORIES ALBUM ====================

/**
 * Subscribes to the private memories album for a couple.
 */
export function subscribeCoupleMemories(
  coupleId: string,
  callback: (memories: LoveMemoryItem[]) => void
) {
  const memoriesRef = collection(db, 'couples', coupleId, 'memories');
  const q = query(memoriesRef, orderBy('createdAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const memories = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<LoveMemoryItem, 'id'>),
      }));
      callback(memories);
    },
    (error) => {
      console.warn('[FG TIME] subscribeCoupleMemories warning:', error);
      callback([]);
    }
  );
}

/**
 * Adds a private photo memory to the couple's shared scrapbook.
 */
export async function addCoupleMemory(
  coupleId: string,
  memory: Omit<LoveMemoryItem, 'id' | 'createdAt'>
): Promise<string> {
  const memoriesRef = collection(db, 'couples', coupleId, 'memories');
  const memoryDocRef = doc(memoriesRef);

  const fullMemory: LoveMemoryItem = {
    ...memory,
    id: memoryDocRef.id,
    coupleId,
    likes: [],
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(memoryDocRef, fullMemory);
    return memoryDocRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `couples/${coupleId}/memories`);
    throw error;
  }
}

/**
 * Deletes a memory from the private couple scrapbook.
 */
export async function deleteCoupleMemory(
  coupleId: string,
  memoryId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'couples', coupleId, 'memories', memoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `couples/${coupleId}/memories/${memoryId}`);
    throw error;
  }
}

/**
 * Toggles like / heart reaction on a shared love memory.
 */
export async function toggleMemoryLoveReaction(
  coupleId: string,
  memoryId: string,
  userId: string,
  hasLiked: boolean
): Promise<void> {
  try {
    const memoryRef = doc(db, 'couples', coupleId, 'memories', memoryId);
    if (hasLiked) {
      await updateDoc(memoryRef, { likes: arrayRemove(userId) });
    } else {
      await updateDoc(memoryRef, { likes: arrayUnion(userId) });
    }
  } catch (error) {
    console.warn('Could not toggle memory reaction:', error);
  }
}


