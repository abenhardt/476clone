import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, PenLine, User, Clock, Shield } from 'lucide-react';
import { Tooltip } from '@/ui/components/Tooltip';

export interface AssessmentReviewState {
  review_status: 'system_calculated' | 'reviewed' | 'overridden';
  review_status_label: string;
  is_reviewed_by_staff: boolean;
  reviewed_by: { id: number; name: string } | null;
  reviewed_at: string | null;
  clinical_notes: string | null;
  is_overridden: boolean;
  override_supervision_level: string | null;
  override_supervision_label: string | null;
  override_reason: string | null;
  overridden_by: { id: number; name: string } | null;
  overridden_at: string | null;
  supervision_level: string;
  supervision_label: string;
  effective_supervision_level: string;
  effective_supervision_label: string;
  effective_staffing_ratio: string;
}

interface MedicalReviewPanelProps {
  assessment: AssessmentReviewState;
  canReview: boolean;    // medical or admin
  canOverride: boolean;  // medical or super_admin
  onReview: (notes: string) => Promise<void>;
  onOverride: (level: string, reason: string, notes?: string) => Promise<void>;
}

const SUPERVISION_OPTIONS = [
  { value: 'standard',   label: 'Standard',    ratio: '1:6', description: 'Shared supervision across up to 6 campers' },
  { value: 'enhanced',   label: 'Enhanced',    ratio: '1:3', description: 'Increased supervision across up to 3 campers' },
  { value: 'one_to_one', label: 'One-to-One',  ratio: '1:1', description: 'Dedicated staff member assigned solely to this camper' },
];

