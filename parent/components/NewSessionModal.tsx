/**
 * NewSessionModal.tsx
 *
 * Reusable "Apply for a New Session" modal.
 *
 * This component is camper-centric: it receives a specific camper and optionally
 * the ID of the best prior application to use as an audit-trail source. It owns
 * session loading, duplicate detection, and navigation internally.
 *
 * Entry points:
 *   - ApplicantDashboardPage (primary — camper card button)
 *   - ApplicantApplicationsPage (secondary — past-application row button)
 *   - ApplicantApplicationDetailPage (legacy path — still works)
 *
 * Source-selection policy (enforced by the caller, not this component):
 *   The caller is responsible for passing `reappliedFromId`. The recommended
 *   strategy is `findBestSourceApp()` exported from this file: most-recent
 *   non-draft terminal application for the camper, with approved > rejected >
 *   withdrawn > cancelled as a tiebreak when submitted_at is equal.
 *
 * Carry-forward policy (enforced here + in ApplicationFormPage):
 *   Only stable, low-sensitivity camper fields travel forward:
 *     first_name, last_name, date_of_birth, gender, tshirt_size
 *   Medical data, documents, signatures, review state, and narratives do NOT
 *   carry forward. The user must complete and re-upload all required sections.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSessions } from '@/features/parent/api/applicant.api';
import type { Camper, Application, Session } from '@/shared/types';
import { ROUTES } from '@/shared/constants/routes';
import { Avatar } from '@/ui/components/Avatar';

// ---------------------------------------------------------------------------
// Source-selection helper — exported so callers can compute reappliedFromId
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = ['approved', 'rejected', 'withdrawn', 'cancelled'] as const;
// Lower number = higher priority when submitted_at timestamps are equal
const STATUS_PRIORITY: Record<string, number> = {
  approved:  0,
  rejected:  1,
  withdrawn: 2,
  cancelled: 3,
};

/**
 * Returns the best prior application to use as a prefill/audit source for the
 * given camper. Never mutates the input array.
 *
 * Algorithm:
 *   1. Filter to non-draft terminal applications for this camper.
 *   2. Sort by submitted_at DESC (most recent wins).
 *   3. Tiebreak: approved > rejected > withdrawn > cancelled.
 *   4. Return the winner, or null if no candidates exist.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function findBestSourceApp(
  apps: Application[],
  camperId: number
): Application | null {
  const candidates = apps.filter(
    (a) =>
      a.camper_id === camperId &&
      !a.is_draft &&
      (TERMINAL_STATUSES as readonly string[]).includes(a.status)
  );
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    const dateA = new Date(a.submitted_at ?? a.created_at ?? 0).getTime();
    const dateB = new Date(b.submitted_at ?? b.created_at ?? 0).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
  })[0];
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

// Statuses that mean the application is still moving through the pipeline.
// Having one of these for a given session blocks opening another for the same session.
const BLOCKING_STATUSES = ['submitted', 'under_review', 'waitlisted'];

interface NewSessionModalProps {
  /** The camper this application will be for. */
  camper: Camper;
  /**
   * ID of the prior application to link as the audit-trail source.
   * Pass findBestSourceApp(...) result. Omit when no prior application exists.
   */
  reappliedFromId?: number;
  /**
   * All applications for this account. Used to detect duplicate session entries.
   * Defaults to empty array (no duplicate checking).
   */
  existingApplications?: Application[];
  onClose: () => void;
}

