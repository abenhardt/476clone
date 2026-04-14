/**
 * SessionHeroBanner.tsx
 *
 * The workspace identity banner. Renders as a full-width hero between the sticky
 * header and the scrollable page content in every admin/super-admin portal.
 *
 * This is NOT a filter or a label. It communicates environment — the admin is
 * either inside a specific session workspace or viewing across all sessions.
 *
 * Two modes:
 *  - SESSION mode  (currentSession != null): photo background, session name, date range, enrollment.
 *  - GLOBAL mode   (currentSession == null): dark-green gradient, "All Sessions Overview" title,
 *                  aggregate session + enrollment counts derived from the loaded sessions list.
 *
 * The banner is ALWAYS rendered on session-aware pages. It never disappears.
 * Hiding it on global mode would silently remove context, which is a UX regression.
 *
 * Visual language:
 *  - SESSION: real landscape photography + dark/green overlay, white typography
 *  - GLOBAL:  deep forest-green gradient, globe icon, aggregate stats
 *  - Both use identical layout, height (160px), and the same "Switch Session" CTA
 *  - key prop drives a CSS fade-in on every context switch
 */

import { Calendar, Users, Globe, LayoutGrid, ChevronDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSessionWorkspace } from '../context/SessionWorkspaceContext';

// ─── Session photo system ─────────────────────────────────────────────────────
import { SESSION_IMAGES, getSessionImage } from '../utils/sessionImages';

// ─── Component ───────────────────────────────────────────────────────────────

