import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      id,
      className = '',
      disabled,
      rows = 3,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-bold text-slate-700 select-none tracking-wide"
          >
            {label}
            {required && <span className="text-red-500 ml-1 font-black">*</span>}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          className={`
            w-full rounded-xl border bg-white p-3
            /* Mobile font-size: 16px (text-base) strictly prevents iOS Safari auto-zoom */
            text-base sm:text-sm
            /* Touch-target: minimum 44px min-height */
            min-h-[44px]
            text-slate-900 placeholder:text-slate-400
            transition-all shadow-2xs resize-y
            focus:outline-none focus:ring-2
            disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-red-200/50' 
              : 'border-slate-200 hover:border-slate-300 focus:border-[#0E3589] focus:ring-[#0E3589]/15'
            }
            ${className}
          `.trim().replace(/\s+/g, ' ')}
          {...props}
        />

        {error && (
          <p className="flex items-center gap-1 text-[11px] font-bold text-red-600 animate-in fade-in duration-150" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}

        {!error && helperText && (
          <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
