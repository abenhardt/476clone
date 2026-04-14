/**
 * RealtimeContext.tsx — Real-time messaging event provider
 *
 * Manages the WebSocket connection to the Laravel Reverb server and distributes
 * MessageSent events to any component that needs them.
 *
 * Architecture:
 *   - Subscribes to `private-user.{userId}` when the user is authenticated
 *   - Listens for `.MessageSent` events broadcast by Laravel's MessageSent event
 *   - Shows a Sonner toast notification for each incoming message
 *   - Exposes the last event + a monotonic key so consumers can use it as a
 *     useEffect dependency without equality-check issues
 *
 * HIPAA: The broadcast payload contains no PHI. Only sender name and conversation
 * subject are shown in the toast — both are non-medical metadata.
 *
 * Usage:
 *   const { lastMessage } = useRealtime();
 *   useEffect(() => { ... }, [lastMessage?.key]);
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { getEcho, destroyEcho } from '@/lib/echo';
import { getNotificationPreferences } from '@/features/admin/api/notifications.api';
import { getConversations, type Conversation } from '@/features/messaging/api/messaging.api';
// Imported for programmatic navigation from outside the RouterProvider tree.
// RealtimeProvider renders above RouterProvider so useNavigate() is unavailable here.
import { router } from '@/core/routing';

// ─── Event shape ─────────────────────────────────────────────────────────────

/**
 * Payload received from the Laravel MessageSent broadcast event.
 * Mirrors MessageSent::broadcastWith() on the backend.
 * No PHI fields — body and attachment content are excluded by design.
 */
export interface MessageSentEvent {
  message_id: number;
  conversation_id: number;
  conversation_subject: string;
  sender_id: number | null;
  sender_name: string | null;
  has_attachments: boolean;
  sent_at: string;
}

/**
 * Wrapped event — the `key` counter forces a new object identity on each event
 * so React's useEffect dependency array detects it as changed even if two
 * consecutive events have identical payloads.
 */
