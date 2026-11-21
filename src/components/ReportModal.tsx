import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { REPORT_REASONS } from '../lib/format';
import { moderationApi } from '../lib/api';
import { CrisisSupportBanner, SuccessConfirmation } from './StateViews';
import type { CrisisResources } from '../types';

export function ReportModal({
  contentType,
  contentId,
  onClose,
}: {
  contentType: 'question' | 'answer';
  contentId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [crisisResources, setCrisisResources] = useState<CrisisResources | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await moderationApi.submitReport({
        contentType,
        contentId,
        reason,
        description,
      });
      if (res.showCrisisResources) {
        setCrisisResources(res.crisisResources);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-indigo-900 bg-white dark:bg-[#0D1326] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-indigo-950/70">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <h2
              id="report-dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Report Content
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submitted ? (
          <div className="mt-5 space-y-5">
            <SuccessConfirmation
              title="Report Received"
              message="Thank you for helping keep Stranger's Wisdom safe. Reports remain private and are reviewed by moderators."
              primaryLabel="Return"
              onPrimary={onClose}
            />
            {(crisisResources || reason === 'Self-harm concerns') && (
              <CrisisSupportBanner resources={crisisResources} />
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                What are you reporting?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm transition-colors cursor-pointer ${
                      reason === r
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 font-medium'
                        : 'border-slate-200 dark:border-indigo-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-indigo-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {reason === 'Self-harm concerns' && <CrisisSupportBanner />}

            <div>
              <label
                htmlFor="report-notes"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                Additional context (optional)
              </label>
              <textarea
                id="report-notes"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Share anything that helps moderators review this safely..."
                className="w-full rounded-xl border border-slate-300 dark:border-indigo-900 bg-slate-50 dark:bg-[#070B19] p-3 text-sm text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] rounded-xl px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
