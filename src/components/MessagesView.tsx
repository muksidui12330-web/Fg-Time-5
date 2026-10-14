import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  MessageCircle,
  Plus,
  Search,
  ArrowLeft,
  Image as ImageIcon,
  X,
  Users,
  Shield,
  ShieldAlert,
  UserCheck,
  UserPlus,
  MoreVertical,
  Trash2,
  LogOut,
  Info,
  Check,
  CheckCheck,
  Smile,
  AlertTriangle,
  Lock,
  Flag,
  UserX,
  Sparkles,
  Camera,
  RefreshCw,
  Heart,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { ConversationItem, MessageItem, UserProfile } from '../types';
import {
  subscribeUserConversations,
  subscribeMessages,
  sendMessage,
  deleteMessage,
  markConversationAsRead,
  getOrCreateConversation,
  createGroupConversation,
  updateGroupDetails,
  addGroupMembers,
  removeGroupMember,
  promoteGroupAdmin,
  demoteGroupAdmin,
  leaveGroup,
  deleteGroup,
  getUserProfile,
  searchUsers,
  checkCanMessage,
  checkIsFollowing,
  toggleFollowUser,
  blockUser,
} from '../services/firestoreService';
import { ReportModal } from './ReportModal';
import { getUserPresenceStatus } from '../services/settingsService';

interface MessagesViewProps {
  initialTargetUserId?: string | null;
  onOpenUserProfile?: (userId: string) => void;
  onOpenCoupleSpace?: () => void;
}

const BOTANICAL_ICONS = [
  'https://images.unsplash.com/photo-1545241047-6083a3684587?w=150', // Monstera
  'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=150', // Fern
  'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=150', // Succulent
  'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=150', // Palm
  'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=150', // Flowers
];

const QUICK_EMOJIS = ['🌿', '🍃', '🌱', '🪴', '❤️', '👍', '🔥', '🌸'];

const ROMANTIC_STICKERS = [
  { label: 'Sweet Love', emoji: '💖', text: 'Sending you so much sweet love 💖' },
  { label: 'Rose Petals', emoji: '🌹', text: 'A shower of fresh rose petals for you 🌹✨' },
  { label: 'Soulmate Hug', emoji: '🌸', text: 'Sending you a warm soulmate hug 🌸🤗' },
  { label: 'Thinking of You', emoji: '💌', text: 'Just wanted to say I am thinking of you 💌' },
  { label: 'Botanical Heart', emoji: '🌿', text: 'You make my heart bloom every day 🌿💚' },
  { label: 'Forever & Always', emoji: '💍', text: 'Forever & always by your side 💍' },
  { label: 'Sweet Cuddles', emoji: '☕', text: 'Warm coffee and sweet cuddles ☕💕' },
  { label: 'Pure Magic', emoji: '✨', text: 'You bring pure magic to my life ✨' },
];

const ROMANTIC_NUDGES = [
  'Thinking of you 🌸',
  'Good morning my love ☀️💖',
  'You make my heart bloom 🌿✨',
  'Can’t wait to see you 💕',
];

