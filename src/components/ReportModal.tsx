import React, { useState } from 'react';
import { Flag, X, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { submitReport } from '../services/firestoreService';

interface ReportModalProps {
  postId?: string | null;
  targetId?: string | null;
  targetType?: 'post' | 'user' | 'comment';
  onClose: () => void;
}

const REPORT_REASONS = [
  'Spam or misleading promotional content',
  'Harassment or disrespectful behavior',
  'Inappropriate or abusive messages/imagery',
  'Environmental misinformation',
  'Impersonation or harmful conduct',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  postId,
  targetId,
  targetType = 'post',
  onClose,
}) => {
  const effectiveId = targetId || postId;
  const { currentUser, signInWithGoogle } = useAuth();
  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!effectiveId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      signInWithGoogle();
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport({
        reporterId: currentUser.uid,
        targetType: targetType,
        targetId: effectiveId,
        reason: `${selectedReason}: ${details.trim()}`,
        createdAt: new Date().toISOString(),
      });
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error submitting report:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-emerald-950 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-emerald-100 dark:border-emerald-900/60">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
            <Flag className="w-4 h-4 text-amber-500" />
            <span>Report Content</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-6 text-center flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">
              Report Submitted
            </p>
            <p className="text-[11px] text-stone-500">
              Thank you for protecting our clean botanical community.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <p className="text-xs text-stone-600 dark:text-stone-300">
              Help us keep FG TIME safe and serene. Why are you reporting this sprout?
            </p>

            <div className="flex flex-col gap-1.5">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedReason === reason
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 font-medium'
                      : 'border-stone-200 dark:border-emerald-900/40 text-stone-700 dark:text-stone-300 hover:bg-stone-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-emerald-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div>
              <textarea
                rows={2}
                placeholder="Additional notes (optional)..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-emerald-950 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
