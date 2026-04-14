/**
 * ParentCalendarPage.tsx
 *
 * Purpose: Read-only calendar view for parents showing camp deadlines, session
 *          dates, and orientation events.
 * Responsibilities:
 *   - Fetch all calendar events once on mount (no admin-level edit capabilities)
 *   - Render a monthly grid with month navigation (previous / Today / next)
 *   - Highlight today's date in green; show up to 2 event chips per cell
 *   - Display an "overdue deadlines" alert strip when past-due deadline events exist
 *   - Show an upcoming-events sidebar listing the next 8 events within 30 days
 *
 * Plain-English: This is the parent's view of the camp's schedule — like
 * looking at a wall calendar where important dates are already marked for them.
 * They can't add events, but they can see exactly when to act.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
         isSameDay, isToday, isPast, addMonths, subMonths, differenceInDays, parseISO } from 'date-fns';

import { getCalendarEvents, type CalendarEvent } from '@/features/admin/api/calendar.api';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { ROUTES } from '@/shared/constants/routes';

// Color palette for each event type — same mapping as the admin calendar
const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  deadline:    { bg: 'rgba(220,38,38,0.10)',   text: 'var(--destructive)',  dot: 'var(--destructive)'  },
  session:     { bg: 'rgba(22,163,74,0.10)',    text: '#16a34a',  dot: '#16a34a'  },
  orientation: { bg: 'rgba(37,99,235,0.10)',    text: '#2563eb',  dot: '#2563eb'  },
  staff:       { bg: 'rgba(124,58,237,0.10)',   text: '#7c3aed',  dot: '#7c3aed'  },
  internal:    { bg: 'rgba(107,114,128,0.10)',  text: '#6b7280',  dot: '#6b7280'  },
};

// Falls back to 'internal' (grey) when an event_type string isn't in the map
function getEventStyle(type: string) {
  return EVENT_COLORS[type] ?? EVENT_COLORS.internal;
}

/**
 * For deadline-type events, compute urgency color dynamically from starts_at vs now.
 * This ensures the color is always current without a DB sync job.
 *   > 7 days → green  (safe)
 *   ≤ 7 days → yellow (approaching)
 *   past     → red    (overdue)
 *   completed → gray
 */
