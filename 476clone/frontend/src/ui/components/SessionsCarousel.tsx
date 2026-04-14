/**
 * SessionsCarousel.tsx
 *
 * Smart sessions display for dashboards:
 *  - 1 active session  → full-width banner (static)
 *  - 2+ active sessions → horizontal carousel with scroll snapping,
 *                          nav arrows, trackpad/touch/mouse support
 *
 * Only renders sessions passed in — callers are responsible for
 * filtering to is_active === true before passing.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionCardData {
  id: number;
  campName: string;
  sessionName: string;
  enrolled: number;
  capacity: number;
}

interface SessionsCarouselProps {
  sessions: SessionCardData[];
  /** Route builder — called with session id, must return the detail URL */
  sessionDetailRoute: (id: number | string) => string;
  /** Show a "Manage →" link in the section header */
  manageRoute: string;
  loading?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(enrolled: number, capacity: number): number {
  return capacity > 0 ? Math.min((enrolled / capacity) * 100, 100) : 0;
}

function barColor(p: number): string {
  if (p >= 80) return 'var(--destructive)';
  if (p >= 40) return '#d97706';
  return 'var(--forest-green)';
}

function pillColor(p: number): { color: string; bg: string } {
  if (p >= 80) return { color: 'var(--destructive)',  bg: 'rgba(220,38,38,0.09)' };
  if (p >= 40) return { color: '#b45309',             bg: 'rgba(245,158,11,0.09)' };
  return         { color: 'var(--forest-green)',       bg: 'rgba(22,163,74,0.09)'  };
}

// ─── Single-session banner ────────────────────────────────────────────────────

