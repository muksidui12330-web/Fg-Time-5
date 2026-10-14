import React from 'react';
import { Home, Compass, Film, User, PlusCircle, Music, Heart } from 'lucide-react';
import { NavTab } from './Sidebar';
import { useAuth } from '../context/AuthContext';

interface MobileNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCreatePost: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onTabChange,
  onOpenCreatePost,
}) => {
  const { userProfile } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#12372A]/95 backdrop-blur-md border-t border-[#00C853]/20 dark:border-emerald-800/40 px-2 py-2 flex items-center justify-around shadow-lg">
      <button
        onClick={() => onTabChange('feed')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'feed'
            ? 'text-[#00C853] font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Feed</span>
      </button>

      <button
        onClick={() => onTabChange('explore')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'explore'
            ? 'text-[#00C853] font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px]">Explore</span>
      </button>

      {/* Center Create Button */}
      <button
        onClick={onOpenCreatePost}
        className="flex items-center justify-center -mt-5 w-11 h-11 rounded-full bg-gradient-to-r from-[#00C853] to-[#00A344] text-white shadow-lg shadow-[#00C853]/40 active:scale-95 transition-all cursor-pointer shrink-0"
        title="Sprout Post"
      >
        <PlusCircle className="w-6 h-6" />
      </button>

      <button
        onClick={() => onTabChange('reels')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'reels'
            ? 'text-[#00C853] font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <Film className="w-5 h-5" />
        <span className="text-[10px]">Clips</span>
      </button>

      <button
        onClick={() => onTabChange('music')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'music'
            ? 'text-[#00C853] font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <Music className="w-5 h-5" />
        <span className="text-[10px]">Studio</span>
      </button>

      <button
        onClick={() => onTabChange('couple')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'couple'
            ? 'text-pink-500 font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        <Heart className={`w-5 h-5 ${currentTab === 'couple' ? 'fill-pink-500 text-pink-500' : ''}`} />
        <span className="text-[10px]">Couple</span>
      </button>

      <button
        onClick={() => onTabChange('profile')}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all cursor-pointer ${
          currentTab === 'profile'
            ? 'text-[#00C853] font-bold scale-105'
            : 'text-stone-500 dark:text-stone-400'
        }`}
      >
        {userProfile?.photoURL ? (
          <img
            src={userProfile.photoURL}
            alt="Profile"
            className={`w-5 h-5 rounded-full object-cover ${
              currentTab === 'profile' ? 'ring-2 ring-[#00C853]' : ''
            }`}
          />
        ) : (
          <User className="w-5 h-5" />
        )}
        <span className="text-[10px]">Profile</span>
      </button>
    </nav>
  );
};
