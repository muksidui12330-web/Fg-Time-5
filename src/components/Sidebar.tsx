import React from 'react';
import {
  Home,
  Compass,
  Film,
  MessageCircle,
  Bell,
  PlusSquare,
  User,
  Settings,
  LogOut,
  LogIn,
  Sparkles,
  Music,
  Heart,
  Smartphone,
  Download,
} from 'lucide-react';
import { GreenLeafLogo } from './GreenLeafLogo';
import { useAuth } from '../context/AuthContext';
import { isApkDownloadAvailable } from '../config/apkConfig';

export type NavTab = 'feed' | 'explore' | 'reels' | 'music' | 'couple' | 'messages' | 'notifications' | 'profile';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCreatePost: () => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onOpenAiAssistant?: () => void;
  onOpenDownloadApk?: () => void;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  onOpenCreatePost,
  onOpenSettings,
  onOpenAuth,
  onOpenAiAssistant,
  onOpenDownloadApk,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}) => {
  const { currentUser, userProfile, signOut } = useAuth();

  const navItems = [
    { id: 'feed' as NavTab, label: 'Roots Feed', icon: Home },
    { id: 'explore' as NavTab, label: 'Explore & Search', icon: Compass },
    { id: 'reels' as NavTab, label: 'Leaf Clips', icon: Film },
    { id: 'music' as NavTab, label: 'Music Studio', icon: Music },
    { id: 'couple' as NavTab, label: 'Love & Couple', icon: Heart },
    {
      id: 'messages' as NavTab,
      label: 'Direct Whispers',
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    {
      id: 'notifications' as NavTab,
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    {
      id: 'profile' as NavTab,
      label: 'My Garden Profile',
      icon: User,
    },
  ];

  return (
    <aside className="w-64 shrink-0 hidden md:flex flex-col justify-between h-screen sticky top-0 border-r border-[#00C853]/20 dark:border-emerald-800/40 bg-white/95 dark:bg-[#12372A]/90 backdrop-blur-md p-4 z-30">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="pt-2 px-2 cursor-pointer" onClick={() => onTabChange('feed')}>
          <GreenLeafLogo size="lg" />
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 group cursor-pointer ${
                  isActive
                    ? 'bg-[#00C853] text-white shadow-md shadow-[#00C853]/25'
                    : 'text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 hover:text-[#00C853]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-[#00C853]'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-white text-[#12372A]'
                        : 'bg-[#00C853] text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {onOpenDownloadApk && (
            <button
              onClick={onOpenDownloadApk}
              className="flex items-center justify-between px-3.5 py-3 rounded-2xl font-semibold text-sm text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 border border-[#00C853]/30 transition-all duration-200 group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#00C853] transition-transform group-hover:scale-110" />
                <span className="font-bold">Download Android APK</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#00C853] text-white shadow-xs">
                {isApkDownloadAvailable() ? 'Download APK' : 'APK Coming Soon'}
              </span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-3 px-3.5 py-3 rounded-2xl font-semibold text-sm text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 hover:text-[#00C853] transition-all duration-200 group text-left cursor-pointer"
          >
            <Settings className="w-5 h-5 text-[#00C853] transition-transform group-hover:rotate-45" />
            <span>Settings & Rules</span>
          </button>

          {onOpenAiAssistant && (
            <button
              onClick={onOpenAiAssistant}
              className="flex items-center gap-3 px-3.5 py-3 rounded-2xl font-semibold text-sm text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 border border-[#00C853]/30 transition-all duration-200 group text-left cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-[#00C853] transition-transform group-hover:scale-110" />
              <span>Sprout AI Guide</span>
            </button>
          )}
        </nav>

        {/* Create Post Action Button */}
        <button
          onClick={onOpenCreatePost}
          className="mt-2 w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-[#00C853] to-[#00A344] hover:from-[#00E676] hover:to-[#00C853] shadow-lg shadow-[#00C853]/25 active:scale-[0.98] transition-all duration-200 cursor-pointer"
        >
          <PlusSquare className="w-5 h-5" />
          <span>Sprout New Post</span>
        </button>
      </div>

      {/* User Card / Sign-in Section */}
      <div className="pt-4 border-t border-emerald-100 dark:border-emerald-800/40">
        {currentUser && userProfile ? (
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#00C853]/10 dark:bg-[#101512]/60 border border-[#00C853]/20 dark:border-emerald-800/40">
            <div
              className="flex items-center gap-2.5 min-w-0 cursor-pointer"
              onClick={() => onTabChange('profile')}
            >
              <img
                src={userProfile.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={userProfile.displayName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]/40 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold truncate text-[#12372A] dark:text-white">
                  {userProfile.displayName}
                </p>
                <p className="text-xs text-[#00C853] truncate">
                  @{userProfile.username}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1.5 rounded-xl hover:bg-red-50 text-stone-500 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-stone-500 dark:text-stone-400 text-center">
              Connect & Sprout with Friends
            </p>
            <button
              onClick={onOpenAuth}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold bg-[#00C853] text-white hover:bg-[#00A344] shadow-md shadow-[#00C853]/20 transition-all cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In / Sprout Account</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
