import React, { useState, useEffect } from 'react';
import { TrendingUp, UserPlus, ShieldCheck, Sparkles, Sprout } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { searchUsers, toggleFollowUser, checkIsFollowing } from '../services/firestoreService';

interface RightSidebarProps {
  onSelectTag: (tag: string) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  onSelectTag,
  onOpenUserProfile,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const trendingTopics = [
    { tag: '#SaveTheSoil', count: '14.2k sprouts' },
    { tag: '#GreenLiving', count: '10.8k sprouts' },
    { tag: '#MonsteraDeliciosa', count: '8.4k sprouts' },
    { tag: '#Permaculture', count: '6.1k sprouts' },
    { tag: '#UrbanJungle', count: '5.9k sprouts' },
    { tag: '#ForestBathing', count: '4.3k sprouts' },
  ];

  useEffect(() => {
    searchUsers('')
      .then(async (users) => {
        if (!Array.isArray(users)) return;
        const filtered = users
          .filter((u) => u.id !== currentUser?.uid)
          .slice(0, 4);
        setSuggestedUsers(filtered);

        if (currentUser) {
          const map: Record<string, boolean> = {};
          for (const u of filtered) {
            map[u.id] = await checkIsFollowing(currentUser.uid, u.id);
          }
          setFollowingMap(map);
        }
      })
      .catch((err) => {
        console.warn('Could not load sidebar suggestions:', err);
      });
  }, [currentUser]);

  const handleFollow = async (targetUser: UserProfile) => {
    if (!currentUser || !userProfile) return;
    try {
      const isNowFollowing = await toggleFollowUser(currentUser.uid, targetUser.id, userProfile);
      setFollowingMap((prev) => ({ ...prev, [targetUser.id]: isNowFollowing }));
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  return (
    <aside className="w-80 shrink-0 hidden lg:flex flex-col gap-5 p-4 border-l border-[#00C853]/20 dark:border-emerald-800/40 h-screen sticky top-0 overflow-y-auto">
      {/* Brand Vision Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-[#00C853]/15 via-[#69F0AE]/10 to-[#12372A]/10 border border-[#00C853]/30 dark:border-emerald-800/60 relative overflow-hidden">
        <div className="flex items-center gap-2 text-[#12372A] dark:text-[#69F0AE] font-bold text-xs uppercase tracking-wider mb-1">
          <Sprout className="w-4 h-4 text-[#00C853]" />
          <span>Eco Wisdom of the Day</span>
        </div>
        <p className="text-xs text-stone-700 dark:text-stone-300 italic leading-relaxed">
          "Share Moments. Connect Hearts. Grow Together."
        </p>
        <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 block">
          — FG TIME Community Motto
        </span>
      </div>

      {/* Suggested Gardeners */}
      <div className="p-4 rounded-3xl bg-white/80 dark:bg-[#12372A]/40 border border-[#00C853]/20 dark:border-emerald-800/40 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
            <UserPlus className="w-4 h-4 text-[#00C853]" />
            <span>Sprouting Gardeners</span>
          </div>
          <span className="text-[11px] text-[#00C853] font-bold">
            Active
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {suggestedUsers.length > 0 ? (
            suggestedUsers.map((u) => {
              const isFollowing = followingMap[u.id];
              return (
                <div key={u.id} className="flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                    onClick={() => onOpenUserProfile && onOpenUserProfile(u.id)}
                  >
                    <img
                      src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={u.displayName}
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-[#00C853]/40 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate text-[#12372A] dark:text-white">
                        {u.displayName}
                      </p>
                      <p className="text-[11px] text-stone-400 truncate">
                        @{u.username}
                      </p>
                    </div>
                  </div>

                  {currentUser && currentUser.uid !== u.id && (
                    <button
                      onClick={() => handleFollow(u)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                        isFollowing
                          ? 'bg-stone-100 dark:bg-emerald-900/40 text-stone-600 dark:text-stone-300 hover:bg-red-50 hover:text-red-600'
                          : 'bg-[#00C853] text-white hover:bg-[#00A344] shadow-sm shadow-[#00C853]/20'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-stone-400 py-2">
              All community members are connected.
            </p>
          )}
        </div>
      </div>

      {/* Trending Topics */}
      <div className="p-4 rounded-3xl bg-white/80 dark:bg-[#12372A]/40 border border-[#00C853]/20 dark:border-emerald-800/40 shadow-sm">
        <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm mb-3">
          <TrendingUp className="w-4 h-4 text-[#00C853]" />
          <span>Trending on Roots Feed</span>
        </div>

        <div className="flex flex-col gap-2.5">
          {trendingTopics.map((topic) => (
            <div
              key={topic.tag}
              onClick={() => onSelectTag(topic.tag)}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-[#00C853]/10 cursor-pointer transition-colors group"
            >
              <div>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 group-hover:text-[#00C853] transition-colors">
                  {topic.tag}
                </span>
                <p className="text-[10px] text-stone-400">{topic.count}</p>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-[#00C853] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure & Security Badge */}
      <div className="p-3.5 rounded-2xl bg-[#00C853]/10 border border-[#00C853]/20 text-stone-600 dark:text-stone-300 text-[11px] flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-[#12372A] dark:text-[#69F0AE]">
          <ShieldCheck className="w-4 h-4 text-[#00C853]" />
          <span>Cloud Firestore & Zero-Trust Rules</span>
        </div>
        <p className="text-[10px] leading-relaxed">
          Real-time persistence with Google Cloud Firestore, Firebase Auth, and mathematically verified ABAC security rules.
        </p>
      </div>

      <div className="text-[10px] text-stone-400 text-center pb-6">
        © 2026 FG TIME • Share Moments. Connect Hearts. Grow Together.
      </div>
    </aside>
  );
};
