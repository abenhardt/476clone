/**
 * AdminCalendarPage.tsx
 *
 * Purpose: Admin calendar for viewing and managing camp events across all event types.
 * Route: /admin/calendar
 *
 * Responsibilities:
 *  - Render a monthly grid calendar with navigation (prev/next/today).
 *  - Show up to 2 event chips per day cell, with a "+N more" overflow indicator.
 *  - Display an "Upcoming" sidebar listing the next 10 future events.
 *  - Allow admins to create events via a modal (clicking any day pre-fills the start date).
 *  - Allow deleting events directly from the upcoming sidebar.
 *
 * Plain-English summary:
 *  Like a wall calendar that knows about camp. Clicking a blank day opens a "New Event" form
 *  with that day pre-selected. Each event type gets its own color (deadlines = red, sessions = green,
 *  etc.). The right sidebar shows the nearest upcoming events in order, each with a delete button.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, X, Calendar, Clock, Trash2, Lock } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { ROUTES } from '@/shared/constants/routes';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
         isToday, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';

import {
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  type CalendarEvent, type CreateCalendarEventPayload, type EventType,
} from '@/features/admin/api/calendar.api';
import { SkeletonCard } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';

interface EventFormState {
  title: string;
  description: string;
  event_type: EventType;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  audience: 'all' | 'accepted' | 'staff' | 'session';
}

const DEFAULT_FORM: EventFormState = {
  title: '',
  description: '',
  event_type: 'session', // 'deadline' is managed by the deadline system — not manually creatable
  starts_at: '',
  ends_at: '',
  all_day: false,
  audience: 'all',
};

// Returns consistent input styling; red border when hasErr is true (required field is empty).
function inputStyle(hasErr = false) {
  return {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    border: `1px solid ${hasErr ? 'var(--destructive)' : 'rgba(0,0,0,0.12)'}`,
    fontSize: '0.9375rem',
    background: '#f9fafb',
    color: 'var(--foreground)',
    outline: 'none',
  } as CSSProperties;
}

export function AdminCalendarPage() {
  const { t } = useTranslation();

  // Maps each event type to colors + translated labels — inside component so t() is in scope.
  const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string; label: string }> = {
    deadline:    { bg: 'rgba(220,38,38,0.10)',   text: 'var(--destructive)',  dot: 'var(--destructive)',  label: 'Deadline'    },
    session:     { bg: 'rgba(22,163,74,0.10)',    text: '#16a34a',  dot: '#16a34a',  label: 'Session'     },
    orientation: { bg: 'rgba(37,99,235,0.10)',    text: '#2563eb',  dot: '#2563eb',  label: 'Orientation' },
    staff:       { bg: 'rgba(124,58,237,0.10)',   text: '#7c3aed',  dot: '#7c3aed',  label: 'Staff'       },
    internal:    { bg: 'rgba(107,114,128,0.10)',  text: '#6b7280',  dot: '#6b7280',  label: 'Internal'    },
  };

  // Derives a flat array of {value, label} pairs from EVENT_COLORS for the legend and dropdown.
  // 'deadline' is excluded from the create dropdown — managed exclusively by the deadline system.
  const EVENT_TYPES = Object.entries(EVENT_COLORS)
    .filter(([v]) => v !== 'deadline')
    .map(([value, meta]) => ({ value: value as EventType, label: meta.label }));

  const navigate = useNavigate();
  const location = useLocation();
  const isSuper = location.pathname.startsWith('/super-admin');

  /**
   * Returns the urgency-based color for a deadline calendar event.
   * Color is computed dynamically from starts_at vs now, not stored in the DB.
   *   > 7 days  → green  (safe)
   *   ≤ 7 days  → yellow (approaching)
   *   past      → red    (overdue)
   *   completed → gray
   */
  function deadlineEventColor(event: CalendarEvent): { bg: string; text: string; dot: string } {
    if (event.deadline?.status === 'completed') {
      return { bg: 'rgba(107,114,128,0.10)', text: '#6b7280', dot: '#6b7280' };
    }
    const days = differenceInDays(parseISO(event.starts_at), new Date());
    if (days < 0)  return { bg: 'rgba(220,38,38,0.10)',  text: '#dc2626', dot: '#dc2626' };
    if (days <= 7) return { bg: 'rgba(217,119,6,0.10)',  text: '#d97706', dot: '#d97706' };
    return           { bg: 'rgba(22,163,74,0.10)',   text: '#16a34a', dot: '#16a34a' };
  }

  /** Returns the correct color style for any event, with deadline urgency computed dynamically. */
  function eventColor(ev: CalendarEvent) {
    return ev.deadline_id ? deadlineEventColor(ev) : (EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.internal);
  }

  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [loading, setLoading]         = useState(true);
  // Which month's grid to display.
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showModal, setShowModal]     = useState(false);
  // The day the user clicked — used to pre-fill the event start date in the form.
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm]               = useState<EventFormState>(DEFAULT_FORM);
  const [saving, setSaving]           = useState(false);
  // Tracks which event is being deleted so we can show a spinner on its button.
  const [deletingId, setDeletingId]   = useState<number | null>(null);

  // ── Fetch all events on mount ──────────────────────────────────────────────
  useEffect(() => {
    getCalendarEvents()
      .then(setEvents)
      .catch(() => toast.error('Failed to load events.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Calendar grid calculations ─────────────────────────────────────────────

  // Generate an array of Date objects for every day in the current month.
  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });
  // How many empty cells to show before the 1st (0=Sunday, 1=Monday, etc.).
  const startWeekday = startOfMonth(currentMonth).getDay();

  // Return events that fall on a given day.
  function eventsForDay(day: Date) {
    return events.filter((e) => isSameDay(new Date(e.starts_at), day));
  }

  // Next 10 future events, sorted by start date ascending.
  const upcoming = events
    .filter((e) => new Date(e.starts_at) >= new Date())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 10);

  // ── Event actions ──────────────────────────────────────────────────────────

  // Opens the create-event modal, optionally pre-filling the clicked day's date.
  function openNewEvent(day?: Date) {
    setForm({
      ...DEFAULT_FORM,
      starts_at: day ? format(day, "yyyy-MM-dd'T'HH:mm") : '',
    });
    setSelectedDay(day ?? null);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim() || !form.starts_at) {
      toast.error('Title and start date are required.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateCalendarEventPayload = {
        title:       form.title.trim(),
        description: form.description || null,
        event_type:  form.event_type,
        // Use the dot color for the event_type as the stored color.
        color:       EVENT_COLORS[form.event_type].dot,
        starts_at:   form.starts_at,
        ends_at:     form.ends_at || null,
        all_day:     form.all_day,
        audience:    form.audience,
        target_session_id: null,
      };
      const created = await createCalendarEvent(payload);
      // Append new event to local state without re-fetching the whole list.
      setEvents((prev) => [...prev, created]);
      toast.success('Event created.');
      setShowModal(false);
    } catch {
      toast.error('Failed to create event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteCalendarEvent(id);
      // Remove the deleted event from local state instantly.
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Event deleted.');
    } catch {
      toast.error('Failed to delete event.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      {/* Page header with "Add Event" button */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: 'var(--ember-orange)' }}>
              Admin
            </p>
            <h2 className="text-2xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              Calendar
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Manage camp events, deadlines, staff schedules, and orientation dates.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => openNewEvent()}>
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Calendar grid (takes 2 of 3 columns) */}
        <div className="lg:col-span-2">
          <div className="glass-panel rounded-2xl overflow-hidden">
            {/* Month navigation bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Jump to current month instantly. */}
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--dash-nav-active-bg)', color: 'var(--ember-orange)' }}
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--muted-foreground)' }}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Day-of-week header row */}
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
                {/* Leading empty cells to align day 1 with the correct weekday column. */}
                {Array.from({ length: startWeekday }).map((_, i) => (
                  <div key={`e-${i}`} className="h-20 border-b border-r" style={{ borderColor: 'var(--border)', background: 'rgba(0,0,0,0.01)' }} />
                ))}
                {days.map((day) => {
                  const dayEvents = eventsForDay(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      role="button"
                      tabIndex={0}
                      className="h-20 border-b border-r p-1.5 flex flex-col gap-0.5 overflow-hidden cursor-pointer transition-colors"
                      style={{
                        borderColor: 'var(--border)',
                        // Today's cell gets a subtle green wash.
                        background: today ? 'rgba(22,163,74,0.04)' : 'transparent',
                      }}
                      // Clicking a day opens the create modal with that day pre-filled.
                      onClick={() => openNewEvent(day)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNewEvent(day); } }}
                      onMouseEnter={(e) => { if (!today) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!today) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Date number — green circle for today. */}
                      <span
                        className="text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          background: today ? '#16a34a' : 'transparent',
                          color: today ? '#ffffff' : 'var(--foreground)',
                        }}
                      >
                        {format(day, 'd')}
                      </span>
                      {/* Show at most 2 event chips; events are small pills with type-based color. */}
                      {dayEvents.slice(0, 2).map((ev) => {
                        const s = eventColor(ev);
                        return (
                          <div
                            key={ev.id}
                            role="button"
                            tabIndex={0}
                            className="rounded px-1 text-[10px] font-medium truncate leading-4"
                            style={{ background: s.bg, color: s.text }}
                            title={ev.title}
                            // Stop propagation so clicking a chip doesn't also open "new event".
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {/* If more than 2 events, show "+N" overflow indicator. */}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Color legend below the calendar grid */}
          <div className="flex flex-wrap gap-4 mt-3 px-1">
            {EVENT_TYPES.map(({ value, label }) => (
              <div key={value} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: EVENT_COLORS[value].dot }} />
                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Upcoming events sidebar */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
              <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                Upcoming
              </h3>
            </div>
          </div>

          {loading ? (
            <SkeletonCard lines={4} />
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)' }}>
              <Calendar className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.cal_no_events')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((ev) => {
                const s = eventColor(ev);
                const isDeadlineLocked = ev.deadline_id !== null;
                return (
                  <li
                    key={ev.id}
                    className="glass-panel rounded-xl p-3"
                  >
                    <div className="flex items-start gap-2">
                      {/* Colored dot — dynamic urgency color for deadline events */}
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{ev.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(ev.starts_at), 'MMM d, yyyy')}
                          {isDeadlineLocked && ' · Managed by Deadlines'}
                        </p>
                      </div>
                      {isDeadlineLocked ? (
                        // Deadline-owned events navigate to the Deadlines page instead of deleting
                        <button
                          onClick={() => navigate(isSuper ? '/super-admin/deadlines' : ROUTES.ADMIN_DEADLINES)}
                          className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
                          style={{ color: 'var(--muted-foreground)' }}
                          title="Edit via Deadline Management"
                          aria-label="Go to deadline management"
                        >
                          <Lock className="h-3 w-3" />
                        </button>
                      ) : (
                        // Non-deadline events can be deleted directly
                        <button
                          onClick={() => handleDelete(ev.id)}
                          disabled={deletingId === ev.id}
                          className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
                          style={{ color: 'var(--muted-foreground)' }}
                          aria-label="Delete event"
                        >
                          {deletingId === ev.id ? (
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Create event modal */}
      {showModal && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowModal(false); }}
        >
          <div
            role="presentation"
            className="glass-panel w-full max-w-md rounded-2xl p-6"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              {/* Show the selected day in the modal title if the user clicked a specific day. */}
              <h3 className="font-headline font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                New Event{selectedDay && ` — ${format(selectedDay, 'MMM d')}`}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="cal-title" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_title_label')} *</label>
                <input
                  id="cal-title"
                  // Red border if title is empty (required field).
                  style={inputStyle(!form.title)}
                  placeholder={t('admin_extra.cal_title_label')}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="cal-description" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_desc_label')}</label>
                <textarea
                  id="cal-description"
                  style={{ ...inputStyle(), height: 72, resize: 'none' }}
                  placeholder={t('admin_extra.cal_desc_label')}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cal-type" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_type_label')}</label>
                  <select
                    id="cal-type"
                    style={inputStyle()}
                    value={form.event_type}
                    onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value as EventType }))}
                  >
                    {EVENT_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cal-audience" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_audience_label')}</label>
                  <select
                    id="cal-audience"
                    style={inputStyle()}
                    value={form.audience}
                    onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as EventFormState['audience'] }))}
                  >
                    <option value="all">All</option>
                    <option value="accepted">{t('admin_extra.cal_audience_accepted')}</option>
                    <option value="staff">{t('admin_extra.cal_audience_staff')}</option>
                    <option value="session">{t('admin_extra.cal_audience_session')}</option>
                  </select>
                </div>
              </div>

              {/* Start and end date-time pickers side by side. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cal-starts-at" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_start_label')} *</label>
                  <input
                    id="cal-starts-at"
                    type="datetime-local"
                    style={inputStyle(!form.starts_at)}
                    value={form.starts_at}
                    onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="cal-ends-at" className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>End</label>
                  <input
                    id="cal-ends-at"
                    type="datetime-local"
                    style={inputStyle()}
                    value={form.ends_at}
                    onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={form.all_day}
                  onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))}
                />
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('admin_extra.cal_all_day')}</span>
              </label>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Create Event'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
