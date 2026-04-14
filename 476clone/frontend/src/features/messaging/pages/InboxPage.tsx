/**
 * InboxPage.tsx
 *
 * Phase 8 — Gmail-style 3-pane inbox.
 *
 * Layout:
 *   [ Folder Nav (220px, collapsible) ] [ Conversation List (380px) ] [ Thread Pane (flex-1) ]
 *
 * Folder nav:
 *   Inbox · Starred · Important | Sent · Archive · Trash | System · Announcements
 *   Collapses to icon-only strip (52px). State persisted in sessionStorage.
 *
 * Conversation list:
 *   Search bar · Compose button · Bulk actions toolbar · Paginated rows
 *   Stars and Important now backed by API (per-user in DB) with optimistic updates.
 *
 * Thread pane:
 *   Shows ThreadView for selected conversation; placeholder when nothing selected.
 *
 * Route: /parent/inbox  /admin/inbox  /medical/inbox  /super-admin/inbox
 */

import {
  useState, useEffect, useCallback, useRef, type ElementType, type MouseEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Mail, Star, AlertCircle, Send, Archive, Trash2, Bot, Megaphone,
  Search, Plus, RefreshCw, ArchiveRestore, MailOpen, X,
  ChevronLeft, ChevronRight, CheckSquare, Square, AlertTriangle, Pin,
} from 'lucide-react';

import {
  getConversations,
  archiveConversation, unarchiveConversation,
  leaveConversation, deleteConversation,
  starConversation, markImportant, trashConversation, restoreConversation,
  markConversationAsRead, markConversationAsUnread,
  type Conversation, type InboxFolder,
} from '@/features/messaging/api/messaging.api';
import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import { format } from 'date-fns';
import { useAppSelector } from '@/store/hooks';
import { useBootstrapReady } from '@/shared/hooks/useBootstrapReady';
import { useRealtime } from '@/features/realtime/RealtimeContext';
import { MessageRow } from '@/features/messaging/components/MessageRow';
import { ThreadView } from '@/features/messaging/components/ThreadView';
import { FloatingCompose, clearComposeDraft } from '@/features/messaging/components/FloatingCompose';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';

// Strict DOMPurify config — see ThreadView.tsx for rationale.
const SAFE_MESSAGE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  FORCE_BODY: true,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';
const LEFT_COLLAPSE_KEY = 'inbox_left_collapsed';
const LEFT_FOLDER_KEY   = 'inbox_active_folder';

// ─── Folder definitions ───────────────────────────────────────────────────────

type FolderDef = { id: InboxFolder; label: string; icon: ElementType };
type FolderItem = FolderDef | 'divider';

// ─── BulkButton helper ────────────────────────────────────────────────────────

function BulkButton({ icon: Icon, title, onClick, destructive }: {
  icon: ElementType; title: string; onClick: () => void; destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
    >
      <Icon
        className="h-4 w-4"
        style={{ color: destructive ? 'var(--destructive)' : 'var(--muted-foreground)' }}
      />
    </button>
  );
}

// ─── FolderNav ────────────────────────────────────────────────────────────────

