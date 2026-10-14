export interface UserSettings {
  // Privacy & Safety
  isPrivate: boolean;
  whoCanMessage: 'everyone' | 'following' | 'nobody';
  whoCanComment: 'everyone' | 'following';
  whoCanMention: 'everyone' | 'following' | 'nobody';
  readReceipts: boolean;
  typingIndicators: boolean;
  onlineVisibility: 'everyone' | 'following' | 'nobody';
  doNotDisturb: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;

  // Notifications
  notifLikes: boolean;
  notifComments: boolean;
  notifFollows: boolean;
  notifMessages: boolean;
  notifMentions: boolean;
  notifSound: boolean;
  pushEnabled: boolean;

  // Media & Playback
  autoplay: 'always' | 'wifi' | 'never';
  defaultMuted: boolean;
  dataSaver: boolean;
  uploadQuality: 'standard' | 'high';
  reduceMotion: boolean;

  // Appearance & Language
  theme: 'light' | 'dark' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  language: 'en' | 'hi' | 'es';
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  isPrivate: false,
  whoCanMessage: 'everyone',
  whoCanComment: 'everyone',
  whoCanMention: 'everyone',
  readReceipts: true,
  typingIndicators: true,
  onlineVisibility: 'everyone',
  doNotDisturb: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  notifLikes: true,
  notifComments: true,
  notifFollows: true,
  notifMessages: true,
  notifMentions: true,
  notifSound: true,
  pushEnabled: false,
  autoplay: 'always',
  defaultMuted: true,
  dataSaver: false,
  uploadQuality: 'high',
  reduceMotion: false,
  theme: 'system',
  fontSize: 'md',
  language: 'en',
};

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  email: string;
  phone?: string;
  photoURL: string;
  bio: string;
  fgTimeId?: string;
  website?: string;
  bannerUrl?: string;
  leafBadge?: string;
  interests?: string[];
  isPrivate?: boolean;
  role?: 'admin' | 'user';
  isOnline?: boolean;
  lastSeen?: string;
  settings?: Partial<UserSettings>;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  createdAt: string;
  blockedUsers?: string[];
  coupleId?: string | null;
  partnerId?: string | null;
  partnerUsername?: string | null;
  partnerDisplayName?: string | null;
  partnerAvatar?: string | null;
  partnerNickname?: string | null;
  coupleStatus?: 'connected' | 'pending';
  anniversaryDate?: string | null;
  isCouplePublic?: boolean;
}

export interface PostMusic {
  title: string;
  artist: string;
  audioUrl?: string;
}

export interface PostItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorPhoto: string;
  content: string;
  imageUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  tags?: string[];
  mentions?: string[];
  music?: PostMusic;
  location?: string;
  category?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount?: number;
  createdAt: string;
  isLikedByMe?: boolean;
  isSavedByMe?: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: string;
  replyToId?: string;
  replyToUsername?: string;
}

export interface StoryItem {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: number;
  viewsCount?: number;
  viewers?: string[];
}

export interface ReelItem {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  videoUrl: string;
  caption: string;
  soundTitle: string;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  isLikedByMe?: boolean;
  isSavedByMe?: boolean;
}

export interface ConversationItem {
  id: string;
  isGroup?: boolean;
  name?: string;
  photoURL?: string;
  participants: string[];
  participantProfiles?: Record<string, { displayName: string; username: string; photoURL: string }>;
  adminIds?: string[];
  creatorId?: string;
  adminsOnlySettings?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  lastSenderId?: string;
  updatedAt: string;
  unreadCount?: number;
  readBy?: Record<string, string>;
  systemAuditLog?: Array<{
    id: string;
    text: string;
    createdAt: string;
  }>;
  otherUser?: UserProfile;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  mediaType?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'system';
  createdAt: string;
  readBy?: string[];
}

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration?: number;
  category: string;
  isOriginal?: boolean;
  creatorId?: string;
  creatorName?: string;
  creatorPhoto?: string;
  usageCount?: number;
  createdAt: string;
}

export interface CallSession {
  id: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName?: string;
  receiverPhoto?: string;
  type: 'voice' | 'video';
  status: 'calling' | 'accepted' | 'declined' | 'ended' | 'missed';
  offer?: any;
  answer?: any;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'follow_request' | 'couple_request' | 'couple_accepted';
  targetId: string;
  read: boolean;
  createdAt: string;
  note?: string;
  anniversaryDate?: string;
}

export interface LoveNoteItem {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  reaction?: string;
  createdAt: string;
}

export interface RelationshipMilestone {
  id: string;
  title: string;
  date: string;
  icon?: string;
  description?: string;
  isCustom?: boolean;
}

export interface CoupleItem {
  id: string;
  user1Id: string;
  user2Id: string;
  requestedBy: string;
  requestedTo: string;
  status: 'pending' | 'connected' | 'rejected' | 'disconnected';
  partner1Name: string;
  partner2Name: string;
  partner1Username: string;
  partner2Username: string;
  partner1Avatar?: string;
  partner2Avatar?: string;
  partner1Nickname?: string;
  partner2Nickname?: string;
  anniversaryDate?: string; // YYYY-MM-DD
  invitationNote?: string;
  loveNotes?: LoveNoteItem[];
  customMilestones?: RelationshipMilestone[];
  coupleTheme?: 'botanical-rose' | 'amethyst-glow' | 'emerald-passion';
  isPublicBadge?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoveMemoryItem {
  id: string;
  coupleId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  imageUrl: string;
  title: string;
  caption?: string;
  memoryDate: string; // YYYY-MM-DD
  mood?: 'romantic' | 'adventure' | 'peaceful' | 'celebration' | 'milestone';
  likes?: string[];
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'post' | 'user' | 'comment';
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface SavedPostRecord {
  id: string;
  postId: string;
  userId: string;
  savedAt: string;
  post?: PostItem;
}

