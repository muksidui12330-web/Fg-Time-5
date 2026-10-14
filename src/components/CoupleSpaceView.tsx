import React, { useState, useEffect, useRef } from 'react';
import {
  Heart,
  Sparkles,
  Calendar,
  Camera,
  Image as ImageIcon,
  Clock,
  Plus,
  Trash2,
  Settings,
  Send,
  MessageCircle,
  X,
  Share2,
  Lock,
  Gift,
  Smile,
  Check,
  AlertCircle,
  Search,
  UserCheck,
  Flame,
  Award,
  RefreshCw,
  Edit2,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { CoupleItem, LoveMemoryItem, UserProfile, LoveNoteItem, RelationshipMilestone } from '../types';
import {
  subscribeUserCouple,
  sendCoupleInvitation,
  respondToCoupleInvitation,
  disconnectCouple,
  updateCoupleDetails,
  addDailyLoveNote,
  addRelationshipMilestone,
  subscribeCoupleMemories,
  addCoupleMemory,
  deleteCoupleMemory,
  toggleMemoryLoveReaction,
  searchUsers,
} from '../services/firestoreService';

interface CoupleSpaceViewProps {
  onOpenMessageWithUser: (userId: string) => void;
  onOpenUserProfile: (userId: string) => void;
  onRequireAuth: () => void;
}

const MEMORY_MOODS: Array<{ id: LoveMemoryItem['mood']; label: string; icon: string; color: string }> = [
  { id: 'romantic', label: 'Sweet Romance', icon: '💖', color: 'from-pink-500 to-rose-500' },
  { id: 'adventure', label: 'Outdoor Adventure', icon: '🌲', color: 'from-emerald-500 to-teal-600' },
  { id: 'peaceful', label: 'Quiet Bloom', icon: '🌸', color: 'from-purple-500 to-indigo-500' },
  { id: 'celebration', label: 'Celebration', icon: '🥂', color: 'from-amber-400 to-pink-500' },
  { id: 'milestone', label: 'Big Milestone', icon: '💍', color: 'from-rose-500 to-purple-600' },
];

const ROMANTIC_CONFETTI_COLORS = ['#00C853', '#FF6584', '#8B5CF6', '#FDA4AF', '#F43F5E', '#A7F3D0'];

export const CoupleSpaceView: React.FC<CoupleSpaceViewProps> = ({
  onOpenMessageWithUser,
  onOpenUserProfile,
  onRequireAuth,
}) => {
  const { currentUser, userProfile } = useAuth();

  // Couple status & data
  const [couple, setCouple] = useState<CoupleItem | null>(null);
  const [isLoadingCouple, setIsLoadingCouple] = useState(true);
  const [memories, setMemories] = useState<LoveMemoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'memories' | 'countdown' | 'notes'>('memories');

  // Pair Invitation Flow State
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [selectedTargetUser, setSelectedTargetUser] = useState<UserProfile | null>(null);
  const [anniversaryInput, setAnniversaryInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [invitationNote, setInvitationNote] = useState('');
  const [partnerNicknameInput, setPartnerNicknameInput] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Love Note State
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedReactionEmoji, setSelectedReactionEmoji] = useState('💖');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Add Memory Modal State
  const [isAddMemoryOpen, setIsAddMemoryOpen] = useState(false);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryCaption, setMemoryCaption] = useState('');
  const [memoryDate, setMemoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [memoryMood, setMemoryMood] = useState<LoveMemoryItem['mood']>('romantic');
  const [memoryImageUrl, setMemoryImageUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const memoryFileInputRef = useRef<HTMLInputElement | null>(null);

  // Settings & Edit Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editAnniversary, setEditAnniversary] = useState('');
  const [editMyNickname, setEditMyNickname] = useState('');
  const [isPublicBadge, setIsPublicBadge] = useState(true);
  const [isDisconnectConfirmOpen, setIsDisconnectConfirmOpen] = useState(false);

  // Milestone Modal State
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [milestoneDescription, setMilestoneDescription] = useState('');

  // Selected Lightbox Memory
  const [activeMemoryDetail, setActiveMemoryDetail] = useState<LoveMemoryItem | null>(null);

  // Trigger celebration confetti
  const triggerLoveConfetti = (particleCount = 55) => {
    try {
      confetti({
        particleCount,
        spread: 80,
        origin: { y: 0.6 },
        colors: ROMANTIC_CONFETTI_COLORS,
      });
    } catch {
      // safe fallback
    }
  };

  // Subscribe to user couple record
  useEffect(() => {
    if (!currentUser) {
      setIsLoadingCouple(false);
      return;
    }

    setIsLoadingCouple(true);
    const unsub = subscribeUserCouple(
      currentUser.uid,
      (foundCouple) => {
        setCouple(foundCouple);
        setIsLoadingCouple(false);
        if (foundCouple?.anniversaryDate) {
          setEditAnniversary(foundCouple.anniversaryDate);
        }
        if (foundCouple) {
          const isUser1 = currentUser.uid === foundCouple.user1Id;
          setEditMyNickname(isUser1 ? foundCouple.partner1Nickname || '' : foundCouple.partner2Nickname || '');
          setIsPublicBadge(foundCouple.isPublicBadge ?? true);
        }
      },
      () => {
        setIsLoadingCouple(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // Subscribe to memories if couple is connected
  useEffect(() => {
    if (!couple || couple.status !== 'connected') {
      setMemories([]);
      return;
    }

    const unsub = subscribeCoupleMemories(couple.id, (loadedMemories) => {
      setMemories(loadedMemories);
    });

    return () => unsub();
  }, [couple]);

  // Partner search debouncing
  useEffect(() => {
    if (!partnerSearchQuery.trim() || partnerSearchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(partnerSearchQuery.trim()).then((users) => {
        if (!Array.isArray(users)) return;
        setSearchResults(users.filter((u) => u.id !== currentUser?.uid));
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [partnerSearchQuery, currentUser]);

  // Identify partner info
  const isUser1 = currentUser && couple ? currentUser.uid === couple.user1Id : true;
  const partnerId = isUser1 ? couple?.user2Id : couple?.user1Id;
  const partnerName = isUser1 ? couple?.partner2Name : couple?.partner1Name;
  const partnerUsername = isUser1 ? couple?.partner2Username : couple?.partner1Username;
  const partnerAvatar = isUser1 ? couple?.partner2Avatar : couple?.partner1Avatar;
  const myNickname = isUser1 ? couple?.partner1Nickname : couple?.partner2Nickname;
  const partnerNickname = isUser1 ? couple?.partner2Nickname : couple?.partner1Nickname;

  // Calculate relationship days & anniversary countdown
  const calculateDaysTogether = (dateStr?: string) => {
    if (!dateStr) return { days: 0, months: 0, years: 0, daysToNext: 0 };
    try {
      const start = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const months = Math.floor(days / 30.4375);
      const years = Math.floor(days / 365.25);

      // Next anniversary
      const thisYearAnniv = new Date(now.getFullYear(), start.getMonth(), start.getDate());
      if (thisYearAnniv.getTime() < now.getTime()) {
        thisYearAnniv.setFullYear(now.getFullYear() + 1);
      }
      const daysToNext = Math.ceil((thisYearAnniv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return { days, months, years, daysToNext };
    } catch {
      return { days: 0, months: 0, years: 0, daysToNext: 0 };
    }
  };

  const relationshipStats = calculateDaysTogether(couple?.anniversaryDate);

  // Handle couple proposal submission
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      onRequireAuth();
      return;
    }
    if (!selectedTargetUser) {
      setInviteError('Please select a partner from search to send your invitation.');
      return;
    }

    setIsSendingInvite(true);
    setInviteError(null);
    try {
      await sendCoupleInvitation(
        userProfile,
        selectedTargetUser,
        anniversaryInput,
        invitationNote.trim(),
        partnerNicknameInput.trim()
      );
      triggerLoveConfetti(70);
    } catch (err: any) {
      console.error('Send invite error:', err);
      setInviteError(err.message || 'Could not send couple request. Please try again.');
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Handle proposal accept/decline
  const handleRespondToProposal = async (accept: boolean) => {
    if (!couple || !userProfile) return;
    try {
      await respondToCoupleInvitation(couple, accept, userProfile);
      if (accept) {
        triggerLoveConfetti(100);
      }
    } catch (err) {
      console.error('Respond proposal error:', err);
    }
  };

  // Handle photo upload for love memory
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Photo upload failed');
      }

      const data = await res.json();
      setMemoryImageUrl(data.url);
    } catch (err: any) {
      console.error('Photo upload error:', err);
      alert(err.message || 'Could not upload memory photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Save new love memory
  const handleSaveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !currentUser || !userProfile) return;
    if (!memoryTitle.trim() || !memoryImageUrl) {
      alert('Please provide a photo and a title for your sweet memory.');
      return;
    }

    setIsSavingMemory(true);
    try {
      await addCoupleMemory(couple.id, {
        coupleId: couple.id,
        authorId: currentUser.uid,
        authorName: userProfile.displayName,
        authorPhoto: userProfile.photoURL || '',
        imageUrl: memoryImageUrl,
        title: memoryTitle.trim(),
        caption: memoryCaption.trim(),
        memoryDate,
        mood: memoryMood,
      });

      triggerLoveConfetti(60);
      setIsAddMemoryOpen(false);
      setMemoryTitle('');
      setMemoryCaption('');
      setMemoryImageUrl('');
    } catch (err: any) {
      console.error('Save memory error:', err);
      alert(err.message || 'Failed to save memory.');
    } finally {
      setIsSavingMemory(false);
    }
  };

  // Submit love note
  const handleSubmitLoveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !currentUser || !userProfile || !newNoteText.trim()) return;

    setIsSubmittingNote(true);
    try {
      const note: LoveNoteItem = {
        id: `note-${Date.now()}`,
        senderId: currentUser.uid,
        senderName: myNickname || userProfile.displayName,
        senderPhoto: userProfile.photoURL || '',
        text: newNoteText.trim(),
        reaction: selectedReactionEmoji,
        createdAt: new Date().toISOString(),
      };

      await addDailyLoveNote(couple.id, note);
      setNewNoteText('');
      triggerLoveConfetti(45);
    } catch (err: any) {
      console.error('Add note error:', err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // Save custom milestone
  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !milestoneTitle.trim()) return;

    try {
      const milestone: RelationshipMilestone = {
        id: `m-${Date.now()}`,
        title: milestoneTitle.trim(),
        date: milestoneDate,
        description: milestoneDescription.trim(),
        icon: '🌸',
        isCustom: true,
      };

      await addRelationshipMilestone(couple.id, milestone);
      setIsAddMilestoneOpen(false);
      setMilestoneTitle('');
      setMilestoneDescription('');
      triggerLoveConfetti(50);
    } catch (err: any) {
      console.error('Save milestone error:', err);
    }
  };

  // Save couple settings
  const handleSaveSettings = async () => {
    if (!couple || !currentUser) return;
    try {
      const updates: Partial<CoupleItem> = {
        anniversaryDate: editAnniversary,
        isPublicBadge,
      };
      if (isUser1) {
        updates.partner1Nickname = editMyNickname.trim() || undefined;
      } else {
        updates.partner2Nickname = editMyNickname.trim() || undefined;
      }

      await updateCoupleDetails(couple.id, updates);
      setIsSettingsModalOpen(false);
      triggerLoveConfetti(40);
    } catch (err: any) {
      console.error('Update settings error:', err);
    }
  };

  // Disconnect couple
  const handleDisconnect = async () => {
    if (!couple || !currentUser || !partnerId) return;
    try {
      await disconnectCouple(couple.id, currentUser.uid, partnerId);
      setIsDisconnectConfirmOpen(false);
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      console.error('Disconnect error:', err);
    }
  };

  if (!currentUser) {
    return (
      <div className="w-full max-w-2xl mx-auto py-10 px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-rose-50/50 to-purple-50/50 dark:from-[#12372A] dark:via-[#1B4D3E] dark:to-[#2A1B3D] border border-pink-200/60 dark:border-pink-900/40 p-8 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-500 via-rose-400 to-[#00C853] flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
            <Heart className="w-8 h-8 fill-white animate-pulse" />
          </div>
          <h2 className="text-2xl font-black text-[#12372A] dark:text-white mb-2">
            FG TIME Love & Couple Space
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-300 max-w-md mx-auto mb-6">
            Connect mutually with your partner on FG TIME. Unlock your private shared memory album, live anniversary countdown, couple badges, and romantic whispers.
          </p>
          <button
            onClick={onRequireAuth}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-[#00C853] text-white font-bold text-sm shadow-lg shadow-pink-500/30 hover:scale-105 transition-all cursor-pointer"
          >
            Sign In to Connect with Partner
          </button>
        </div>
      </div>
    );
  }

  if (isLoadingCouple) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 flex flex-col items-center justify-center text-pink-500">
        <RefreshCw className="w-8 h-8 animate-spin mb-3" />
        <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
          Loading your Love & Couple Space...
        </p>
      </div>
    );
  }

  // CASE 1: No couple link exists yet -> Onboarding / Invitation Search Form
  if (!couple || couple.status === 'disconnected' || couple.status === 'rejected') {
    return (
      <div className="w-full max-w-2xl mx-auto py-6 px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-rose-50/40 to-purple-50/30 dark:from-[#12372A] dark:via-[#1B4032] dark:to-[#22162B] border border-pink-200 dark:border-pink-900/50 p-6 sm:p-8 shadow-xl mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-400 to-[#00C853] flex items-center justify-center text-white shadow-md shadow-pink-500/25">
              <Heart className="w-6 h-6 fill-white" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-pink-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Mutual-Consent Pairing
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#12372A] dark:text-white">
                Connect Hearts on FG TIME
              </h2>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-6">
            Share a protected sanctuary with your soulmate. Both partners must approve before the connection activates. Enjoy a private photo album, live anniversary countdown, and glowing couple badges.
          </p>

          <form onSubmit={handleSendInvite} className="space-y-4">
            {/* Step 1: Find Partner */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5">
                1. Search for your Partner (Username or Name)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. blossom_flora or Sofia..."
                  value={partnerSearchQuery}
                  onChange={(e) => setPartnerSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-pink-200 dark:border-pink-900/60 bg-white dark:bg-[#102018] text-xs text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && !selectedTargetUser && (
                <div className="mt-2 p-2 bg-white dark:bg-[#12281E] border border-pink-100 dark:border-pink-900/50 rounded-2xl shadow-lg max-h-48 overflow-y-auto space-y-1">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedTargetUser(user);
                        setPartnerSearchQuery(user.displayName);
                        setSearchResults([]);
                      }}
                      className="p-2 rounded-xl hover:bg-pink-50 dark:hover:bg-pink-950/40 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-pink-400"
                        />
                        <div>
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-100">
                            {user.displayName}
                          </p>
                          <p className="text-[10px] text-stone-400">@{user.username}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-pink-500 flex items-center gap-1">
                        Select <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected User Badge */}
              {selectedTargetUser && (
                <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/30 dark:to-purple-950/30 border border-pink-300 dark:border-pink-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedTargetUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={selectedTargetUser.displayName}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-stone-800 dark:text-white flex items-center gap-1">
                        {selectedTargetUser.displayName} <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500 inline" />
                      </p>
                      <p className="text-[10px] text-stone-400">@{selectedTargetUser.username}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTargetUser(null)}
                    className="p-1 rounded-full text-stone-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Relationship Date */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-pink-500" />
                2. Relationship Start / Anniversary Date
              </label>
              <input
                type="date"
                value={anniversaryInput}
                onChange={(e) => setAnniversaryInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-pink-200 dark:border-pink-900/60 bg-white dark:bg-[#102018] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Step 3: Sweet Invitation Whisper */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1.5">
                3. Sweet Invitation Whisper (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Let's grow our love memories together on FG TIME 🌸🍃..."
                value={invitationNote}
                onChange={(e) => setInvitationNote(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-pink-200 dark:border-pink-900/60 bg-white dark:bg-[#102018] text-xs text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
              />
            </div>

            {inviteError && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 text-red-600 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inviteError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedTargetUser || isSendingInvite}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-[#00C853] hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-pink-500/25 disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSendingInvite ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Sending Invitation...</span>
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Send Mutual Couple Invitation 💖</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#12372A]/60 border border-pink-100 dark:border-pink-900/30 shadow-sm">
            <span className="text-2xl mb-1 block">🔒</span>
            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 mb-1">
              Strictly Private Album
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Photos uploaded here are locked and accessible only to both of you.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#12372A]/60 border border-purple-100 dark:border-purple-900/30 shadow-sm">
            <span className="text-2xl mb-1 block">⏳</span>
            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 mb-1">
              Live Days Counter
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Live counter of days together and countdown to your next anniversary.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#12372A]/60 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
            <span className="text-2xl mb-1 block">🍃</span>
            <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 mb-1">
              Couple Badges
            </h4>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Optionally display your couple connection badge on your public profiles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CASE 2: Pending Proposal
  if (couple.status === 'pending') {
    const isSentByMe = couple.requestedBy === currentUser.uid;

    return (
      <div className="w-full max-w-xl mx-auto py-8 px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-rose-50/50 to-purple-50/40 dark:from-[#12372A] dark:via-[#1B4032] dark:to-[#2A1633] border border-pink-300 dark:border-pink-800 p-6 sm:p-8 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-tr from-pink-500 via-rose-400 to-[#00C853] flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
            <Heart className="w-8 h-8 fill-white animate-bounce" />
          </div>

          {isSentByMe ? (
            <>
              <span className="text-xs font-bold text-pink-500 uppercase tracking-widest block mb-1">
                Invitation Sent 💌
              </span>
              <h3 className="text-xl font-black text-[#12372A] dark:text-white mb-2">
                Waiting for {partnerName} to Accept
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-300 max-w-sm mx-auto mb-6">
                We've notified @{partnerUsername}. Once they accept, your couple space and private love memories album will blossom into view!
              </p>
              <button
                onClick={() => handleRespondToProposal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              >
                Cancel Invitation
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-bold text-pink-500 uppercase tracking-widest block mb-1">
                Couple Proposal Received 🌸
              </span>
              <h3 className="text-xl font-black text-[#12372A] dark:text-white mb-2">
                {partnerName} wants to connect with you!
              </h3>
              {couple.invitationNote && (
                <div className="my-4 p-4 rounded-2xl bg-white/80 dark:bg-black/30 border border-pink-200 dark:border-pink-900/50 text-xs italic text-stone-700 dark:text-stone-200">
                  "{couple.invitationNote}"
                </div>
              )}
              {couple.anniversaryDate && (
                <p className="text-xs text-stone-500 dark:text-stone-300 mb-6 flex items-center justify-center gap-1.5">
                  <Calendar className="w-4 h-4 text-pink-500" />
                  <span>Relationship Date: <strong>{couple.anniversaryDate}</strong></span>
                </p>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleRespondToProposal(false)}
                  className="px-5 py-2.5 rounded-2xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleRespondToProposal(true)}
                  className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-[#00C853] hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-pink-500/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Accept Proposal 💍</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // CASE 3: Active Connected Couple Space
  return (
    <div className="w-full max-w-3xl mx-auto py-5 px-4 pb-20">
      {/* Couple Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#12372A] via-[#1E4D3E] to-[#2E1838] border border-pink-500/30 p-6 sm:p-8 text-white shadow-2xl mb-6">
        {/* Glow Circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00C853]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-pink-300 border border-pink-400/30">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Verified Couple Sanctuary</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerLoveConfetti(80)}
                className="p-2 rounded-full bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 transition-colors"
                title="Shower Love Confetti"
              >
                <Heart className="w-4 h-4 fill-pink-400 text-pink-400 animate-pulse" />
              </button>

              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Couple Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Avatars Linked with Heart */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mb-4">
            <div
              onClick={() => onOpenUserProfile(currentUser.uid)}
              className="flex flex-col items-center cursor-pointer group"
            >
              <img
                src={userProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={userProfile?.displayName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-[#00C853] shadow-lg group-hover:scale-105 transition-transform"
              />
              <span className="text-xs font-bold mt-2 text-emerald-300">
                {myNickname || userProfile?.displayName}
              </span>
              <span className="text-[10px] text-stone-300">@{userProfile?.username}</span>
            </div>

            {/* Glowing Heart Ring */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center shadow-lg shadow-pink-500/50 animate-pulse">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white" />
              </div>
              <span className="text-[9px] uppercase tracking-wider text-pink-200 mt-1 font-bold">
                Linked
              </span>
            </div>

            <div
              onClick={() => partnerId && onOpenUserProfile(partnerId)}
              className="flex flex-col items-center cursor-pointer group"
            >
              <img
                src={partnerAvatar || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150'}
                alt={partnerName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover ring-4 ring-pink-500 shadow-lg group-hover:scale-105 transition-transform"
              />
              <span className="text-xs font-bold mt-2 text-pink-300">
                {partnerNickname || partnerName}
              </span>
              <span className="text-[10px] text-stone-300">@{partnerUsername}</span>
            </div>
          </div>

          {/* Quick Whispers CTA */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => partnerId && onOpenMessageWithUser(partnerId)}
              className="px-4 py-2 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <MessageCircle className="w-3.5 h-3.5 text-pink-300" />
              <span>Whisper with Partner</span>
            </button>

            <button
              onClick={() => setIsAddMemoryOpen(true)}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-xs font-bold text-white flex items-center gap-2 transition-all shadow-md shadow-pink-500/30 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Add Love Memory</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Days & Anniversary Countdown Card */}
      <div className="rounded-3xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-emerald-500/10 dark:from-pink-950/40 dark:via-purple-950/40 dark:to-emerald-950/40 border border-pink-200 dark:border-pink-900/50 p-6 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-pink-600 dark:text-pink-400 text-xs font-bold mb-1">
              <Clock className="w-4 h-4" />
              <span>Days Blooming Together</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-[#12372A] dark:text-white">
              {relationshipStats.days} <span className="text-lg font-bold text-pink-500">Days</span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-300 mt-0.5">
              Since {couple.anniversaryDate || 'our special day'} 🌿 ({relationshipStats.months} months together)
            </p>
          </div>

          {/* Countdown to Next Anniversary */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#12281E]/80 border border-pink-200/80 dark:border-pink-900/40 text-center sm:text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">
              Next Anniversary in
            </span>
            <div className="text-xl font-black text-pink-600 dark:text-pink-400">
              {relationshipStats.daysToNext} <span className="text-xs font-semibold">Days</span>
            </div>
            <span className="text-[10px] text-stone-400">
              {relationshipStats.years + 1} Year Milestone 💐
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-stone-200 dark:border-emerald-800/40 pb-2">
        <button
          onClick={() => setActiveTab('memories')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'memories'
              ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
              : 'text-stone-600 dark:text-stone-300 hover:bg-pink-50 dark:hover:bg-pink-950/30'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Private Scrapbook ({memories.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'notes'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-stone-600 dark:text-stone-300 hover:bg-purple-50 dark:hover:bg-purple-950/30'
          }`}
        >
          <Heart className="w-3.5 h-3.5" />
          <span>Love Notes ({couple.loveNotes?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('countdown')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'countdown'
              ? 'bg-[#00C853] text-white shadow-md shadow-[#00C853]/20'
              : 'text-stone-600 dark:text-stone-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Milestones</span>
        </button>
      </div>

      {/* TAB 1: PRIVATE LOVE MEMORIES SCRAPBOOK */}
      {activeTab === 'memories' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <Lock className="w-3.5 h-3.5 text-pink-500" />
              <span>Strictly Private Album</span>
            </div>

            <button
              onClick={() => setIsAddMemoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          </div>

          {memories.length === 0 ? (
            <div className="p-10 rounded-3xl bg-white dark:bg-[#12372A]/40 border border-dashed border-pink-200 dark:border-pink-900/60 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center">
                <ImageIcon className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-stone-700 dark:text-stone-200 mb-1">
                Your Shared Scrapbook is Empty
              </h4>
              <p className="text-xs text-stone-400 max-w-sm mx-auto mb-4">
                Capture your coffee dates, nature walks, milestones, and funny selfies. Only the two of you can view them!
              </p>
              <button
                onClick={() => setIsAddMemoryOpen(true)}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                Upload First Love Memory 🌸
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {memories.map((mem) => {
                const hasLiked = mem.likes?.includes(currentUser.uid) || false;
                const moodObj = MEMORY_MOODS.find((m) => m.id === mem.mood) || MEMORY_MOODS[0];

                return (
                  <div
                    key={mem.id}
                    onClick={() => setActiveMemoryDetail(mem)}
                    className="group relative rounded-2xl bg-white dark:bg-[#12372A] border border-pink-100 dark:border-pink-900/40 overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer"
                  >
                    <div className="aspect-square w-full overflow-hidden relative">
                      <img
                        src={mem.imageUrl}
                        alt={mem.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-white flex items-center gap-1 font-medium">
                        <span>{moodObj.icon}</span>
                        <span className="hidden sm:inline">{moodObj.label}</span>
                      </span>

                      {/* Love Reaction Counter */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMemoryLoveReaction(couple.id, mem.id, currentUser.uid, hasLiked);
                          if (!hasLiked) triggerLoveConfetti(35);
                        }}
                        className={`absolute bottom-2 right-2 px-2.5 py-1 rounded-full backdrop-blur-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                          hasLiked
                            ? 'bg-pink-500 text-white scale-105'
                            : 'bg-black/50 text-white hover:bg-black/70'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-white' : ''}`} />
                        <span>{mem.likes?.length || 0}</span>
                      </button>
                    </div>

                    <div className="p-3">
                      <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                        {mem.title}
                      </h4>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {mem.memoryDate}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOVE NOTES & SWEET PROMPTS */}
      {activeTab === 'notes' && (
        <div className="space-y-6">
          {/* Note Input Box */}
          <form
            onSubmit={handleSubmitLoveNote}
            className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#12372A]/80 border border-purple-200 dark:border-purple-900/40 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💌</span>
              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Leave a Sweet Whisper for {partnerName}
              </h4>
            </div>

            <textarea
              rows={2}
              placeholder="Good morning sunshine ☀️ Thank you for being my rock..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              className="w-full p-3 rounded-2xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none mb-3"
            />

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1 text-sm">
                <span className="text-[10px] text-stone-400 font-bold mr-1">Sticker:</span>
                {['💖', '🌸', '🌿', '☕', '🌹', '✨', '🤗'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedReactionEmoji(emoji)}
                    className={`p-1 rounded-lg text-sm transition-transform ${
                      selectedReactionEmoji === emoji ? 'bg-purple-100 dark:bg-purple-900/50 scale-125' : 'hover:scale-110'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={!newNoteText.trim() || isSubmittingNote}
                className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Note</span>
              </button>
            </div>
          </form>

          {/* Notes Board */}
          <div className="space-y-3">
            {couple.loveNotes && couple.loveNotes.length > 0 ? (
              [...couple.loveNotes].reverse().map((note) => {
                const isMyNote = note.senderId === currentUser.uid;

                return (
                  <div
                    key={note.id}
                    className={`p-4 rounded-3xl border transition-all ${
                      isMyNote
                        ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800/40 ml-4'
                        : 'bg-white dark:bg-[#12372A] border-stone-200 dark:border-emerald-800/40 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{note.reaction || '💖'}</span>
                        <span className="text-xs font-bold text-stone-800 dark:text-stone-100">
                          {note.senderName}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {new Date(note.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                      {note.text}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-stone-400 text-center py-6">
                No love notes yet. Send your partner the first sweet message!
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RELATIONSHIP MILESTONES */}
      {activeTab === 'countdown' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-stone-700 dark:text-stone-200 uppercase tracking-wider">
              Our Journey Milestones
            </h4>
            <button
              onClick={() => setIsAddMilestoneOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00C853] hover:bg-[#00A344] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Milestone</span>
            </button>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-pink-500 before:via-purple-500 before:to-[#00C853]">
            {/* Standard Milestones */}
            <div className="relative flex items-start gap-3">
              <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center text-[10px] shadow-sm">
                🌱
              </span>
              <div className="p-4 rounded-2xl bg-white dark:bg-[#12372A] border border-pink-200 dark:border-pink-900/40 w-full shadow-sm">
                <span className="text-[10px] font-bold text-pink-500 block">Day 1</span>
                <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100">
                  The Day We Sprouted 🌿
                </h4>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Our relationship began on {couple.anniversaryDate}.
                </p>
              </div>
            </div>

            {/* Custom Milestones */}
            {couple.customMilestones?.map((m) => (
              <div key={m.id} className="relative flex items-start gap-3">
                <span className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] shadow-sm">
                  {m.icon || '🌸'}
                </span>
                <div className="p-4 rounded-2xl bg-white dark:bg-[#12372A] border border-purple-200 dark:border-purple-900/40 w-full shadow-sm">
                  <span className="text-[10px] font-bold text-purple-500 block">{m.date}</span>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-100">
                    {m.title}
                  </h4>
                  {m.description && (
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      {m.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADD MEMORY MODAL */}
      {isAddMemoryOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#12372A] border border-pink-200 dark:border-pink-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddMemoryOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-pink-500" />
              <h3 className="text-base font-black text-stone-800 dark:text-white">
                Add to Love Scrapbook
              </h3>
            </div>

            <form onSubmit={handleSaveMemory} className="space-y-3.5">
              {/* Photo Upload Area */}
              <div>
                <input
                  ref={memoryFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                {memoryImageUrl ? (
                  <div className="relative aspect-video rounded-2xl overflow-hidden ring-2 ring-pink-500 mb-2">
                    <img
                      src={memoryImageUrl}
                      alt="Uploaded preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setMemoryImageUrl('')}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => memoryFileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="w-full h-36 rounded-2xl border-2 border-dashed border-pink-300 dark:border-pink-900/60 bg-pink-50/50 dark:bg-pink-950/20 hover:bg-pink-50 dark:hover:bg-pink-950/30 flex flex-col items-center justify-center text-pink-600 dark:text-pink-400 transition-colors cursor-pointer"
                  >
                    {isUploadingPhoto ? (
                      <>
                        <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                        <span className="text-xs font-bold">Uploading memory...</span>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 mb-1.5" />
                        <span className="text-xs font-bold">Tap to Pick Photo from Gallery</span>
                        <span className="text-[10px] text-stone-400 mt-0.5">JPG, PNG, WebP up to 50MB</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  Memory Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sunset Picnic at Botanical Garden 🌅"
                  value={memoryTitle}
                  onChange={(e) => setMemoryTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Date & Mood in 2 columns */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={memoryDate}
                    onChange={(e) => setMemoryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    Mood
                  </label>
                  <select
                    value={memoryMood}
                    onChange={(e) => setMemoryMood(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    {MEMORY_MOODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.icon} {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  Sweet Caption / Story
                </label>
                <textarea
                  rows={2}
                  placeholder="The coffee was warm, but your smile was warmer..."
                  value={memoryCaption}
                  onChange={(e) => setMemoryCaption(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!memoryImageUrl || !memoryTitle.trim() || isSavingMemory}
                className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-pink-500/20 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSavingMemory ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Memory...</span>
                  </>
                ) : (
                  <>
                    <Heart className="w-4 h-4 fill-white" />
                    <span>Save to Scrapbook</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MEMORY LIGHTBOX DETAIL MODAL */}
      {activeMemoryDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#12372A] border border-pink-200 dark:border-pink-900 overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setActiveMemoryDetail(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <img
              src={activeMemoryDetail.imageUrl}
              alt={activeMemoryDetail.title}
              className="w-full max-h-96 object-cover"
            />

            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-pink-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{activeMemoryDetail.memoryDate}</span>
                </span>

                <button
                  onClick={() => {
                    if (window.confirm('Delete this memory from your couple scrapbook?')) {
                      deleteCoupleMemory(couple.id, activeMemoryDetail.id);
                      setActiveMemoryDetail(null);
                    }
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 transition-colors"
                  title="Delete Memory"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-base font-black text-stone-900 dark:text-white mb-2">
                {activeMemoryDetail.title}
              </h3>

              {activeMemoryDetail.caption && (
                <p className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed mb-4">
                  {activeMemoryDetail.caption}
                </p>
              )}

              <div className="pt-3 border-t border-stone-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-[11px] text-stone-400">
                  Shared by {activeMemoryDetail.authorName}
                </span>

                <button
                  onClick={() => {
                    const hasLiked = activeMemoryDetail.likes?.includes(currentUser.uid) || false;
                    toggleMemoryLoveReaction(couple.id, activeMemoryDetail.id, currentUser.uid, hasLiked);
                    if (!hasLiked) triggerLoveConfetti(40);
                    setActiveMemoryDetail({
                      ...activeMemoryDetail,
                      likes: hasLiked
                        ? (activeMemoryDetail.likes || []).filter((id) => id !== currentUser.uid)
                        : [...(activeMemoryDetail.likes || []), currentUser.uid],
                    });
                  }}
                  className="px-3 py-1.5 rounded-full bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
                >
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span>{activeMemoryDetail.likes?.length || 0} Loves</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD MILESTONE MODAL */}
      {isAddMilestoneOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12372A] border border-emerald-200 dark:border-emerald-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddMilestoneOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-stone-800 dark:text-white mb-3">
              Add Relationship Milestone
            </h3>

            <form onSubmit={handleSaveMilestone} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. First Road Trip to Mountains 🏔️"
                  value={milestoneTitle}
                  onChange={(e) => setMilestoneTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Drove through scenic pine forests..."
                  value={milestoneDescription}
                  onChange={(e) => setMilestoneDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={!milestoneTitle.trim()}
                className="w-full py-2.5 rounded-xl bg-[#00C853] hover:bg-[#00A344] text-white text-xs font-bold shadow-md shadow-[#00C853]/20 disabled:opacity-40 transition-all cursor-pointer"
              >
                Save Milestone
              </button>
            </form>
          </div>
        </div>
      )}

      {/* COUPLE SETTINGS & DISCONNECT MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-stone-800 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-pink-500" />
              <span>Couple Space Settings</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                  Relationship Anniversary Date
                </label>
                <input
                  type="date"
                  value={editAnniversary}
                  onChange={(e) => setEditAnniversary(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                  My Pet Name / Nickname in Couple Space
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Sunshine ☀️"
                  value={editMyNickname}
                  onChange={(e) => setEditMyNickname(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101F18] text-xs text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-[#101F18] border border-stone-200 dark:border-emerald-800/40">
                <div>
                  <h5 className="text-xs font-bold text-stone-800 dark:text-white">
                    Public Couple Badge
                  </h5>
                  <p className="text-[10px] text-stone-400">
                    Display "Linked with @{partnerUsername} 💖" on your profile
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isPublicBadge}
                  onChange={(e) => setIsPublicBadge(e.target.checked)}
                  className="w-4 h-4 text-pink-500 rounded focus:ring-pink-400"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold shadow-md shadow-pink-500/20 transition-all cursor-pointer"
              >
                Save Settings
              </button>

              <div className="pt-2 border-t border-stone-200 dark:border-emerald-800">
                <button
                  type="button"
                  onClick={() => setIsDisconnectConfirmOpen(true)}
                  className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  Disconnect Couple Space
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISCONNECT CONFIRMATION MODAL */}
      {isDisconnectConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#12372A] border border-red-300 dark:border-red-900 p-6 shadow-2xl text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-950/60 text-red-500 flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-stone-800 dark:text-white mb-1">
              Disconnect Couple Space?
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-300 mb-5">
              This will safely unlink your profiles. Your mutual couple badges will be removed. You can always reconnect later.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDisconnectConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
              >
                Keep Linked
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