export function SessionHeroBanner() {
  const ctx = useSessionWorkspace();

  // Only hide outside admin portals (ctx is null for applicant/medical layouts).
  if (!ctx) return null;

  const { currentSession, isGlobalMode, sessions, openSelector } = ctx;

  // ── GLOBAL MODE ────────────────────────────────────────────────────────────
  if (isGlobalMode) {
    // Compute aggregate stats from the already-loaded sessions list.
    const totalSessions = sessions.length;
    const totalEnrolled = sessions.reduce((sum, s) => sum + (s.enrolled_count ?? 0), 0);
    const totalCapacity = sessions.reduce((sum, s) => sum + (s.capacity ?? 0), 0);

    return (
      <div
        key="global"
        className="relative flex-shrink-0"
        style={{
          height: '160px',
          animation: 'sessionBannerIn 280ms ease-out both',
        }}
      >
        {/* ── Background photograph — same image set as session mode ── */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${SESSION_IMAGES.summer})` }}
          aria-hidden
        />

        {/* ── Gradient overlay — deeper green tint to distinguish from session mode ── */}
        <div
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(to right,',
              '  rgba(5,46,22,0.82) 0%,',
              '  rgba(20,83,45,0.72) 42%,',
              '  rgba(5,46,22,0.55) 100%)',
            ].join(' '),
          }}
          aria-hidden
        />

        {/* ── Content row ── */}
        <div className="relative h-full flex items-center justify-between px-8 gap-6">

          {/* LEFT: workspace identity */}
          <div className="min-w-0 flex items-center gap-5">

            {/* Globe icon badge */}
            <div
              className="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            >
              <Globe className="h-6 w-6" style={{ color: 'rgba(255,255,255,0.90)' }} />
            </div>

            <div className="min-w-0">
              {/* Context label */}
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-1"
                style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em' }}
              >
                Cross-Session View
              </p>

              {/* Title */}
              <h2
                className="font-headline font-bold leading-tight"
                style={{
                  fontSize: '1.875rem',
                  color: '#fff',
                  letterSpacing: '-0.025em',
                  textShadow: '0 1px 12px rgba(0,0,0,0.30)',
                }}
              >
                All Sessions Overview
              </h2>

              {/* Aggregate stats line */}
              <div className="flex items-center gap-4 mt-1.5 flex-wrap">

                {totalSessions > 0 && (
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid
                      className="h-3.5 w-3.5 flex-shrink-0"
                      style={{ color: 'rgba(255,255,255,0.65)' }}
                    />
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 400 }}>
                      {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                )}

                {totalEnrolled > 0 && (
                  <>
                    <span
                      className="hidden sm:block"
                      aria-hidden
                      style={{ color: 'rgba(255,255,255,0.30)', fontWeight: 700 }}
                    >
                      ·
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Users
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.65)' }}
                      />
                      <span className="text-sm" style={{ color: 'rgba(255,255,255,0.88)', fontWeight: 400 }}>
                        {totalEnrolled}
                        {totalCapacity > 0 ? ` / ${totalCapacity}` : ''} enrolled
                      </span>
                    </div>
                  </>
                )}

                {totalSessions === 0 && (
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Viewing all sessions combined
                  </span>
                )}

              </div>
            </div>
          </div>

          {/* RIGHT: Select Session CTA */}
          <button
            onClick={openSelector}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
            style={{
              background: 'rgba(255,255,255,0.14)',
              color: '#fff',
              boxShadow: '0 2px 12px rgba(0,0,0,0.20)',
              border: '1px solid rgba(255,255,255,0.22)',
              letterSpacing: '-0.01em',
            }}
            aria-label="Select a session workspace"
          >
            Select Session
            <ChevronDown className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.72)' }} />
          </button>
        </div>

        {/* ── Inline keyframe ── */}
        <style>{`
          @keyframes sessionBannerIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
        `}</style>
      </div>
    );
  }

  // ── SESSION MODE ───────────────────────────────────────────────────────────

  const photoUrl = getSessionImage(currentSession!.id);

  const dateRange = (() => {
    try {
      const start = format(parseISO(currentSession!.start_date), 'MMM d');
      const end   = format(parseISO(currentSession!.end_date),   'MMM d, yyyy');
      return `${start} – ${end}`;
    } catch {
      return `${currentSession!.start_date} – ${currentSession!.end_date}`;
    }
  })();

  const enrolled = currentSession!.enrolled_count ?? 0;
  const capacity = currentSession!.capacity        ?? 0;

  return (
    /*
     * key={currentSession.id} means React unmounts + remounts this element
     * on every session switch, triggering the CSS animation below for a
     * smooth cross-fade when the workspace changes.
     */
    <div
      key={currentSession!.id}
      className="relative flex-shrink-0"
      style={{
        height: '160px',
        animation: 'sessionBannerIn 280ms ease-out both',
      }}
    >
      {/* ── Background photograph ── */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${photoUrl})` }}
        aria-hidden
      />

      {/* ── Gradient overlay ──
          Left anchor: deep dark so white text pops cleanly.
          Mid: dark green — ties the image to the brand.
          Right: lighter so the photo breathes toward the edge.
      ── */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'linear-gradient(to right,',
            '  rgba(0,0,0,0.68) 0%,',
            '  rgba(15,83,41,0.58) 42%,',
            '  rgba(0,0,0,0.22) 100%)',
          ].join(' '),
        }}
        aria-hidden
      />

      {/* ── Content row ── */}
      <div className="relative h-full flex items-center justify-between px-8 gap-6">

        {/* LEFT: workspace identity */}
        <div className="min-w-0">

          {/* Session name — the dominant element */}
          <h2
            className="font-headline font-bold leading-tight truncate"
            style={{
              fontSize: '1.875rem',   /* 30px */
              color: '#fff',
              letterSpacing: '-0.025em',
              textShadow: '0 1px 12px rgba(0,0,0,0.40)',
            }}
          >
            {currentSession!.name}
          </h2>

          {/* Secondary line: date range + enrollment */}
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">

            <div className="flex items-center gap-1.5">
              <Calendar
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: 'rgba(255,255,255,0.72)' }}
              />
              <span
                className="text-sm"
                style={{ color: 'rgba(255,255,255,0.90)', fontWeight: 400 }}
              >
                {dateRange}
              </span>
            </div>

            {capacity > 0 && (
              <>
                {/* Mid-dot separator */}
                <span
                  className="hidden sm:block"
                  aria-hidden
                  style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}
                >
                  ·
                </span>

                <div className="flex items-center gap-1.5">
                  <Users
                    className="h-3.5 w-3.5 flex-shrink-0"
                    style={{ color: 'rgba(255,255,255,0.72)' }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'rgba(255,255,255,0.90)', fontWeight: 400 }}
                  >
                    {enrolled} / {capacity} enrolled
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Switch Session CTA */}
        <button
          onClick={openSelector}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150 flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
          style={{
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            color: '#fff',
            boxShadow: '0 2px 20px rgba(22,163,74,0.50), 0 1px 4px rgba(0,0,0,0.20)',
            border: '1px solid rgba(255,255,255,0.18)',
            letterSpacing: '-0.01em',
          }}
          aria-label="Switch session workspace"
        >
          Switch Session
          <ChevronDown className="h-4 w-4" style={{ color: 'rgba(255,255,255,0.80)' }} />
        </button>
      </div>

      {/* ── Inline keyframe for session-change fade ── */}
      <style>{`
        @keyframes sessionBannerIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}
