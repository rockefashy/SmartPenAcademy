import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  variant?: 'horizontal' | 'stacked' | 'badge';
  lightMode?: boolean;
}

export const SmartPenLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const heightClasses = {
    xs: 'h-8 sm:h-9',
    sm: 'h-10 sm:h-11',
    md: 'h-12 sm:h-14',
    lg: 'h-14 sm:h-16 md:h-20',
    xl: 'h-20 sm:h-24 md:h-28',
  }[size];

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="/app_images/finallogo.png"
        alt="SmartPen Academy - Neat Writing. Sharp Minds!"
        className={`${heightClasses} w-auto object-contain max-w-none drop-shadow-2xs`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};


