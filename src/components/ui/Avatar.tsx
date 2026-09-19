import React from 'react';

export interface AvatarProps {
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: string;
  bgColor?: string;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-14 h-14 text-base font-black',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  className = '',
  fallback = '?',
  bgColor = 'bg-[#0E3589] text-white',
}) => {
  const cleanName = (name || '').trim();
  const initial = cleanName ? cleanName.charAt(0).toUpperCase() : fallback;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold select-none shrink-0 shadow-xs ${SIZE_CLASSES[size]} ${bgColor} ${className}`}
      aria-label={cleanName || 'Avatar'}
      title={cleanName || undefined}
    >
      {initial}
    </div>
  );
};
