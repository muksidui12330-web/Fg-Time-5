import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
  monochrome?: boolean;
}

export const GreenLeafLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  showTagline = false,
  monochrome = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        {/* Subtle luminous halo */}
        <div className="absolute inset-0 bg-[#00C853]/20 blur-md rounded-full -z-10" />

        {/* Dynamic Forward-Moving Two-Leaf Emblem */}
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm transition-transform duration-300 hover:scale-105"
        >
          <defs>
            {/* Primary vibrant green gradient */}
            <linearGradient id="primaryLeafGrad" x1="10" y1="54" x2="58" y2="12" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#00A344" />
              <stop offset="60%" stopColor="#00C853" />
              <stop offset="100%" stopColor="#69F0AE" />
            </linearGradient>

            {/* Dark forest green gradient for upper/inner leaf */}
            <linearGradient id="forestLeafGrad" x1="16" y1="46" x2="50" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#12372A" />
              <stop offset="70%" stopColor="#1B5E20" />
              <stop offset="100%" stopColor="#00C853" />
            </linearGradient>

            {/* Forward motion stem highlights */}
            <linearGradient id="leafVein" x1="14" y1="52" x2="54" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#B9F6CA" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Leaf 1: Upper Forward-Arching Canopy Leaf */}
          <path
            d="M16 48C18 30 32 18 52 14C50 32 36 44 16 48Z"
            fill={monochrome ? 'currentColor' : 'url(#forestLeafGrad)'}
          />

          {/* Leaf 2: Dynamic Ascending Primary Green Leaf (Overlapping forward arrow-like motion) */}
          <path
            d="M12 52C14 34 32 16 56 12C54 36 36 50 12 52Z"
            fill={monochrome ? 'currentColor' : 'url(#primaryLeafGrad)'}
          />

          {/* Forward-curving spine / vein representing momentum & connection */}
          <path
            d="M14 50C26 44 42 32 54 14"
            stroke={monochrome ? '#FFFFFF' : 'url(#leafVein)'}
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Small ascending kinetic leaf node */}
          <path
            d="M34 32C38 28 44 26 48 26C46 30 42 34 34 32Z"
            fill="#FFFFFF"
            opacity="0.8"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div
            className={`font-black tracking-tight leading-none text-[#12372A] dark:text-white ${textSizes[size]}`}
          >
            <span className="text-[#00C853]">FG</span> TIME
          </div>
          {showTagline ? (
            <span className="text-[11px] font-medium tracking-tight text-[#12372A]/80 dark:text-[#69F0AE] mt-0.5">
              Share Moments. Connect Hearts. Grow Together.
            </span>
          ) : (
            <span className="text-[10px] tracking-widest uppercase font-semibold text-[#12372A]/70 dark:text-[#69F0AE]">
              Share & Grow
            </span>
          )}
        </div>
      )}
    </div>
  );
};
