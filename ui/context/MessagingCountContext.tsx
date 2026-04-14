/**
 * MessagingCountContext.tsx
 *
 * Single source of truth for the global unread inbox message count.
 *
 * WHY THIS EXISTS:
 *   Before this context, three separate components (DashboardHeader, AdminLayout,
 *   SuperAdminLayout) each independently fetched getUnreadCount() on mount AND
 *   each listened to the same 'messaging:unread-changed' event. This caused:
 *     1. Three simultaneous API calls on every badge refresh.
 *     2. A race condition where openConversation() dispatched the event before
 *        getMessages() had been called — so the server hadn't marked messages as
 *        read yet, and all three fetches returned the stale (pre-read) count.
 *
 * HOW IT WORKS:
 *   - MessagingCountProvider fetches the count once on mount.
 *   - It listens for the 'messaging:unread-changed' CustomEvent, which ThreadView
 *     dispatches AFTER getMessages() resolves (i.e., after the server has already
 *     written the read receipts).
 *   - All consumers (header, sidebar, dashboard) read from this shared state —
 *     one fetch, one listener, one consistent value everywhere.
 *
 * DISPATCHING THE EVENT:
 *   Dispatch window.dispatchEvent(new CustomEvent('messaging:unread-changed'))
 *   ONLY after the server operation that changes read state has completed:
 *     - ThreadView: after getMessages() resolves (auto-marks on server)
 *     - handleMarkRead / handleMarkUnread / handleBulkMarkRead: after API call
 *   Do NOT dispatch before the server call — that causes the stale-count race.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { getUnreadCount } from '@/features/messaging/api/messaging.api';

// ─── Context shape ────────────────────────────────────────────────────────────

interface MessagingCountContextValue {
  /** Authoritative count of unread inbox messages for the logged-in user. */
  unreadMessageCount: number;
  /**
   * Manually trigger a re-fetch of the count from the server.
   * Prefer dispatching 'messaging:unread-changed' over calling this directly
   * so all consumers update together.
   */
  refreshUnreadCount: () => void;
}

const MessagingCountContext = createContext<MessagingCountContextValue>({
  unreadMessageCount: 0,
  refreshUnreadCount: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MessagingCountProvider({ children }: { children: ReactNode }) {
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Monotonic counter that increments on every fetch attempt. The closure
  // captures the version at call time; if a newer fetch has started by the
  // time this one resolves, the result is discarded. This prevents a slow
  // in-flight request (fired before messages were marked read) from
  // overwriting a faster request that already has the correct post-read count.
  const fetchVersionRef = useRef(0);

  const refreshUnreadCount = useCallback(() => {
    const version = ++fetchVersionRef.current;
    getUnreadCount()
      .then((count) => {
        // Only apply if no newer fetch has started since this one was triggered.
        if (fetchVersionRef.current === version) {
          setUnreadMessageCount(count);
        }
      })
      .catch(() => {}); // Non-critical — badge simply won't update on failure.
  }, []);

  useEffect(() => {
    // Initial fetch on mount.
    refreshUnreadCount();

    // Re-fetch whenever any part of the app signals that read state has changed.
    // This event must only be dispatched AFTER the server has committed the change.
    window.addEventListener('messaging:unread-changed', refreshUnreadCount);
    return () => window.removeEventListener('messaging:unread-changed', refreshUnreadCount);
  }, [refreshUnreadCount]);

  return (
    <MessagingCountContext.Provider value={{ unreadMessageCount, refreshUnreadCount }}>
      {children}
    </MessagingCountContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useUnreadMessageCount(): MessagingCountContextValue {
  return useContext(MessagingCountContext);
}
