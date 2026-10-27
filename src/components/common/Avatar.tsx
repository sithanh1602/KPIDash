import React from 'react';

const COLORS = [
  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'bg-purple-500/20 text-purple-300 border-purple-500/40',
  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  'bg-rose-500/20 text-rose-300 border-rose-500/40',
  'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
];

export function UserAvatar({
  name,
  initials,
  size = 'md',
  className = '',
}: {
  name?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const text = initials || (name ? name.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase() : '?');
  const code = (name || text).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const color = COLORS[code % COLORS.length];

  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm font-bold',
    xl: 'w-16 h-16 text-lg font-bold',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-bold border ${color} ${sizeStyles} ${className} shrink-0 select-none shadow-sm`}
    >
      {text}
    </div>
  );
}
