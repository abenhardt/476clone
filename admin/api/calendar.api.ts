/**
 * calendar.api.ts
 * Client for GET /api/calendar (upcoming events and date-range queries).
 */

import axios from '@/api/axios.config';

export type EventType = 'deadline' | 'session' | 'orientation' | 'staff' | 'internal';

export interface CalendarEvent {
  id: number;
  created_by: number;
  creator?: { id: number; name: string };
  title: string;
  description: string | null;
  event_type: EventType;
  /** null for deadline-type events — the frontend computes urgency color from starts_at. */
  color: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  audience: 'all' | 'accepted' | 'staff' | 'session';
  target_session_id: number | null;
  /**
   * Set when this event is owned by the Deadline system.
   * Events with deadline_id cannot be edited or deleted through the calendar API.
   */
  deadline_id: number | null;
  /** Eagerly-loaded deadline metadata (present when deadline_id is set). */
  deadline?: {
    id: number;
    entity_type: string;
    entity_id: number | null;
    status: string;
    due_date: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export type CreateCalendarEventPayload = Omit<CalendarEvent, 'id' | 'created_by' | 'creator' | 'created_at' | 'updated_at' | 'deadline_id' | 'deadline'>;

/** Fetch upcoming events (next 60 days by default). */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const res = await axios.get<{ data: CalendarEvent[] }>('/calendar');
  return res.data.data;
}

/** Fetch events within a date range. */
export async function getCalendarEventRange(start: string, end: string): Promise<CalendarEvent[]> {
  const res = await axios.get<{ data: CalendarEvent[] }>('/calendar', {
    params: { start, end },
  });
  return res.data.data;
}

/** Admin: create event. */
export async function createCalendarEvent(payload: CreateCalendarEventPayload): Promise<CalendarEvent> {
  const res = await axios.post<{ data: CalendarEvent }>('/calendar', payload);
  return res.data.data;
}

/** Admin: update event. */
export async function updateCalendarEvent(id: number, payload: Partial<CreateCalendarEventPayload>): Promise<CalendarEvent> {
  const res = await axios.put<{ data: CalendarEvent }>(`/calendar/${id}`, payload);
  return res.data.data;
}

/** Admin: delete event. */
export async function deleteCalendarEvent(id: number): Promise<void> {
  await axios.delete(`/calendar/${id}`);
}
