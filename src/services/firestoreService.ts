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
} from '../types';

// ==================== POSTS ====================

export function subscribePosts(
  callback: (posts: PostItem[]) => void,
  categoryFilter?: string
) {
  const postsRef = collection(db, 'posts');
  let q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));
  if (categoryFilter && categoryFilter !== 'all') {
    q = query(postsRef, where('category', '==', categoryFilter), orderBy('createdAt', 'desc'), limit(50));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const posts: PostItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PostItem, 'id'>),
      }));
      callback(posts);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
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
  const q = query(convRef, where('participants', 'array-contains', userId), orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: ConversationItem[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ConversationItem, 'id'>),
      }));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conversations');
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

export async function seedCommunityDataIfEmpty(currentUserProfile?: UserProfile | null) {
  try {
    const existingSnap = await getDocs(query(collection(db, 'posts'), limit(1)));
    if (!existingSnap.empty) {
      return; // already has content!
    }

    const defaultAuthor = currentUserProfile || {
      id: 'fg_botanist_system',
      displayName: 'Aria Verdant',
      username: 'aria_leaf',
      photoURL: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    };

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

