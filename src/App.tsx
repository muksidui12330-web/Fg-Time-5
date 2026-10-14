import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MediaCoordinatorProvider, useMediaCoordinator } from './context/MediaCoordinatorContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { MobileNav } from './components/MobileNav';
import { RightSidebar } from './components/RightSidebar';
import { StoriesBar } from './components/StoriesBar';
import { CreatePostModal } from './components/CreatePostModal';
import { PostCard } from './components/PostCard';
import { ReelsView } from './components/ReelsView';
import { MusicStudioView } from './components/MusicStudioView';
import { ExploreView } from './components/ExploreView';
import { MessagesView } from './components/MessagesView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { CoupleSpaceView } from './components/CoupleSpaceView';
import { SettingsModal } from './components/SettingsModal';
import { ReportModal } from './components/ReportModal';
import { AuthModal } from './components/AuthModal';
import { SplashScreen } from './components/SplashScreen';
import { SproutAiAssistantModal } from './components/SproutAiAssistantModal';
import { DownloadApkModal } from './components/DownloadApkModal';
import { isApkDownloadAvailable } from './config/apkConfig';
import { PostItem, UserProfile, PostMusic } from './types';
import {
  subscribePosts,
  subscribeNotifications,
  subscribeUserConversations,
  seedCommunityDataIfEmpty,
  searchUsers,
  toggleFollowUser,
  checkIsFollowing,
  INITIAL_CURATED_POSTS,
} from './services/firestoreService';
import { Sparkles, Sprout, Plus, UserPlus, Flame, Loader2, RotateCcw, AlertCircle, Smartphone, Download } from 'lucide-react';

