import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import {
  Smile,
  Star,
  CheckCircle2,
  MessageSquareQuote,
  ArrowRight,
  Sparkles,
  Award,
  ShieldCheck,
  Filter,
  TrendingUp,
  Clock
} from 'lucide-react';
import { api } from '../services/api';
import { Testimonial } from '../types';
import { StarRating } from '../components/StarRating';
import { formatGradeClass } from '../utils/formatters';

interface TestimonialsPageProps {
  onNavigate: (view: string) => void;
  onOpenDemoBooking?: () => void;
}

export const TestimonialsPage: React.FC<TestimonialsPageProps> = ({ onNavigate, onOpenDemoBooking }) => {
  // Hydrate immediately from pre-rendered data injected at build time (window.__INITIAL_TESTIMONIALS__).
  // This ensures Googlebot and real users see testimonials in the initial HTML without waiting for JS.
  const getInitialTestimonials = (): Testimonial[] => {
    if (typeof window !== 'undefined' && Array.isArray((window as any).__INITIAL_TESTIMONIALS__)) {
      return (window as any).__INITIAL_TESTIMONIALS__ as Testimonial[];
    }
    return [];
  };

  const [testimonials, setTestimonials] = useState<Testimonial[]>(getInitialTestimonials);
  const [selectedFilter, setSelectedFilter] = useState<'all' | '5star' | 'exam'>('all');
  // If we already have pre-rendered data, skip the loading state to avoid a flash.
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && Array.isArray((window as any).__INITIAL_TESTIMONIALS__) && (window as any).__INITIAL_TESTIMONIALS__.length > 0) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    // Always fetch fresh data from the API for live updates and filter support.
    // If pre-rendered data was available we are already showing it, so this is a background refresh.
    api.getTestimonials()
      .then((data) => {
        if (data && Array.isArray(data)) {
          setTestimonials(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load testimonials:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleBooking = () => {
    if (onOpenDemoBooking) {
      onOpenDemoBooking();
    } else {
      onNavigate('free-demo');
    }
  };

  const filteredReviews = testimonials.filter((t) => {
    if (selectedFilter === '5star') return (t.rating || 5) === 5;
    if (selectedFilter === 'exam') {
      const text = (t.review + ' ' + (t.title || '')).toLowerCase();
      return text.includes('exam') || text.includes('speed') || text.includes('marks') || text.includes('school');
    }
    return true;
  });

  return (
    <div className="space-y-12 sm:space-y-20 pb-16 sm:pb-24 overflow-hidden font-sans">
      <br></br>
      {/* 3. TESTIMONIALS LIST & FILTER */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Parent &amp; Student Stories
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Showing {filteredReviews.length} verified testimonials
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedFilter === 'all'
                ? 'bg-white text-[#0E3589] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              All Reviews
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('5star')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedFilter === '5star'
                ? 'bg-white text-[#0E3589] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              5-Star Ratings
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('exam')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedFilter === 'exam'
                ? 'bg-white text-[#0E3589] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Exam &amp; Speed Results
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            Loading verified reviews...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-2">
            <p className="text-sm font-semibold text-slate-700">No reviews found for this filter.</p>
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className="text-xs text-[#0E3589] font-bold hover:underline"
            >
              Reset filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReviews.map((rev, idx) => {
              const displayTitle = rev.title;
              const badgeLabel = rev.beforeAfterTag || 'Verified Parent Review';

              return (
                <div
                  key={rev.id || idx}
                  className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-slate-100 hover:border-blue-200 shadow-md hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <StarRating readOnly rating={rev.rating || 5} size="sm" />
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200">
                        {badgeLabel}
                      </span>
                    </div>

                    {displayTitle && (
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                        "{displayTitle}"
                      </h3>
                    )}

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-sans font-medium">
                      "{rev.review}"
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">
                        {rev.authorName || 'SmartPen Parent'}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {rev.studentName ? `Parent of ${rev.studentName}` : 'Bangalore Center'}
                        {rev.studentGrade ? ` • ${formatGradeClass(rev.studentGrade)}` : ''}
                      </p>
                    </div>

                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. BOTTOM CTA BANNER */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-[#0E3589] via-[#0084F4] to-[#F46E20] rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-4">
            <span className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider inline-block">
              Experience the Transformation
            </span>
            <h2 className="text-2xl sm:text-4xl font-black">
              Help Your Child Write with Pride
            </h2>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-sans">
              Schedule a free 1-on-1 diagnostic assessment with Mrs. Deepthy Rock. Discover the exact kinetic adjustments your child needs to achieve neat, high-scoring handwriting.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleBooking}
                variant="accent"
                size="lg"
                className="bg-white text-[#0E3589] hover:bg-amber-100 px-8 py-3.5 rounded-2xl font-black text-base shadow-md cursor-pointer inline-flex items-center gap-2"
                id="btn-testimonials-cta-demo"
              >
                <span>Book for a Free Demo Class</span>
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
