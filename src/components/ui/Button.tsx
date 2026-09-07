import React from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 
  | 'primary' 
  | 'accent' 
  | 'secondary' 
  | 'outline' 
  | 'danger' 
  | 'ghost' 
  | 'success';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-[#0E3589] to-[#0084F4] hover:from-[#092666] hover:to-[#0070d0] text-white shadow-md shadow-blue-900/10 active:scale-[0.99] border border-transparent',
  accent: 'bg-gradient-to-r from-[#F46E20] to-[#FF8C38] hover:from-[#e05c10] hover:to-[#f07b27] text-white shadow-md shadow-orange-500/20 active:scale-[0.99] border border-transparent',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 active:scale-[0.99]',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 shadow-2xs active:scale-[0.99]',
  danger: 'bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm shadow-red-600/20 active:scale-[0.99] border border-transparent',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-bold border border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm shadow-emerald-600/20 active:scale-[0.99] border border-transparent'
};

const sizeStyles: Record<ButtonSize, string> = {
  // Enforce minimum 44px touch target on mobile devices (min-h-[44px])
  sm: 'min-h-[44px] sm:min-h-[36px] px-3 py-1.5 text-xs rounded-xl font-bold gap-1.5',
  md: 'min-h-[44px] px-4 py-2 text-sm rounded-xl font-bold gap-2',
  lg: 'min-h-[48px] sm:min-h-[44px] px-6 py-3 text-base rounded-2xl font-black gap-2.5',
  icon: 'min-h-[44px] min-w-[44px] sm:min-h-[38px] sm:min-w-[38px] p-2 rounded-xl flex items-center justify-center'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      type = 'button',
      className = '',
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Double-submit prevention at runtime
      if (isDisabled) {
        e.preventDefault();
        return;
      }
      if (onClick) {
        onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        onClick={handleClick}
        className={`
          inline-flex items-center justify-center transition-all cursor-pointer select-none
          touch-manipulation
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : 'w-auto'}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {loadingText ? <span>{loadingText}</span> : children ? <span>{children}</span> : null}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children && <span>{children}</span>}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