const MainApp: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const { stopAllMedia } = useMediaCoordinator();
  const [showSplash, setShowSplash] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('feed');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<'all' | 'following' | 'suggested'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [selectedTrackForPost, setSelectedTrackForPost] = useState<PostMusic | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isDownloadApkOpen, setIsDownloadApkOpen] = useState(false);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [activeProfileUserId, setActiveProfileUserId] = useState<string | null>(null);
  const [targetMessageUserId, setTargetMessageUserId] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  // Auto-seed community data once on initial mount if database is empty
  useEffect(() => {
    seedCommunityDataIfEmpty(userProfile);
  }, [userProfile]);

  // Fetch suggested accounts for the home feed
  useEffect(() => {
    searchUsers('')
      .then(async (users) => {
        if (!Array.isArray(users)) return;
        const filtered = users.filter((u) => u.id !== currentUser?.uid).slice(0, 5);
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
        console.warn('Could not load suggested accounts:', err);
      });
  }, [currentUser]);

  // Subscribe to live posts with fallback to curated posts
  useEffect(() => {
    setIsLoadingPosts(true);
    setFeedError(null);
    const unsub = subscribePosts(
      (fetchedPosts) => {
        if (fetchedPosts && fetchedPosts.length > 0) {
          setPosts(fetchedPosts);
        } else {
          // If Firestore is empty, show curated nature starter posts
          setPosts(INITIAL_CURATED_POSTS);
        }
        setIsLoadingPosts(false);
      },
      categoryFilter === 'all' ? undefined : categoryFilter,
      (err) => {
        console.warn('Feed load error:', err);
        setFeedError('Unable to connect to live feed. Displaying verified local moments.');
        setPosts((prev) => (prev.length > 0 ? prev : INITIAL_CURATED_POSTS));
        setIsLoadingPosts(false);
      }
    );
    return () => unsub();
  }, [categoryFilter]);

  // Subscribe to unread notifications
  useEffect(() => {
    if (!currentUser) {
      setUnreadNotifications(0);
      return;
    }
    const unsub = subscribeNotifications(currentUser.uid, (notifs) => {
      const unread = notifs.filter((n) => !n.read).length;
      setUnreadNotifications(unread);
    });
    return () => unsub();
  }, [currentUser]);

  // Subscribe to unread messages
  useEffect(() => {
    if (!currentUser) {
      setUnreadMessages(0);
      return;
    }
    const unsub = subscribeUserConversations(currentUser.uid, (convs) => {
      const unread = convs.filter((c) => {
        const lastRead = c.readBy?.[currentUser.uid];
        return (
          c.lastSenderId &&
          c.lastSenderId !== currentUser.uid &&
          (!lastRead || (c.lastMessageTime && new Date(c.lastMessageTime) > new Date(lastRead)))
        );
      }).length;
      setUnreadMessages(unread);
    });
    return () => unsub();
  }, [currentUser]);

  // Theme toggle
  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const handleOpenUserProfile = (userId: string) => {
    setActiveProfileUserId(userId);
    setCurrentTab('profile');
  };

  const handleOpenMessageWithUser = (userId: string) => {
    setTargetMessageUserId(userId);
    setCurrentTab('messages');
  };

  const handleFollowUser = async (targetUser: UserProfile) => {
    if (!currentUser || !userProfile) {
      setIsAuthModalOpen(true);
      return;
    }
    const isNowFollowing = await toggleFollowUser(currentUser.uid, targetUser.id, userProfile);
    setFollowingMap((prev) => ({ ...prev, [targetUser.id]: isNowFollowing }));
  };

  // Filter posts (hide blocked users, filter following if selected)
  const displayPosts = posts.filter((p) => {
    if (userProfile?.blockedUsers?.includes(p.authorId)) {
      return false;
    }
    if (feedFilter === 'following') {
      return followingMap[p.authorId] === true || p.authorId === currentUser?.uid;
    }
    return true;
  });

  const handleTabChange = (tab: NavTab) => {
    stopAllMedia();
    if (tab === 'profile') setActiveProfileUserId(null);
    setCurrentTab(tab);
  };

  return (
    <div
      className={`min-h-screen bg-[#EAF8EF] dark:bg-[#101512] text-[#101512] dark:text-white flex flex-col ${
        isDarkMode ? 'dark' : ''
      }`}
    >
      {/* Splash Screen */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} minDurationMs={1600} />
      )}

      {/* Prominent Top Download APK Banner (Mobile & Desktop) */}
      <div className="w-full bg-gradient-to-r from-[#12372A] via-[#1B5E20] to-[#12372A] text-white py-2 px-3 sm:px-4 border-b border-[#00C853]/30 flex items-center justify-between shadow-xs z-30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#00C853]/25 flex items-center justify-center shrink-0 ring-1 ring-[#00C853]/60">
            <Smartphone className="w-3.5 h-3.5 text-[#00C853]" />
          </div>
          <div className="text-xs truncate">
            <span className="font-extrabold text-[#69F0AE] mr-1.5">FG TIME Android App:</span>
            <span className="text-stone-200 hidden sm:inline">Official signed release (v1.2.0 • 18.4 MB). </span>
            <span className="text-stone-300 text-[11px]">Install for native push whispers & instant leaf feed!</span>
          </div>
        </div>

        <button
          onClick={() => setIsDownloadApkOpen(true)}
          className="ml-2 px-3 py-1.5 rounded-xl bg-[#00C853] hover:bg-[#00E676] text-[#12372A] font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#12372A]" />
          <span>{isApkDownloadAvailable() ? 'Download APK' : 'APK Coming Soon'}</span>
        </button>
      </div>

      {/* Top Navbar on mobile */}
      <Navbar
        onTabChange={handleTabChange}
        onOpenCreatePost={() => {
          if (!currentUser) setIsAuthModalOpen(true);
          else setIsCreatePostOpen(true);
        }}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDownloadApk={() => setIsDownloadApkOpen(true)}
        unreadNotificationsCount={unreadNotifications}
        unreadMessagesCount={unreadMessages}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto justify-between relative">
        {/* Left Desktop Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onTabChange={handleTabChange}
          onOpenCreatePost={() => {
            if (!currentUser) setIsAuthModalOpen(true);
            else setIsCreatePostOpen(true);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantOpen(true)}
          onOpenDownloadApk={() => setIsDownloadApkOpen(true)}
          unreadNotificationsCount={unreadNotifications}
          unreadMessagesCount={unreadMessages}
        />

        {/* Central Feed / Main Viewport */}
        <main className="flex-1 max-w-2xl w-full mx-auto px-3 sm:px-4 py-4 pb-20 md:pb-6">
          {currentTab === 'feed' && (
            <div className="flex flex-col gap-3">
              {/* Stories Carousel */}
              <StoriesBar />

              {/* Feed Header with Following & Category Tabs */}
              <div className="flex flex-col gap-2 pb-2 border-b border-[#00C853]/20 dark:border-emerald-800/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setFeedFilter('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        feedFilter === 'all'
                          ? 'bg-[#00C853] text-white shadow-sm'
                          : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                      }`}
                    >
                      For You (Roots)
                    </button>
                    <button
                      onClick={() => setFeedFilter('following')}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        feedFilter === 'following'
                          ? 'bg-[#00C853] text-white shadow-sm'
                          : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                      }`}
                    >
                      Following Gardeners
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (!currentUser) setIsAuthModalOpen(true);
                      else setIsCreatePostOpen(true);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00C853]/15 text-[#00C853] font-bold text-xs hover:bg-[#00C853]/25 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Sprout</span>
                  </button>
                </div>

                {/* Secondary Category Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap ${
                      categoryFilter === 'all'
                        ? 'bg-stone-200 dark:bg-emerald-900/60 text-stone-900 dark:text-white'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    All Categories
                  </button>
                  <button
                    onClick={() => setCategoryFilter('nature')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap ${
                      categoryFilter === 'nature'
                        ? 'bg-stone-200 dark:bg-emerald-900/60 text-stone-900 dark:text-white'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    🌿 Nature & Flora
                  </button>
                  <button
                    onClick={() => setCategoryFilter('vibes')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap ${
                      categoryFilter === 'vibes'
                        ? 'bg-stone-200 dark:bg-emerald-900/60 text-stone-900 dark:text-white'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    🍃 Botanical Vibes
                  </button>
                  <button
                    onClick={() => setCategoryFilter('green-tech')}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap ${
                      categoryFilter === 'green-tech'
                        ? 'bg-stone-200 dark:bg-emerald-900/60 text-stone-900 dark:text-white'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    🔋 Eco Living
                  </button>
                </div>
              </div>

              {/* Feed Stream */}
              <div className="flex flex-col gap-4 mt-2">
                {feedError && (
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>{feedError}</span>
                    </div>
                    <button
                      onClick={() => setCategoryFilter(categoryFilter)}
                      className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Sync</span>
                    </button>
                  </div>
                )}

                {isLoadingPosts ? (
                  <div className="flex flex-col gap-4">
                    {[1, 2].map((s) => (
                      <div
                        key={s}
                        className="bg-white dark:bg-[#12372A]/80 rounded-3xl p-4 border border-[#00C853]/15 shadow-sm animate-pulse flex flex-col gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#00C853]/20" />
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="w-28 h-3 rounded bg-stone-200 dark:bg-emerald-900/40" />
                            <div className="w-20 h-2.5 rounded bg-stone-100 dark:bg-emerald-900/20" />
                          </div>
                        </div>
                        <div className="w-full h-4 rounded bg-stone-100 dark:bg-emerald-900/30" />
                        <div className="w-4/5 h-4 rounded bg-stone-100 dark:bg-emerald-900/20" />
                        <div className="w-full h-56 rounded-2xl bg-[#00C853]/10 flex items-center justify-center">
                          <Sprout className="w-8 h-8 text-[#00C853]/30" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayPosts.length > 0 ? (
                  displayPosts.map((post, idx) => (
                    <React.Fragment key={post.id}>
                      <PostCard
                        post={post}
                        onOpenReport={(pId) => setReportingPostId(pId)}
                        onSelectTag={() => setCurrentTab('explore')}
                        onOpenAuthorProfile={(authId) => handleOpenUserProfile(authId)}
                        onRequireAuth={() => setIsAuthModalOpen(true)}
                      />

                      {/* Clearly Labeled Suggested Content Carousel inserted after 2nd post */}
                      {idx === 1 && suggestedUsers.length > 0 && (
                        <div className="my-2 p-4 rounded-3xl bg-white dark:bg-[#12372A]/80 border border-[#00C853]/20 dark:border-emerald-800 shadow-sm">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#12372A] dark:text-white uppercase tracking-wider">
                              <Flame className="w-4 h-4 text-[#00C853]" />
                              <span>Suggested Gardeners for You</span>
                            </div>
                            <span className="text-[10px] text-stone-400">
                              Based on green interests
                            </span>
                          </div>

                          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                            {suggestedUsers.map((su) => (
                              <div
                                key={su.id}
                                className="flex flex-col items-center p-3 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/60 shrink-0 w-36 text-center"
                              >
                                <img
                                  src={su.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                                  alt={su.displayName}
                                  onClick={() => handleOpenUserProfile(su.id)}
                                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#00C853]/40 mb-1.5 cursor-pointer"
                                />
                                <p
                                  onClick={() => handleOpenUserProfile(su.id)}
                                  className="text-xs font-bold truncate max-w-[120px] cursor-pointer hover:underline"
                                >
                                  {su.displayName}
                                </p>
                                <p className="text-[10px] text-stone-400 truncate max-w-[120px] mb-2">
                                  @{su.username}
                                </p>
                                <button
                                  onClick={() => handleFollowUser(su)}
                                  className={`w-full py-1 rounded-xl text-[11px] font-bold transition-all ${
                                    followingMap[su.id]
                                      ? 'bg-stone-200 dark:bg-emerald-900 text-stone-700 dark:text-stone-300'
                                      : 'bg-[#00C853] text-white hover:bg-[#00A344]'
                                  }`}
                                >
                                  {followingMap[su.id] ? 'Following' : 'Follow'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <div className="p-12 text-center bg-white dark:bg-[#12372A]/40 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800">
                    <Sprout className="w-12 h-12 text-[#00C853] mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
                      {feedFilter === 'following'
                        ? 'No sprouts from followed accounts yet'
                        : 'The garden is serene'}
                    </h3>
                    <p className="text-xs text-stone-500 max-w-xs mx-auto mt-1 mb-4">
                      {feedFilter === 'following'
                        ? 'Follow some gardeners or switch back to the main Roots feed!'
                        : 'Be the first to sprout a leaf post and share your green perspectives.'}
                    </p>
                    <button
                      onClick={() => {
                        if (!currentUser) setIsAuthModalOpen(true);
                        else setIsCreatePostOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-2xl bg-[#00C853] text-white font-bold text-xs shadow-md shadow-[#00C853]/20 cursor-pointer"
                    >
                      Sprout a Post Now
                    </button>
                  </div>
                )}

                {/* Instagram-Style "You're All Caught Up" Celebration Banner */}
                {displayPosts.length > 0 && (
                  <div className="my-6 p-6 rounded-3xl bg-white dark:bg-[#12372A]/60 border border-[#00C853]/30 dark:border-emerald-800 text-center flex flex-col items-center gap-2 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center ring-4 ring-[#00C853]/20">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-[#12372A] dark:text-white">
                      You're All Caught Up! 🌿
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-300 max-w-sm">
                      You've seen all the fresh green moments and sprouts from today. Keep nurturing your connections or explore new community creators!
                    </p>
                    <button
                      onClick={() => setCurrentTab('explore')}
                      className="mt-2 px-4 py-2 rounded-xl bg-stone-100 dark:bg-emerald-900/60 hover:bg-[#00C853] hover:text-white text-xs font-bold transition-all text-stone-700 dark:text-stone-200 cursor-pointer"
                    >
                      Discover New Gardeners in Explore
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'explore' && (
            <ExploreView
              onOpenUserProfile={(uId) => handleOpenUserProfile(uId)}
              onSelectPost={() => setCurrentTab('feed')}
            />
          )}

          {currentTab === 'reels' && <ReelsView />}

          {currentTab === 'music' && (
            <MusicStudioView
              onSelectTrackForPost={(track) => {
                setSelectedTrackForPost(track);
                setIsCreatePostOpen(true);
              }}
            />
          )}

          {currentTab === 'couple' && (
            <CoupleSpaceView
              onOpenMessageWithUser={(uId) => handleOpenMessageWithUser(uId)}
              onOpenUserProfile={(uId) => handleOpenUserProfile(uId)}
              onRequireAuth={() => setIsAuthModalOpen(true)}
            />
          )}

          {currentTab === 'messages' && (
            <MessagesView
              initialTargetUserId={targetMessageUserId}
              onOpenUserProfile={(uId) => handleOpenUserProfile(uId)}
              onOpenCoupleSpace={() => setCurrentTab('couple')}
            />
          )}

          {currentTab === 'notifications' && (
            <NotificationsView
              onOpenUserProfile={(uId) => handleOpenUserProfile(uId)}
              onOpenCoupleSpace={() => setCurrentTab('couple')}
            />
          )}

          {currentTab === 'profile' && (
            <ProfileView
              targetUserId={activeProfileUserId}
              onOpenMessageWithUser={(uId) => handleOpenMessageWithUser(uId)}
              onOpenReportPost={(pId) => setReportingPostId(pId)}
              onRequireAuth={() => setIsAuthModalOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenCoupleSpace={() => setCurrentTab('couple')}
            />
          )}
        </main>

        {/* Right Desktop Sidebar */}
        <RightSidebar
          onSelectTag={() => setCurrentTab('explore')}
          onOpenUserProfile={(uId) => handleOpenUserProfile(uId)}
          onOpenDownloadApk={() => setIsDownloadApkOpen(true)}
        />
      </div>

      {/* Bottom Nav on Mobile */}
      <MobileNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onOpenCreatePost={() => {
          if (!currentUser) setIsAuthModalOpen(true);
          else setIsCreatePostOpen(true);
        }}
      />

      {/* Floating Sprout Guide AI Trigger Button */}
      <button
        onClick={() => setIsAiAssistantOpen(true)}
        className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-30 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#12372A] text-white hover:bg-[#1B5E20] border-2 border-[#00C853] shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-md group"
        title="Open Sprout Guide AI"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#00C853] animate-ping" />
        <Sparkles className="w-4 h-4 text-[#00C853] group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold tracking-wide">Sprout Guide</span>
      </button>

      {/* Global Modals */}
      <DownloadApkModal
        isOpen={isDownloadApkOpen}
        onClose={() => setIsDownloadApkOpen(false)}
      />

      <SproutAiAssistantModal
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
      />

      <CreatePostModal
        isOpen={isCreatePostOpen}
        initialTrack={selectedTrackForPost}
        onClose={() => {
          setIsCreatePostOpen(false);
          setSelectedTrackForPost(null);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <ReportModal
        postId={reportingPostId}
        onClose={() => setReportingPostId(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MediaCoordinatorProvider>
        <MainApp />
      </MediaCoordinatorProvider>
    </AuthProvider>
  );
}