function getDeadlineEventStyle(event: CalendarEvent): { bg: string; text: string; dot: string } {
  if (event.deadline?.status === 'completed') {
    return { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', dot: '#6b7280' };
  }
  const days = differenceInDays(parseISO(event.starts_at), new Date());
  if (days < 0)  return { bg: 'rgba(220,38,38,0.10)',  text: '#dc2626', dot: '#dc2626' };
  if (days <= 7) return { bg: 'rgba(217,119,6,0.10)',  text: '#d97706', dot: '#d97706' };
  return           { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a', dot: '#16a34a' };
}

/** Returns the correct style for any calendar event. */
function resolveEventStyle(ev: CalendarEvent) {
  return ev.deadline_id ? getDeadlineEventStyle(ev) : getEventStyle(ev.event_type);
}

export function ParentCalendarPage() {
  const navigate = useNavigate();
  const [events, setEvents]     = useState<CalendarEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  // The month currently shown in the grid — starts as the current calendar month
  const [currentMonth, setCurrentMonth] = useState(new Date());

  /**
   * Navigate to the relevant page when a deadline calendar event is clicked.
   * Routing logic by entity_type:
   *   document_request → /applicant/documents (upload page)
   *   application      → /applicant/applications
   *   default          → /applicant/documents
   */
  function handleDeadlineClick(ev: CalendarEvent) {
    if (!ev.deadline_id) return;
    const entityType = ev.deadline?.entity_type;
    if (entityType === 'document_request') {
      navigate(ROUTES.PARENT_DOCUMENTS);
    } else if (entityType === 'application') {
      navigate(ROUTES.PARENT_APPLICATIONS);
    } else {
      navigate(ROUTES.PARENT_DOCUMENTS);
    }
  }

  // Fetch all events once; errors are silently swallowed so the empty calendar still renders
  useEffect(() => {
    getCalendarEvents()
      .then(setEvents)
      .catch(() => {/* silently show empty */})
      .finally(() => setLoading(false));
  }, []);

  // Build an array of every date in the current month for the grid
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });

  // Number of empty cells to insert before day 1 (0=Sun, 1=Mon, …, 6=Sat)
  const startWeekday = startOfMonth(currentMonth).getDay();

  // Filter all events to those whose start date matches a specific grid cell
  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
  }

  // Upcoming: events in the next 30 days, sorted ascending, capped at 8 for the sidebar
  const upcoming = events
    .filter((e) => {
      const d = new Date(e.starts_at);
      const now = new Date();
      return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 8);

  // Past deadline events — these need the parent's attention
  const overdue = events.filter((e) =>
    e.event_type === 'deadline' && isPast(new Date(e.starts_at))
  );

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Page header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
          My Schedule
        </p>
        <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
          Calendar
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Application deadlines, session dates, and orientation events.
        </p>
      </div>

      {/* Overdue deadlines alert — only shown when past-due deadline events exist */}
      {!loading && overdue.length > 0 && (
        <div
          className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.20)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--destructive)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
              {overdue.length} overdue deadline{overdue.length !== 1 ? 's' : ''}
            </p>
            {/* List the overdue deadline titles inline */}
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {overdue.map((e) => e.title).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout: calendar grid (2/3) + upcoming sidebar (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          <div
            className="glass-panel rounded-2xl overflow-hidden"
          >
            {/* Month navigation header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                {/* Previous month button */}
                <button
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dash-nav-hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* "Today" resets the view to the current calendar month */}
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--dash-nav-active-bg)', color: 'var(--ember-orange)' }}
                >
                  Today
                </button>
                {/* Next month button */}
                <button
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--dash-nav-hover-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekday column headers */}
            <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            {loading ? (
              <div className="p-6"><SkeletonCard lines={4} /></div>
            ) : (
              <div className="grid grid-cols-7">
                {/* Leading empty cells align day 1 with the correct weekday column */}
                {Array.from({ length: startWeekday }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 border-b border-r" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.01)' }} />
                ))}
                {days.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const today    = isToday(day);
                  const inMonth  = isSameMonth(day, currentMonth);
                  return (
                    <div
                      key={day.toISOString()}
                      className="h-20 border-b border-r p-1.5 flex flex-col gap-0.5 overflow-hidden"
                      style={{
                        borderColor: 'var(--border)',
                        // Today gets a subtle green tint; other-month days get a dimmer grey
                        background: today ? 'rgba(22,163,74,0.04)' : inMonth ? 'transparent' : 'rgba(0,0,0,0.01)',
                      }}
                    >
                      {/* Day number — circled in green for today */}
                      <span
                        className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          background: today ? '#16a34a' : 'transparent',
                          color: today ? '#ffffff' : inMonth ? 'var(--foreground)' : 'var(--muted-foreground)',
                        }}
                      >
                        {format(day, 'd')}
                      </span>
                      {/* Show up to 2 event chips per cell to avoid overflow */}
                      {dayEvents.slice(0, 2).map((ev) => {
                        const style = resolveEventStyle(ev);
                        return (
                          <div
                            key={ev.id}
                            className="rounded px-1 text-[10px] font-medium truncate leading-4"
                            style={{ background: style.bg, color: style.text }}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {/* "+N more" indicator when a day has more than 2 events */}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Color legend below the grid */}
          <div className="flex flex-wrap gap-4 mt-3 px-1">
            {Object.entries(EVENT_COLORS).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: style.dot }} />
                <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming events sidebar — next 30 days, max 8 entries */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Upcoming (30 days)
            </h3>
          </div>

          {loading ? (
            <SkeletonCard lines={4} />
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)' }}>
              <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No upcoming events.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((ev) => {
                const style = resolveEventStyle(ev);
                const isClickableDeadline = ev.deadline_id !== null;
                return (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                  <li
                    key={ev.id}
                    className="glass-card rounded-xl p-3"
                    onClick={isClickableDeadline ? () => handleDeadlineClick(ev) : undefined}
                    onKeyDown={isClickableDeadline ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleDeadlineClick(ev); } : undefined}
                    role={isClickableDeadline ? 'button' : undefined}
                    tabIndex={isClickableDeadline ? 0 : undefined}
                    style={{ cursor: isClickableDeadline ? 'pointer' : 'default' }}
                    title={isClickableDeadline ? 'Click to go to the upload page' : undefined}
                  >
                    <div className="flex items-start gap-2">
                      {/* Colored dot — urgency-based for deadline events */}
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: style.dot }} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                          {ev.title}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(ev.starts_at), 'MMM d, yyyy')}
                          {isClickableDeadline && ' · Tap to act'}
                          {/* Only show time for non-all-day events */}
                          {!ev.all_day && ` · ${format(new Date(ev.starts_at), 'h:mm a')}`}
                        </p>
                        {/* Event type pill */}
                        <span
                          className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 capitalize"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {ev.event_type}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
