/**
 * IncompleteApprovalModal.tsx
 *
 * Warning modal shown when an admin attempts to approve an application that
 * has missing fields, documents, or consents.
 *
 * The modal is purely presentational — it renders the structured completeness
 * report from the backend and fires one of two callbacks:
 *   onClose   → admin chose "Go Back and Fix" — no changes made
 *   onApprove → admin chose "Approve Anyway"  — parent proceeds with override
 */

import type { ApplicationCompleteness, CompletenessItem } from '@/features/admin/types/admin.types';
import { AlertTriangle, X as XIcon } from 'lucide-react';
import { Button } from '@/ui/components/Button';

interface Props {
  completeness: ApplicationCompleteness;
  submitting: boolean;
  onClose: () => void;
  onApprove: () => void;
}

export function IncompleteApprovalModal({ completeness, submitting, onClose, onApprove }: Props) {
  const hasFields      = completeness.missing_fields.length > 0;
  const hasDocs        = completeness.missing_documents.length > 0;
  const hasUnverified  = (completeness.unverified_documents ?? []).length > 0;
  const hasConsents    = completeness.missing_consents.length > 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start gap-3 px-6 pt-6 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex-shrink-0 rounded-full p-2 mt-0.5"
            style={{ background: 'rgba(234,88,12,0.12)' }}
          >
            <AlertTriangle className="h-5 w-5" style={{ color: 'var(--ember-orange)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Application Incomplete — Approval Warning
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              The following issues were found. Items in <strong>Missing Documents</strong> were never
              uploaded. Items in <strong>Awaiting Verification</strong> are on file but not yet reviewed.
              You can still approve — your decision and these gaps will be recorded.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Missing items — grouped by category */}
        <div className="px-6 py-4 space-y-4 max-h-[55vh] overflow-y-auto">

          {hasFields && (
            <MissingSection
              title="Missing Information"
              items={completeness.missing_fields}
            />
          )}

          {hasDocs && (
            <MissingSection
              title="Missing Documents"
              items={completeness.missing_documents}
            />
          )}

          {hasUnverified && (
            <MissingSection
              title="Uploaded — Awaiting Reviewer Verification"
              items={completeness.unverified_documents ?? []}
              note="These documents were submitted by the applicant and are on file, but have not yet been reviewed and verified by a staff member. They are NOT missing — they are received and pending your review."
            />
          )}

          {hasConsents && (
            <MissingSection
              title="Missing Consents"
              items={completeness.missing_consents}
            />
          )}

        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Go Back and Fix
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            disabled={submitting}
            onClick={onApprove}
          >
            Approve Anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function MissingSection({ title, items, note }: { title: string; items: CompletenessItem[]; note?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
        {title}
      </p>
      {note && (
        <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {note}
        </p>
      )}
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            style={{
              background: item.severity === 'high'
                ? 'rgba(234,88,12,0.07)'
                : 'rgba(202,138,4,0.07)',
              color: 'var(--foreground)',
            }}
          >
            <span
              className="mt-0.5 flex-shrink-0 h-2 w-2 rounded-full"
              style={{
                background: item.severity === 'high'
                  ? 'var(--ember-orange)'
                  : '#ca8a04',
                marginTop: '5px',
              }}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