function SessionBanner({
  session,
  route,
}: {
  session: SessionCardData;
  route: string;
}) {
  const p      = pct(session.enrolled, session.capacity);
  const color  = barColor(p);
  const pill   = pillColor(p);

  return (
    <Link
      to={route}
      className="glass-panel rounded-2xl block hover:bg-[var(--dash-nav-hover-bg)] transition-colors group"
    >
      <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {session.campName}
          </p>
          <p className="text-base font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
            {session.sessionName}
          </p>
        </div>

        {/* Capacity pill */}
        <div
          className="text-sm font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 tabular-nums"
          style={{ color: pill.color, background: pill.bg }}
        >
          {session.enrolled} / {session.capacity} enrolled
        </div>

        <ArrowRight
          className="h-4 w-4 flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity hidden sm:block"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-5">
        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${p}%`, background: color }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {p >= 100 ? 'Session full' : p >= 80 ? 'Almost full' : 'Enrollment open'}
          </span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
            {Math.round(p)}%
          </span>
        </div>
      </div>
    </Link>
  );
}

// ─── Carousel card ────────────────────────────────────────────────────────────

function SessionCard({
  session,
  route,
  width,
}: {
  session: SessionCardData;
  route: string;
  width: string;
}) {
  const p     = pct(session.enrolled, session.capacity);
  const color = barColor(p);
  const pill  = pillColor(p);

  return (
    <Link
      to={route}
      data-carousel-card
      className="glass-card rounded-2xl flex-shrink-0 block hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
      style={{ width, scrollSnapAlign: 'start' }}
    >
      <div className="p-5 flex flex-col h-full">
        {/* Camp name */}
        <p
          className="text-xs font-medium uppercase tracking-wide truncate mb-0.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {session.campName}
        </p>

        {/* Session name */}
        <p
          className="text-sm font-semibold leading-snug mb-4 flex-1"
          style={{ color: 'var(--foreground)' }}
        >
          {session.sessionName}
        </p>

        {/* Progress bar */}
        <div>
          <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${p}%`, background: color }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded tabular-nums"
              style={{ color: pill.color, background: pill.bg }}
            >
              {session.enrolled} / {session.capacity}
            </span>
            <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>
              {Math.round(p)}%
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Nav arrow button ─────────────────────────────────────────────────────────

function NavArrow({
  direction,
  visible,
  enabled,
  onClick,
}: {
  direction: 'left' | 'right';
  visible: boolean;
  enabled: boolean;
  onClick: () => void;
}) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
      className="absolute top-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all duration-200"
      style={{
        transform: `translateY(-50%) ${direction === 'left' ? 'translateX(-50%)' : 'translateX(50%)'}`,
        [direction]: 0,
        background:    'var(--card)',
        border:        '1px solid var(--border)',
        color:         'var(--foreground)',
        opacity:       visible && enabled ? 1 : 0,
        pointerEvents: visible && enabled ? 'auto' : 'none',
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SessionsCarousel({
  sessions,
  sessionDetailRoute,
  manageRoute,
  loading = false,
}: SessionsCarouselProps) {
  const scrollRef        = useRef<HTMLDivElement>(null);
  const [hovering,       setHovering]       = useState(false);
  const [canLeft,        setCanLeft]        = useState(false);
  const [canRight,       setCanRight]       = useState(false);
  const isSingle = sessions.length === 1;

  // ── Edge detection ──────────────────────────────────────────────────────────
  const checkEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 6;
    setCanLeft(el.scrollLeft > threshold);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - threshold);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isSingle) return;

    checkEdges();
    el.addEventListener('scroll', checkEdges, { passive: true });
    const ro = new ResizeObserver(checkEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkEdges);
      ro.disconnect();
    };
  }, [sessions, isSingle, checkEdges]);

  // ── Arrow scroll ────────────────────────────────────────────────────────────
  const scrollBy = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector('[data-carousel-card]') as HTMLElement | null;
    const cardW = card ? card.offsetWidth : 280;
    const gap   = 16;
    el.scrollBy({ left: dir === 'left' ? -(cardW + gap) : cardW + gap, behavior: 'smooth' });
  }, []);

  // ── Section header ──────────────────────────────────────────────────────────
  const header = (
    <div className="flex items-center justify-between mb-4">
      <h2
        className="text-sm font-semibold uppercase tracking-wide"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Session Enrollment
      </h2>
      <Link
        to={manageRoute}
        className="text-xs font-medium flex items-center gap-1 hover:underline"
        style={{ color: 'var(--ember-orange)' }}
      >
        Manage <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <section>
        {header}
        <div className="glass-panel rounded-2xl p-6 animate-pulse" style={{ height: '88px' }} />
      </section>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────────────────
  if (sessions.length === 0) {
    return (
      <section>
        {header}
        <div className="glass-panel rounded-2xl flex items-center justify-center py-10">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            No active sessions
          </p>
        </div>
      </section>
    );
  }

  // ── Single session — full-width banner ──────────────────────────────────────
  if (isSingle) {
    return (
      <section>
        {header}
        <SessionBanner
          session={sessions[0]}
          route={sessionDetailRoute(sessions[0].id)}
        />
      </section>
    );
  }

  // ── Multiple sessions — carousel ────────────────────────────────────────────
  //
  // Card width: fills container showing ~2.3 cards so the third peeks in.
  // Uses max() so cards never shrink below 220px on very small screens.
  const cardWidth = 'max(220px, calc((100% - 48px) / 2.3))';

  return (
    <section>
      {header}

      {/* Outer wrapper: clips cards + anchors nav arrows */}
      <div
        className="relative"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Left arrow */}
        <NavArrow
          direction="left"
          visible={hovering}
          enabled={canLeft}
          onClick={() => scrollBy('left')}
        />

        {/* Scroll track */}
        <div
          ref={scrollRef}
          className="flex gap-4 pb-1"
          style={{
            overflowX:                 'auto',
            scrollSnapType:            'x mandatory',
            scrollbarWidth:            'none',        // Firefox
            WebkitOverflowScrolling:   'touch',
            // hide webkit scrollbar
            msOverflowStyle:           'none',
          } as React.CSSProperties}
        >
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              route={sessionDetailRoute(s.id)}
              width={cardWidth}
            />
          ))}

          {/* Trailing spacer so last card can snap to start and still show the "peek" gap */}
          <div className="flex-shrink-0" style={{ width: '1px' }} aria-hidden="true" />
        </div>

        {/* Right arrow */}
        <NavArrow
          direction="right"
          visible={hovering}
          enabled={canRight}
          onClick={() => scrollBy('right')}
        />
      </div>
    </section>
  );
}