export const MessagesView: React.FC<MessagesViewProps> = ({
  initialTargetUserId,
  onOpenUserProfile,
  onOpenCoupleSpace,
}) => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();

  // Conversations & Chat State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messageText, setMessageText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string>('');
  const [otherUserMap, setOtherUserMap] = useState<Record<string, UserProfile>>({});
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'direct' | 'groups'>('all');
  const [inboxSearch, setInboxSearch] = useState('');
  const [showRomanticStickers, setShowRomanticStickers] = useState(false);

  // Modals state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupInfoModalOpen, setIsGroupInfoModalOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [reportingUserId, setReportingUserId] = useState<string | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);

  // Follow-to-Chat Gate state
  const [followRequiredUser, setFollowRequiredUser] = useState<UserProfile | null>(null);
  const [gateMessage, setGateMessage] = useState<string>('');
  const [isFollowingGateUser, setIsFollowingGateUser] = useState(false);

  // Group creation state
  const [groupName, setGroupName] = useState('');
  const [selectedGroupPhoto, setSelectedGroupPhoto] = useState(BOTANICAL_ICONS[0]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<UserProfile[]>([]);
  const [groupUserSearchQuery, setGroupUserSearchQuery] = useState('');
  const [groupCandidateUsers, setGroupCandidateUsers] = useState<UserProfile[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Add members state
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberCandidates, setNewMemberCandidates] = useState<UserProfile[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<UserProfile[]>([]);

  // Direct chat user search
  const [directSearchQuery, setDirectSearchQuery] = useState('');
  const [directCandidateUsers, setDirectCandidateUsers] = useState<UserProfile[]>([]);
  const [isSearchingDirect, setIsSearchingDirect] = useState(false);

  // Send status & errors
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const groupFileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to all conversations the user is in
  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeUserConversations(currentUser.uid, async (convs) => {
      setConversations(convs);

      // Fetch profiles for direct chat participants or group members
      const neededIds = new Set<string>();
      convs.forEach((c) => {
        c.participants.forEach((pId) => {
          if (pId !== currentUser.uid && !otherUserMap[pId]) {
            neededIds.add(pId);
          }
        });
      });

      for (const id of Array.from(neededIds)) {
        try {
          const prof = await getUserProfile(id);
          if (prof) {
            setOtherUserMap((prev) => ({ ...prev, [id]: prof }));
          }
        } catch {
          // ignore profile fetch error
        }
      }
    });

    return () => unsub();
  }, [currentUser]);

  // Handle incoming initialTargetUserId from profile
  useEffect(() => {
    if (currentUser && initialTargetUserId && initialTargetUserId !== currentUser.uid) {
      handleInitiateChatWithUser(initialTargetUserId);
    }
  }, [initialTargetUserId, currentUser]);

  // Subscribe to active conversation messages & mark as read
  useEffect(() => {
    if (!selectedConversationId || !currentUser) {
      setMessages([]);
      return;
    }

    markConversationAsRead(selectedConversationId, currentUser.uid);

    const unsub = subscribeMessages(selectedConversationId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    });

    return () => unsub();
  }, [selectedConversationId, currentUser]);

  // Initiating chat with user with Follow-to-Chat policy enforcement
  const handleInitiateChatWithUser = async (targetUserId: string) => {
    if (!currentUser || !userProfile) return;
    try {
      const targetUser = otherUserMap[targetUserId] || (await getUserProfile(targetUserId));
      if (!targetUser) return;
      setOtherUserMap((prev) => ({ ...prev, [targetUserId]: targetUser }));

      // Check permissions: Follow-to-Chat & Block validation
      const check = await checkCanMessage(currentUser.uid, targetUser, userProfile);
      if (!check.allowed) {
        if (check.reason === 'follow_required' || check.reason === 'private_account_mutual_required') {
          setFollowRequiredUser(targetUser);
          setGateMessage(check.message || 'Follow required to message this gardener.');
          return;
        } else {
          alert(check.message || 'Unable to open conversation with this user.');
          return;
        }
      }

      // If allowed, create or open conversation
      const convId = await getOrCreateConversation(
        currentUser.uid,
        targetUser.id,
        userProfile,
        targetUser
      );
      setSelectedConversationId(convId);
      setIsNewChatModalOpen(false);
      setFollowRequiredUser(null);
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  const handleFollowAndOpenChat = async () => {
    if (!currentUser || !userProfile || !followRequiredUser) return;
    setIsFollowingGateUser(true);
    try {
      await toggleFollowUser(currentUser.uid, followRequiredUser.id, userProfile);
      const convId = await getOrCreateConversation(
        currentUser.uid,
        followRequiredUser.id,
        userProfile,
        followRequiredUser
      );
      setSelectedConversationId(convId);
      setFollowRequiredUser(null);
      setIsNewChatModalOpen(false);
    } catch (err) {
      console.error('Error following user for chat:', err);
    } finally {
      setIsFollowingGateUser(false);
    }
  };

  // Direct User Search in modal
  const handleSearchDirectUsers = async (queryText: string) => {
    setDirectSearchQuery(queryText);
    if (!queryText.trim()) {
      setDirectCandidateUsers([]);
      return;
    }
    setIsSearchingDirect(true);
    try {
      const users = await searchUsers(queryText.trim());
      if (Array.isArray(users)) {
        setDirectCandidateUsers(users.filter((u) => u.id !== currentUser?.uid));
      }
    } catch (err) {
      console.warn('Search users failed:', err);
    } finally {
      setIsSearchingDirect(false);
    }
  };

  // Group candidate search in modal
  const handleSearchGroupCandidates = async (queryText: string) => {
    setGroupUserSearchQuery(queryText);
    try {
      const users = await searchUsers(queryText.trim());
      if (Array.isArray(users)) {
        setGroupCandidateUsers(
          users.filter((u) => u.id !== currentUser?.uid)
        );
      }
    } catch (err) {
      console.warn('Group search users failed:', err);
    }
  };

  // Attach image from device gallery
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be smaller than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Group custom photo upload
  const handleGroupPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedGroupPhoto(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile || !selectedConversationId) return;
    if (!messageText.trim() && !attachedImage) return;

    const textToSend = messageText.trim();
    const imageToSend = attachedImage;

    setMessageText('');
    setAttachedImage('');
    setSendError(null);
    setIsSending(true);

    try {
      await sendMessage(
        selectedConversationId,
        userProfile,
        textToSend,
        imageToSend || undefined,
        imageToSend ? 'image' : 'text'
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSendError('Message could not be delivered. Please retry.');
    } finally {
      setIsSending(false);
    }
  };

  // Quick emoji insertion
  const handleAddEmoji = (emoji: string) => {
    setMessageText((prev) => prev + emoji);
  };

  // Romantic sticker & whisper sender
  const handleSendRomanticSticker = async (stickerText: string) => {
    if (!selectedConversationId || !currentUser || !userProfile) return;
    try {
      confetti({
        particleCount: 50,
        spread: 75,
        origin: { y: 0.7 },
        colors: ['#00C853', '#FF6584', '#8B5CF6', '#FDA4AF'],
      });
    } catch {}

    try {
      await sendMessage(
        selectedConversationId,
        userProfile,
        stickerText
      );
    } catch (err) {
      console.warn('Could not send sticker:', err);
    }
  };

  // Delete message (sender or group admin)
  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedConversationId) return;
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await deleteMessage(selectedConversationId, msgId);
    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Unable to delete message.');
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile || !groupName.trim()) return;
    if (selectedGroupMembers.length === 0) {
      alert('Please select at least 1 member for the group.');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const convId = await createGroupConversation(
        userProfile,
        groupName.trim(),
        selectedGroupPhoto,
        selectedGroupMembers
      );
      setSelectedConversationId(convId);
      setIsCreateGroupModalOpen(false);
      setGroupName('');
      setSelectedGroupMembers([]);
    } catch (err) {
      console.error('Error creating group:', err);
      alert('Failed to create group. Please check your connection.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = async (conv: ConversationItem) => {
    if (!currentUser || !userProfile) return;
    if (!window.confirm(`Are you sure you want to leave "${conv.name}"?`)) return;

    try {
      await leaveGroup(conv.id, currentUser.uid, userProfile.displayName);
      setSelectedConversationId(null);
      setIsGroupInfoModalOpen(false);
    } catch (err) {
      console.error('Error leaving group:', err);
      alert('Unable to leave group.');
    }
  };

  // Delete Group (Admin only)
  const handleDeleteGroup = async (conv: ConversationItem) => {
    if (!window.confirm(`Permanently delete group "${conv.name}" for all members? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteGroup(conv.id);
      setSelectedConversationId(null);
      setIsGroupInfoModalOpen(false);
    } catch (err) {
      console.error('Error deleting group:', err);
      alert('Unable to delete group.');
    }
  };

  // Block active user
  const handleBlockActiveUser = async (targetId: string) => {
    if (!currentUser || !userProfile) return;
    if (!window.confirm('Block this gardener? They will no longer be able to message you or view your posts.')) {
      return;
    }
    try {
      await blockUser(currentUser.uid, targetId, userProfile.blockedUsers || []);
      setSelectedConversationId(null);
      setIsChatMenuOpen(false);
      alert('Gardener blocked.');
    } catch (err) {
      console.error('Error blocking user:', err);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (activeTabFilter === 'direct' && c.isGroup) return false;
    if (activeTabFilter === 'groups' && !c.isGroup) return false;

    if (inboxSearch.trim()) {
      const q = inboxSearch.toLowerCase();
      if (c.isGroup) {
        return c.name?.toLowerCase().includes(q);
      } else {
        const otherId = c.participants.find((p) => p !== currentUser?.uid);
        const other = otherId ? otherUserMap[otherId] : null;
        return (
          other?.displayName.toLowerCase().includes(q) ||
          other?.username.toLowerCase().includes(q)
        );
      }
    }
    return true;
  });

  const selectedConv = conversations.find((c) => c.id === selectedConversationId);
  const activeOtherUserId = selectedConv?.participants.find((p) => p !== currentUser?.uid);
  const activeOtherProfile = activeOtherUserId ? otherUserMap[activeOtherUserId] : null;
  const isSelectedConvGroup = selectedConv?.isGroup;
  const isMeAdminOfSelectedGroup = selectedConv?.adminIds?.includes(currentUser?.uid || '') || false;
  const isMeCreatorOfSelectedGroup = selectedConv?.creatorId === currentUser?.uid;

  if (!currentUser) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#12372A]/70 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800 max-w-md mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center mx-auto mb-3">
          <MessageCircle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[#12372A] dark:text-white mb-2">
          FG TIME Whispers & Groups
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-300 mb-5 leading-relaxed">
          Sign in to connect with other gardeners, join botanical circles, and exchange real-time direct whispers.
        </p>
        <button
          onClick={signInWithGoogle}
          className="px-6 py-2.5 rounded-2xl bg-[#00C853] hover:bg-[#00A344] text-white font-bold text-xs shadow-md shadow-[#00C853]/20 transition-all cursor-pointer"
        >
          Sign in to Chat
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-[82vh] min-h-[580px] bg-white dark:bg-[#12372A]/70 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800 shadow-sm flex overflow-hidden">
      {/* ================= LEFT INBOX PANE ================= */}
      <div
        className={`w-full md:w-80 shrink-0 border-r border-[#00C853]/20 dark:border-emerald-800/40 flex flex-col ${
          selectedConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header with Title and Action Buttons */}
        <div className="p-4 border-b border-[#00C853]/20 dark:border-emerald-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#12372A] dark:text-white">
              Inbox
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] font-bold">
              {conversations.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsCreateGroupModalOpen(true);
                handleSearchGroupCandidates('');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#00C853]/10 hover:bg-[#00C853]/20 text-[#00C853] font-bold text-xs transition-colors cursor-pointer"
              title="Create Group Circle"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Group</span>
            </button>
            <button
              onClick={() => {
                setIsNewChatModalOpen(true);
                handleSearchDirectUsers('');
              }}
              className="p-1.5 rounded-full bg-[#00C853] hover:bg-[#00A344] text-white transition-colors cursor-pointer"
              title="New Direct Message"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-stone-100 dark:border-emerald-900/30">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search whispers & groups..."
              value={inboxSearch}
              onChange={(e) => setInboxSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C853]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setActiveTabFilter('all')}
              className={`flex-1 py-1 text-[11px] rounded-lg font-semibold transition-colors ${
                activeTabFilter === 'all'
                  ? 'bg-[#00C853] text-white'
                  : 'bg-stone-100 dark:bg-emerald-950/60 text-stone-600 dark:text-stone-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTabFilter('direct')}
              className={`flex-1 py-1 text-[11px] rounded-lg font-semibold transition-colors ${
                activeTabFilter === 'direct'
                  ? 'bg-[#00C853] text-white'
                  : 'bg-stone-100 dark:bg-emerald-950/60 text-stone-600 dark:text-stone-300'
              }`}
            >
              Direct
            </button>
            <button
              onClick={() => setActiveTabFilter('groups')}
              className={`flex-1 py-1 text-[11px] rounded-lg font-semibold transition-colors ${
                activeTabFilter === 'groups'
                  ? 'bg-[#00C853] text-white'
                  : 'bg-stone-100 dark:bg-emerald-950/60 text-stone-600 dark:text-stone-300'
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isGroup = conv.isGroup;
              const otherId = conv.participants.find((p) => p !== currentUser.uid);
              const other = otherId ? otherUserMap[otherId] : null;
              const isSelected = conv.id === selectedConversationId;
              const presenceInfo = !isGroup && other ? getUserPresenceStatus(other, currentUser.uid) : null;

              // Check if unread
              const lastRead = conv.readBy?.[currentUser.uid];
              const isUnread =
                conv.lastSenderId &&
                conv.lastSenderId !== currentUser.uid &&
                (!lastRead || (conv.lastMessageTime && new Date(conv.lastMessageTime) > new Date(lastRead)));

              const title = isGroup ? conv.name : other?.displayName || 'Gardener';
              const avatar = isGroup
                ? conv.photoURL || BOTANICAL_ICONS[0]
                : other?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`p-3 flex items-center gap-3 cursor-pointer border-b border-emerald-50 dark:border-emerald-900/20 transition-colors ${
                    isSelected
                      ? 'bg-[#00C853]/15 dark:bg-emerald-900/40'
                      : 'hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={avatar}
                      alt={title || 'Chat'}
                      className={`w-11 h-11 rounded-full object-cover ring-2 ${
                        isGroup ? 'ring-emerald-500 rounded-2xl' : 'ring-[#00C853]/40'
                      }`}
                    />
                    {isGroup && (
                      <span className="absolute -bottom-1 -right-1 bg-[#12372A] text-white p-0.5 rounded-full text-[9px] ring-1 ring-white">
                        <Users className="w-2.5 h-2.5 text-[#00C853]" />
                      </span>
                    )}
                    {!isGroup && presenceInfo?.showDot && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00C853] rounded-full ring-2 ring-white dark:ring-[#12372A]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-bold truncate ${isUnread ? 'text-[#00C853]' : 'text-[#12372A] dark:text-white'}`}>
                        {title}
                      </p>
                      <span className="text-[10px] text-stone-400">
                        {conv.lastMessageTime
                          ? new Date(conv.lastMessageTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-xs truncate ${isUnread ? 'font-bold text-stone-800 dark:text-stone-100' : 'text-stone-500 dark:text-stone-300'}`}>
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#00C853] shrink-0 ml-1.5" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
              <MessageCircle className="w-8 h-8 text-stone-300 dark:text-emerald-800" />
              <span>No conversations match your search.</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT CHAT THREAD PANE ================= */}
      <div
        className={`flex-1 flex flex-col bg-[#EAF8EF]/30 dark:bg-[#101512]/60 ${
          selectedConversationId ? 'flex' : 'hidden md:flex'
        }`}
      >
        {selectedConversationId && selectedConv ? (
          <>
            {/* Chat Thread Header */}
            <div className="p-3.5 px-4 bg-white/95 dark:bg-[#12372A]/90 border-b border-[#00C853]/20 dark:border-emerald-800/40 flex items-center justify-between relative">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedConversationId(null)}
                  className="md:hidden p-1 rounded-full text-stone-500 hover:text-stone-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <img
                  src={
                    isSelectedConvGroup
                      ? selectedConv.photoURL || BOTANICAL_ICONS[0]
                      : activeOtherProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                  }
                  alt="Avatar"
                  onClick={() => {
                    if (isSelectedConvGroup) {
                      setIsGroupInfoModalOpen(true);
                    } else if (activeOtherUserId && onOpenUserProfile) {
                      onOpenUserProfile(activeOtherUserId);
                    }
                  }}
                  className={`w-9 h-9 object-cover ring-2 ring-[#00C853] cursor-pointer ${
                    isSelectedConvGroup ? 'rounded-xl' : 'rounded-full'
                  }`}
                />

                <div>
                  <div className="flex items-center gap-1.5">
                    <p
                      onClick={() => {
                        if (isSelectedConvGroup) {
                          setIsGroupInfoModalOpen(true);
                        } else if (activeOtherUserId && onOpenUserProfile) {
                          onOpenUserProfile(activeOtherUserId);
                        }
                      }}
                      className="text-xs font-bold text-[#12372A] dark:text-white leading-tight cursor-pointer hover:underline"
                    >
                      {isSelectedConvGroup
                        ? selectedConv.name
                        : activeOtherProfile?.displayName || 'Community Member'}
                    </p>
                    {isSelectedConvGroup && isMeAdminOfSelectedGroup && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-[#00C853] font-bold">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#00C853] flex items-center gap-1.5 flex-wrap">
                    {isSelectedConvGroup ? (
                      `${selectedConv.participants.length} botanical members`
                    ) : (
                      <>
                        <span>@{activeOtherProfile?.username || 'member'}</span>
                        <span className="text-stone-300 dark:text-stone-600">•</span>
                        <span className="font-mono bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-[#00C853]/30 text-[9px] font-bold">
                          {activeOtherProfile?.fgTimeId || (activeOtherUserId ? `FG-${activeOtherUserId.slice(0, 6).toUpperCase()}` : 'FG-ID')}
                        </span>
                        {activeOtherProfile && (() => {
                          const pInfo = getUserPresenceStatus(activeOtherProfile, currentUser?.uid);
                          return (
                            <>
                              <span className="text-stone-300 dark:text-stone-600">•</span>
                              <span className={`inline-flex items-center gap-1 font-bold ${pInfo.isOnline ? 'text-[#00C853]' : 'text-stone-400'}`}>
                                {pInfo.showDot && <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />}
                                <span>{pInfo.text}</span>
                              </span>
                            </>
                          );
                        })()}
                        {activeOtherProfile && activeOtherUserId && (userProfile?.partnerId === activeOtherUserId || (userProfile?.coupleId && activeOtherProfile.coupleId === userProfile.coupleId)) && (
                          <>
                            <span className="text-stone-300 dark:text-stone-600">•</span>
                            <button
                              type="button"
                              onClick={() => onOpenCoupleSpace && onOpenCoupleSpace()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-emerald-500/15 border border-pink-400/40 text-[9px] font-bold text-pink-600 dark:text-pink-300 hover:scale-105 transition-all shadow-sm cursor-pointer"
                              title="Open Private Couple Space"
                            >
                              <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500 animate-pulse" />
                              <span>Couple Partner 💕</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Chat Actions Menu */}
              <div className="flex items-center gap-2">
                {isSelectedConvGroup && (
                  <button
                    onClick={() => setIsGroupInfoModalOpen(true)}
                    className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-emerald-900 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                    title="Group Details & Members"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setIsChatMenuOpen(!isChatMenuOpen)}
                    className="p-1.5 rounded-full hover:bg-stone-100 dark:hover:bg-emerald-900 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isChatMenuOpen && (
                    <div className="absolute right-0 top-8 z-30 w-48 bg-white dark:bg-[#12372A] rounded-2xl shadow-xl border border-stone-200 dark:border-emerald-800 py-1.5 text-xs">
                      {isSelectedConvGroup ? (
                        <>
                          <button
                            onClick={() => {
                              setIsGroupInfoModalOpen(true);
                              setIsChatMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-emerald-900/40 flex items-center gap-2 text-stone-700 dark:text-stone-200"
                          >
                            <Users className="w-3.5 h-3.5" /> Group Settings & Members
                          </button>
                          <button
                            onClick={() => {
                              handleLeaveGroup(selectedConv);
                              setIsChatMenuOpen(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-emerald-900/40 flex items-center gap-2 text-amber-600 font-semibold"
                          >
                            <LogOut className="w-3.5 h-3.5" /> Leave Group
                          </button>
                          {isMeAdminOfSelectedGroup && (
                            <button
                              onClick={() => {
                                handleDeleteGroup(selectedConv);
                                setIsChatMenuOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 text-red-600 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Group
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {activeOtherUserId && onOpenUserProfile && (
                            <button
                              onClick={() => {
                                onOpenUserProfile(activeOtherUserId);
                                setIsChatMenuOpen(false);
                              }}
                              className="w-full text-left px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-emerald-900/40 flex items-center gap-2 text-stone-700 dark:text-stone-200"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> View Garden Profile
                            </button>
                          )}
                          {activeOtherUserId && (
                            <>
                              <button
                                onClick={() => {
                                  setReportingUserId(activeOtherUserId);
                                  setIsChatMenuOpen(false);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-stone-50 dark:hover:bg-emerald-900/40 flex items-center gap-2 text-amber-600"
                              >
                                <Flag className="w-3.5 h-3.5" /> Report Abusive Chat
                              </button>
                              <button
                                onClick={() => handleBlockActiveUser(activeOtherUserId)}
                                className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 text-red-600 font-semibold"
                              >
                                <UserX className="w-3.5 h-3.5" /> Block Gardener
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="text-center py-12 text-xs text-stone-400">
                  <Sparkles className="w-8 h-8 text-[#00C853] mx-auto mb-2 opacity-60" />
                  <p>Sprout the conversation! Send your first botanical whisper.</p>
                </div>
              )}

              {messages.map((m) => {
                const isSystem = m.mediaType === 'system';
                const isMe = m.senderId === currentUser.uid;
                const canDelete = isMe || isMeAdminOfSelectedGroup;

                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center my-1">
                      <div className="px-3.5 py-1 rounded-full bg-stone-200/60 dark:bg-emerald-950/60 text-[10px] text-stone-600 dark:text-stone-300 flex items-center gap-1.5 shadow-sm">
                        <span>{m.text}</span>
                        <span className="text-[8px] text-stone-400">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col group ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    {/* In group chats, display sender's name if not me */}
                    {isSelectedConvGroup && !isMe && (
                      <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 mb-0.5 ml-2">
                        {m.senderName}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 max-w-[85%] sm:max-w-[70%]">
                      {/* Delete button on hover */}
                      {canDelete && isMe && (
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition-opacity"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}

                      <div
                        className={`px-4 py-2.5 rounded-2xl text-xs ${
                          isMe
                            ? 'bg-gradient-to-r from-[#00C853] to-[#00A344] text-white rounded-br-none shadow-md shadow-[#00C853]/20'
                            : 'bg-white dark:bg-[#12372A] text-stone-800 dark:text-white rounded-bl-none border border-stone-200 dark:border-emerald-800 shadow-sm'
                        }`}
                      >
                        {/* Attached Image inside Bubble */}
                        {m.imageUrl && (
                          <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                            <img
                              src={m.imageUrl}
                              alt="Attachment"
                              onClick={() => setEnlargedImageUrl(m.imageUrl || null)}
                              className="max-h-60 w-auto rounded-xl object-cover hover:opacity-90 transition-opacity"
                            />
                          </div>
                        )}

                        {m.text && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
                      </div>

                      {canDelete && !isMe && (
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition-opacity"
                          title="Admin delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Timestamp & Read Receipt */}
                    <div className="flex items-center gap-1 text-[9px] text-stone-400 mt-0.5 px-1">
                      <span>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMe && (
                        <span>
                          {m.readBy && m.readBy.length > 1 ? (
                            <CheckCheck className="w-3 h-3 text-[#00C853] inline" />
                          ) : (
                            <Check className="w-3 h-3 text-stone-400 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Send Error Notice */}
            {sendError && (
              <div className="px-4 py-1.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-[11px] flex items-center justify-between border-t border-red-200">
                <span>{sendError}</span>
                <button
                  onClick={() => setSendError(null)}
                  className="font-bold underline text-[10px]"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Attached Photo Preview before sending */}
            {attachedImage && (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 flex items-center justify-between border-t border-emerald-200">
                <div className="flex items-center gap-2">
                  <img
                    src={attachedImage}
                    alt="Preview"
                    className="w-10 h-10 rounded-lg object-cover ring-1 ring-[#00C853]"
                  />
                  <span className="text-xs text-[#00C853] font-bold">
                    Photo ready to share
                  </span>
                </div>
                <button
                  onClick={() => setAttachedImage('')}
                  className="p-1 rounded-full text-stone-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Emoji Bar & Romantic Stickers Toggle */}
            <div className="px-3 py-1 bg-stone-50 dark:bg-[#101512] border-t border-stone-200 dark:border-emerald-900/40 flex items-center justify-between gap-1 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-stone-400 mr-1 font-semibold">React:</span>
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleAddEmoji(emoji)}
                    className="p-1 hover:bg-stone-200 dark:hover:bg-emerald-900 rounded text-sm transition-transform active:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Romantic Stickers & Reactions Toggle */}
              <button
                type="button"
                onClick={() => setShowRomanticStickers(!showRomanticStickers)}
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                  showRomanticStickers
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-500/30'
                    : 'bg-pink-500/10 text-pink-600 dark:text-pink-300 hover:bg-pink-500/20'
                }`}
                title="Romantic Stickers & Reactions"
              >
                <Heart className={`w-3 h-3 ${showRomanticStickers ? 'fill-white' : 'fill-pink-500 text-pink-500'}`} />
                <span>Love Stickers 💕</span>
              </button>
            </div>

            {/* Romantic Stickers Drawer */}
            {showRomanticStickers && (
              <div className="px-3 py-2 bg-gradient-to-r from-pink-50/90 via-purple-50/70 to-emerald-50/90 dark:from-pink-950/40 dark:via-purple-950/40 dark:to-emerald-950/40 border-t border-pink-200 dark:border-pink-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Tap to send love whisper:
                  </span>
                  <div className="flex items-center gap-1">
                    {ROMANTIC_NUDGES.slice(0, 2).map((nudge) => (
                      <button
                        key={nudge}
                        type="button"
                        onClick={() => handleSendRomanticSticker(nudge)}
                        className="px-2 py-0.5 rounded-full bg-white dark:bg-black/40 border border-pink-200 dark:border-pink-800 text-[9px] font-semibold text-stone-700 dark:text-stone-200 hover:bg-pink-100 transition-colors cursor-pointer truncate max-w-[120px]"
                      >
                        {nudge}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {ROMANTIC_STICKERS.map((st) => (
                    <button
                      key={st.label}
                      type="button"
                      onClick={() => handleSendRomanticSticker(st.text)}
                      className="p-1.5 rounded-xl bg-white dark:bg-[#12281E] border border-pink-100 dark:border-pink-900/50 hover:border-pink-400 dark:hover:border-pink-600 hover:scale-105 active:scale-95 transition-all text-center group cursor-pointer shadow-sm"
                      title={st.label}
                    >
                      <span className="text-xl block group-hover:scale-110 transition-transform">{st.emoji}</span>
                      <span className="text-[8px] font-bold text-stone-600 dark:text-stone-300 block truncate mt-0.5">
                        {st.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white dark:bg-[#12372A]/90 border-t border-[#00C853]/20 dark:border-emerald-800/40 flex items-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full text-stone-400 hover:text-[#00C853] hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
                title="Attach photo from device gallery"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <input
                type="text"
                placeholder={
                  isSelectedConvGroup
                    ? `Message ${selectedConv.name}...`
                    : 'Type a mindful whisper...'
                }
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs rounded-full border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              />

              <button
                type="submit"
                disabled={(!messageText.trim() && !attachedImage) || isSending}
                className="p-2.5 rounded-full bg-[#00C853] hover:bg-[#00A344] text-white disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-[#00C853]/20"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-stone-400">
            <div className="w-16 h-16 rounded-full bg-[#00C853]/10 text-[#00C853] flex items-center justify-center mb-3">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200">
              Your Whispers & Circles Inbox
            </h4>
            <p className="text-xs text-stone-400 max-w-xs mt-1 leading-relaxed">
              Select a conversation from the left, or tap + to start a direct whisper or create a botanical group circle.
            </p>
          </div>
        )}
      </div>

      {/* ================= FOLLOW-TO-CHAT PROMPT GATE MODAL ================= */}
      {followRequiredUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#00C853]/30 dark:border-emerald-800 text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center mb-3 ring-4 ring-[#00C853]/20">
              <UserPlus className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-[#12372A] dark:text-white mb-1">
              Follow to Start Whispering
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-300 mb-4 leading-relaxed">
              {gateMessage}
            </p>

            <div className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 flex items-center gap-3 mb-5">
              <img
                src={followRequiredUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={followRequiredUser.displayName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]"
              />
              <div className="text-left min-w-0 flex-1">
                <p className="text-xs font-bold text-stone-800 dark:text-white truncate">
                  {followRequiredUser.displayName}
                </p>
                <p className="text-[10px] text-stone-400 truncate">
                  @{followRequiredUser.username}
                </p>
              </div>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={() => setFollowRequiredUser(null)}
                className="flex-1 py-2.5 rounded-2xl border border-stone-200 dark:border-emerald-800 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFollowAndOpenChat}
                disabled={isFollowingGateUser}
                className="flex-1 py-2.5 rounded-2xl bg-[#00C853] hover:bg-[#00A344] text-white text-xs font-bold shadow-md shadow-[#00C853]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isFollowingGateUser ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow & Chat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= NEW CHAT MODAL ================= */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#12372A] dark:text-white flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-[#00C853]" />
                <span>New Direct Whisper</span>
              </h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search gardener name or @handle..."
                value={directSearchQuery}
                onChange={(e) => handleSearchDirectUsers(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5">
              {isSearchingDirect ? (
                <div className="text-center py-6 text-xs text-stone-400">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-[#00C853]" />
                  <span>Searching gardeners...</span>
                </div>
              ) : directCandidateUsers.length > 0 ? (
                directCandidateUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleInitiateChatWithUser(u.id)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-[#00C853]/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={u.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                          {u.displayName}
                        </p>
                        <p className="text-[10px] text-stone-400">@{u.username}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#00C853] bg-[#00C853]/10 px-2 py-0.5 rounded-full">
                      Chat
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-stone-400">
                  Type a name or @handle above to find gardeners.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= CREATE GROUP MODAL ================= */}
      {isCreateGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/30 dark:border-emerald-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00C853]" />
                <h3 className="text-sm font-bold text-[#12372A] dark:text-white">
                  Create Botanical Group Circle
                </h3>
              </div>
              <button
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              {/* Group Name */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  Group Circle Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Urban Balcony Gardeners 🪴"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                  required
                />
              </div>

              {/* Group Icon Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5">
                  Group Circle Icon
                </label>
                <input
                  ref={groupFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleGroupPhotoUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    {BOTANICAL_ICONS.map((iconUrl, i) => (
                      <img
                        key={i}
                        src={iconUrl}
                        alt="Icon preset"
                        onClick={() => setSelectedGroupPhoto(iconUrl)}
                        className={`w-9 h-9 rounded-xl object-cover cursor-pointer ring-2 transition-all ${
                          selectedGroupPhoto === iconUrl
                            ? 'ring-[#00C853] scale-105'
                            : 'ring-transparent opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => groupFileInputRef.current?.click()}
                    className="p-2 rounded-xl border border-stone-200 dark:border-emerald-800 text-stone-500 hover:text-[#00C853] transition-colors"
                    title="Upload Custom Photo"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  Select Members ({selectedGroupMembers.length} selected)
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search gardeners to invite..."
                    value={groupUserSearchQuery}
                    onChange={(e) => handleSearchGroupCandidates(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C853]"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto flex flex-col gap-1 border border-stone-100 dark:border-emerald-900/40 rounded-xl p-1.5">
                  {groupCandidateUsers.map((u) => {
                    const isSelected = selectedGroupMembers.some((m) => m.id === u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGroupMembers((prev) =>
                              prev.filter((m) => m.id !== u.id)
                            );
                          } else {
                            setSelectedGroupMembers((prev) => [...prev, u]);
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#00C853]/15 text-[#12372A] dark:text-white'
                            : 'hover:bg-stone-50 dark:hover:bg-emerald-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt={u.displayName}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-xs font-bold leading-tight">{u.displayName}</p>
                            <p className="text-[10px] text-stone-400">@{u.username}</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="accent-[#00C853] w-4 h-4 rounded cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-emerald-900/40">
                <button
                  type="button"
                  onClick={() => setIsCreateGroupModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingGroup || !groupName.trim() || selectedGroupMembers.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00C853] hover:bg-[#00A344] rounded-xl shadow-md disabled:opacity-40 transition-all cursor-pointer"
                >
                  {isCreatingGroup ? 'Sprouting Group...' : 'Create Group Circle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= GROUP INFO & MEMBER ADMIN MODAL ================= */}
      {isGroupInfoModalOpen && selectedConv && isSelectedConvGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/30 dark:border-emerald-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#00C853]" />
                <h3 className="text-sm font-bold text-[#12372A] dark:text-white">
                  Group Circle Details & Admins
                </h3>
              </div>
              <button
                onClick={() => setIsGroupInfoModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Group Header Info */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[#101512] mb-4">
              <img
                src={selectedConv.photoURL || BOTANICAL_ICONS[0]}
                alt={selectedConv.name}
                className="w-12 h-12 rounded-2xl object-cover ring-2 ring-[#00C853]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#12372A] dark:text-white truncate">
                  {selectedConv.name}
                </p>
                <p className="text-[10px] text-stone-400">
                  {selectedConv.participants.length} members • Created by{' '}
                  {selectedConv.creatorId === currentUser.uid
                    ? 'You'
                    : selectedConv.participantProfiles?.[selectedConv.creatorId || '']?.displayName || 'Gardener'}
                </p>
              </div>
            </div>

            {/* Admin Controls Notice */}
            {isMeAdminOfSelectedGroup && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#00C853]">Group Admin Privileges</p>
                  <p className="text-[10px] text-stone-500 dark:text-stone-300">
                    You can manage members, promote admins, or update settings.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                  className="px-3 py-1 rounded-lg bg-[#00C853] text-white text-[11px] font-bold hover:bg-[#00A344] transition-colors"
                >
                  + Add Members
                </button>
              </div>
            )}

            {/* Add Member inline form */}
            {isAddMemberOpen && (
              <div className="mb-4 p-3 rounded-2xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512]">
                <p className="text-xs font-bold text-stone-800 dark:text-white mb-2">
                  Add Gardeners to Group
                </p>
                <input
                  type="text"
                  placeholder="Search user to add..."
                  onChange={async (e) => {
                    const q = e.target.value;
                    if (q.trim()) {
                      const res = await searchUsers(q.trim());
                      if (Array.isArray(res)) {
                        setNewMemberCandidates(
                          res.filter((u) => !selectedConv.participants.includes(u.id))
                        );
                      }
                    } else {
                      setNewMemberCandidates([]);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 mb-2 focus:ring-1 focus:ring-[#00C853]"
                />

                <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                  {newMemberCandidates.map((cand) => (
                    <div
                      key={cand.id}
                      className="flex items-center justify-between p-1.5 hover:bg-stone-50 dark:hover:bg-emerald-950 rounded-lg text-xs"
                    >
                      <span>{cand.displayName} (@{cand.username})</span>
                      <button
                        onClick={async () => {
                          if (!userProfile) return;
                          await addGroupMembers(selectedConv.id, [cand], userProfile.displayName);
                          setNewMemberCandidates((prev) => prev.filter((p) => p.id !== cand.id));
                        }}
                        className="px-2 py-0.5 rounded bg-[#00C853] text-white text-[10px] font-bold"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="mb-4">
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-200 mb-2">
                Members List ({selectedConv.participants.length})
              </h4>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                {selectedConv.participants.map((mId) => {
                  const prof = otherUserMap[mId] || selectedConv.participantProfiles?.[mId];
                  const isCreator = selectedConv.creatorId === mId;
                  const isAdmin = selectedConv.adminIds?.includes(mId);
                  const isThisMe = mId === currentUser.uid;

                  return (
                    <div
                      key={mId}
                      className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-[#101512] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={prof?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={prof?.displayName || 'Member'}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-bold text-stone-800 dark:text-stone-100 leading-tight">
                            {prof?.displayName || 'Gardener'}{isThisMe ? ' (You)' : ''}
                          </p>
                          <p className="text-[10px] text-stone-400">@{prof?.username || 'member'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isCreator ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                            Creator
                          </span>
                        ) : isAdmin ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#00C853]/20 text-[#00C853] font-bold">
                            Admin
                          </span>
                        ) : null}

                        {/* Admin controls over non-self members */}
                        {isMeAdminOfSelectedGroup && !isThisMe && !isCreator && (
                          <div className="flex items-center gap-1">
                            {isAdmin ? (
                              <button
                                onClick={async () => {
                                  if (!userProfile) return;
                                  await demoteGroupAdmin(selectedConv.id, mId, prof?.displayName || 'Member', userProfile.displayName);
                                }}
                                className="text-[10px] text-stone-500 hover:text-amber-600 underline"
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!userProfile) return;
                                  await promoteGroupAdmin(selectedConv.id, mId, prof?.displayName || 'Member', userProfile.displayName);
                                }}
                                className="text-[10px] text-[#00C853] hover:underline"
                              >
                                Make Admin
                              </button>
                            )}

                            <button
                              onClick={async () => {
                                if (!userProfile) return;
                                if (window.confirm(`Remove ${prof?.displayName} from this group?`)) {
                                  await removeGroupMember(selectedConv.id, mId, prof?.displayName || 'Member', userProfile.displayName);
                                }
                              }}
                              className="text-[10px] text-red-500 hover:underline ml-1"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Trail Log */}
            {selectedConv.systemAuditLog && selectedConv.systemAuditLog.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5">
                  Admin Activity Log
                </h4>
                <div className="max-h-28 overflow-y-auto p-2 bg-stone-50 dark:bg-[#101512] rounded-xl text-[10px] text-stone-500 flex flex-col gap-1">
                  {selectedConv.systemAuditLog.slice().reverse().map((audit) => (
                    <div key={audit.id} className="flex justify-between">
                      <span>• {audit.text}</span>
                      <span className="text-stone-400">
                        {new Date(audit.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Danger Zone Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-stone-200 dark:border-emerald-800">
              <button
                onClick={() => handleLeaveGroup(selectedConv)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave Group
              </button>

              {isMeAdminOfSelectedGroup && (
                <button
                  onClick={() => handleDeleteGroup(selectedConv)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= ENLARGED PHOTO VIEWER MODAL ================= */}
      {enlargedImageUrl && (
        <div
          onClick={() => setEnlargedImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-2xl max-h-[90vh]">
            <img
              src={enlargedImageUrl}
              alt="Enlarged"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setEnlargedImageUrl(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ================= REPORT MODAL ================= */}
      {reportingUserId && (
        <ReportModal
          targetId={reportingUserId}
          targetType="user"
          onClose={() => setReportingUserId(null)}
        />
      )}
    </div>
  );
};
