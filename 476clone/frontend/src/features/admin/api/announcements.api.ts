/**
 * announcements.api.ts
 * Client for GET /api/announcements (list published announcements).
 * Admin endpoints (create/update/delete/pin) also exported.
 */

import axios from '@/api/axios.config';
import type { PaginatedResponse } from '@/shared/types/api.types';

export interface Announcement {
  id: number;
  author_id: number;
  author?: { id: number; name: string };
  title: string;
  body: string;
  is_pinned: boolean;
  is_urgent: boolean;
  audience: 'all' | 'accepted' | 'staff' | 'session';
  target_session_id: number | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type CreateAnnouncementPayload = {
  title: string;
  body: string;
  is_pinned?: boolean;
  is_urgent?: boolean;
  audience: 'all' | 'accepted' | 'staff' | 'session';
  target_session_id?: number | null;
  published_at?: string | null;
};

/** Fetch published announcements (paginated). */
export async function getAnnouncements(limit = 10): Promise<PaginatedResponse<Announcement>> {
  const res = await axios.get<PaginatedResponse<Announcement>>('/announcements', {
    params: { limit },
  });
  return res.data;
}

/** Admin: create announcement. */
export async function createAnnouncement(payload: CreateAnnouncementPayload): Promise<Announcement> {
  const res = await axios.post<{ data: Announcement }>('/announcements', payload);
  return res.data.data;
}

/** Admin: update announcement. */
export async function updateAnnouncement(id: number, payload: Partial<CreateAnnouncementPayload>): Promise<Announcement> {
  const res = await axios.put<{ data: Announcement }>(`/announcements/${id}`, payload);
  return res.data.data;
}

/** Admin: delete announcement. */
export async function deleteAnnouncement(id: number): Promise<void> {
  await axios.delete(`/announcements/${id}`);
}

/** Admin: toggle pin. */
export async function toggleAnnouncementPin(id: number): Promise<{ is_pinned: boolean }> {
  const res = await axios.post<{ is_pinned: boolean }>(`/announcements/${id}/pin`);
  return res.data;
}
