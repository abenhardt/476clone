/**
 * ThreadView.tsx
 *
 * Conversation thread view — extracted from InboxPage for clean separation.
 * Shows the message list, thread header, and reply compose box.
 *
 * Note: does NOT have its own entry animation — parent InboxPage wraps it
 * in AnimatePresence mode="wait" for the crossfade transition between views.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';

// Strict DOMPurify config for message body rendering.
// Allows only safe inline formatting tags — no <style>, no <script>,
// no <img> (prevents external pixel tracking), no event attributes.
// This protects against CSS injection, clickjacking UI confusion,
// and IP-leaking image requests even if server content is untrusted.
const SAFE_MESSAGE_CONFIG: DOMPurifyConfig = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  FORCE_BODY: true,
};
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft, Archive, Paperclip, Send, X, Download, Bot, Eye, FileText, Reply, ReplyAll } from 'lucide-react';
import {
  getMessages, sendMessage, replyToMessage, replyAllToMessage,
  archiveConversation, unarchiveConversation,
  downloadAttachment, getAttachmentBlobUrl,
  type Conversation, type Message, type MessageAttachment,
} from '@/features/messaging/api/messaging.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { Avatar, avatarBg } from '@/ui/components/Avatar';
import { RichTextEditor } from './editor/RichTextEditor';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = '#16a34a';

function formatFileSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${Math.round(bytes / 1_024)} KB`;
  return `${bytes} B`;
}

function getFileTypeStyle(mimeType: string): { color: string; isImage: boolean; isPdf: boolean } {
  if (mimeType?.startsWith('image/'))  return { color: '#2563eb', isImage: true,  isPdf: false };
  if (mimeType === 'application/pdf')  return { color: '#dc2626', isImage: false, isPdf: true  };
  if (mimeType?.includes('word') || mimeType?.includes('document'))
                                       return { color: '#7c3aed', isImage: false, isPdf: false };
  return                                      { color: '#6b7280', isImage: false, isPdf: false };
}

// ─── RecipientSummary ─────────────────────────────────────────────────────────

import type { MessageRecipient } from '@/features/messaging/api/messaging.api';

/**
 * Renders a compact TO/CC summary line under a message bubble.
 * BCC recipients are never shown here — the server already filtered them out
 * for non-senders, so this component only renders what it receives.
 */
