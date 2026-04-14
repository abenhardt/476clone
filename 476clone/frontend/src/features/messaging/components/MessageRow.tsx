/**
 * MessageRow.tsx
 *
 * Individual message row in the inbox list view.
 * Gmail-level interaction:
 *   - Checkbox (hidden until hover or selected)
 *   - Star/flag toggle
 *   - Sender, subject, preview, category badge, timestamp
 *   - Hover reveals action icons: Archive, Delete, More (replaces timestamp)
 *   - More menu via Popover: mark read/unread, archive, delete
 */

import { useRef, useState, type MouseEvent } from 'react';
import {
  Archive, ArchiveRestore, Trash2, MoreHorizontal, Star, CheckSquare, Square, Bot, AlertCircle,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { Popover } from '@/ui/overlay/Popover';
import { Avatar, avatarBg } from '@/ui/components/Avatar';
import type { Conversation, InboxFolder } from '@/features/messaging/api/messaging.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (d.getFullYear() === new Date().getFullYear()) return format(d, 'MMM d');
  return format(d, 'MM/dd/yy');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MessageRowProps {
  conversation: Conversation;
  isSelected: boolean;
  isStarred: boolean;
  /** Highlights the row when this conversation is open in the thread pane. */
  isActive?: boolean;
  /** When true, the archive action becomes "Unarchive". */
  isInArchive?: boolean;
  currentUserId?: number;
  /** Current folder — controls whether we show sender name (inbox) or recipient name (sent). */
  folder?: InboxFolder;
  onSelect: (id: number, e: MouseEvent) => void;
  onStar: (id: number, e: MouseEvent) => void;
  onArchive: (id: number, e: MouseEvent) => void;
  onDelete: (id: number, e: MouseEvent) => void;
  /** If provided, shows a "Restore" option (for trash folder). */
  onRestore?: (id: number, e: MouseEvent) => void;
  /** Toggles the important state. */
  onMarkImportant?: (id: number) => void;
  onMarkRead?: (id: number) => void;
  onMarkUnread?: (id: number) => void;
  onClick: (conv: Conversation) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MessageRow({
  conversation: conv,
  isSelected,
  isStarred,
  isActive = false,
  isInArchive = false,
  currentUserId,
  folder,
  onSelect,
  onStar,
  onArchive,
  onDelete,
  onRestore,
  onMarkImportant,
  onMarkRead,
  onMarkUnread,
  onClick,
}: MessageRowProps) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const isSystem = conv.is_system_generated === true;
  const isUnread = (conv.unread_count ?? 0) > 0;
  const others   = conv.participants.filter((p) => p.id !== currentUserId);

  // In Sent folder, show recipient names ("To: Jack Frost") because the viewer IS the sender.
  // In all other folders, show the sender's name ("who messaged me?").
  const iSentThis = folder === 'sent'
    || conv.last_message?.sender_id === currentUserId
    || (conv.last_message == null && conv.created_by_id === currentUserId);

  const senderName = isSystem
    ? 'Camp Burnt Gin'
    : iSentThis
      ? (others.length > 0
          ? `To: ${others.map((p) => p.name).join(', ')}`
          : 'To: Unknown')
      : (conv.last_message?.sender?.name ?? others[0]?.name ?? 'Unknown');

  const senderAvatar = isSystem
    ? null
    : iSentThis
      ? (others[0]?.avatar_url ?? null)
      : (conv.last_message?.sender?.avatar_url ?? others[0]?.avatar_url ?? null);
  const preview    = conv.last_message?.body
    ? conv.last_message.body.replace(/<[^>]*>/g, '').slice(0, 90)
    : '—';
  const subject  = conv.subject ?? '(No subject)';
  const lastTime = conv.last_message?.created_at ?? conv.created_at;

  const rowBg = isSelected || isActive
    ? BRAND_T
    : isUnread ? 'rgba(22,163,74,0.03)' : 'var(--card)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(conv)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(conv); }}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group"
      style={{ background: rowBg }}
      onMouseEnter={(e) => {
        if (!isSelected && !isActive)
          (e.currentTarget as HTMLElement).style.background = 'var(--dash-nav-hover-bg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = rowBg;
      }}
      data-testid="message-row"
    >
      {/* Checkbox — hidden until hover or selected */}
      <button
        type="button"
        onClick={(e) => onSelect(conv.id, e)}
        className="flex-shrink-0 transition-opacity"
        style={{ opacity: isSelected ? 1 : undefined }}
        aria-label={isSelected ? 'Deselect conversation' : 'Select conversation'}
      >
        {isSelected
          ? <CheckSquare className="h-4 w-4 opacity-100" style={{ color: BRAND }} />
          : <Square className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {/* Star */}
      <button
        type="button"
        onClick={(e) => onStar(conv.id, e)}
        className="flex-shrink-0"
        aria-label={isStarred ? 'Remove star' : 'Star conversation'}
      >
        <Star
          className="h-4 w-4 transition-colors"
          style={{
            color: isStarred ? '#f59e0b' : 'var(--border)',
            fill:  isStarred ? '#f59e0b' : 'transparent',
          }}
        />
      </button>

      {/* Avatar — system convs show Bot icon */}
      {isSystem ? (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 36, height: 36, background: 'rgba(22,163,74,0.12)' }}
        >
          <Bot className="h-4 w-4" style={{ color: BRAND }} />
        </div>
      ) : (
        <Avatar src={senderAvatar} name={senderName} size="md" fallbackColor={avatarBg(senderName)} />
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-sm truncate"
            style={{ fontWeight: isUnread ? 700 : 500, color: 'var(--foreground)' }}
          >
            {senderName}
          </span>
          {conv.is_important && (
            <AlertCircle className="h-3 w-3 flex-shrink-0" style={{ color: '#f59e0b' }} />
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-sm truncate flex-shrink-0 max-w-[40%]"
            style={{ fontWeight: isUnread ? 600 : 400, color: 'var(--foreground)' }}
          >
            {subject}
          </span>
          <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            — {preview}
          </span>
        </div>
      </div>

      {/* Right side: timestamp/dot or action icons */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Timestamp + unread dot — hidden on hover */}
        <div className="relative flex items-center gap-2.5">
          <div className={`flex items-center gap-2.5 transition-opacity duration-150 ${!isSystem ? 'group-hover:opacity-0' : ''}`}>
            <time
              className="text-xs w-14 text-right tabular-nums"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {relativeTime(lastTime)}
            </time>
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: isUnread ? BRAND : 'transparent' }}
            />
          </div>

          {/* Action icons — visible on hover, suppressed for system convs */}
          {!isSystem && (
            <div
              role="presentation"
              className="absolute right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => onArchive(conv.id, e)}
                title={isInArchive ? 'Unarchive' : 'Archive'}
                aria-label={isInArchive ? 'Unarchive conversation' : 'Archive conversation'}
                className="p-1 rounded transition-colors hover:bg-[var(--border)]"
                style={{ color: 'var(--muted-foreground)' }}
                data-testid="row-archive-btn"
              >
                {isInArchive
                  ? <ArchiveRestore className="h-3.5 w-3.5" />
                  : <Archive className="h-3.5 w-3.5" />
                }
              </button>
              <button
                type="button"
                onClick={(e) => onDelete(conv.id, e)}
                title="Delete"
                aria-label="Delete conversation"
                className="p-1 rounded transition-colors hover:bg-[var(--border)]"
                style={{ color: 'var(--muted-foreground)' }}
                data-testid="row-delete-btn"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                ref={moreButtonRef}
                type="button"
                onClick={(e) => { e.stopPropagation(); setMoreOpen((v) => !v); }}
                title="More options"
                aria-label="More options"
                className="p-1 rounded transition-colors hover:bg-[var(--border)]"
                style={{ color: 'var(--muted-foreground)' }}
                data-testid="row-more-btn"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* More menu popover — only for non-system convs */}
      {!isSystem && (
        <Popover
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          anchorRef={moreButtonRef}
          placement="bottom-right"
        >
          <div className="py-1 min-w-[180px]">
            {isUnread ? (
              <button
                type="button"
                onClick={() => { onMarkRead?.(conv.id); setMoreOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                Mark as read
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { onMarkUnread?.(conv.id); setMoreOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                Mark as unread
              </button>
            )}
            {onMarkImportant && (
              <button
                type="button"
                onClick={() => { onMarkImportant(conv.id); setMoreOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                {conv.is_important ? 'Remove from important' : 'Mark as important'}
              </button>
            )}
            <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
            {onRestore ? (
              <button
                type="button"
                onClick={(e) => { onRestore(conv.id, e); setMoreOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { onArchive(conv.id, e); setMoreOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
              >
                {isInArchive ? 'Unarchive' : 'Archive'}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { onDelete(conv.id, e); setMoreOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ color: 'var(--destructive)' }}
            >
              {onRestore ? 'Delete permanently' : 'Move to trash'}
            </button>
          </div>
        </Popover>
      )}
    </div>
  );
}
