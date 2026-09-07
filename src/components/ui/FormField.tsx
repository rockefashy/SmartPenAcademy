import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Input, InputProps } from './Input';
import { Select, SelectProps } from './Select';
import { Textarea, TextareaProps } from './Textarea';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

interface FormFieldComponent extends React.FC<FormFieldProps> {
  Label: React.FC<{ children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string }>;
  Helper: React.FC<{ children: React.ReactNode; className?: string }>;
  Error: React.FC<{ children: React.ReactNode; className?: string }>;
  Input: typeof Input;
  Select: typeof Select;
  Textarea: typeof Textarea;
}

export const FormField: FormFieldComponent = ({
  label,
  htmlFor,
  required,
  error,
  helperText,
  children,
  className = ''
}) => {
  return (
    <div className={`w-full space-y-1.5 font-sans ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-bold text-slate-700 select-none tracking-wide"
        >
          {label}
          {required && <span className="text-red-500 ml-1 font-black">*</span>}
        </label>
      )}

      {children}

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
};

const FormFieldLabel: React.FC<{ children: React.ReactNode; htmlFor?: string; required?: boolean; className?: string }> = ({
  children,
  htmlFor,
  required,
  className = ''
}) => (
  <label
    htmlFor={htmlFor}
    className={`block text-xs font-bold text-slate-700 select-none tracking-wide ${className}`}
  >
    {children}
    {required && <span className="text-red-500 ml-1 font-black">*</span>}
  </label>
);

const FormFieldHelper: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <p className={`text-[11px] text-slate-500 font-medium ${className}`}>
    {children}
  </p>
);

const FormFieldError: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <p className={`flex items-center gap-1 text-[11px] font-bold text-red-600 animate-in fade-in duration-150 ${className}`} role="alert">
    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
    <span>{children}</span>
  </p>
);

FormField.Label = FormFieldLabel;
FormField.Helper = FormFieldHelper;
FormField.Error = FormFieldError;
FormField.Input = Input;
FormField.Select = Select;
FormField.Textarea = Textarea;

export { Input, Select, Textarea };
export type { InputProps, SelectProps, TextareaProps };