const STATUS_CONFIG = {
  system_calculated: {
    bg:    'rgba(107,114,128,0.08)',
    border: 'rgba(107,114,128,0.2)',
    color: '#6b7280',
    icon: Shield,
    message: 'This score is system-calculated from medical data and has not yet been reviewed by a clinician. Use "Validate Assessment" to confirm the score is clinically appropriate, or "Override Supervision" if you need to adjust the supervision level based on clinical judgement.',
  },
  reviewed: {
    bg:    'rgba(22,101,52,0.07)',
    border: 'rgba(22,101,52,0.2)',
    color: '#16a34a',
    icon: CheckCircle2,
    message: 'A clinician has reviewed and validated this assessment. The system-calculated score has been confirmed as clinically appropriate. Clinical notes (if any) are shown below.',
  },
  overridden: {
    bg:    'rgba(234,88,12,0.07)',
    border: 'rgba(234,88,12,0.25)',
    color: '#ea580c',
    icon: AlertTriangle,
    message: 'A clinician has overridden the system-calculated supervision level. The effective supervision level shown below is the authoritative level staff must follow. The original system recommendation and override justification are recorded in the audit trail.',
  },
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * MedicalReviewPanel — clinical review and supervision override interface.
 *
 * Shows the current review state and, for authorised users, provides:
 *  - A "Validate Assessment" form (add clinical notes, confirm system recommendation)
 *  - A "Override Supervision Level" form (select different level, mandatory reason ≥20 chars)
 *
 * The override reason field is deliberately large and requires meaningful clinical
 * justification — not a loophole for convenience overrides.
 */
export function MedicalReviewPanel({
  assessment,
  canReview,
  canOverride,
  onReview,
  onOverride,
}: MedicalReviewPanelProps) {
  const [mode, setMode]            = useState<'idle' | 'reviewing' | 'overriding'>('idle');
  const [notes, setNotes]          = useState(assessment.clinical_notes ?? '');
  const [overrideLevel, setOverrideLevel] = useState(assessment.override_supervision_level ?? assessment.supervision_level);
  const [overrideReason, setOverrideReason] = useState(assessment.override_reason ?? '');
  const [overrideNotes, setOverrideNotes]   = useState(assessment.clinical_notes ?? '');
  const [saving, setSaving]        = useState(false);
  const [error, setError]          = useState<string | null>(null);

  // Sync internal form state when the parent refreshes the assessment after a save.
  // Without this, re-opening the review/override form shows stale pre-save values.
  useEffect(() => {
    if (mode === 'idle') {
      setNotes(assessment.clinical_notes ?? '');
      setOverrideLevel(assessment.override_supervision_level ?? assessment.supervision_level);
      setOverrideReason(assessment.override_reason ?? '');
      setOverrideNotes(assessment.clinical_notes ?? '');
    }
  }, [assessment, mode]);

  const statusConfig = STATUS_CONFIG[assessment.review_status];
  const StatusIcon   = statusConfig.icon;

  const handleReview = async () => {
    setSaving(true);
    setError(null);
    try {
      await onReview(notes);
      setMode('idle');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save review. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async () => {
    if (overrideReason.trim().length < 20) {
      setError('Override reason must be at least 20 characters to document clinical justification.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onOverride(overrideLevel, overrideReason, overrideNotes || undefined);
      setMode('idle');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save override. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Review status banner */}
      <div
        className="flex items-start gap-3 rounded-xl p-3.5"
        style={{ background: statusConfig.bg, border: `1px solid ${statusConfig.border}` }}
      >
        <StatusIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: statusConfig.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: `${statusConfig.color}18`,
                color: statusConfig.color,
                border: `1px solid ${statusConfig.color}30`,
              }}
            >
              {assessment.review_status_label}
            </span>
            {assessment.is_reviewed_by_staff && assessment.reviewed_by && (
              <span className="text-xs text-[var(--muted-foreground,#6b7280)] flex items-center gap-1">
                <User className="w-3 h-3" />
                {assessment.reviewed_by.name}
                {assessment.reviewed_at && (
                  <>
                    <Clock className="w-3 h-3 ml-1" />
                    {fmtDate(assessment.reviewed_at)}
                  </>
                )}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed text-[var(--foreground)]">{statusConfig.message}</p>
        </div>
      </div>

      {/* Effective supervision level */}
      <div className="rounded-xl border border-[var(--border,#e5e7eb)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#6b7280)] mb-1">
              Effective Supervision Level
              <Tooltip
                content="The supervision level staff must act on right now. If an override is active it supersedes the system calculation — the original system value is shown for reference. Standard = 1:6 ratio; Enhanced = 1:3; One-to-One = dedicated staff."
                placement="right"
                maxWidth={300}
              >
                <span className="ml-1 cursor-help inline-flex">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </Tooltip>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{assessment.effective_supervision_label}</span>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-lg font-semibold"
                style={{ background: 'rgba(22,101,52,0.10)', color: '#166534' }}
              >
                {assessment.effective_staffing_ratio}
              </span>
              {assessment.is_overridden && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c' }}
                >
                  Overridden
                </span>
              )}
            </div>
          </div>
          {assessment.is_overridden && (
            <div className="text-right text-xs text-[var(--muted-foreground,#6b7280)]">
              <p>System: {assessment.supervision_label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Override details (if overridden) */}
      {assessment.is_overridden && assessment.override_reason && (
        <div
          className="rounded-xl p-3.5"
          style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#ea580c] mb-1.5">Override Justification</p>
          <p className="text-sm text-[var(--foreground)] leading-relaxed">{assessment.override_reason}</p>
          {assessment.overridden_by && (
            <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-1.5 flex items-center gap-1">
              <User className="w-3 h-3" />
              {assessment.overridden_by.name}
              {assessment.overridden_at && (
                <> · {fmtDate(assessment.overridden_at)}</>
              )}
            </p>
          )}
        </div>
      )}

      {/* Clinical notes (if any) */}
      {assessment.clinical_notes && mode === 'idle' && (
        <div className="rounded-xl border border-[var(--border,#e5e7eb)] p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#6b7280)] mb-1.5">
            Clinical Notes
          </p>
          <p className="text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
            {assessment.clinical_notes}
          </p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          className="rounded-xl p-3 text-sm"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}
        >
          {error}
        </div>
      )}

      {/* Review form */}
      {mode === 'reviewing' && (
        <div className="rounded-xl border border-[var(--border,#e5e7eb)] p-4 space-y-3">
          <p className="text-sm font-semibold">Validate Assessment</p>
          <p className="text-xs text-[var(--muted-foreground,#6b7280)]">
            Confirming validation means you have reviewed the system-calculated score and find it clinically appropriate for this camper.
            This does not change the score or supervision level — it records your clinical sign-off.
            Adding notes is optional but recommended to document your reasoning.
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Clinical notes (optional) — document your assessment review, relevant context, or observations…"
            rows={4}
            maxLength={4000}
            className="w-full rounded-lg border border-[var(--border,#e5e7eb)] bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange,#16a34a)] focus:ring-opacity-30"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMode('idle'); setError(null); }}
              className="text-sm text-[var(--muted-foreground,#6b7280)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReview}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#16a34a' }}
            >
              {saving ? 'Saving…' : 'Confirm Review'}
            </button>
          </div>
        </div>
      )}

      {/* Override form */}
      {mode === 'overriding' && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: 'rgba(234,88,12,0.35)', background: 'rgba(234,88,12,0.03)' }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#ea580c' }} />
            <p className="text-sm font-semibold" style={{ color: '#ea580c' }}>Override Supervision Level</p>
          </div>
          <p className="text-xs text-[var(--muted-foreground,#6b7280)]">
            This will replace the system-calculated supervision level with your clinical judgement.
            The override becomes the <strong className="text-[var(--foreground)]">effective level staff must follow</strong> immediately.
            A mandatory clinical justification (minimum 20 characters) is required and will be permanently recorded in the audit trail.
          </p>

          <div className="space-y-2">
            {SUPERVISION_OPTIONS.map(opt => (
              <label
                key={opt.value}
                htmlFor={`override_level_${opt.value}`}
                aria-label={opt.label}
                className={[
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  overrideLevel === opt.value
                    ? 'border-[#16a34a] bg-[rgba(22,101,52,0.06)]'
                    : 'border-[var(--border,#e5e7eb)] hover:border-[rgba(22,101,52,0.4)]',
                ].join(' ')}
              >
                <input
                  id={`override_level_${opt.value}`}
                  type="radio"
                  name="override_level"
                  value={opt.value}
                  checked={overrideLevel === opt.value}
                  onChange={() => setOverrideLevel(opt.value)}
                  className="mt-1"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className="text-xs font-mono px-1.5 py-0.5 rounded-lg"
                      style={{ background: 'rgba(22,101,52,0.10)', color: '#166534' }}
                    >
                      {opt.ratio}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="override_reason" className="text-xs font-semibold text-[var(--foreground)]">
              Clinical Justification <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              id="override_reason"
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="Document the clinical reason for this override. Minimum 20 characters required. (e.g., 'Newly identified anxiety behaviours not yet in profile; physician recommendation pending update.')"
              rows={4}
              maxLength={4000}
              className="w-full rounded-lg border border-[var(--border,#e5e7eb)] bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange,#16a34a)] focus:ring-opacity-30"
            />
            <p className="text-xs text-[var(--muted-foreground,#6b7280)]">
              {overrideReason.length} / 4000 chars · minimum 20 required
            </p>
          </div>

          <div className="space-y-1">
            <label htmlFor="override_notes" className="text-xs font-semibold text-[var(--foreground)]">Additional Clinical Notes (optional)</label>
            <textarea
              id="override_notes"
              value={overrideNotes}
              onChange={e => setOverrideNotes(e.target.value)}
              placeholder="Optional additional context…"
              rows={2}
              maxLength={4000}
              className="w-full rounded-lg border border-[var(--border,#e5e7eb)] bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange,#16a34a)] focus:ring-opacity-30"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => { setMode('idle'); setError(null); }}
              className="text-sm text-[var(--muted-foreground,#6b7280)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleOverride}
              disabled={saving || overrideReason.trim().length < 20}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: '#ea580c' }}
            >
              {saving ? 'Saving…' : 'Apply Override'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons (idle state) */}
      {mode === 'idle' && (canReview || canOverride) && (
        <div className="flex flex-wrap gap-2">
          {canReview && (
            <button
              type="button"
              onClick={() => setMode('reviewing')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--muted,#f9fafb)]"
              style={{ borderColor: '#16a34a', color: '#16a34a' }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {assessment.is_reviewed_by_staff ? 'Update Review' : 'Validate Assessment'}
            </button>
          )}
          {canOverride && (
            <button
              type="button"
              onClick={() => setMode('overriding')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-[var(--muted,#f9fafb)]"
              style={{ borderColor: '#ea580c', color: '#ea580c' }}
            >
              <PenLine className="w-3.5 h-3.5" />
              {assessment.is_overridden ? 'Update Override' : 'Override Supervision'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
