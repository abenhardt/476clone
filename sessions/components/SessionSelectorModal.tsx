/**
 * SessionSelectorModal.tsx
 *
 * The premium session workspace selector — an iconic, dynamic overlay that lets
 * admins choose which camp session they want to operate inside.
 *
 * Design language:
 *  - Real landscape photography as session backgrounds
 *  - Dark gradient overlays for readability, lighter at top, deeper at bottom
 *  - Text and metadata overlaid on the photo, clean and minimal
 *  - Subtle zoom on hover (scale on the photo layer, fixed overlay + text)
 *  - Enterprise-grade, calm, intentional
 *  - Mobile-responsive 1 → 2 → 3 column grid
 *
 * The modal renders via createPortal so it always overlays the full viewport
 * regardless of where in the tree it is mounted.
 */

import { useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Globe, CheckCircle2, Calendar, ChevronRight, Archive } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { useSessionWorkspace } from '../context/SessionWorkspaceContext';
import type { CampSession } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';

// ─── Session photo system ─────────────────────────────────────────────────────
import { getSessionImage } from '../utils/sessionImages';

// ─── Session status ──────────────────────────────────────────────────────────
// Only called for active sessions — no 'Archived' case needed in the modal.

const STATUS_DISPLAY: Record<string, { label: string; bg: string; text: string }> = {
  upcoming:   { label: 'Upcoming',    bg: 'rgba(37,99,235,0.72)',  text: '#fff' },
  open:       { label: 'Open',        bg: 'rgba(22,163,74,0.72)',  text: '#fff' },
  in_session: { label: 'In Session',  bg: 'rgba(14,90,42,0.80)',   text: '#fff' },
  closed:     { label: 'Closed',      bg: 'rgba(194,65,12,0.72)',  text: '#fff' },
  completed:  { label: 'Completed',   bg: 'rgba(75,85,99,0.72)',   text: 'rgba(255,255,255,0.90)' },
};

function getSessionStatus(session: CampSession): { label: string; bg: string; text: string } {
  // Always prefer server-computed status — incorporates portal_open and registration window.
  if (session.status && STATUS_DISPLAY[session.status]) return STATUS_DISPLAY[session.status];

  // Fallback: date-only derivation when server status is absent.
  try {
    const now   = new Date();
    const start = parseISO(session.start_date);
    const end   = parseISO(session.end_date);
    if (isBefore(now, start)) return STATUS_DISPLAY.upcoming;
    if (isAfter(now, end))    return STATUS_DISPLAY.completed;
  } catch { /* ignore */ }

  return STATUS_DISPLAY.in_session;
}

// ─── Session card ────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: CampSession;
  isSelected: boolean;
  onSelect: () => void;
}

