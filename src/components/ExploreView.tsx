import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  User,
  Tag,
  Heart,
  MessageCircle,
  History,
  X,
  TrendingUp,
  Lightbulb,
  Compass,
} from 'lucide-react';
import { UserProfile, PostItem } from '../types';
import {
  searchUsers,
  subscribePosts,
  toggleFollowUser,
  checkIsFollowing,
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';

interface ExploreViewProps {
  onSelectPost?: (post: PostItem) => void;
  onOpenUserProfile?: (userId: string) => void;
}

const POPULAR_HASHTAGS = [
  '#SaveTheSoil',
  '#GreenLiving',
  '#IndoorPlants',
  '#MonsteraDeliciosa',
  '#Permaculture',
  '#UrbanJungle',
  '#ForestBathing',
];

export const ExploreView: React.FC<ExploreViewProps> = ({
  onSelectPost,
  onOpenUserProfile,
}) => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [matchingUsers, setMatchingUsers] = useState<UserProfile[]>([]);
  const [allPosts, setAllPosts] = useState<PostItem[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('fgtime_search_history') || '[]');
    } catch {
      return [];
    }
  });

  const [aiRecommendations, setAiRecommendations] = useState<{
    trendingTags?: string[];
    prompts?: string[];
    botanicalTip?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/ai/recommendations')
      .then((res) => res.json())
      .then((data) => setAiRecommendations(data))
      .catch(() => {});
  }, []);

  const categories = [
    { id: 'all', label: 'All Sprouts' },
    { id: 'nature', label: '🌿 Nature & Flora' },
    { id: 'vibes', label: '🍃 Botanical Vibes' },
    { id: 'green-tech', label: '🔋 Eco Tech & Living' },
  ];

  useEffect(() => {
    const unsub = subscribePosts((posts) => {
      setAllPosts(posts);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (searchTerm.trim().length > 0) {
      searchUsers(searchTerm.trim())
        .then((users) => {
          if (!Array.isArray(users)) return;
          setMatchingUsers(users);
          if (currentUser) {
            users.forEach(async (u) => {
              const isFollowing = await checkIsFollowing(currentUser.uid, u.id);
              setFollowingMap((prev) => ({ ...prev, [u.id]: isFollowing }));
            });
          }
        })
        .catch((err) => {
          console.warn('Could not search users:', err);
        });
    } else {
      setMatchingUsers([]);
    }
  }, [searchTerm, currentUser]);

  const handleExecuteSearch = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setSearchTerm(clean);

    // Save to history
    const updated = [clean, ...searchHistory.filter((s) => s !== clean)].slice(0, 8);
    setSearchHistory(updated);
    localStorage.setItem('fgtime_search_history', JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('fgtime_search_history');
  };

  const handleRemoveHistoryItem = (item: string) => {
    const updated = searchHistory.filter((s) => s !== item);
    setSearchHistory(updated);
    localStorage.setItem('fgtime_search_history', JSON.stringify(updated));
  };

  const handleFollow = async (targetUser: UserProfile) => {
    if (!currentUser || !userProfile) {
      signInWithGoogle();
      return;
    }
    const isNowFollowing = await toggleFollowUser(currentUser.uid, targetUser.id, userProfile);
    setFollowingMap((prev) => ({ ...prev, [targetUser.id]: isNowFollowing }));
  };

  const filteredPosts = allPosts.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      !searchTerm.trim() ||
      p.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.authorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full flex flex-col gap-4 py-2">
      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          placeholder="Search by FG TIME ID (e.g. FG-12AB), @username, or hashtags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleExecuteSearch(searchTerm);
          }}
          className="w-full pl-12 pr-14 py-3 text-xs sm:text-sm rounded-2xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#12372A]/80 text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853] shadow-sm"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 hover:text-stone-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search History Chips if not searching */}
      {!searchTerm && searchHistory.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#12372A]/60 border border-[#00C853]/20 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5 uppercase">
              <History className="w-3.5 h-3.5 text-[#00C853]" />
              <span>Recent Searches</span>
            </span>
            <button
              onClick={handleClearHistory}
              className="text-[10px] text-stone-400 hover:text-red-500 font-bold"
            >
              Clear All
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {searchHistory.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-stone-100 dark:bg-[#101512] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-emerald-900"
              >
                <button
                  onClick={() => handleExecuteSearch(item)}
                  className="hover:underline font-medium"
                >
                  {item}
                </button>
                <button
                  onClick={() => handleRemoveHistoryItem(item)}
                  className="text-stone-400 hover:text-red-500 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Popular Hashtags */}
      {!searchTerm && (
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
          <span className="text-[11px] font-bold text-stone-400 shrink-0 mr-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-[#00C853]" /> Popular:
          </span>
          {POPULAR_HASHTAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleExecuteSearch(tag)}
              className="text-xs px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-[#00C853] font-semibold whitespace-nowrap hover:bg-[#00C853] hover:text-white transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === c.id
                ? 'bg-[#00C853] text-white shadow-md shadow-[#00C853]/20'
                : 'bg-white dark:bg-[#12372A]/60 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-emerald-800 hover:bg-[#00C853]/10'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* AI Smart Discovery & Botanical Tip Banner */}
      {!searchTerm && aiRecommendations && (
        <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-[#12372A] dark:via-[#101512] dark:to-[#12372A] border border-[#00C853]/30 shadow-sm flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#12372A] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#00C853]" />
              <span>AI Botanical Discovery</span>
            </span>
            <span className="text-[10px] uppercase font-bold text-[#00C853] bg-[#00C853]/10 px-2 py-0.5 rounded-full">
              Gemini Powered
            </span>
          </div>

          {aiRecommendations.botanicalTip && (
            <div className="p-3 rounded-2xl bg-white/80 dark:bg-emerald-950/40 border border-[#00C853]/20 text-xs text-stone-700 dark:text-stone-200 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-[#00C853] shrink-0 mt-0.5" />
              <span>{aiRecommendations.botanicalTip}</span>
            </div>
          )}

          {aiRecommendations.prompts && aiRecommendations.prompts.length > 0 && (
            <div className="flex flex-col gap-1 mt-0.5">
              <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                🌱 Sprout Prompt Inspiration:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {aiRecommendations.prompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecuteSearch(p.slice(0, 20))}
                    className="text-[11px] px-3 py-1 rounded-xl bg-white dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 hover:border-[#00C853] text-stone-700 dark:text-stone-200 transition-colors cursor-pointer text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Matching Gardeners Section (if searching) */}
      {matchingUsers.length > 0 && (
        <div className="bg-white dark:bg-[#12372A]/60 p-4 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#00C853] mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>Community Gardeners Found</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matchingUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/60"
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                  onClick={() => onOpenUserProfile && onOpenUserProfile(u.id)}
                >
                  <img
                    src={u.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={u.displayName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]/40 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#12372A] dark:text-white truncate">
                      {u.displayName}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] text-stone-400">@{u.username}</span>
                      <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded border border-[#00C853]/25 text-[#00C853] font-bold">
                        {u.fgTimeId || `FG-${u.id.slice(0, 6).toUpperCase()}`}
                      </span>
                    </div>
                  </div>
                </div>

                {currentUser && currentUser.uid !== u.id && (
                  <button
                    onClick={() => handleFollow(u)}
                    className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${
                      followingMap[u.id]
                        ? 'bg-stone-200 dark:bg-emerald-900 text-stone-700 dark:text-stone-300'
                        : 'bg-[#00C853] text-white hover:bg-[#00A344]'
                    }`}
                  >
                    {followingMap[u.id] ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explore Grid of Posts */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
            {searchTerm ? 'Search Results' : 'Explore Garden Grid'}
          </span>
          <span className="text-xs text-stone-400 font-semibold">
            {filteredPosts.length} sprouts
          </span>
        </div>

        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => onSelectPost && onSelectPost(post)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 dark:bg-emerald-900/30 cursor-pointer border border-[#00C853]/20 dark:border-emerald-800/40"
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt="Sprout"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full p-3.5 flex flex-col justify-between bg-gradient-to-br from-[#00C853]/10 to-[#12372A]/10">
                    <p className="text-xs text-stone-800 dark:text-stone-200 line-clamp-4 font-semibold">
                      {post.content}
                    </p>
                    <span className="text-[10px] text-[#00C853] font-bold">
                      @{post.authorUsername}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white font-bold text-xs">
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4 fill-white" />
                    <span>{post.likesCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4 fill-white" />
                    <span>{post.commentsCount || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center bg-white dark:bg-[#12372A]/40 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800">
            <p className="text-sm text-stone-500">
              No matching sprouts found. Try searching for a different plant or hashtag! 🌿
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
