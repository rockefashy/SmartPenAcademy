import React from 'react';

export interface StatCardProps {
  icon: React.ReactNode | React.ComponentType<{ className?: string }>;
  value: string | number;
  label?: string;
  title?: string;
  colorScheme?: 'orange' | 'red' | 'blue' | 'emerald' | 'amber' | 'slate' | 'purple';
  color?: string;
  description?: string;
  className?: string;
  onClick?: () => void;
}

const colorVariants: Record<string, { border: string; iconBg: string; valueColor: string }> = {
  orange: {
    border: 'border-2 border-orange-200',
    iconBg: 'bg-orange-100 text-[#F46E20]',
    valueColor: 'text-[#F46E20]',
  },
  red: {
    border: 'border border-red-200',
    iconBg: 'bg-red-100 text-red-600',
    valueColor: 'text-red-600',
  },
  blue: {
    border: 'border border-blue-200',
    iconBg: 'bg-blue-100 text-[#0E3589]',
    valueColor: 'text-[#0E3589]',
  },
  emerald: {
    border: 'border border-emerald-200',
    iconBg: 'bg-emerald-100 text-emerald-700',
    valueColor: 'text-emerald-700',
  },
  amber: {
    border: 'border border-amber-200',
    iconBg: 'bg-amber-100 text-amber-800',
    valueColor: 'text-amber-800',
  },
  purple: {
    border: 'border border-purple-200',
    iconBg: 'bg-purple-100 text-purple-700',
    valueColor: 'text-purple-700',
  },
  slate: {
    border: 'border border-slate-200',
    iconBg: 'bg-slate-100 text-slate-700',
    valueColor: 'text-slate-900',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  value,
  label,
  title,
  colorScheme,
  color,
  description,
  className = '',
  onClick,
}) => {
  const effectiveScheme = (colorScheme || color || 'slate') as string;
  const scheme = colorVariants[effectiveScheme] || colorVariants.slate;
  const displayLabel = label || title || '';

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || (typeof icon === 'object' && (icon as any)?.$$typeof)) {
      const IconComponent = icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="w-4 h-4" />;
    }
    return icon as React.ReactNode;
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl ${scheme.border} shadow-2xs flex items-center gap-2.5 transition-all ${className}`.trim()}
    >
      <div className={`w-8 h-8 rounded-lg ${scheme.iconBg} flex items-center justify-center font-bold shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
        {renderIcon()}
      </div>
      <div className="min-w-0">
        <p className={`text-base sm:text-lg font-black leading-tight ${scheme.valueColor}`}>
          {value}
        </p>
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight truncate">
          {displayLabel}
        </p>
        {description && (
          <p className="text-[9px] text-slate-400 leading-tight truncate mt-0.5">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};