export interface WrappedMessage {
  event: MessageSentEvent;
  key: number;
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface RealtimeContextValue {
  lastMessage: WrappedMessage | null;
  /** True while the WebSocket connection to Reverb is established. Falls back
   *  to false when Reverb is unreachable — InboxPage's 30s poll is the safety
   *  net in that case. */
  isConnected: boolean;
  /** Call with the currently open conversation ID to suppress toast notifications
   *  for that conversation. Pass null when the thread is closed. */
  setActiveConversationId: (id: number | null) => void;
  /**
   * Re-fetches the user's notification preferences from the server and updates
   * the internal ref used by the WebSocket/polling toast gate.
   *
   * Call this after the user changes `in_app_message_notifications` in Settings
   * so the change takes effect immediately without requiring a page reload.
   */
  refreshNotificationPrefs: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  lastMessage: null,
  isConnected: false,
  setActiveConversationId: () => undefined,
  refreshNotificationPrefs: () => undefined,
});

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const user  = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.token)
    ?? sessionStorage.getItem('auth_token');

  const [lastMessage,  setLastMessage]  = useState<WrappedMessage | null>(null);
  const [isConnected,  setIsConnected]  = useState(false);
  const keyRef = useRef(0);

  // Notification preferences — stored in a ref so the WebSocket event handler
  // closure always reads the current value without needing to re-subscribe.
  // Default to true (show notifications) until preferences load.
  const notifPrefsRef    = useRef<{ in_app_message_notifications?: boolean } | null>(null);
  // Tracks the conversation the user is currently viewing. Toasts are suppressed
  // when a message arrives for the open conversation — the thread auto-updates.
  const activeConvIdRef  = useRef<number | null>(null);

  // Polling fallback state — tracks which conversations we've already seen as
  // unread so the first poll establishes a silent baseline and subsequent polls
  // only notify about genuinely NEW arrivals.
  const prevUnreadConvRef     = useRef<Map<number, string>>(new Map()); // conv id → updated_at
  const pollingInitializedRef = useRef(false);

  function setActiveConversationId(id: number | null) {
    activeConvIdRef.current = id;
  }

  // Exposed so Settings can trigger an immediate re-fetch after the user
  // toggles `in_app_message_notifications` — without this the ref stays stale
  // until the next login because its effect only depends on user?.id / token.
  function refreshNotificationPrefs() {
    if (!user?.id || !token) return;
    getNotificationPreferences()
      .then((prefs) => { notifPrefsRef.current = prefs; })
      .catch(() => { /* keep existing ref on failure */ });
  }

  // Fetch notification preferences once when the user authenticates.
  // A separate effect from the WebSocket subscription so that preference changes
  // do not disconnect/reconnect the socket.
  useEffect(() => {
    if (!user?.id || !token) {
      notifPrefsRef.current = null;
      return;
    }
    getNotificationPreferences()
      .then((prefs) => { notifPrefsRef.current = prefs; })
      .catch(() => { /* keep null — toasts will show by default on fetch failure */ });
  }, [user?.id, token]);

  // ── Polling fallback ──────────────────────────────────────────────────────────
  // When the WebSocket connection to Reverb is not established, poll the inbox
  // every 30 seconds to detect new messages and fire the same notification toasts
  // that WebSocket events would produce. Stops automatically once connected.
  useEffect(() => {
    if (isConnected || !user?.id || !token) {
      // WebSocket active (or user logged out) — reset baseline so polling
      // reinitializes cleanly if the connection drops again later.
      pollingInitializedRef.current = false;
      prevUnreadConvRef.current.clear();
      return;
    }

    async function pollForNewMessages() {
      try {
        const res    = await getConversations({ folder: 'inbox' });
        const unread = res.data.filter((c: Conversation) => c.unread_count > 0);
        const prev   = prevUnreadConvRef.current;

        if (!pollingInitializedRef.current) {
          // First run: establish the baseline silently.
          // We record what was already unread — no toasts for pre-existing messages.
          for (const c of unread) prev.set(c.id, c.updated_at);
          pollingInitializedRef.current = true;
          return;
        }

        const inAppEnabled = notifPrefsRef.current?.in_app_message_notifications !== false;

        for (const c of unread) {
          const prevTs   = prev.get(c.id);
          const isNewer  = !prevTs || new Date(c.updated_at) > new Date(prevTs);
          const suppress = activeConvIdRef.current === c.id;

          if (isNewer) {
            // Signal dashboard and other listeners regardless of toast preference.
            window.dispatchEvent(new CustomEvent('realtime:message-arrived'));

            if (inAppEnabled && !suppress) {
              const senderLabel  = c.last_message?.sender?.name ?? 'New message';
              const subjectLabel = c.subject ?? 'Inbox';
              const convId       = c.id;

              toast(senderLabel, {
                description: subjectLabel,
                icon: <Mail className="h-4 w-4" style={{ color: '#16a34a' }} />,
                duration: 6000,
                action: {
                  label: 'View',
                  onClick: () => {
                    // Derive the portal prefix from the current path so the button
                    // works on any portal (/admin, /super-admin, /applicant, /medical).
                    const prefix     = window.location.pathname.split('/')[1] ?? 'admin';
                    const targetPath = `/${prefix}/inbox`;
                    const isOnInbox  = window.location.pathname === targetPath;

                    if (isOnInbox) {
                      // InboxPage is already mounted — dispatch a DOM event so its
                      // listener can directly select the conversation without relying
                      // on router.navigate() to the same URL (which can be unreliable
                      // when location.state is the only thing changing).
                      window.dispatchEvent(
                        new CustomEvent('inbox:open-conversation', { detail: { convId } }),
                      );
                    } else {
                      // Navigate to inbox; InboxPage will read conversationId from
                      // location.state on mount and auto-select.
                      router.navigate(targetPath, { state: { conversationId: convId } });
                    }
                  },
                },
              });
            }
          }

          // Update baseline whether or not a toast was shown.
          prev.set(c.id, c.updated_at);
        }
      } catch (err) {
        console.error('[RealtimeContext] Poll for new messages failed:', err);
      }
    }

    void pollForNewMessages();
    // 10s interval when WebSocket is down — short enough to feel responsive
    // without hammering the server. Stops automatically once connected.
    const id = setInterval(() => void pollForNewMessages(), 10_000);
    return () => clearInterval(id);
  }, [isConnected, user?.id, token]);

  useEffect(() => {
    // Not authenticated — no WebSocket needed
    if (!user?.id || !token) {
      destroyEcho();
      setIsConnected(false);
      return;
    }

    const echo    = getEcho(token);
    const channel = echo.private(`user.${user.id}`);

    // ── Track connection state so consumers can react when Reverb is down.
    // pusher-js fires these on the underlying connector. The polling
    // fallback runs when isConnected is false.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pusherConn = (echo.connector as any)?.pusher?.connection;
    if (pusherConn) {
      const onConnected    = () => setIsConnected(true);
      const onDisconnected = () => setIsConnected(false);
      pusherConn.bind('connected',    onConnected);
      pusherConn.bind('disconnected', onDisconnected);
      pusherConn.bind('unavailable',  onDisconnected);
      pusherConn.bind('failed',       onDisconnected);
      // Reflect the initial state if already connected (e.g. token rotation)
      if (pusherConn.state === 'connected') setIsConnected(true);
    }

    // Guard against silent private-channel auth failures.
    // If the /api/broadcasting/auth request returns a non-2xx (e.g. 403 on
    // token expiry or a Reverb misconfiguration), pusher-js marks the channel
    // as failed but does NOT change the top-level connection state. This means
    // isConnected could stay true while no events are delivered — polling stops
    // and the user gets complete silence. Binding to the channel's error event
    // forces isConnected = false so the polling fallback re-activates.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (channel as any).error?.((err: unknown) => {
      console.warn('[RealtimeContext] Private channel subscription error — falling back to polling:', err);
      setIsConnected(false);
    });

    channel.listen('.NotificationCreated', () => {
      // A new database notification was written for this user (e.g. application
      // status change, new message notification, provider link update, etc.).
      // Signal DashboardHeader to re-fetch the bell badge count immediately
      // instead of waiting for the 60-second polling cycle.
      window.dispatchEvent(new CustomEvent('notification:refresh'));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    channel.listen('.MessageSent', (event: any) => {
      const typedEvent = event as MessageSentEvent;

      // Increment key so even identical payloads register as new events
      keyRef.current += 1;
      setLastMessage({ event: typedEvent, key: keyRef.current });

      // Notify MessagingCountContext to re-fetch the unread count from the server.
      // This keeps the sidebar inbox badge accurate even when the user is not on
      // the inbox page. Dispatch is done before the toast so the badge updates
      // as soon as the event arrives — MessagingCountContext fires an async fetch
      // internally so there is no UI blocking.
      window.dispatchEvent(new CustomEvent('messaging:unread-changed'));

      // Mark this conversation as seen in the polling baseline so the next
      // polling cycle does not show a duplicate notification.
      prevUnreadConvRef.current.set(typedEvent.conversation_id, typedEvent.sent_at);

      // Signal dashboard and other components that a new message has arrived.
      window.dispatchEvent(new CustomEvent('realtime:message-arrived'));

      // Show an in-app notification toast — unless:
      //   1. The user has disabled in-app notifications in Settings → Notifications
      //   2. The user is already viewing the conversation the message belongs to
      const inAppEnabled  = notifPrefsRef.current?.in_app_message_notifications !== false;
      const isActiveConv  = activeConvIdRef.current === typedEvent.conversation_id;

      if (inAppEnabled && !isActiveConv) {
        const senderLabel  = typedEvent.sender_name ?? 'New message';
        const subjectLabel = typedEvent.conversation_subject ?? 'Inbox';

        toast(senderLabel, {
          description: subjectLabel,
          icon: <Mail className="h-4 w-4" style={{ color: '#16a34a' }} />,
          duration: 6000,
          action: {
            label: 'View',
            onClick: () => {
              const prefix     = window.location.pathname.split('/')[1] ?? 'admin';
              const targetPath = `/${prefix}/inbox`;
              const isOnInbox  = window.location.pathname === targetPath;

              if (isOnInbox) {
                window.dispatchEvent(
                  new CustomEvent('inbox:open-conversation', {
                    detail: { convId: typedEvent.conversation_id },
                  }),
                );
              } else {
                router.navigate(targetPath, {
                  state: { conversationId: typedEvent.conversation_id },
                });
              }
            },
          },
        });
      }
    });

    // Cleanup: unbind state listeners, unsubscribe channel, destroy socket
    return () => {
      if (pusherConn) {
        pusherConn.unbind('connected');
        pusherConn.unbind('disconnected');
        pusherConn.unbind('unavailable');
        pusherConn.unbind('failed');
      }
      channel.stopListening('.NotificationCreated');
      channel.stopListening('.MessageSent');
      destroyEcho();
      setIsConnected(false);
    };
  }, [user?.id, token]);

  return (
    <RealtimeContext.Provider value={{ lastMessage, isConnected, setActiveConversationId, refreshNotificationPrefs }}>
      {children}
    </RealtimeContext.Provider>
  );
}
