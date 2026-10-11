import React, { useEffect, useState } from 'react';
import { GreenLeafLogo } from './GreenLeafLogo';
import { Sparkles, Heart, Sprout } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 1800,
}) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      const finishTimer = setTimeout(() => {
        if (onFinish) onFinish();
      }, 400);
      return () => clearTimeout(finishTimer);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between py-12 px-6 bg-gradient-to-b from-[#EAF8EF] via-white to-[#EAF8EF] dark:from-[#101512] dark:via-[#12372A] dark:to-[#101512] transition-opacity duration-400 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top subtle badge */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00C853]/10 border border-[#00C853]/20 text-[#12372A] dark:text-[#69F0AE] text-xs font-semibold animate-pulse">
        <Sprout className="w-3.5 h-3.5 text-[#00C853]" />
        <span>Vibrant Botanical Social</span>
      </div>

      {/* Center Hero Logo & Tagline */}
      <div className="flex flex-col items-center text-center gap-5 my-auto">
        {/* Animated Leaf Emblem */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#00C853]/30 via-[#69F0AE]/20 to-[#12372A]/20 blur-xl rounded-full animate-pulse" />
          <GreenLeafLogo size="xl" showText={false} />
        </div>

        <div className="flex flex-col items-center">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#12372A] dark:text-white">
            <span className="text-[#00C853]">FG</span> TIME
          </h1>
          <p className="text-sm sm:text-base font-semibold text-[#12372A]/80 dark:text-[#A7F3D0] mt-2 max-w-xs leading-snug">
            Share Moments. Connect Hearts. Grow Together.
          </p>
        </div>

        {/* Minimal dynamic progress bar */}
        <div className="w-36 h-1.5 bg-[#00C853]/20 dark:bg-emerald-900/40 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-gradient-to-r from-[#00C853] to-[#69F0AE] rounded-full animate-[progress_1.6s_ease-in-out_infinite]" />
        </div>
      </div>

      {/* Footer credits */}
      <div className="flex flex-col items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
        <div className="flex items-center gap-1.5">
          <span>Rooted in Real-Time Cloud Firestore</span>
          <Sparkles className="w-3 h-3 text-[#00C853]" />
        </div>
        <span>© 2026 FG TIME • All Rights Reserved</span>
      </div>
    </div>
  );
};