function RecipientSummary({ recipients, isMine }: { recipients: MessageRecipient[]; isMine: boolean }) {
  const { t } = useTranslation();
  const toList  = recipients.filter((r) => r.recipient_type === 'to');
  const ccList  = recipients.filter((r) => r.recipient_type === 'cc');
  // Client-side BCC guard: only show BCC entries when this is the sender's own message.
  // The server already filters BCC from non-senders, but this adds defence-in-depth:
  // if the server ever returns BCC entries to a non-sender due to a bug, we will not
  // display them. isMine === false means someone else sent this; hide BCC unconditionally.
  const bccList = isMine ? recipients.filter((r) => r.recipient_type === 'bcc') : [];

  if (toList.length === 0 && ccList.length === 0 && bccList.length === 0) return null;

  function nameList(list: MessageRecipient[]) {
    return list.map((r) => r.user?.name ?? `User ${r.user_id}`).join(', ');
  }

  const textColor = isMine ? 'rgba(255,255,255,0.60)' : 'var(--muted-foreground)';

  return (
    <div className="text-xs mt-0.5 leading-relaxed" style={{ color: textColor }}>
      {toList.length > 0 && (
        <span>
          <span className="font-medium">To:</span> {nameList(toList)}
          {(ccList.length > 0 || bccList.length > 0) && ' · '}
        </span>
      )}
      {ccList.length > 0 && (
        <span>
          <span className="font-medium">Cc:</span> {nameList(ccList)}
          {bccList.length > 0 && ' · '}
        </span>
      )}
      {bccList.length > 0 && (
        <span>
          <span className="font-medium">{t('messaging_extra.bcc_label')}</span> {nameList(bccList)}
        </span>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ThreadViewProps {
  conversation: Conversation;
  currentUserId?: number;
  onBack: () => void;
  onArchive: (id: number) => void;
  /** Incremented by InboxPage when a real-time event arrives for this conversation.
   *  Triggers a silent background re-fetch of the message list. */
  refreshSignal?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ThreadView({ conversation, currentUserId, onBack, onArchive, refreshSignal }: ThreadViewProps) {
  const isSystem = conversation.is_system_generated === true;

  const [messages, setMessages]             = useState<Message[]>([]);
  const [loading, setLoading]               = useState(true);
  const [replyHtml, setReplyHtml]           = useState('');
  const [editorKey, setEditorKey]           = useState(0);
  const [sending, setSending]               = useState(false);
  const [attachments, setAttachments]       = useState<File[]>([]);
  // Reply context: which message we're replying to, and how
  const [replyingTo, setReplyingTo]         = useState<Message | null>(null);
  const [replyMode, setReplyMode]           = useState<'reply' | 'reply_all'>('reply');
  const [archiving, setArchiving]           = useState(false);
  const [previewUrls, setPreviewUrls]       = useState<Record<number, string>>({});
  const [previewLoadingIds, setPreviewLoadingIds] = useState<Set<number>>(new Set());
  const [previewModal, setPreviewModal]     = useState<{ url: string; mimeType: string; name: string } | null>(null);
  // Pagination: oldest page the user has loaded so far (1 = have loaded everything)
  const [oldestPageLoaded, setOldestPageLoaded] = useState(1);
  const [loadingOlder, setLoadingOlder]     = useState(false);
  const fileInputRef          = useRef<HTMLInputElement>(null);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const loadingPreviewsRef    = useRef<Set<number>>(new Set());
  const blobUrlsRef           = useRef<string[]>([]);
  // Tracks which conversation's messages are currently loaded so the fetch
  // effect can distinguish a fresh open (needs spinner) from a background
  // refresh triggered by a real-time signal (should be silent).
  const messagesConvRef       = useRef<number | null>(null);

  // Load messages when conversation changes or a real-time refresh is signalled.
  // We always load the LAST page first so the user sees the most recent messages
  // immediately without scrolling. "Load older messages" prepends earlier pages.
  useEffect(() => {
    let isCancelled = false;
    const silent = messages.length > 0 && conversation.id === messagesConvRef.current;
    const hadUnread = conversation.unread_count > 0;
    if (!silent) {
      setLoading(true);
      setOldestPageLoaded(1);
    }
    messagesConvRef.current = conversation.id;

    // Step 1: Fetch page 1 to discover the total page count, then fetch the last page.
    // Returns a chained Promise so .catch() covers both the initial fetch and the
    // optional last-page fetch when multi-page conversations are loaded.
    getMessages(conversation.id, { page: 1 })
      .then((res) => {
        if (isCancelled) return Promise.resolve();
        const last = res.meta.last_page;
        if (last <= 1) {
          // Only one page — we already have everything
          setMessages(res.data);
          setOldestPageLoaded(1);
          if (!silent && hadUnread) {
            window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
          }
          return Promise.resolve();
        }
        // Fetch the last page to show the most recent messages
        return getMessages(conversation.id, { page: last }).then((lastRes) => {
          if (!isCancelled) {
            setMessages(lastRes.data);
            setOldestPageLoaded(last);
            if (!silent && hadUnread) {
              window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
            }
          }
        });
      })
      .catch(() => {
        if (!isCancelled && !silent) toast.error('Could not load messages.');
      })
      .finally(() => { if (!isCancelled) setLoading(false); });
    return () => { isCancelled = true; };
  // refreshSignal is included so real-time events trigger a re-fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, refreshSignal]);

  // Load a page of older messages and prepend it to the thread.
  async function loadOlderMessages() {
    if (loadingOlder || oldestPageLoaded <= 1) return;
    const prevPage = oldestPageLoaded - 1;
    setLoadingOlder(true);
    try {
      const res = await getMessages(conversation.id, { page: prevPage });
      setMessages((prev) => [...res.data, ...prev]);
      setOldestPageLoaded(prevPage);
    } catch {
      toast.error('Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Revoke all blob URLs when the conversation changes or component unmounts
  useEffect(() => {
    const loadingPreviews = loadingPreviewsRef.current;
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      loadingPreviews.clear();
      setPreviewUrls({});
      setPreviewModal(null);
      setPreviewLoadingIds(new Set());
    };
  }, [conversation.id]);

  // Eager-load image attachment previews via authenticated fetch.
  // PDFs are loaded on-demand via handlePreview to avoid fetching large files unnecessarily.
  useEffect(() => {
    let isStale = false;
    for (const msg of messages) {
      for (const att of msg.attachments ?? []) {
        if (!att.mime_type?.startsWith('image/')) continue;
        if (loadingPreviewsRef.current.has(att.id)) continue;
        loadingPreviewsRef.current.add(att.id);
        const msgId = msg.id;
        const attId = att.id;
        getAttachmentBlobUrl(msgId, attId)
          .then((url) => {
            blobUrlsRef.current.push(url);
            if (!isStale) {
              setPreviewUrls((prev) => ({ ...prev, [attId]: url }));
            } else {
              URL.revokeObjectURL(url);
            }
          })
          .catch(() => {
            loadingPreviewsRef.current.delete(attId);
          });
      }
    }
    return () => { isStale = true; };
  }, [messages]);

  async function handleSend() {
    const plainText = replyHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText && attachments.length === 0) return;
    setSending(true);
    try {
      let msg: Message;
      const files = attachments.length > 0 ? attachments : undefined;

      if (replyingTo) {
        // Threaded reply: use server-side recipient resolution for BCC safety
        if (replyMode === 'reply_all') {
          msg = await replyAllToMessage(conversation.id, replyingTo.id, replyHtml, files);
        } else {
          msg = await replyToMessage(conversation.id, replyingTo.id, replyHtml, files);
        }
      } else {
        // Plain send in the thread (no specific message being replied to)
        msg = await sendMessage(conversation.id, replyHtml, files);
      }

      setMessages((p) => [...p, msg]);
      setReplyHtml('');
      setEditorKey((k) => k + 1);
      setAttachments([]);
      setReplyingTo(null); // Clear reply context after successful send
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg && msg !== 'Validation failed.' ? msg : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  function startReply(msg: Message) {
    setReplyingTo(msg);
    setReplyMode('reply');
  }

  function startReplyAll(msg: Message) {
    setReplyingTo(msg);
    setReplyMode('reply_all');
  }

  function cancelReply() {
    setReplyingTo(null);
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      if (conversation.archived_at) {
        await unarchiveConversation(conversation.id);
        toast.success('Conversation restored to inbox.');
      } else {
        await archiveConversation(conversation.id);
        toast.success('Conversation archived.');
      }
      onArchive(conversation.id);
    } catch {
      toast.error('Action failed.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleDownload(messageId: number, att: MessageAttachment) {
    const name = att.original_filename || 'attachment';
    try {
      await downloadAttachment(messageId, att.id, name);
    } catch {
      toast.error(`Failed to download ${name}.`);
    }
  }

  async function handlePreview(messageId: number, att: MessageAttachment) {
    // Use cached blob URL if already loaded (images are eager-loaded)
    let url = previewUrls[att.id];
    if (!url) {
      setPreviewLoadingIds((prev) => new Set([...prev, att.id]));
      try {
        url = await getAttachmentBlobUrl(messageId, att.id);
        blobUrlsRef.current.push(url);
        setPreviewUrls((prev) => ({ ...prev, [att.id]: url }));
      } catch {
        toast.error(`Could not preview ${att.original_filename || 'file'}.`);
        return;
      } finally {
        setPreviewLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(att.id);
          return next;
        });
      }
    }
    setPreviewModal({ url, mimeType: att.mime_type, name: att.original_filename || 'Attachment' });
  }

  const others        = conversation.participants.filter((p) => p.id !== currentUserId);
  const displayName   = isSystem ? 'Camp Burnt Gin' : (others.length > 0 ? others[0].name : 'Conversation');
  const displayAvatar = isSystem ? null : (others[0]?.avatar_url ?? null);

  return (
    <div className="flex flex-col h-full">

      {/* ── Thread header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          aria-label="Back to inbox"
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
        </button>

        {isSystem ? (
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{ width: 32, height: 32, background: 'rgba(22,163,74,0.12)' }}
          >
            <Bot className="h-4 w-4" style={{ color: BRAND }} />
          </div>
        ) : (
          <Avatar src={displayAvatar} name={displayName} size="md" fallbackColor={avatarBg(displayName)} />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
            {conversation.subject ?? displayName}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
            {isSystem ? 'Automated system notification' : conversation.participants.map((p) => p.name).join(', ')}
          </p>
        </div>

        {!isSystem && (
          <button
            onClick={() => void handleArchive()}
            disabled={archiving}
            title={conversation.archived_at ? 'Restore to inbox' : 'Archive'}
            aria-label={conversation.archived_at ? 'Restore to inbox' : 'Archive conversation'}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
          >
            <Archive className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeletons.Row key={i} />)}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm py-12" style={{ color: 'var(--muted-foreground)' }}>
            No messages yet.
          </p>
        ) : (
          <>
            {/* Load older messages button — only shown when earlier pages exist */}
            {oldestPageLoaded > 1 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  className="text-xs px-4 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--muted-foreground)',
                    background: 'var(--card)',
                  }}
                >
                  {loadingOlder ? 'Loading…' : `Load older messages (${oldestPageLoaded - 1} page${oldestPageLoaded - 1 > 1 ? 's' : ''} earlier)`}
                </button>
              </div>
            )}
          {messages.map((msg) => {
            const isSystemMsg = msg.sender_id === null;
            const isMine      = !isSystemMsg && msg.sender_id === currentUserId;
            const senderName  = isSystemMsg ? 'Camp Burnt Gin' : (msg.sender?.name ?? 'Unknown');
            return (
              <div
                key={msg.id}
                className={isSystemMsg ? 'flex justify-center' : `group flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
              >
                {/* System message: centered notification style */}
                {isSystemMsg ? (
                  <div
                    className="w-full max-w-lg px-4 py-3 rounded-xl text-sm leading-relaxed message-body"
                    style={{
                      background: 'rgba(22,163,74,0.06)',
                      border: '1px solid rgba(22,163,74,0.18)',
                      color: 'var(--foreground)',
                    }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body, SAFE_MESSAGE_CONFIG) }}
                  />
                ) : (
                  <>
                    {!isMine && <Avatar src={msg.sender?.avatar_url} name={senderName} size="md" fallbackColor={avatarBg(senderName)} />}
                    <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : ''}`}>
                      {!isMine && (
                        <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          {senderName.split(' ')[0]}
                        </p>
                      )}
                      <div
                        className="px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed message-body"
                        style={{
                          background: isMine ? BRAND : 'var(--glass-medium)',
                          color: isMine ? '#fff' : 'var(--foreground)',
                          borderBottomRightRadius: isMine ? 4 : undefined,
                          borderBottomLeftRadius:  isMine ? undefined : 4,
                        }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.body, SAFE_MESSAGE_CONFIG) }}
                      />
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`flex flex-col gap-1.5 mt-1.5 ${isMine ? 'items-end' : 'items-start'}`}>
                          {msg.attachments.map((att) => {
                            const { color, isImage, isPdf } = getFileTypeStyle(att.mime_type ?? '');
                            const isPreviewable  = isImage || isPdf;
                            const preview        = previewUrls[att.id];
                            const previewLoading = previewLoadingIds.has(att.id);
                            const borderAlpha    = isMine ? 'rgba(255,255,255,0.20)' : 'var(--border)';
                            return (
                              <div
                                key={att.id}
                                className="rounded-xl overflow-hidden flex-shrink-0"
                                style={{
                                  width: 256,
                                  border: `1px solid ${borderAlpha}`,
                                  background: isMine ? BRAND : 'var(--card)',
                                }}
                              >
                                {/* Image thumbnail (eager-loaded) */}
                                {isImage && preview && (
                                  <button
                                    type="button"
                                    className="w-full block p-0 border-0 bg-transparent cursor-zoom-in"
                                    onClick={() => setPreviewModal({ url: preview, mimeType: att.mime_type, name: att.original_filename || 'Attachment' })}
                                    aria-label={`Preview ${att.original_filename || 'image'}`}
                                  >
                                    <img
                                      src={preview}
                                      alt={att.original_filename || 'Image attachment'}
                                      className="w-full block object-cover"
                                      style={{ maxHeight: 160 }}
                                    />
                                  </button>
                                )}
                                {/* Placeholder while image blob loads */}
                                {isImage && !preview && (
                                  <div
                                    className="w-full flex items-center justify-center"
                                    style={{ height: 72, background: 'rgba(0,0,0,0.04)' }}
                                  >
                                    <Paperclip className="h-5 w-5 opacity-20" />
                                  </div>
                                )}

                                {/* File info row */}
                                <div className="flex items-center gap-2.5 px-3 py-2.5">
                                  {/* File-type badge */}
                                  <div
                                    className="flex-shrink-0 flex items-center justify-center rounded-lg"
                                    style={{
                                      width: 34, height: 34,
                                      background: isMine ? 'rgba(255,255,255,0.20)' : color + '1a',
                                      color: isMine ? '#fff' : color,
                                    }}
                                  >
                                    {isImage
                                      ? <Paperclip className="h-4 w-4" />
                                      : <FileText  className="h-4 w-4" />
                                    }
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-xs font-semibold truncate"
                                      style={{ color: isMine ? '#fff' : 'var(--foreground)' }}
                                    >
                                      {att.original_filename || 'Attachment'}
                                    </p>
                                    <p
                                      className="text-xs"
                                      style={{ color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--muted-foreground)' }}
                                    >
                                      {formatFileSize(att.file_size)}
                                    </p>
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div
                                  className="flex border-t"
                                  style={{ borderColor: borderAlpha }}
                                >
                                  {isPreviewable && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void handlePreview(msg.id, att)}
                                        disabled={previewLoading}
                                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
                                        style={{ color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--muted-foreground)' }}
                                        aria-label={`Preview ${att.original_filename || 'file'}`}
                                      >
                                        <Eye className="h-3 w-3" />
                                        {previewLoading ? '…' : 'Preview'}
                                      </button>
                                      <div className="w-px" style={{ background: borderAlpha }} />
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void handleDownload(msg.id, att)}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                                    style={{ color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--muted-foreground)' }}
                                    aria-label={`Download ${att.original_filename || 'file'}`}
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Recipient metadata — shows TO/CC summary for messages with explicit recipients */}
                      {msg.recipients && msg.recipients.length > 0 && (
                        <RecipientSummary recipients={msg.recipients} isMine={isMine} />
                      )}

                      {/* Reply type badge for reply/reply-all messages */}
                      {msg.reply_type && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{
                            background: msg.reply_type === 'reply_all'
                              ? 'rgba(37,99,235,0.10)' : 'rgba(22,163,74,0.10)',
                            color: msg.reply_type === 'reply_all' ? '#1d4ed8' : '#16a34a',
                          }}
                        >
                          {msg.reply_type === 'reply_all' ? 'Reply All' : 'Reply'}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <time className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(msg.created_at), 'h:mm a · MMM d')}
                        </time>
                        {/* Reply / Reply-All action buttons (non-system messages only) */}
                        {!isSystem && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startReply(msg)}
                              title="Reply to this message"
                              aria-label="Reply"
                              className="p-1 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                            >
                              <Reply className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startReplyAll(msg)}
                              title="Reply All to this message"
                              aria-label="Reply All"
                              className="p-1 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                            >
                              <ReplyAll className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply box / system notice / archived notice ───────────────────── */}
      {isSystem ? (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'rgba(22,163,74,0.04)' }}
        >
          <Bot className="h-3.5 w-3.5 flex-shrink-0" style={{ color: BRAND }} />
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            This is an automated system notification. Replies are not supported.
          </p>
        </div>
      ) : conversation.archived_at ? (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            This conversation is archived.
          </p>
          <button
            onClick={() => void handleArchive()}
            className="text-sm font-medium hover:underline"
            style={{ color: BRAND }}
          >
            Restore to inbox
          </button>
        </div>
      ) : (
        <div
          className="border-t flex-shrink-0 overflow-hidden"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {/* Reply context bar — shown when replying to a specific message */}
          {replyingTo && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 border-b"
              style={{
                borderColor: 'var(--border)',
                background: replyMode === 'reply_all'
                  ? 'rgba(37,99,235,0.06)' : 'rgba(22,163,74,0.06)',
              }}
            >
              {replyMode === 'reply_all'
                ? <ReplyAll className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#1d4ed8' }} />
                : <Reply    className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#16a34a' }} />
              }
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--muted-foreground)' }}>
                {replyMode === 'reply_all' ? 'Reply All to ' : 'Replying to '}
                <span style={{ color: 'var(--foreground)' }}>
                  {replyingTo.sender?.name ?? 'message'}
                </span>
              </span>
              <button
                type="button"
                onClick={cancelReply}
                aria-label="Cancel reply"
                className="p-0.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
          )}

          <RichTextEditor
            key={editorKey}
            onUpdate={setReplyHtml}
            placeholder={replyingTo
              ? (replyMode === 'reply_all' ? 'Write a reply all…' : 'Write a reply…')
              : 'Write a message…'
            }
            minHeight={80}
            maxHeight={160}
          />

          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              {attachments.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <Paperclip className="h-3 w-3" />
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Remove ${f.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Send row */}
          <div
            className="flex items-center justify-between px-3 py-2 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  const oversized = files.filter((f) => f.size > 10 * 1024 * 1024);
                  if (oversized.length > 0) {
                    toast.error(`File too large: "${oversized[0].name}". Maximum size is 10 MB.`);
                    e.target.value = '';
                    return;
                  }
                  setAttachments((p) => [...p, ...files]);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
                aria-label="Attach file"
                className="p-1.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              >
                <Paperclip className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{
                background: replyingTo && replyMode === 'reply_all'
                  ? '#1d4ed8' : BRAND,
              }}
            >
              {replyingTo
                ? (replyMode === 'reply_all'
                    ? <ReplyAll className="h-3.5 w-3.5" />
                    : <Reply    className="h-3.5 w-3.5" />)
                : <Send className="h-3.5 w-3.5" />
              }
              {sending ? 'Sending…' : (replyingTo
                ? (replyMode === 'reply_all' ? 'Reply All' : 'Reply')
                : 'Send'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Attachment preview modal ───────────────────────────────────────── */}
      {previewModal && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Preview ${previewModal.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setPreviewModal(null)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') setPreviewModal(null); }}
        >
          <div
            role="presentation"
            className="relative rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxWidth: '90vw', maxHeight: '90vh', background: 'var(--card)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {/* Preview content */}
            {previewModal.mimeType.startsWith('image/') ? (
              <img
                src={previewModal.url}
                alt={previewModal.name}
                style={{ maxWidth: '85vw', maxHeight: '78vh', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <iframe
                src={previewModal.url}
                title={previewModal.name}
                style={{ width: 'min(860px, 85vw)', height: '78vh', border: 'none', display: 'block' }}
              />
            )}
            {/* Footer bar */}
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-t flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-medium truncate flex-1" style={{ color: 'var(--foreground)' }}>
                {previewModal.name}
              </p>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0"
                style={{ color: 'var(--muted-foreground)' }}
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

