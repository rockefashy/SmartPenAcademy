import React from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      label,
      error,
      helperText,
      required,
      id,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-slate-700 select-none tracking-wide"
          >
            {label}
            {required && <span className="text-red-500 ml-1 font-black">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`
              w-full appearance-none rounded-xl border bg-white pl-3.5 pr-10
              /* Mobile font-size: 16px (text-base) strictly prevents iOS Safari auto-zoom */
              text-base sm:text-sm
              /* Mobile touch-target: minimum 44px height */
              min-h-[44px] sm:min-h-[38px] py-2.5 sm:py-2
              text-slate-900 transition-all shadow-2xs cursor-pointer
              focus:outline-none focus:ring-2
              disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
              ${error 
                ? 'border-red-400 text-red-900 focus:border-red-500 focus:ring-red-200/50' 
                : 'border-slate-200 hover:border-slate-300 focus:border-[#0E3589] focus:ring-[#0E3589]/15'
              }
              ${className}
            `.trim().replace(/\s+/g, ' ')}
            {...props}
          >
            {children}
          </select>

          <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

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

Select.displayName = 'Select';