export function NewSessionModal({
  camper,
  reappliedFromId,
  existingApplications = [],
  onClose,
}: NewSessionModalProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  // Focus the dialog on mount for accessibility
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Load available sessions once on mount
  useEffect(() => {
    getSessions()
      .then((all) =>
        setSessions(all.filter((s) => s.status === 'open' || s.status === 'upcoming'))
      )
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  // Keyboard: close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Duplicate detection: is there already an active or draft application for
  // this camper in the selected session?
  const duplicateApp = selectedSessionId
    ? existingApplications.find(
        (a) =>
          a.camper_id === camper.id &&
          a.session_id === selectedSessionId &&
          (a.is_draft || BLOCKING_STATUSES.includes(a.status))
      )
    : null;

  function handleConfirm() {
    if (!selectedSessionId || duplicateApp) return;
    onClose();
    navigate(ROUTES.PARENT_APPLICATION_NEW, {
      state: {
        prefill: {
          first_name:    camper.first_name,
          last_name:     camper.last_name,
          date_of_birth: camper.date_of_birth,
          gender:        camper.gender,
          tshirt_size:   camper.tshirt_size,
        },
        sessionId: selectedSessionId,
        // Only set the audit-trail link when a prior application was found.
        // Its absence means a first-time application for this camper.
        ...(reappliedFromId != null ? { reappliedFromId } : {}),
      },
    });
  }

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nsm-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl p-6 shadow-xl outline-none"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={camper.full_name} size="sm" />
            <div>
              <h2
                id="nsm-title"
                className="font-headline text-lg font-semibold"
                style={{ color: 'var(--foreground)' }}
              >
                Apply for a New Session
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                Starting a new application for{' '}
                <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                  {camper.full_name}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0 ml-4"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── What happens explanation ──────────────────────── */}
        <div
          className="rounded-xl p-4 mb-5 text-sm leading-relaxed"
          style={{
            background: 'rgba(22,163,74,0.06)',
            border: '1px solid rgba(22,163,74,0.18)',
            color: 'var(--foreground)',
          }}
        >
          <p className="font-medium mb-2" style={{ color: 'var(--ember-orange)' }}>
            What happens when you start a new application:
          </p>
          <ul className="space-y-1.5 list-none">
            <li className="flex items-start gap-2">
              <CheckCircle2
                className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                style={{ color: '#16a34a' }}
              />
              <span>
                A brand-new application is created — your previous one is not changed.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2
                className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                style={{ color: '#16a34a' }}
              />
              <span>
                {camper.first_name}&apos;s basic information is filled in to save you time.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2
                className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                style={{ color: '#16a34a' }}
              />
              <span>You&apos;ll review and complete all sections before submitting.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2
                className="h-3.5 w-3.5 mt-0.5 flex-shrink-0"
                style={{ color: '#16a34a' }}
              />
              <span>All required documents and forms must be uploaded again.</span>
            </li>
          </ul>
        </div>

        {/* ── Session selector ─────────────────────────────── */}
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
          Choose a camp session:
        </p>

        {loading ? (
          <div
            className="flex items-center justify-center py-6 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Loading available sessions…
          </div>
        ) : loadError ? (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{
              background: 'rgba(220,38,38,0.05)',
              border: '1px solid rgba(220,38,38,0.20)',
              color: 'var(--destructive)',
            }}
          >
            Could not load sessions. Please close and try again.
          </div>
        ) : sessions.length === 0 ? (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{
              background: 'var(--dash-bg)',
              border: '1px solid var(--border)',
              color: 'var(--muted-foreground)',
            }}
          >
            No sessions are currently open for applications.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto mb-4 pr-1">
            {sessions.map((session) => {
              // Check whether this camper already has an in-flight application for
              // this session. We show a warning tag but still allow selection so
              // the user can read the duplicate warning before being blocked.
              const sessionConflict = existingApplications.find(
                (a) =>
                  a.camper_id === camper.id &&
                  a.session_id === session.id &&
                  (a.is_draft || BLOCKING_STATUSES.includes(a.status))
              );
              const isSelected = selectedSessionId === session.id;

              return (
                <label
                  key={session.id}
                  className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors"
                  style={{
                    borderColor: isSelected ? 'var(--ember-orange)' : 'var(--border)',
                    background: isSelected
                      ? 'rgba(22,163,74,0.06)'
                      : 'var(--dash-bg)',
                  }}
                >
                  <input
                    type="radio"
                    name="nsm-session"
                    value={session.id}
                    checked={isSelected}
                    onChange={() => setSelectedSessionId(session.id)}
                    className="mt-0.5 flex-shrink-0 accent-[var(--ember-orange)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {session.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(session.start_date).toLocaleDateString()} –{' '}
                      {new Date(session.end_date).toLocaleDateString()}
                      {session.available_spots != null && (
                        <span> · {session.available_spots} spots available</span>
                      )}
                    </p>
                    {sessionConflict && (
                      <p
                        className="text-xs mt-1 font-medium"
                        style={{ color: '#b45309' }}
                      >
                        {camper.first_name} already has a{' '}
                        {sessionConflict.is_draft ? 'draft' : sessionConflict.status}{' '}
                        application for this session.
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* ── Duplicate warning (shown below when the selected session has a conflict) */}
        {duplicateApp && (
          <div
            className="flex items-start gap-2.5 rounded-xl p-3 mb-4 text-sm"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.30)',
            }}
          >
            <AlertCircle
              className="h-4 w-4 flex-shrink-0 mt-0.5"
              style={{ color: '#b45309' }}
            />
            <p style={{ color: '#92400e' }}>
              {camper.full_name} already has a{' '}
              {duplicateApp.is_draft ? 'draft' : duplicateApp.status} application for
              this session.{' '}
              {duplicateApp.is_draft
                ? 'Please continue the existing draft instead of starting a new one.'
                : 'Please check your existing application or choose a different session.'}
            </p>
          </div>
        )}

        {/* ── Action buttons ───────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSessionId || !!duplicateApp || loading}
            className="text-sm px-5 py-2 rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            Start New Application
          </button>
        </div>
      </div>
    </div>
  );
}