function FolderNav({
  collapsed, onToggle, folder, onFolderChange, inboxUnread,
}: {
  collapsed: boolean;
  onToggle: () => void;
  folder: InboxFolder;
  onFolderChange: (f: InboxFolder) => void;
  inboxUnread: number;
}) {
  const { t } = useTranslation();

  const FOLDER_DEFS: FolderItem[] = [
    { id: 'inbox',         label: t('messaging_extra.folder_inbox'),         icon: Mail          },
    { id: 'starred',       label: t('messaging_extra.folder_starred'),       icon: Star          },
    { id: 'important',     label: t('messaging_extra.folder_important'),     icon: AlertCircle   },
    'divider',
    { id: 'sent',          label: t('messaging_extra.folder_sent'),          icon: Send          },
    { id: 'archive',       label: t('messaging_extra.folder_archive'),       icon: Archive       },
    { id: 'trash',         label: t('messaging_extra.folder_trash'),         icon: Trash2        },
    'divider',
    { id: 'system',        label: t('messaging_extra.folder_system'),        icon: Bot           },
    { id: 'announcements', label: t('messaging_extra.folder_announcements'), icon: Megaphone     },
  ];

  return (
    <div
      className="flex flex-col border-r flex-shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? 52 : 220,
        background: 'var(--card)',
        borderColor: 'var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Toggle button */}
      <div
        className="flex items-center px-2 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', minHeight: 52 }}
      >
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            : <ChevronLeft  className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          }
        </button>
        {!collapsed && (
          <span className="ml-2 font-headline font-bold text-base truncate" style={{ color: 'var(--foreground)' }}>
            {t('messaging_extra.folder_inbox')}
          </span>
        )}
      </div>

      {/* Folder list */}
      <nav className="flex flex-col py-2 flex-1 overflow-y-auto">
        {FOLDER_DEFS.map((item, i) => {
          if (item === 'divider') {
            return <div key={`div-${i}`} className="my-1 mx-2 border-t" style={{ borderColor: 'var(--border)' }} />;
          }
          const Icon    = item.icon;
          const active  = folder === item.id;
          const badge   = item.id === 'inbox' && inboxUnread > 0 ? inboxUnread : 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFolderChange(item.id)}
              title={collapsed ? item.label : undefined}
              aria-label={item.label}
              className="flex items-center gap-2.5 transition-colors rounded-lg mx-1.5 my-0.5 flex-shrink-0"
              style={{
                padding: collapsed ? '8px 12px' : '8px 10px',
                background: active ? BRAND_T : 'transparent',
                color: active ? BRAND : 'var(--foreground)',
                fontWeight: active ? 600 : 400,
                justifyContent: collapsed ? 'center' : undefined,
              }}
            >
              <div className="relative flex-shrink-0">
                <Icon className="h-4 w-4" style={{ color: active ? BRAND : 'var(--muted-foreground)' }} />
                {/* Collapsed badge dot */}
                {collapsed && badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                    style={{ background: BRAND }}
                  />
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="text-sm flex-1 text-left truncate">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-semibold leading-none flex-shrink-0"
                      style={{
                        background: active ? BRAND : 'rgba(107,114,128,0.14)',
                        color: active ? '#fff' : '#6b7280',
                        fontSize: 10,
                      }}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── InboxPage ────────────────────────────────────────────────────────────────

export function InboxPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const bootstrapReady = useBootstrapReady();

  // If we arrived via a notification "View" button, hold the target ID here
  // and auto-select it once the conversation list has loaded.
  const pendingConvIdRef = useRef<number | null>(
    (location.state as { conversationId?: number } | null)?.conversationId ?? null,
  );
  const currentUserId  = useAppSelector((s) => s.auth.user?.id);
  const userRoleName   = useAppSelector((s) => {
    const u = s.auth.user;
    return u?.roles?.[0]?.name ?? (typeof u?.role === 'string' ? u.role : '') ?? '';
  });
  const isAdmin = ['admin', 'super_admin'].includes(userRoleName);

  // ── Persisted UI state
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(LEFT_COLLAPSE_KEY) === 'true'; } catch { return false; }
  });
  const [folder, setFolder] = useState<InboxFolder>(() => {
    try {
      const saved = sessionStorage.getItem(LEFT_FOLDER_KEY) as InboxFolder | null;
      return saved ?? 'inbox';
    } catch { return 'inbox'; }
  });

  // ── Data state
  const [conversations,        setConversations]        = useState<Conversation[]>([]);
  const [announcements,        setAnnouncements]        = useState<Announcement[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(false);
  const [inboxUnread,          setInboxUnread]          = useState(0);
  const [refreshKey,           setRefreshKey]           = useState(0);
  // Incremented when a real-time event arrives for the open conversation —
  // ThreadView watches this to silently re-fetch its message list.
  const [threadRefreshSignal,  setThreadRefreshSignal]  = useState(0);

  // ── Interaction state
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [showCompose,  setShowCompose]  = useState(false);

  // ── Refs
  const searchRef         = useRef<HTMLInputElement>(null);
  const listRef           = useRef<HTMLDivElement>(null);
  const savedScroll       = useRef(0);
  // Tracks the active fetch token. Updated synchronously in changeFolder so
  // any in-flight fetch from a previous folder sees the mismatch immediately,
  // before React's useEffect cleanup has a chance to run.
  const activeFetchRef    = useRef<symbol | null>(null);
  // Tracks the active silent-refresh token to prevent stale results from
  // real-time background fetches overwriting a concurrent folder switch.
  const silentRefreshRef  = useRef<symbol | null>(null);
  // Mirror of selectedConv for synchronous reads inside effects without needing
  // selectedConv in the dependency array. Avoids the anti-pattern of reading
  // current state inside a state-updater function (double-invoke risk in React
  // Concurrent Mode / StrictMode).
  const selectedConvRef   = useRef<Conversation | null>(null);

  // ─── Real-time event handling ─────────────────────────────────────────────

  const { lastMessage, setActiveConversationId } = useRealtime();

  // Silently re-fetches the conversation list in the background without
  // showing a loading spinner. Used after a real-time message event arrives.
  const silentRefreshConversations = useCallback(() => {
    if (folder === 'announcements') return;
    const token = Symbol();
    silentRefreshRef.current = token;
    getConversations({ folder })
      .then((res) => {
        if (silentRefreshRef.current !== token) return;
        setConversations(res.data);
        setInboxUnread((res.meta as { unread_count?: number }).unread_count ?? 0);
      })
      .catch((err) => { console.error('[InboxPage] Silent refresh failed:', err); });
  }, [folder]);

  // Keep the ref in sync with the state so the WebSocket effect below can read
  // the current conversation synchronously without adding selectedConv as a dep.
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  // React to incoming MessageSent events from the WebSocket channel.
  useEffect(() => {
    if (!lastMessage) return;
    const { event } = lastMessage;

    // Read the current conversation via ref — avoids performing side effects
    // inside a state-updater function, which React may call multiple times in
    // Concurrent / StrictMode and would double-increment inboxUnread.
    const activeConv = selectedConvRef.current;

    // Only increment the badge when the incoming message is NOT in the currently
    // open conversation. If the conversation is open, ThreadView will trigger a
    // re-fetch and dispatch messaging:unread-changed, which corrects the count
    // from the server — no manual increment needed (and it would be wrong to
    // add +1 for a message the user is actively reading).
    if (activeConv?.id !== event.conversation_id) {
      setInboxUnread((c) => c + 1);
    }

    // Silently refresh the conversation list so the new message appears at the
    // top and the unread count is accurate without a full loading spinner.
    silentRefreshConversations();

    // If the user has this conversation open in the thread pane, signal
    // ThreadView to re-fetch its message list.
    if (activeConv?.id === event.conversation_id) {
      setThreadRefreshSignal((k) => k + 1);
    }
  // lastMessage.key is a monotonic counter — safe as the sole dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage?.key]);

  // Polling fallback — keeps unread count and conversation list fresh when
  // the Reverb WebSocket is unavailable (e.g. Reverb not started in dev).
  // Runs every 30 seconds only while the inbox is visible. Real-time events
  // supersede this; the poll is a safety net, not the primary update path.
  useEffect(() => {
    if (!bootstrapReady) return;
    const id = setInterval(silentRefreshConversations, 30_000);
    return () => clearInterval(id);
  }, [bootstrapReady, silentRefreshConversations]);

  // Also refresh immediately whenever RealtimeContext signals a new message —
  // covers both the WebSocket-connected path and the polling fallback path.
  useEffect(() => {
    if (!bootstrapReady) return;
    window.addEventListener('realtime:message-arrived', silentRefreshConversations);
    return () => window.removeEventListener('realtime:message-arrived', silentRefreshConversations);
  }, [bootstrapReady, silentRefreshConversations]);

  // ─── Persist left pane state ─────────────────────────────────────────────

  function toggleLeftCollapse() {
    setLeftCollapsed((v) => {
      const next = !v;
      try { sessionStorage.setItem(LEFT_COLLAPSE_KEY, String(next)); } catch { /**/ }
      return next;
    });
  }

  function changeFolder(f: InboxFolder) {
    // Invalidate any in-flight fetch synchronously, before React paints or runs
    // effect cleanups. This closes the race window where a stale fetch completes
    // after the click but before the useEffect cleanup sets its local `cancelled` flag.
    activeFetchRef.current = null;

    setFolder(f);
    // Do NOT clear conversations/announcements immediately — keep stale content
    // visible during the brief loading window so the transition is smooth rather
    // than jarring (blank → skeleton → content). The effect will replace the
    // stale list atomically when fresh data arrives.
    setLoading(true);
    setError(false);
    setSelected(new Set());
    setSelectedConv(null);
    setSearch('');
    try { sessionStorage.setItem(LEFT_FOLDER_KEY, f); } catch { /**/ }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────
  // Each fetch run gets a unique Symbol token assigned to activeFetchRef.
  // changeFolder() sets activeFetchRef.current = null synchronously (pre-paint),
  // so any in-flight fetch from a previous folder finds a token mismatch the
  // moment it resumes and discards its result without touching state.

  useEffect(() => {
    if (!bootstrapReady) return;

    const token = Symbol();
    activeFetchRef.current = token;

    const isMine = () => activeFetchRef.current === token;

    // loading=true and error=false are already set synchronously by changeFolder()
    // or by the refresh button handler. Setting them here again causes an extra
    // render cycle (even as no-ops) which produces the visible folder-switch glitch.

    async function fetchFolder() {
      if (folder === 'announcements') {
        try {
          const res = await getAnnouncements(50);
          if (!isMine()) return;
          // Atomically swap: clear stale data and set new data in one batch
          setConversations([]);
          setAnnouncements(res.data);
        } catch {
          if (!isMine()) return;
          setAnnouncements([]);
          setError(true);
        } finally {
          if (isMine()) setLoading(false);
        }
        return;
      }

      try {
        const res = await getConversations({ folder });
        if (!isMine()) return;
        // Atomically swap: clear stale data and set new data in one batch
        setAnnouncements([]);
        setConversations(res.data);
        // Always update the unread badge — the API returns the total across all folders
        setInboxUnread((res.meta as { unread_count?: number }).unread_count ?? 0);

        // Auto-select a conversation if we were navigated here from a notification.
        if (pendingConvIdRef.current !== null) {
          const target = res.data.find((c) => c.id === pendingConvIdRef.current);
          pendingConvIdRef.current = null;
          if (target) {
            setActiveConversationId(target.id);
            setSelectedConv(target);
          }
        }
      } catch {
        if (!isMine()) return;
        setConversations([]);
        setError(true);
      } finally {
        if (isMine()) setLoading(false);
      }
    }

    void fetchFolder();

    return () => {
      // Also clear on cleanup (unmount / strict-mode double-invoke)
      if (activeFetchRef.current === token) activeFetchRef.current = null;
    };
  }, [folder, refreshKey, bootstrapReady, setActiveConversationId]);

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target  = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === 'Escape') {
        if (showCompose) {
          // Clear the compose draft so stale subject/body cannot bleed into
          // the next compose session opened in this tab.
          clearComposeDraft();
          setShowCompose(false);
        }
        return;
      }
      if (inInput) return;
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) setShowCompose(true);
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCompose]);

  // ─── Notification "View" — same-page handler via custom DOM event ─────────
  // When the user is ALREADY on InboxPage, RealtimeContext dispatches
  // "inbox:open-conversation" instead of calling router.navigate() to the same
  // URL (navigating to an already-active route with changed state only is
  // unreliable in React Router 6 — useLocation() may not update consistently).
  //
  // When the user is NOT on InboxPage, RealtimeContext uses router.navigate()
  // with location.state; InboxPage mounts fresh and pendingConvIdRef (line 222)
  // reads the conversationId normally from location.state.
  useEffect(() => {
    function onOpenConversation(e: Event) {
      const convId = (e as CustomEvent<{ convId: number }>).detail.convId;

      if (folder !== 'inbox') {
        // Switch to inbox — the subsequent data load will consume pendingConvIdRef.
        pendingConvIdRef.current = convId;
        changeFolder('inbox');
        return;
      }

      // Already on inbox — try to find the conversation in the current list.
      const target = conversations.find((c) => c.id === convId);
      if (target) {
        setActiveConversationId(target.id);
        setSelectedConv(target);
      } else {
        // Not in list yet (new message arrived after last fetch).
        // Queue and force a refresh so the data-load effect picks it up.
        pendingConvIdRef.current = convId;
        setRefreshKey((k) => k + 1);
      }
    }

    window.addEventListener('inbox:open-conversation', onOpenConversation);
    return () => window.removeEventListener('inbox:open-conversation', onOpenConversation);
  // conversations + folder are read inside the handler — include so the closure
  // always sees fresh values without needing refs for each.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, conversations]);

  // ─── Filtered list ────────────────────────────────────────────────────────

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.subject?.toLowerCase().includes(q) ||
      c.last_message?.sender?.name.toLowerCase().includes(q) ||
      c.last_message?.body.toLowerCase().includes(q)
    );
  });

  const allSelected  = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0;
  const isReadOnly   = folder === 'system' || folder === 'announcements';

  // ─── Selection ────────────────────────────────────────────────────────────

  function toggleSelect(id: number, e: MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  }

  // ─── Row actions ──────────────────────────────────────────────────────────

  async function handleStar(id: number, e: MouseEvent) {
    e.stopPropagation();
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, is_starred: !c.is_starred } : c)
    );
    if (selectedConv?.id === id) {
      setSelectedConv((prev) => prev ? { ...prev, is_starred: !prev.is_starred } : prev);
    }
    try {
      const actualIsStarred = await starConversation(id);
      // Sync with server's actual state (overrides the optimistic flip)
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, is_starred: actualIsStarred } : c)
      );
      if (selectedConv?.id === id) {
        setSelectedConv((prev) => prev ? { ...prev, is_starred: actualIsStarred } : prev);
      }
      // If we're in the starred folder and just unstarred, remove from list
      if (folder === 'starred' && !actualIsStarred) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // Revert
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, is_starred: !c.is_starred } : c)
      );
      if (selectedConv?.id === id) {
        setSelectedConv((prev) => prev ? { ...prev, is_starred: !prev.is_starred } : prev);
      }
      toast.error('Failed to update star.');
    }
  }

  async function handleImportant(id: number) {
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, is_important: !c.is_important } : c)
    );
    try {
      const actualIsImportant = await markImportant(id);
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, is_important: actualIsImportant } : c)
      );
      if (folder === 'important' && !actualIsImportant) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      setConversations((prev) =>
        prev.map((c) => c.id === id ? { ...c, is_important: !c.is_important } : c)
      );
      toast.error('Failed to update importance.');
    }
  }

  function handleArchive(id: number, e: MouseEvent) {
    e.stopPropagation();
    if (folder === 'archive') {
      unarchiveConversation(id)
        .then(() => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (selectedConv?.id === id) setSelectedConv(null);
          toast.success('Conversation restored to inbox.');
        })
        .catch(() => toast.error('Restore failed.'));
    } else {
      archiveConversation(id)
        .then(() => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (selectedConv?.id === id) setSelectedConv(null);
          toast.success('Conversation archived.');
        })
        .catch(() => toast.error('Archive failed.'));
    }
  }

  function handleDelete(id: number, e: MouseEvent) {
    e.stopPropagation();
    if (folder === 'trash') {
      // Permanently delete (admin) or leave (applicant) from trash
      const action = isAdmin ? deleteConversation(id) : leaveConversation(id);
      action
        .then(() => {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (selectedConv?.id === id) setSelectedConv(null);
          toast.success(isAdmin ? 'Conversation deleted.' : 'Conversation removed.');
        })
        .catch(() => toast.error('Delete failed.'));
    } else {
      // Move to trash
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selectedConv?.id === id) setSelectedConv(null);
      trashConversation(id)
        .then(() => toast.success('Moved to trash.'))
        .catch(() => {
          setRefreshKey((k) => k + 1);
          toast.error('Failed to move to trash.');
        });
    }
  }

  function handleRestoreFromTrash(id: number, e: MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedConv?.id === id) setSelectedConv(null);
    restoreConversation(id)
      .then(() => toast.success('Conversation restored.'))
      .catch(() => {
        setRefreshKey((k) => k + 1);
        toast.error('Restore failed.');
      });
  }

  // ─── Bulk actions ─────────────────────────────────────────────────────────

  async function handleBulkArchive() {
    const ids = [...selected];
    await Promise.all(ids.map((id) =>
      folder === 'archive' ? unarchiveConversation(id) : archiveConversation(id)
    )).then(() => {
      setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
      setSelected(new Set());
      toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} ${folder === 'archive' ? 'restored' : 'archived'}.`);
    }).catch(() => toast.error('Bulk action failed.'));
  }

  async function handleBulkTrash() {
    const ids = [...selected];
    const action = folder === 'trash'
      ? (id: number) => isAdmin ? deleteConversation(id) : leaveConversation(id)
      : (id: number) => trashConversation(id);
    await Promise.all(ids.map(action))
      .then(() => {
        setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
        setSelected(new Set());
        toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} ${folder === 'trash' ? (isAdmin ? 'deleted' : 'removed') : 'moved to trash'}.`);
      })
      .catch(() => toast.error('Bulk action failed.'));
  }

  async function handleBulkRestore() {
    const ids = [...selected];
    await Promise.all(ids.map((id) => restoreConversation(id)))
      .then(() => {
        setConversations((prev) => prev.filter((c) => !ids.includes(c.id)));
        setSelected(new Set());
        toast.success(`${ids.length} conversation${ids.length > 1 ? 's' : ''} restored.`);
      })
      .catch(() => toast.error('Bulk restore failed.'));
  }

  async function handleBulkStar() {
    const ids = [...selected];
    setConversations((prev) =>
      prev.map((c) => ids.includes(c.id) ? { ...c, is_starred: true } : c)
    );
    await Promise.all(ids.map((id) => starConversation(id))).catch(() => {
      setRefreshKey((k) => k + 1);
      toast.error('Failed to star conversations.');
    });
    setSelected(new Set());
  }

  async function handleBulkMarkRead() {
    const ids = [...selected];
    setConversations((prev) =>
      prev.map((c) => ids.includes(c.id) ? { ...c, unread_count: 0 } : c)
    );
    setSelected(new Set());
    try {
      await Promise.all(ids.map((id) => markConversationAsRead(id)));
      // Only dispatch the unread-changed event after all API calls succeed.
      window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
    } catch {
      // Rollback optimistic state update on failure.
      setRefreshKey((k) => k + 1);
      toast.error('Failed to mark conversations as read.');
    }
  }

  // ─── Row-level mark-read / mark-unread ────────────────────────────────────

  async function handleMarkRead(id: number) {
    // Optimistic: clear badge immediately
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, unread_count: 0 } : c)
    );
    try {
      await markConversationAsRead(id);
      // Notify the bell and sidebar badge that the unread count has decreased.
      window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
    } catch {
      setRefreshKey((k) => k + 1);
      toast.error('Failed to mark as read.');
    }
  }

  async function handleMarkUnread(id: number) {
    // Optimistic: show as having 1 unread message
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, unread_count: Math.max(c.unread_count, 1) } : c)
    );
    try {
      await markConversationAsUnread(id);
      // Notify the bell and sidebar badge that the unread count has increased.
      window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
    } catch {
      setRefreshKey((k) => k + 1);
      toast.error('Failed to mark as unread.');
    }
  }

  // ─── Conversation navigation ───────────────────────────────────────────────

  function openConversation(conv: Conversation) {
    savedScroll.current = listRef.current?.scrollTop ?? 0;
    // Optimistically clear this conversation's local badge so the row un-bolds immediately.
    // Do NOT dispatch 'messaging:unread-changed' here — the server hasn't marked anything as
    // read yet. ThreadView will dispatch the event after getMessages() resolves, which is when
    // the server actually writes the read receipts.
    if (conv.unread_count > 0) {
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    }
    setActiveConversationId(conv.id);
    setSelectedConv(conv);
  }

  function handleBack() {
    setActiveConversationId(null);
    setSelectedConv(null);
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = savedScroll.current;
    });
  }

  function handleConvArchived(id: number) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveConversationId(null);
    setSelectedConv(null);
  }

  function handleConvCreated(conv: Conversation) {
    if (folder === 'inbox' || folder === 'sent') {
      setConversations((prev) => [conv, ...prev]);
    }
    setShowCompose(false);
    openConversation(conv);
  }

  // ─── Empty state content ──────────────────────────────────────────────────

  const emptyIcons: Partial<Record<InboxFolder, ElementType>> = {
    inbox:         Mail,
    starred:       Star,
    important:     AlertCircle,
    sent:          Send,
    archive:       Archive,
    trash:         Trash2,
    system:        Bot,
    announcements: Megaphone,
  };
  const emptyMessages: Partial<Record<InboxFolder, string>> = {
    inbox:         'Your inbox is clear',
    starred:       'No starred conversations',
    important:     'No important conversations',
    sent:          'No sent conversations',
    archive:       'No archived conversations',
    trash:         'Trash is empty',
    system:        'No system notifications',
    announcements: 'No announcements yet',
  };
  const EmptyIcon = emptyIcons[folder] ?? MailOpen;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--background)' }}>

      {/* ── Left pane: folder navigation ───────────────────────────────────── */}
      <FolderNav
        collapsed={leftCollapsed}
        onToggle={toggleLeftCollapse}
        folder={folder}
        onFolderChange={changeFolder}
        inboxUnread={inboxUnread}
      />

      {/* ── Center pane: conversation list ─────────────────────────────────── */}
      <div
        className="flex flex-col border-r flex-shrink-0 overflow-hidden"
        style={{
          width: 380,
          borderColor: 'var(--border)',
          background: 'var(--card)',
        }}
      >
        {/* Top bar: search + compose */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)', minHeight: 52 }}
        >
          <div
            className="flex items-center gap-1.5 flex-1 rounded-lg px-2.5 py-1.5 border"
            style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…  (/)"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--foreground)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="flex-shrink-0">
                <X className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </div>
          {!isReadOnly && (
            <button
              onClick={() => setShowCompose(true)}
              title="Compose (c)"
              aria-label="Compose new message"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('messaging_extra.compose')}</span>
            </button>
          )}
        </div>

        {/* Bulk toolbar */}
        {!loading && !error && filtered.length > 0 && !isReadOnly && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 border-b flex-shrink-0"
            style={{
              borderColor: 'var(--border)',
              background: someSelected ? BRAND_T : 'rgba(248,249,250,0.6)',
              minHeight: 36,
            }}
          >
            <button
              onClick={toggleSelectAll}
              title={allSelected ? 'Deselect all' : 'Select all'}
              className="p-1 rounded transition-colors flex-shrink-0 hover:bg-[var(--dash-nav-hover-bg)]"
            >
              {allSelected
                ? <CheckSquare className="h-3.5 w-3.5" style={{ color: BRAND }} />
                : <Square className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              }
            </button>

            {someSelected ? (
              <>
                <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
                  {selected.size} selected
                </span>
                <button
                  onClick={() => setSelected(new Set())}
                  title="Clear selection"
                  className="p-0.5 rounded"
                >
                  <X className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                </button>
                <div className="flex items-center gap-0.5">
                  <BulkButton icon={MailOpen}      title="Mark as read"  onClick={() => void handleBulkMarkRead()} />
                  <BulkButton icon={Star}           title="Star all"      onClick={() => void handleBulkStar()} />
                  {folder === 'trash'
                    ? <BulkButton icon={ArchiveRestore} title="Restore all"   onClick={() => void handleBulkRestore()} />
                    : folder === 'archive'
                      ? <BulkButton icon={ArchiveRestore} title="Restore to inbox" onClick={() => void handleBulkArchive()} />
                      : <BulkButton icon={Archive}        title="Archive all"  onClick={() => void handleBulkArchive()} />
                  }
                  <BulkButton
                    icon={Trash2}
                    title={folder === 'trash' ? 'Delete permanently' : 'Move to trash'}
                    onClick={() => void handleBulkTrash()}
                    destructive
                  />
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {filtered.length} conversation{filtered.length !== 1 ? 's' : ''}
              </span>
            )}

            <div className="ml-auto">
              <button
                onClick={() => { setLoading(true); setError(false); setRefreshKey((k) => k + 1); }}
                title="Refresh"
                aria-label="Refresh inbox"
                className="p-1 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  style={{ color: 'var(--muted-foreground)' }}
                />
              </button>
            </div>
          </div>
        )}

        {/* Conversation list (scrollable) — loading bar overlays stale content */}
        <div className="flex-1 overflow-y-auto relative" ref={listRef}>

          {/* Top loading bar: visible while fetching, never causes layout shift */}
          {loading && (
            <div className="absolute top-0 left-0 right-0 z-10" style={{ height: 2, background: 'var(--card)' }}>
              <div
                className="h-full animate-pulse"
                style={{ background: BRAND, width: '60%', transition: 'width 0.8s ease' }}
              />
            </div>
          )}

          {/* ── Announcements folder ── */}
          {folder === 'announcements' && (
            error ? (
              <ErrorState onRetry={() => { setLoading(true); setError(false); setRefreshKey((k) => k + 1); }} />
            ) : !loading && announcements.length === 0 ? (
              <EmptyFolderState EmptyIcon={EmptyIcon} message={emptyMessages[folder] ?? 'Empty'} />
            ) : (
              <AnnouncementList announcements={announcements} />
            )
          )}

          {/* ── All other folders ── */}
          {folder !== 'announcements' && (
            error ? (
              <ErrorState onRetry={() => { setLoading(true); setError(false); setRefreshKey((k) => k + 1); }} />
            ) : !loading && filtered.length === 0 ? (
              <EmptyFolderState EmptyIcon={EmptyIcon} message={search ? 'No results' : (emptyMessages[folder] ?? 'Empty')} />
            ) : (
              <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                {filtered.map((conv) => (
                  <MessageRow
                    key={conv.id}
                    conversation={conv}
                    isSelected={selected.has(conv.id)}
                    isStarred={conv.is_starred}
                    isActive={selectedConv?.id === conv.id}
                    isInArchive={folder === 'archive'}
                    currentUserId={currentUserId}
                    folder={folder}
                    onSelect={toggleSelect}
                    onStar={(id, e) => void handleStar(id, e)}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    onRestore={folder === 'trash' ? handleRestoreFromTrash : undefined}
                    onMarkImportant={handleImportant}
                    onMarkRead={handleMarkRead}
                    onMarkUnread={handleMarkUnread}
                    onClick={openConversation}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Right pane: thread viewer ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--background)' }}>
        {selectedConv ? (
          <div className="flex flex-col h-full overflow-hidden">
            <ThreadView
              conversation={selectedConv}
              currentUserId={currentUserId}
              onBack={handleBack}
              onArchive={handleConvArchived}
              refreshSignal={threadRefreshSignal}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(22,163,74,0.08)' }}
            >
              <Mail className="h-7 w-7" style={{ color: BRAND }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Select a conversation
            </p>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Choose a message from the list to read it.
            </p>
            {!isReadOnly && (
              <button
                onClick={() => setShowCompose(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: BRAND }}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('messaging_extra.compose')}  (c)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Floating compose ────────────────────────────────────────────────── */}
      {showCompose && (
        <FloatingCompose
          onClose={() => setShowCompose(false)}
          onCreated={handleConvCreated}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        Could not load messages
      </p>
      <button
        onClick={onRetry}
        className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ color: '#16a34a' }}
      >
        Try again
      </button>
    </div>
  );
}

function EmptyFolderState({ EmptyIcon, message }: { EmptyIcon: ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 gap-3">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(107,114,128,0.08)' }}
      >
        <EmptyIcon className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
        {message}
      </p>
    </div>
  );
}

function AnnouncementList({ announcements }: { announcements: Announcement[] }) {
  return (
    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
      {announcements.map((ann) => (
        <div
          key={ann.id}
          className="px-4 py-3 flex flex-col gap-1"
          style={{ background: ann.is_urgent ? 'rgba(239,68,68,0.04)' : undefined }}
        >
          <div className="flex items-start gap-1.5 flex-wrap">
            {ann.is_pinned && <Pin className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />}
            {ann.is_urgent && <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: '#dc2626' }} />}
            <p className="text-sm font-semibold flex-1 leading-tight" style={{ color: 'var(--foreground)' }}>
              {ann.title}
            </p>
            <time className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              {format(new Date(ann.published_at ?? ann.created_at), 'MMM d')}
            </time>
          </div>
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: 'var(--muted-foreground)' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ann.body, SAFE_MESSAGE_CONFIG) }}
          />
        </div>
      ))}
    </div>
  );
}
