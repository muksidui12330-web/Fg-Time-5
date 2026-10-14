import React from 'react';
import { Bell, MessageCircle, LogIn, Plus, Sparkles, Settings, Music, Heart } from 'lucide-react';
import { GreenLeafLogo } from './GreenLeafLogo';
import { useAuth } from '../context/AuthContext';
import { NavTab } from './Sidebar';

interface NavbarProps {
  onTabChange: (tab: NavTab) => void;
  onOpenCreatePost: () => void;
  onOpenAuth: () => void;
  onOpenAiAssistant?: () => void;
  onOpenSettings?: () => void;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onTabChange,
  onOpenCreatePost,
  onOpenAuth,
  onOpenAiAssistant,
  onOpenSettings,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}) => {
  const { currentUser, userProfile } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-30 w-full bg-white/95 dark:bg-[#12372A]/90 backdrop-blur-md border-b border-[#00C853]/20 dark:border-emerald-800/40 px-4 py-3 flex items-center justify-between">
      <div className="cursor-pointer" onClick={() => onTabChange('feed')}>
        <GreenLeafLogo size="sm" />
      </div>

      <div className="flex items-center gap-2">
        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="p-2 rounded-full text-[#00C853] hover:bg-[#00C853]/15 transition-colors cursor-pointer"
            title="Sprout AI Guide"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={onOpenCreatePost}
          className="p-2 rounded-full bg-[#00C853] text-white shadow-md shadow-[#00C853]/20 active:scale-95 transition-all"
          title="Create Post"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={() => onTabChange('notifications')}
          className="relative p-2 rounded-full text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5 text-[#00C853]" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#00C853] rounded-full ring-2 ring-white dark:ring-[#12372A]" />
          )}
        </button>

        <button
          onClick={() => onTabChange('messages')}
          className="relative p-2 rounded-full text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 transition-colors"
          title="Direct Whispers"
        >
          <MessageCircle className="w-5 h-5 text-[#00C853]" />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#00C853] rounded-full ring-2 ring-white dark:ring-[#12372A]" />
          )}
        </button>

        <button
          onClick={() => onTabChange('music')}
          className="p-2 rounded-full text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 transition-colors cursor-pointer"
          title="FG TIME Music Studio"
        >
          <Music className="w-5 h-5 text-[#00C853]" />
        </button>

        <button
          onClick={() => onTabChange('couple')}
          className="p-2 rounded-full text-pink-500 hover:bg-pink-500/10 transition-colors cursor-pointer"
          title="FG TIME Love & Couple Sanctuary"
        >
          <Heart className="w-5 h-5 text-pink-500 fill-pink-500/20 hover:fill-pink-500 transition-colors" />
        </button>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full text-stone-700 dark:text-stone-200 hover:bg-[#00C853]/10 transition-colors cursor-pointer"
            title="Settings Center"
          >
            <Settings className="w-5 h-5 text-[#00C853]" />
          </button>
        )}

        {currentUser && userProfile ? (
          <img
            src={userProfile.photoURL}
            alt={userProfile.displayName}
            onClick={() => onTabChange('profile')}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-[#00C853] cursor-pointer"
          />
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-[#00C853] text-white shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
