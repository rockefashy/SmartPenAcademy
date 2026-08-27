import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  max?: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {Array.from({ length: max }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = starNumber <= value;

        return (
          <button
            key={index}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange && onChange(starNumber)}
            className={`transition-transform focus:outline-none ${
              !readOnly ? 'cursor-pointer hover:scale-125 active:scale-95' : 'cursor-default'
            }`}
            title={`${starNumber} of ${max} stars`}
          >
            <Star
              className={`${sizeClasses[size]} ${
                isFilled
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_1px_2px_rgba(245,158,11,0.4)]'
                  : 'text-slate-300 fill-slate-100'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
};
