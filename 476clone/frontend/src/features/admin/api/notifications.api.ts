/**
 * notifications.api.ts
 * Notification API calls and notification preference management.
 */

import axiosInstance from '@/api/axios.config';
import type { ApiResponse } from '@/shared/types';
import type { Notification } from '@/shared/types';

// ---------------------------------------------------------------------------
// Notification list response
// ---------------------------------------------------------------------------

/**
 * The notification list endpoint returns a custom paginated shape.
 * Each item has been pre-formatted by the server with a human-readable
 * title and message extracted from the stored notification data.
 */
export interface NotificationsResponse {
  data: Notification[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    unread_count: number;
  };
}

// ---------------------------------------------------------------------------
// Notification preferences
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  application_updates: boolean;
  announcements: boolean;
  messages: boolean;
  deadlines: boolean;
  /** Controls whether a popup toast appears when a new message arrives in-app.
   *  Defaults to true. Independent of the `messages` email preference. */
  in_app_message_notifications: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** GET /api/notifications */
export async function getNotifications(unreadOnly = false): Promise<NotificationsResponse> {
  const params = unreadOnly ? { unread_only: true } : {};
  const { data } = await axiosInstance.get<NotificationsResponse>('/notifications', { params });
  return data;
}

/** PUT /api/notifications/:id/read */
export async function markNotificationRead(id: string): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.put<ApiResponse<null>>(`/notifications/${id}/read`);
  return data;
}

/** PUT /api/notifications/read-all */
export async function markAllNotificationsRead(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.put<ApiResponse<null>>('/notifications/read-all');
  return data;
}

/** DELETE /api/notifications/clear-all */
export async function clearAllNotifications(): Promise<ApiResponse<null>> {
  const { data } = await axiosInstance.delete<ApiResponse<null>>('/notifications/clear-all');
  return data;
}

/** GET /api/profile/notification-preferences */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await axiosInstance.get<ApiResponse<NotificationPreferences>>(
    '/profile/notification-preferences'
  );
  return data.data;
}

/** PUT /api/profile/notification-preferences */
export async function updateNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean
): Promise<NotificationPreferences> {
  const { data } = await axiosInstance.put<ApiResponse<NotificationPreferences>>(
    '/profile/notification-preferences',
    { [key]: value }
  );
  return data.data;
}
