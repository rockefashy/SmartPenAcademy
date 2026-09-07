import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  id?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-[95vw]'
};

export const Modal: React.FC<ModalProps> & {
  Header: React.FC<{ title?: React.ReactNode; subtitle?: React.ReactNode; onClose?: () => void; children?: React.ReactNode; className?: string }>;
  Body: React.FC<{ children: React.ReactNode; className?: string }>;
  Footer: React.FC<{ children: React.ReactNode; className?: string }>;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  className = '',
  bodyClassName = '',
  showCloseButton = true,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  id
}) => {
  const modalContentRef = useRef<HTMLDivElement>(null);

  // 1. ESC Key dismissal lifecycle
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // 2. Body scroll lock lifecycle
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      id={id}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-150"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalContentRef}
        className={`w-full ${sizeClasses[size]} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[90vh] overflow-hidden my-auto animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull-down Indicator Handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 cursor-grab" onClick={onClose}>
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Optional automatic header if title passed as prop */}
        {(title || showCloseButton) && (
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white/90 sticky top-0 z-10 backdrop-blur-xs">
            <div className="min-w-0 flex-1">
              {typeof title === 'string' ? (
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        )}

        {/* Main Body */}
        <div className={`overflow-y-auto flex-1 p-5 sm:p-6 overscroll-contain pb-safe ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

// Sub-components for Compound Pattern
Modal.Header = ({ title, subtitle, onClose, children, className = '' }) => (
  <div className={`px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white/95 sticky top-0 z-10 backdrop-blur-xs ${className}`}>
    <div className="min-w-0 flex-1">
      {children ? children : (
        <>
          {typeof title === 'string' ? (
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h3>
          ) : (
            title
          )}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </>
      )}
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        aria-label="Close dialog"
      >
        <X className="w-5 h-5 sm:w-4 sm:h-4" />
      </button>
    )}
  </div>
);

Modal.Body = ({ children, className = '' }) => (
  <div className={`overflow-y-auto flex-1 p-5 sm:p-6 overscroll-contain pb-safe ${className}`}>
    {children}
  </div>
);

Modal.Footer = ({ children, className = '' }) => (
  <div className={`px-5 sm:px-6 py-3.5 sm:py-4 border-t border-slate-100 bg-slate-50/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 sticky bottom-0 z-10 ${className}`}>
    {children}
  </div>
);

Modal.Header.displayName = 'Modal.Header';
Modal.Body.displayName = 'Modal.Body';
Modal.Footer.displayName = 'Modal.Footer';