function SessionCard({ session, isSelected, onSelect }: SessionCardProps) {
  const status    = getSessionStatus(session);
  const photoUrl  = getSessionImage(session.id);

  const enrolled  = session.enrolled_count  ?? 0;
  const capacity  = session.capacity        ?? 0;
  const fillPct   = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const fillColor = fillPct >= 100 ? '#ef4444' : fillPct >= 80 ? '#f59e0b' : '#86efac';

  const dateRange = (() => {
    try {
      const start = format(parseISO(session.start_date), 'MMM d');
      const end   = format(parseISO(session.end_date),   'MMM d, yyyy');
      return `${start} – ${end}`;
    } catch {
      return `${session.start_date} – ${session.end_date}`;
    }
  })();

  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-xl overflow-hidden transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        border: isSelected ? '2px solid var(--ember-orange)' : '1px solid rgba(255,255,255,0.12)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(234,88,12,0.20), 0 8px 32px rgba(0,0,0,0.24)'
          : '0 2px 12px rgba(0,0,0,0.16)',
      }}
    >
      {/* Photo header */}
      <div className="relative h-44 overflow-hidden">

        {/* Background photo — zooms on hover via group */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
          style={{ backgroundImage: `url(${photoUrl})` }}
          aria-hidden
        />

        {/* Gradient overlay — transparent at top, dark at bottom */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.72) 100%)',
          }}
          aria-hidden
        />

        {/* Status badge — top-right */}
        <span
          className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm"
          style={{ background: status.bg, color: status.text, letterSpacing: '0.01em' }}
        >
          {status.label}
        </span>

        {/* Selected checkmark — top-left */}
        {isSelected && (
          <div
            className="absolute top-3 left-3 rounded-full p-0.5"
            style={{ background: 'rgba(255,255,255,0.92)' }}
          >
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
          </div>
        )}

        {/* Text overlay — anchored to bottom of photo */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
          {session.camp?.name && (
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.72)', letterSpacing: '0.03em' }}>
              {session.camp.name}
            </p>
          )}
          <h3 className="font-headline font-bold text-base leading-tight" style={{ color: '#fff' }}>
            {session.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Calendar className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.64)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
              {dateRange}
            </span>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div
        className="px-4 py-3 space-y-3"
        style={{ background: 'var(--card)' }}
      >
        {/* Capacity bar */}
        {capacity > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <span className="font-medium" style={{ color: 'var(--foreground)' }}>{enrolled}</span>
                <span> / {capacity} enrolled</span>
              </span>
              <span className="text-xs font-semibold" style={{ color: fillPct >= 100 ? '#ef4444' : fillPct >= 80 ? '#d97706' : '#166534' }}>
                {fillPct}%
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${fillPct}%`, background: fillColor }}
              />
            </div>
          </div>
        )}

        {/* Enter workspace CTA */}
        <div
          className="flex items-center justify-between pt-1"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span
            className="text-xs font-medium"
            style={{ color: isSelected ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
          >
            {isSelected ? 'Current workspace' : 'Enter workspace'}
          </span>
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
            style={{ color: isSelected ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}
          />
        </div>
      </div>
    </button>
  );
}

// ─── Loading skeleton card ───────────────────────────────────────────────────

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse" style={{ borderColor: 'var(--border)' }}>
      <div className="h-44" style={{ background: 'var(--glass-medium)' }} />
      <div className="p-4 space-y-3">
        <div className="h-2 rounded-full" style={{ background: 'var(--border)' }} />
        <div className="h-3 rounded" style={{ background: 'var(--border)', width: '40%' }} />
      </div>
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export function SessionSelectorModal() {
  const ctx = useSessionWorkspace();

  // Destructure with safe fallbacks so hooks are always called unconditionally.
  // ctx is null only outside admin portals (applicant/medical layouts) — never inside.
  const currentSession  = ctx?.currentSession  ?? null;
  const sessions        = ctx?.sessions        ?? [];
  const sessionsLoading = ctx?.sessionsLoading ?? false;
  const selectorOpen    = ctx?.selectorOpen    ?? false;
  const setCurrentSession = ctx?.setCurrentSession ?? (() => {});
  const ctxCloseSelector  = ctx?.closeSelector;
  const closeSelector = useMemo(() => ctxCloseSelector ?? (() => {}), [ctxCloseSelector]);

  // Close on Escape key — hooks must be called before any conditional returns.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') closeSelector();
  }, [closeSelector]);

  useEffect(() => {
    if (!selectorOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectorOpen, handleKeyDown]);

  // Both early-exit conditions are now AFTER all hooks.
  if (!ctx || !selectorOpen) return null;

  // Show non-archived, non-completed sessions. Three groups:
  //   inSessionSessions — camp is physically happening today (in_session)
  //   openSessions      — applications accepted or recently closed; camp hasn't started yet (open | closed)
  //   upcomingSessions  — portal not yet open; camp hasn't started (upcoming)
  const nonArchived = [...sessions]
    .filter((s) => s.is_active)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const inSessionSessions = nonArchived.filter((s) => s.status === 'in_session');
  const openSessions      = nonArchived.filter((s) => s.status === 'open' || s.status === 'closed');
  const upcomingSessions  = nonArchived.filter((s) => s.status === 'upcoming');

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(8px)' }}
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) closeSelector(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') closeSelector(); }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: 'var(--card)',
          boxShadow: '0 32px 96px rgba(0,0,0,0.22)',
          border: '1px solid var(--border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Session Workspace Selector"
      >
        {/* Modal header */}
        <div
          className="flex items-start justify-between px-6 pt-6 pb-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2
              className="font-headline font-bold text-xl"
              style={{ color: 'var(--foreground)' }}
            >
              Session Workspace
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Choose a camp session to enter its workspace. All data — campers, applications, reports — will be scoped to that session.
            </p>
          </div>
          <button
            onClick={closeSelector}
            className="p-2 rounded-lg transition-colors flex-shrink-0 ml-4"
            style={{ color: 'var(--muted-foreground)' }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable session grid */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Global Overview option */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--muted-foreground)' }}>
              Overview
            </p>
            <button
              onClick={() => setCurrentSession(null)}
              className="w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200"
              style={{
                background: currentSession === null ? 'rgba(22,101,52,0.05)' : 'var(--card)',
                borderColor: currentSession === null ? 'var(--ember-orange)' : 'var(--border)',
                boxShadow: currentSession === null
                  ? '0 0 0 2px rgba(234,88,12,0.20)'
                  : 'none',
              }}
            >
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--glass-medium)', border: '1px solid var(--border)' }}
              >
                <Globe className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                    Global Overview
                  </p>
                  {currentSession === null && (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Cross-session view — analytics and reporting across all camps
                </p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>

          {/* Session cards — three groups: in-session, open for applications, upcoming */}
          <div className="space-y-6">

            {/* ── In Session — Currently Running ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ background: 'rgba(22,163,74,1)' }}
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                  In Session — Currently Running {inSessionSessions.length > 0 && `(${inSessionSessions.length})`}
                </p>
              </div>

              {sessionsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 2 }).map((_, i) => <SessionCardSkeleton key={i} />)}
                </div>
              ) : inSessionSessions.length === 0 ? (
                <div
                  className="rounded-xl border flex items-center justify-center py-8 text-center"
                  style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
                >
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    No sessions are currently running
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inSessionSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isSelected={currentSession?.id === session.id}
                      onSelect={() => setCurrentSession(session)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Open for Applications ── */}
            {(sessionsLoading || openSessions.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(22,163,74,1)' }}
                    aria-hidden
                  />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                    Open for Applications {openSessions.length > 0 && `(${openSessions.length})`}
                  </p>
                </div>

                {sessionsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 1 }).map((_, i) => <SessionCardSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {openSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        isSelected={currentSession?.id === session.id}
                        onSelect={() => setCurrentSession(session)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Upcoming — Portal Not Yet Open ── */}
            {(sessionsLoading || upcomingSessions.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(37,99,235,1)' }}
                    aria-hidden
                  />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                    Upcoming — Not Yet Open {upcomingSessions.length > 0 && `(${upcomingSessions.length})`}
                  </p>
                </div>

                {sessionsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 1 }).map((_, i) => <SessionCardSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingSessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        isSelected={currentSession?.id === session.id}
                        onSelect={() => setCurrentSession(session)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state — no sessions at all */}
            {!sessionsLoading && inSessionSessions.length === 0 && openSessions.length === 0 && upcomingSessions.length === 0 && (
              <div
                className="rounded-xl border flex flex-col items-center justify-center py-12 text-center"
                style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
              >
                <Calendar className="h-8 w-8 mb-3" style={{ color: 'var(--border)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  No active or upcoming sessions
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  Create a session to get started
                </p>
              </div>
            )}

            {/* Archived sessions — separated, accessible via link, never mixed in */}
            <div
              className="pt-4 flex items-center gap-3"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              <Archive className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Archived sessions are not shown here.
              </p>
              <Link
                to={ROUTES.ADMIN_ARCHIVED_SESSIONS}
                onClick={closeSelector}
                className="text-xs font-medium flex items-center gap-1 flex-shrink-0"
                style={{ color: 'var(--ember-orange)' }}
              >
                View Archived Sessions
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--glass-medium)' }}
        >
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {currentSession
              ? `Operating in: ${currentSession.name}`
              : 'No session selected — showing cross-session data'}
          </p>
          <button
            onClick={closeSelector}
            className="text-xs font-medium px-4 py-2 rounded-lg border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
