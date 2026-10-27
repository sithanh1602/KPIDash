import React from 'react';

interface RubikLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function RubikLogo({ size = 'md', showText = true }: RubikLogoProps) {
  const dim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div className="flex items-center gap-2.5">
      {/* Isometric Rubik 3D Cube Icon */}
      <div className={`${dim} shrink-0 relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#1c2230] to-[#0c0f17] border border-[#2d374d] shadow-lg shadow-emerald-500/10 p-1`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Top Face (Emerald/Cyan facets) */}
          <polygon points="24,4 38,12 24,20 10,12" fill="#0ea5e9" opacity="0.9" />
          <polygon points="24,4 31,8 24,12 17,8" fill="#38bdf8" />
          <polygon points="31,8 38,12 31,16 24,12" fill="#0284c7" />
          <polygon points="17,8 24,12 17,16 10,12" fill="#0369a1" />

          {/* Left Face (Emerald & Green facets) */}
          <polygon points="10,13 23,21 23,37 10,29" fill="#10b981" opacity="0.9" />
          <polygon points="10,13 16.5,17 16.5,25 10,21" fill="#34d399" />
          <polygon points="16.5,17 23,21 23,29 16.5,25" fill="#059669" />
          <polygon points="10,21 16.5,25 16.5,33 10,29" fill="#047857" />

          {/* Right Face (Violet & Indigo facets) */}
          <polygon points="25,21 38,13 38,29 25,37" fill="#8b5cf6" opacity="0.95" />
          <polygon points="25,21 31.5,17 38,21 31.5,25" fill="#a78bfa" opacity="0.7" />
          <polygon points="25,21 31.5,17 31.5,25 25,29" fill="#7c3aed" />
          <polygon points="31.5,17 38,13 38,21 31.5,25" fill="#6366f1" />
          <polygon points="25,29 31.5,25 31.5,33 25,37" fill="#4f46e5" />
          <polygon points="31.5,25 38,21 38,29 31.5,33" fill="#4338ca" />

          {/* Inner Grid Lines */}
          <line x1="24" y1="4" x2="24" y2="20" stroke="#0f172a" strokeWidth="1" />
          <line x1="10" y1="12" x2="38" y2="12" stroke="#0f172a" strokeWidth="1" />
          <line x1="24" y1="20" x2="24" y2="38" stroke="#0f172a" strokeWidth="1.2" />
        </svg>
      </div>

      {showText && (
        <div className="leading-tight">
          <div className={`font-black tracking-wider text-white ${textSize} flex items-center gap-1.5`}>
            <span>ADAS</span>
          </div>
        </div>
      )}
    </div>
  );
}
