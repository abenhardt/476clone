/**
 * NotificationPanel.tsx
 *
 * Purpose: A slide-out panel that shows the logged-in user's notifications.
 * Triggered by the bell icon in DashboardHeader.
 *
 * Responsibilities:
 *   - Fetches notifications from GET /api/notifications when the panel opens.
 *   - Renders skeleton placeholders while loading to avoid layout shift.
 *   - Supports marking a single notification read (PATCH /api/notifications/{id}/read).
 *   - Supports marking all notifications read at once.
 *   - Supports clearing all notifications (DELETE /api/notifications).
 *   - Calls `onUnreadChange` so the parent (DashboardHeader) can update the badge count.
 *
 * Layout:
 *   A fixed aside is shown/hidden from the right edge of the screen over a transparent
 *   backdrop. Clicking the backdrop dismisses the panel.
 */

import { useEffect, useState } from 'react';
import { X, Bell, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from '@/features/admin/api/notifications.api';
import type { Notification } from '@/shared/types';
import { cn } from '@/shared/utils/cn';

interface NotificationPanelProps {
  /** Controls whether the panel is visible. */
  open: boolean;
  /** Called when the user closes the panel (backdrop click or X button). */
  onClose: () => void;
  /** Called whenever the unread count changes so the header badge stays in sync. */
  onUnreadChange?: (count: number) => void;
}

export function NotificationPanel({ open, onClose, onUnreadChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Clear the bell dot the moment the panel opens — the user has "seen" the
  // notification list even before reading individual items. The badge returns
  // to non-zero only when a new notification arrives via real-time event or
  // the 60-second polling cycle in DashboardHeader.
  useEffect(() => {
    if (open) onUnreadChange?.(0);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch notifications every time the panel opens — keeps the list fresh.
  // Does NOT call onUnreadChange here: the badge was already cleared above.
  // The count inside the panel is derived from local state (notifications array).
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getNotifications()
      .then((res) => {
        setNotifications(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  /**
   * Marks a single notification as read.
   * Updates local state immediately so the UI responds without a refetch.
   */
  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        );
        // Tell the parent how many unread remain after this change.
        onUnreadChange?.(next.filter((n) => !n.read_at).length);
        return next;
      });
    } catch {
      // ignore — state was optimistically not updated
    }
  };

  /**
   * Marks every notification as read in one API call.
   * Updates all items in local state and resets the badge to zero.
   */
  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      onUnreadChange?.(0);
    } catch {
      // ignore — state was optimistically not updated
    }
  };

  /**
   * Deletes all notifications from the server.
   * Clears the local list and resets the badge to zero.
   */
  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      onUnreadChange?.(0);
    } catch {
      // ignore — state was optimistically not updated
    }
  };

  // Derive unread count from local state for the badge inside the panel header.
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  if (!open) return null;

  return (
    <>
      {/* Transparent backdrop — clicking it triggers onClose without a visual overlay */}
      <button
        type="button"
        aria-label="Close notifications"
        className="fixed inset-0 z-40 bg-transparent cursor-default"
        onClick={onClose}
      />

      {/* Panel — fixed to the right edge of the viewport */}
      <aside
        className="fixed top-0 right-0 h-full w-full max-w-sm z-50 flex flex-col border-l"
        style={{
          background: 'var(--card)',
          borderColor: 'var(--border)',
          backdropFilter: 'blur(20px)',
        }}
        aria-label="Notifications"
      >
        {/* ── Panel header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ember-orange" />
            <h2
              className="font-headline font-semibold text-base"
              style={{ color: 'var(--foreground)' }}
            >
              Notifications
            </h2>
            {/* Orange pill showing the number of unread notifications */}
            {unreadCount > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: 'var(--ember-orange)',
                  color: 'white',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>

          {/* Action buttons — only rendered when there is something to act on */}
          <div className="flex items-center gap-2">
            {/* "Mark all read" only appears when there are unread notifications */}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs flex items-center gap-1 hover:text-ember-orange transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            {/* "Clear all" only appears when there are any notifications */}
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs flex items-center gap-1 hover:text-red-500 transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Clear all notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            )}
            {/* X close button — always visible */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--muted-foreground)' }}
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Notification list ── */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            // Skeleton placeholders — three gray blocks pulse while data loads.
            <div className="flex flex-col gap-3 p-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl animate-pulse"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            // Empty state — shown after loading completes with zero items.
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Bell className="h-8 w-8" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No notifications yet
              </p>
            </div>
          ) : (
            // Notification list — divided by horizontal rules between items.
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {notifications.map((notification) => (
                <li key={notification.id}>
                  {/*
                   * The entire row is a button so clicking anywhere on an unread
                   * notification marks it read. Already-read notifications are
                   * visually dimmer (normal font weight) and clicking does nothing.
                   */}
                  <button
                    className={cn(
                      'w-full text-left px-6 py-4 transition-colors hover:bg-[var(--dash-nav-hover-bg)]',
                      // Slight tint for unread items to draw the eye.
                      !notification.read_at && 'bg-white/[0.02]'
                    )}
                    onClick={() =>
                      !notification.read_at && void handleMarkRead(notification.id)
                    }
                  >
                  <div className="flex items-start gap-3">
                    {/* Orange dot indicator — only rendered for unread notifications */}
                    {!notification.read_at && (
                      <div
                        className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: 'var(--ember-orange)' }}
                      />
                    )}
                    {/* Extra left padding on read items to align with the absent dot */}
                    <div className={cn('flex-1', notification.read_at && 'pl-[18px]')}>
                      {/* Title is bold for unread, normal weight for read */}
                      <p
                        className={cn(
                          'text-sm mb-0.5',
                          !notification.read_at ? 'font-medium' : 'font-normal'
                        )}
                        style={{ color: 'var(--foreground)' }}
                      >
                        {notification.title}
                      </p>
                      {/* Body message in muted color */}
                      <p
                        className="text-xs leading-relaxed mb-1.5"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {notification.message}
                      </p>
                      {/* Relative timestamp — e.g. "3 minutes ago" */}
                      <p
                        className="text-xs"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
