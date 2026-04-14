/**
 * deadlines.api.ts
 *
 * API client for the Deadline Management System.
 * Admins and super_admins have full write access.
 * Applicants use getMyDeadlines() only.
 */

import axios from '@/api/axios.config';

export type EntityType = 'document_request' | 'application' | 'medical_requirement' | 'session';
export type EnforcementMode = 'hard' | 'soft';
export type DeadlineStatus = 'pending' | 'completed' | 'overdue' | 'extended';
export type UrgencyLevel = 'safe' | 'approaching' | 'overdue' | 'completed';

export interface Deadline {
  id: number;
  camp_session_id: number;
  entity_type: EntityType;
  entity_id: number | null;
  title: string;
  description: string | null;
  due_date: string;
  effective_due_date: string;
  grace_period_days: number;
  days_until_due: number;
  urgency_level: UrgencyLevel;
  status: DeadlineStatus;
  is_enforced: boolean;
  enforcement_mode: EnforcementMode;
  is_visible_to_applicants: boolean;
  override_note: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface CreateDeadlinePayload {
  camp_session_id: number;
  entity_type: EntityType;
  entity_id?: number | null;
  title: string;
  description?: string;
  due_date: string;
  grace_period_days?: number;
  is_enforced?: boolean;
  enforcement_mode?: EnforcementMode;
  is_visible_to_applicants?: boolean;
}

export interface BulkSessionDeadlinePayload {
  camp_session_id: number;
  entity_type: EntityType;
  title: string;
  description?: string;
  due_date: string;
  grace_period_days?: number;
  is_enforced?: boolean;
  enforcement_mode?: EnforcementMode;
  is_visible_to_applicants?: boolean;
}

export interface ExtendDeadlinePayload {
  new_due_date: string;
  reason: string;
}

export interface PaginatedDeadlines {
  data: Deadline[];
  meta: { current_page: number; last_page: number; total: number };
}

// ── Admin: full CRUD ───────────────────────────────────────────────────────────

/** List deadlines with optional filters (admin). */
export async function getDeadlines(params?: {
  session_id?: number;
  entity_type?: EntityType;
  status?: string;
}): Promise<PaginatedDeadlines> {
  const res = await axios.get<PaginatedDeadlines>('/deadlines', { params });
  return res.data;
}

/** Create a targeted deadline (admin). */
export async function createDeadline(payload: CreateDeadlinePayload): Promise<Deadline> {
  const res = await axios.post<{ data: Deadline }>('/deadlines', payload);
  return res.data.data;
}

/** Create a session-wide deadline covering all entities of a type (admin). */
export async function createBulkSessionDeadline(
  payload: BulkSessionDeadlinePayload,
): Promise<Deadline> {
  const res = await axios.post<{ data: Deadline }>('/deadlines/bulk-session', payload);
  return res.data.data;
}

/** Get a single deadline (admin). */
export async function getDeadline(id: number): Promise<Deadline> {
  const res = await axios.get<{ data: Deadline }>(`/deadlines/${id}`);
  return res.data.data;
}

/** Update a deadline (admin). */
export async function updateDeadline(
  id: number,
  payload: Partial<CreateDeadlinePayload>,
): Promise<Deadline> {
  const res = await axios.put<{ data: Deadline }>(`/deadlines/${id}`, payload);
  return res.data.data;
}

/** Soft-delete a deadline (admin). Also deletes the linked calendar event. */
export async function deleteDeadline(id: number): Promise<void> {
  await axios.delete(`/deadlines/${id}`);
}

/** Extend a deadline's due date with an admin reason (admin). */
export async function extendDeadline(
  id: number,
  payload: ExtendDeadlinePayload,
): Promise<Deadline> {
  const res = await axios.post<{ data: Deadline }>(`/deadlines/${id}/extend`, payload);
  return res.data.data;
}

/** Manually complete a deadline, unblocking the affected applicant (admin override). */
export async function completeDeadline(id: number, reason: string): Promise<Deadline> {
  const res = await axios.post<{ data: Deadline }>(`/deadlines/${id}/complete`, { reason });
  return res.data.data;
}

// ── Applicant: own deadlines ───────────────────────────────────────────────────

/** Fetch the authenticated applicant's own visible deadlines. */
export async function getMyDeadlines(): Promise<Deadline[]> {
  const res = await axios.get<{ data: Deadline[] }>('/deadlines/my');
  return res.data.data;
}
