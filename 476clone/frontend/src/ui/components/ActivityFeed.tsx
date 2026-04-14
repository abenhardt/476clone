/**
 * ActivityFeed.tsx
 *
 * Unified activity feed for admin dashboards. Renders two item types:
 *
 *   • message  — inbox conversation; shows sender avatar, name, subject,
 *                body preview, and an unread indicator
 *   • application — status-change event; shows status icon, camper name,
 *                   event description, and session context
 *
 * Design principles:
 *   - Unread messages use a left accent border + subtle background so the
 *     admin can triage without clicking.
 *   - Sender name is always visible — "Help" with no author is useless.
 *   - Body preview is always shown (HTML-stripped) so context is instant.
 *   - Visual weight tracks urgency: bold = needs attention, normal = FYI.
 */

import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle, XCircle, Clock, FileText,
  ChevronRight, MessageSquare, Settings,
} from 'lucide-react';

import { Avatar, avatarBg } from '@/ui/components/Avatar';
import type { Conversation } from '@/features/messaging/api/messaging.api';
import type { Application } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityItem =
  | { kind: 'message';     conv: Conversation; ts: number }
  | { kind: 'application'; app: Application;   ts: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip HTML tags and decode common entities for body previews. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function applicationIcon(status: string): typeof FileText {
  switch (status) {
    case 'approved':     return CheckCircle;
    case 'rejected':     return XCircle;
    case 'waitlisted':
    case 'under_review': return Clock;
    default:             return FileText;
  }
}

function applicationIconColor(status: string): string {
  switch (status) {
    case 'approved':     return 'var(--forest-green)';
    case 'rejected':     return 'var(--destructive)';
    case 'waitlisted':   return '#d97706';
    case 'under_review': return '#2563eb';
    default:             return 'var(--ember-orange)';
  }
}

function applicationLabel(status: string, camperName: string): string {
  switch (status) {
    case 'approved':     return `${camperName}'s application approved`;
    case 'rejected':     return `${camperName}'s application not approved`;
    case 'waitlisted':   return `${camperName} added to waitlist`;
    case 'under_review': return `${camperName}'s application under review`;
    case 'submitted':    return `New application — ${camperName}`;
    default:             return `Application updated — ${camperName}`;
  }
}

// ─── Message item ─────────────────────────────────────────────────────────────

function MessageItem({ conv, inboxPath }: { conv: Conversation; inboxPath: string }) {
  const unread    = conv.unread_count > 0;
  const sender    = conv.last_message?.sender;
  const senderName = sender?.name ?? conv.participants.find((p) => p.role === 'applicant')?.name ?? 'Unknown sender';
  const avatarSrc  = sender?.avatar_url ?? null;
  const preview    = conv.last_message ? stripHtml(conv.last_message.body) : '';
  const subject    = conv.subject ?? 'New message';
  const timeAgo    = formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true });
  const isSystem   = conv.is_system_generated;

  return (
    <li
      style={unread ? {
        borderLeft: '2px solid #2563eb',
        background: 'rgba(37,99,235,0.04)',
      } : {
        borderLeft: '2px solid transparent',
      }}
    >
      <Link
        to={inboxPath}
        state={{ conversationId: conv.id }}
        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ textDecoration: 'none' }}
      >
        {/* Avatar or system icon */}
        <div className="flex-shrink-0 mt-0.5 relative">
          {isSystem ? (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(107,114,128,0.12)' }}
            >
              <Settings className="h-3.5 w-3.5" style={{ color: '#6b7280' }} />
            </div>
          ) : (
            <Avatar
              src={avatarSrc}
              name={senderName}
              size="sm"
              fallbackColor={avatarBg(senderName)}
            />
          )}
          {/* Unread dot — overlays bottom-right of avatar */}
          {unread && (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
              style={{ background: '#2563eb', borderColor: 'var(--card)' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: sender + timestamp */}
          <div className="flex items-baseline justify-between gap-2">
            <p
              className="text-xs truncate"
              style={{
                color: 'var(--foreground)',
                fontWeight: unread ? 600 : 500,
              }}
            >
              {isSystem ? 'System' : senderName}
            </p>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              {timeAgo}
            </span>
          </div>

          {/* Row 2: subject */}
          <p
            className="text-xs truncate mt-0.5"
            style={{
              color: unread ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: unread ? 500 : 400,
            }}
          >
            {subject}
          </p>

          {/* Row 3: body preview */}
          {preview && (
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: 'var(--muted-foreground)', opacity: 0.75 }}
            >
              {preview}
            </p>
          )}
        </div>

        <ChevronRight
          className="h-3.5 w-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ color: 'var(--foreground)' }}
        />
      </Link>
    </li>
  );
}

// ─── Application item ─────────────────────────────────────────────────────────

function ApplicationItem({ app }: { app: Application }) {
  const name    = app.camper?.full_name ?? `Camper #${app.camper_id}`;
  const Icon    = applicationIcon(app.status);
  const color   = applicationIconColor(app.status);
  const label   = applicationLabel(app.status, name);
  const session = app.session?.name ?? null;
  const timeAgo = formatDistanceToNow(new Date(app.updated_at ?? app.created_at), { addSuffix: true });

  return (
    <li style={{ borderLeft: '2px solid transparent' }}>
      <Link
        to={ROUTES.ADMIN_APPLICATION_DETAIL(app.id)}
        className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        style={{ textDecoration: 'none' }}
      >
        {/* Status icon */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${color}16` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: label + timestamp */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {label}
            </p>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
              {timeAgo}
            </span>
          </div>

          {/* Row 2: session context */}
          {session && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)', opacity: 0.75 }}>
              {session}
            </p>
          )}
        </div>

        <ChevronRight
          className="h-3.5 w-3.5 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-50 transition-opacity"
          style={{ color: 'var(--foreground)' }}
        />
      </Link>
    </li>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFeed() {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-2">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.05)' }}
      >
        <MessageSquare className="h-4 w-4" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
      </div>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No recent activity</p>
    </div>
  );
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────

interface ActivityFeedProps {
  items: ActivityItem[];
  /** Path to the portal's inbox — defaults to /admin/inbox. Pass the correct
   *  prefix when rendering in non-admin portals (e.g. /super-admin/inbox). */
  inboxPath?: string;
}

export function ActivityFeed({ items, inboxPath = '/admin/inbox' }: ActivityFeedProps) {
  if (items.length === 0) return <EmptyFeed />;

  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {items.map((item) => {
        if (item.kind === 'message') {
          return <MessageItem key={`conv-${item.conv.id}`} conv={item.conv} inboxPath={inboxPath} />;
        }
        return <ApplicationItem key={`app-${item.app.id}`} app={item.app} />;
      })}
    </ul>
  );
}
