import React, { useEffect, useRef } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  message: string | null | undefined;
  type?: ToastType;
  durationMs?: number;
  onDismiss: () => void;
  position?: 'bottom-right' | 'top-right' | 'bottom-center' | 'top-center';
  actionLabel?: string;
  onAction?: () => void;
}

const typeStyles: Record<ToastType, { container: string; icon: React.ReactNode; text: string; closeHover: string }> = {
  success: {
    container: 'bg-slate-900/95 text-white border-slate-700 shadow-2xl shadow-emerald-950/20',
    icon: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    text: 'text-white',
    closeHover: 'hover:bg-slate-800 text-slate-400 hover:text-white',
  },
  error: {
    container: 'bg-rose-950/95 text-rose-100 border-rose-800 shadow-2xl shadow-rose-950/40',
    icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    text: 'text-rose-100',
    closeHover: 'hover:bg-rose-900 text-rose-400 hover:text-white',
  },
  warning: {
    container: 'bg-amber-950/95 text-amber-100 border-amber-800 shadow-2xl shadow-amber-950/40',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    text: 'text-amber-100',
    closeHover: 'hover:bg-amber-900 text-amber-400 hover:text-white',
  },
  info: {
    container: 'bg-slate-900/95 text-blue-100 border-blue-800 shadow-2xl shadow-blue-950/20',
    icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
    text: 'text-blue-100',
    closeHover: 'hover:bg-slate-800 text-blue-400 hover:text-white',
  },
};

const positionStyles: Record<'bottom-right' | 'top-right' | 'bottom-center' | 'top-center', string> = {
  'bottom-right': 'bottom-6 right-6 sm:bottom-8 sm:right-8 animate-in slide-in-from-bottom-5',
  'top-right': 'top-6 right-6 sm:top-8 sm:right-8 animate-in slide-in-from-top-5',
  'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2 animate-in slide-in-from-bottom-5',
  'top-center': 'top-6 left-1/2 -translate-x-1/2 animate-in slide-in-from-top-5',
};

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  durationMs = 6000,
  onDismiss,
  position = 'bottom-right',
  actionLabel,
  onAction,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!message) return;

    if (durationMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, durationMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, durationMs, onDismiss]);

  const handleMouseEnter = () => {
    // Pause auto-dismiss on user hover so they can read longer messages comfortably
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleMouseLeave = () => {
    // Resume auto-dismiss on mouse leave
    if (durationMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, durationMs);
    }
  };

  if (!message) return null;

  const currentType = typeStyles[type] || typeStyles.success;
  const currentPos = positionStyles[position] || positionStyles['bottom-right'];

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`fixed z-[70] max-w-md w-[calc(100vw-2rem)] sm:w-auto p-4 rounded-2xl border backdrop-blur-md flex items-center justify-between gap-3.5 transition-all select-none ${currentType.container} ${currentPos}`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {currentType.icon}
        <span className={`text-xs font-bold leading-relaxed break-words ${currentType.text}`}>
          {message}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-xs font-bold underline px-2 py-1 rounded hover:bg-white/10 transition-colors"
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${currentType.closeHover}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
