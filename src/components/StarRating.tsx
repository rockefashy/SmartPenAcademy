import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value?: number;
  rating?: number; // Support both value and rating
  max?: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  rating,
  max = 5,
  onChange,
  readOnly = false,
  size = 'md',
  className = '',
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  // Normalize rating from either value or rating prop
  const currentRating = typeof value === 'number' ? value : (typeof rating === 'number' ? rating : 0);
  const displayRating = hoverRating !== null ? hoverRating : currentRating;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      onMouseLeave={() => !readOnly && setHoverRating(null)}
    >
      {Array.from({ length: max }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = starNumber <= displayRating;

        return (
          <Button
            key={index}
            type="button"
            variant="ghost"
            size="icon"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHoverRating(starNumber)}
            onClick={() => !readOnly && onChange && onChange(starNumber)}
            className={`p-1 rounded ${
              !readOnly
                ? 'cursor-pointer hover:scale-125 active:scale-95'
                : 'cursor-default'
            }`}
            title={`${starNumber} of ${max} stars`}
            aria-label={`${starNumber} of ${max} stars`}
          >
            <Star
              className={`${sizeClasses[size]} transition-colors duration-150 ${
                isFilled
                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_1px_3px_rgba(245,158,11,0.5)]'
                  : 'text-slate-300 fill-slate-100 hover:text-amber-300'
              }`}
            />
          </Button>
        );
      })}
    </div>
  );
};
