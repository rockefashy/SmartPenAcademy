import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Star,
  Sparkles,
  Trash2,
  RefreshCw,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Testimonial } from '../../../types';
import { api } from '../../../services/api';
import { handleClientError } from '../../../utils/clientError';
import { Button, Modal, StatCard, Toast } from '../../ui';

export const TestimonialsTab: React.FC = () => {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Featured'>('All');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(prev => prev?.message === message ? null : prev), 6000);
  };

  const loadTestimonials = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all testimonials for admin moderation
      const data = await api.getTestimonials();
      setTestimonials(data);
    } catch (err) {
      handleClientError('TestimonialsTab.loadTestimonials', err, 'Failed to load testimonials');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const handleUpdateStatus = async (id: string, newStatus: 'Pending' | 'Approved' | 'Featured') => {
    setActionInProgress(id);
    try {
      const updated = await api.updateTestimonial(id, { status: newStatus });
      setTestimonials(prev => prev.map(t => t.id === id ? updated : t));
      showFeedback(`Testimonial status updated to ${newStatus}`);
    } catch (err: any) {
      showFeedback(handleClientError('TestimonialsTab.updateStatus', err, 'Failed to update testimonial status'), 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionInProgress(id);
    try {
      await api.deleteTestimonial(id);
      setTestimonials(prev => prev.filter(t => t.id !== id));
      showFeedback('Testimonial permanently deleted');
      setConfirmDeleteId(null);
    } catch (err: any) {
      showFeedback(handleClientError('TestimonialsTab.delete', err, 'Failed to delete testimonial'), 'error');
      setConfirmDeleteId(null);
    } finally {
      setActionInProgress(null);
    }
  };

  const filtered = testimonials.filter(t => {
    if (statusFilter === 'All') return true;
    return t.status === statusFilter;
  });

  const pendingCount = testimonials.filter(t => t.status === 'Pending').length;
  const approvedCount = testimonials.filter(t => t.status === 'Approved').length;
  const featuredCount = testimonials.filter(t => t.status === 'Featured').length;

  return (
    <div className="space-y-6">
      {/* Floating Viewport Toast */}
      <Toast
        message={feedback?.message}
        type={feedback?.type}
        durationMs={6000}
        onDismiss={() => setFeedback(null)}
      />

      {/* 1. Stat Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Reviews"
          value={testimonials.length}
          icon={<MessageSquare className="w-4 h-4" />}
          colorScheme="blue"
        />
        <StatCard
          label="Pending Approval"
          value={pendingCount}
          icon={<Clock className="w-4 h-4" />}
          colorScheme={pendingCount > 0 ? 'orange' : 'emerald'}
          description={pendingCount > 0 ? 'Requires moderation' : 'Inbox clear'}
        />
        <StatCard
          label="Approved (Catalog)"
          value={approvedCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          colorScheme="emerald"
        />
        <StatCard
          label="Featured (Homepage)"
          value={featuredCount}
          icon={<Sparkles className="w-4 h-4" />}
          colorScheme="amber"
        />
      </div>

      {/* 2. Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {(['All', 'Pending', 'Approved', 'Featured'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === f
                  ? 'bg-[#0E3589] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
              {f === 'Pending' && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-[10px] bg-amber-500 text-white rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadTestimonials}
          disabled={isLoading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </div>

      {/* 3. Testimonials Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading parent reviews...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-500">
          No testimonials matching filter &quot;{statusFilter}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className={`bg-white rounded-xl border p-5 shadow-sm transition-all flex flex-col justify-between ${
                item.status === 'Pending'
                  ? 'border-amber-300 ring-2 ring-amber-100'
                  : item.status === 'Featured'
                  ? 'border-indigo-200'
                  : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header: Student Name, Parent, Status, Date */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">
                      {item.studentName}
                      {item.grade ? <span className="text-xs font-normal text-slate-500 ml-1.5">({item.grade})</span> : null}
                    </h4>
                    <p className="text-xs text-slate-500">
                      by {item.parentName || 'Parent'} • {item.relationship || 'Parent'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.mediaConsent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> Consent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        <ShieldAlert className="w-3 h-3" /> No Consent
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        item.status === 'Featured'
                          ? 'bg-purple-100 text-purple-800'
                          : item.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800 animate-pulse'
                      }`}
                    >
                      {item.status || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Rating & Title */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${i < (item.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                      />
                    ))}
                  </div>
                  {item.title && <span className="text-xs font-semibold text-slate-800">“{item.title}”</span>}
                </div>

                {/* Review Text */}
                <p className="text-sm text-slate-600 mb-4 whitespace-pre-line leading-relaxed">
                  {item.review}
                </p>

                {/* Image if available */}
                {item.image && (
                  <div className="mb-4">
                    <img
                      src={item.image}
                      alt={item.title || 'Student work sample'}
                      className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-sm"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                <span className="text-[11px] text-slate-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                </span>
                <div className="flex items-center gap-2">
                  {item.status !== 'Approved' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(item.id, 'Approved')}
                      disabled={actionInProgress === item.id}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                    >
                      Approve
                    </Button>
                  )}
                  {item.status !== 'Featured' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleUpdateStatus(item.id, 'Featured')}
                      disabled={actionInProgress === item.id}
                      leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700"
                    >
                      Feature
                    </Button>
                  )}
                  {item.status === 'Featured' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateStatus(item.id, 'Approved')}
                      disabled={actionInProgress === item.id}
                      className="text-xs"
                    >
                      Unfeature
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteId(item.id)}
                    disabled={actionInProgress === item.id}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-xs text-rose-600 hover:bg-rose-50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <Modal
          isOpen={!!confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
          title="Delete Testimonial"
        >
          <div className="space-y-4 p-1">
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete this testimonial? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(confirmDeleteId)}
                loading={actionInProgress === confirmDeleteId}
              >
                Delete Testimonial
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
