import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Globe,
  Edit3,
  MessageCircle,
  Grid,
  Bookmark,
  Sparkles,
  X,
  UserCheck,
  UserPlus,
  ShieldAlert,
  Lock,
  Unlock,
  Heart,
  Copy,
  Check,
  Settings,
  Film,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, PostItem } from '../types';
import {
  getUserProfile,
  subscribePosts,
  subscribeUserPosts,
  subscribeSavedPosts,
  toggleFollowUser,
  checkIsFollowing,
  blockUser,
} from '../services/firestoreService';
import { PostCard } from './PostCard';

interface ProfileViewProps {
  targetUserId?: string | null;
  onOpenMessageWithUser: (userId: string) => void;
  onOpenReportPost: (postId: string) => void;
  onRequireAuth?: () => void;
  onOpenSettings?: () => void;
  onOpenCoupleSpace?: () => void;
}

const LEAF_BADGES = [
  'Forest Sprout 🌱',
  'Eco Pioneer 🌿',
  'Flora Guardian 🌳',
  'Botanical Explorer 🍃',
  'Green Architect 🪴',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  targetUserId,
  onOpenMessageWithUser,
  onOpenReportPost,
  onRequireAuth,
  onOpenSettings,
  onOpenCoupleSpace,
}) => {
  const { currentUser, userProfile: myProfile, updateCurrentProfile, signInWithGoogle } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [userPosts, setUserPosts] = useState<PostItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'grid' | 'saved'>('posts');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [editBadge, setEditBadge] = useState('');
  const [editIsPrivate, setEditIsPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const effectiveUserId = targetUserId || currentUser?.uid;
  const isMe = currentUser && currentUser.uid === effectiveUserId;

  useEffect(() => {
    if (!effectiveUserId) return;

    if (isMe && myProfile) {
      setProfile(myProfile);
    } else {
      getUserProfile(effectiveUserId).then((p) => {
        setProfile(p);
      });
    }

    if (currentUser && !isMe) {
      checkIsFollowing(currentUser.uid, effectiveUserId).then((fol) => {
        setIsFollowing(fol);
      });
    }
  }, [effectiveUserId, isMe, myProfile, currentUser]);

  // Subscribe to user's personal posts
  useEffect(() => {
    if (!effectiveUserId) return;
    const unsub = subscribeUserPosts(effectiveUserId, (posts) => {
      setUserPosts(posts);
    });
    return () => unsub();
  }, [effectiveUserId]);

  // Subscribe to saved posts (strictly for owner)
  useEffect(() => {
    if (!isMe || !currentUser) {
      setSavedPosts([]);
      return;
    }
    const unsub = subscribeSavedPosts(currentUser.uid, (saved) => {
      setSavedPosts(saved);
    });
    return () => unsub();
  }, [isMe, currentUser]);

  const handleOpenEdit = () => {
    if (!profile) return;
    setEditName(profile.displayName || '');
    setEditBio(profile.bio || '');
    setEditWebsite(profile.website || '');
    setEditPhotoURL(profile.photoURL || '');
    setEditBadge(profile.leafBadge || LEAF_BADGES[0]);
    setEditIsPrivate(profile.isPrivate || false);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMe) return;
    setIsSaving(true);
    try {
      await updateCurrentProfile({
        displayName: editName.trim(),
        bio: editBio.trim(),
        website: editWebsite.trim(),
        photoURL: editPhotoURL.trim(),
        leafBadge: editBadge,
        isPrivate: editIsPrivate,
      });
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUser || !myProfile || !profile) {
      if (onRequireAuth) onRequireAuth();
      else signInWithGoogle();
      return;
    }
    const newStatus = await toggleFollowUser(currentUser.uid, profile.id, myProfile);
    setIsFollowing(newStatus);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            followersCount: Math.max(0, (prev.followersCount || 0) + (newStatus ? 1 : -1)),
          }
        : null
    );
  };

  const displayFgTimeId = profile?.fgTimeId || (profile?.id ? `FG-${profile.id.slice(0, 6).toUpperCase()}` : 'FG-MEMBER');

  const handleCopyFgTimeId = () => {
    if (!displayFgTimeId) return;
    navigator.clipboard.writeText(displayFgTimeId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (!profile) {
    return (
      <div className="p-12 text-center text-stone-500">
        Loading garden profile...
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-2">
      {/* Profile Card */}
      <div className="bg-white dark:bg-[#12372A]/70 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800/40 shadow-sm overflow-hidden mb-6">
        {/* Cover Area */}
        <div className="h-36 sm:h-44 w-full bg-gradient-to-r from-[#12372A] via-[#1B5E20] to-[#00C853] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
          <div className="absolute bottom-3 right-4 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00C853]" />
            <span>FG TIME Garden</span>
          </div>
        </div>

        {/* Profile Info */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex items-end justify-between -mt-14 mb-4">
            <img
              src={profile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={profile.displayName}
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white dark:ring-[#12372A] shadow-xl"
            />

            <div className="flex items-center gap-2">
              {isMe ? (
                <>
                  <button
                    onClick={handleOpenEdit}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-stone-200 dark:border-emerald-800 hover:border-[#00C853] hover:bg-[#00C853]/5 text-xs font-bold text-stone-800 dark:text-stone-100 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#00C853]" />
                    <span>Edit Profile</span>
                  </button>

                  {onOpenSettings && (
                    <button
                      onClick={onOpenSettings}
                      className="p-2 rounded-2xl border border-stone-200 dark:border-emerald-800 hover:border-[#00C853] hover:bg-[#00C853]/10 text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
                      title="Settings Center"
                    >
                      <Settings className="w-4 h-4 text-[#00C853]" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleToggleFollow}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                      isFollowing
                        ? 'bg-stone-100 dark:bg-emerald-900/60 text-stone-700 dark:text-stone-200 border border-stone-200 dark:border-emerald-800'
                        : 'bg-[#00C853] hover:bg-[#00A344] text-white shadow-[#00C853]/20'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow Garden</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenMessageWithUser(profile.id)}
                    className="p-2 rounded-2xl border border-stone-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-stone-700 dark:text-stone-200 transition-colors"
                    title="Direct Message"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Names & Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-black text-[#12372A] dark:text-white">
              {profile.displayName}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] font-bold">
              {profile.leafBadge || 'Forest Sprout 🌱'}
            </span>
            {profile.isPrivate && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-emerald-950 text-stone-600 dark:text-stone-300 font-semibold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Private
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <p className="text-xs text-stone-400">@{profile.username}</p>
            <span className="text-stone-300 dark:text-stone-600">•</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-[#00C853]/30 text-[11px] font-mono text-[#00C853]">
              <span className="font-semibold text-stone-500 dark:text-stone-400">FG TIME ID:</span>
              <span className="font-bold">{displayFgTimeId}</span>
              <button
                type="button"
                onClick={handleCopyFgTimeId}
                className="ml-1 text-[#00C853] hover:text-[#00A344] cursor-pointer transition-transform active:scale-90"
                title="Copy FG TIME ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-[#00C853]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            {copiedId && (
              <span className="text-[10px] text-[#00C853] font-semibold animate-pulse">Copied!</span>
            )}
          </div>

          {/* Couple Badge if Connected */}
          {profile.partnerUsername && (profile.isCouplePublic ?? true) && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => onOpenCoupleSpace && onOpenCoupleSpace()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/15 via-rose-500/15 to-purple-500/15 border border-pink-400/30 text-xs font-bold text-pink-600 dark:text-pink-300 hover:scale-105 transition-all shadow-sm cursor-pointer"
                title="View Couple Space"
              >
                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500 animate-pulse" />
                <span>Connected with @{profile.partnerUsername}</span>
                {profile.anniversaryDate && (
                  <span className="text-[10px] text-purple-500 dark:text-purple-300 font-semibold">
                    • Since {profile.anniversaryDate} 💕
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Quick link to Couple Connect if viewing own profile and not yet connected */}
          {isMe && !profile.partnerUsername && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => onOpenCoupleSpace && onOpenCoupleSpace()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-[#00C853]/10 hover:bg-pink-500/20 border border-pink-300/40 text-xs font-bold text-pink-600 dark:text-pink-300 transition-all cursor-pointer"
              >
                <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
                <span>Couple Connect: Link hearts with your partner 💖</span>
              </button>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-200 mb-3 whitespace-pre-wrap leading-relaxed">
              {profile.bio}
            </p>
          )}

          {/* Interests Chips */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {profile.interests.map((interest) => (
                <span
                  key={interest}
                  className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-[#00C853] font-semibold"
                >
                  {interest}
                </span>
              ))}
            </div>
          )}

          {/* Website & Join Date */}
          <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-stone-400 flex-wrap mb-4">
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#00C853] hover:underline"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{profile.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Joined{' '}
                {new Date(profile.createdAt).toLocaleDateString([], {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          {/* Counters Row */}
          <div className="flex items-center gap-6 pt-3 border-t border-emerald-100 dark:border-emerald-800/40 text-xs">
            <div>
              <span className="font-bold text-[#12372A] dark:text-white mr-1">
                {userPosts.length}
              </span>
              <span className="text-stone-500">Sprouts</span>
            </div>
            <div>
              <span className="font-bold text-[#12372A] dark:text-white mr-1">
                {profile.followersCount || 0}
              </span>
              <span className="text-stone-500">Followers</span>
            </div>
            <div>
              <span className="font-bold text-[#12372A] dark:text-white mr-1">
                {profile.followingCount || 0}
              </span>
              <span className="text-stone-500">Following</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-8 border-b border-emerald-100 dark:border-emerald-800/40 mb-5">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-1.5 py-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'posts'
              ? 'border-[#00C853] text-[#00C853]'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <span>Feed View</span>
        </button>

        <button
          onClick={() => setActiveTab('grid')}
          className={`flex items-center gap-1.5 py-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'grid'
              ? 'border-[#00C853] text-[#00C853]'
              : 'border-transparent text-stone-400 hover:text-stone-600'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span>Grid View</span>
        </button>

        {isMe && (
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-1.5 py-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'saved'
                ? 'border-[#00C853] text-[#00C853]'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Saved Sprouts</span>
          </button>
        )}
      </div>

      {/* Posts Section */}
      {activeTab === 'posts' && (
        <div className="flex flex-col gap-4">
          {userPosts.length > 0 ? (
            userPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenReport={onOpenReportPost}
              />
            ))
          ) : (
            <div className="p-8 text-center text-xs text-stone-400">
              No sprouts in this garden yet.
            </div>
          )}
        </div>
      )}

      {activeTab === 'grid' && (
        <div className="grid grid-cols-3 gap-2">
          {userPosts.map((post) => (
            <div
              key={post.id}
              className="aspect-square rounded-2xl overflow-hidden bg-stone-100 dark:bg-emerald-900/30 border border-emerald-100/60 dark:border-emerald-800/30 relative group"
            >
              {post.mediaType === 'video' || post.imageUrl?.endsWith('.mp4') ? (
                <div className="relative w-full h-full bg-black">
                  <video
                    src={post.imageUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white pointer-events-none">
                    <Film className="w-3 h-3 text-[#00C853]" />
                  </div>
                </div>
              ) : post.imageUrl ? (
                <img
                  src={post.imageUrl}
                  alt="Sprout"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-2.5 text-[10px] text-stone-700 dark:text-stone-300 line-clamp-3">
                  {post.content}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                <Heart className="w-3.5 h-3.5 fill-white" />
                <span>{post.likesCount || 0}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved Posts Tab (Private to user) */}
      {activeTab === 'saved' && isMe && (
        <div className="flex flex-col gap-4">
          {savedPosts.length > 0 ? (
            savedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onOpenReport={onOpenReportPost}
              />
            ))
          ) : (
            <div className="p-12 text-center bg-white dark:bg-[#12372A]/40 rounded-3xl border border-emerald-100 dark:border-emerald-800/40">
              <Bookmark className="w-8 h-8 text-[#00C853] mx-auto mb-2 opacity-60" />
              <p className="text-xs text-stone-500">
                You haven't saved any sprouts yet. Tap the bookmark icon on any post to save it to your private garden!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#12372A] dark:text-white">
                Edit Garden Profile
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-3.5">
              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Avatar Photo URL
                </label>
                <input
                  type="url"
                  value={editPhotoURL}
                  onChange={(e) => setEditPhotoURL(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Botanical Title / Badge
                </label>
                <select
                  value={editBadge}
                  onChange={(e) => setEditBadge(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                >
                  {LEAF_BADGES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853] resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Website / Garden Link
                </label>
                <input
                  type="url"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              {/* Privacy Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80">
                <div>
                  <p className="text-xs font-bold text-[#12372A] dark:text-white">
                    Private Account
                  </p>
                  <p className="text-[10px] text-stone-500">
                    Only approved followers can view your garden
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editIsPrivate}
                  onChange={(e) => setEditIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-[#00C853]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00C853] hover:bg-[#00A344] rounded-xl shadow-md cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
