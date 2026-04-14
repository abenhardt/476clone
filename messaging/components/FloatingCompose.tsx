/**
 * FloatingCompose.tsx
 *
 * Gmail-style floating compose panel with TO / CC / BCC support.
 *
 * Layout (top → bottom):
 *   ┌─ Header ────────────────────────── [−] [⤢] [✕] ─┐
 *   ├─ To: [chips…] [input]    [Cc] [Bcc] ────────────┤
 *   ├─ Cc: [chips…] [input]  (visible after toggle) ───┤
 *   ├─ Bcc: [chips…] [input] (visible after toggle) ───┤
 *   ├─ Subject: ────────────────────── [Category ▾] ───┤
 *   │  Editor body (flex-1, scrollable)                 │
 *   │                                                   │
 *   ├─ Attachment chips (if any) ──────────────────────┤
 *   └─ [↑] [B][I][U]|[•][1.]|[🔗][😊]    [Send →] ───┘
 *
 * Key behaviors:
 *   - Cc/Bcc fields appear on click (like Gmail)
 *   - Each field has independent chip list + autocomplete
 *   - BCC recipients are passed with type='bcc' — server enforces privacy
 *   - Send flow: createConversation (all IDs) → sendMessage (with typed recipients)
 *   - Draft autosave: 1.5s debounce to localStorage
 *   - Close guard: ConfirmDialog when unsaved content
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X, Minus, Maximize2, Minimize2, Upload, Send } from 'lucide-react';
import {
  createConversation, sendMessage, searchInboxUsers, deleteConversation, leaveConversation,
  type Conversation, type ConversationParticipant,
  type MessageCategory, type NewConversationPayload, type RecipientEntry,
} from '@/features/messaging/api/messaging.api';
import { useRichEditor, EditorBody, EditorToolbar } from './editor/RichTextEditor';
import { ConfirmDialog } from '@/ui/overlay/ConfirmDialog';
import { Avatar, avatarBg } from '@/ui/components/Avatar';
import { ROLE_LABELS, type RoleName } from '@/shared/constants/roles';

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND   = '#16a34a';
const BRAND_T = 'rgba(22,163,74,0.10)';

const CC_COLOR  = 'rgba(37,99,235,0.10)';
const CC_TEXT   = '#1d4ed8';
const BCC_COLOR = 'rgba(124,58,237,0.10)';
const BCC_TEXT  = '#7c3aed';

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY = 'inbox_compose_draft';
interface Draft { subject: string; body: string }
// Use sessionStorage so drafts are tab-scoped and cleared on logout/tab close.
// localStorage would persist drafts across sessions, exposing PHI to the next user.
function saveDraft(d: Draft)       { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /**/ } }
function loadDraft(): Draft | null { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null; } catch { return null; } }
function clearDraft()              { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /**/ } }
/** Exported so external close paths (e.g. Escape key handler) can clear the draft
 *  without having to import the internal DRAFT_KEY constant. */
// eslint-disable-next-line react-refresh/only-export-components
export function clearComposeDraft() { clearDraft(); }

// ─── Types ────────────────────────────────────────────────────────────────────

type SaveStatus  = 'idle' | 'saving' | 'saved';
type ActiveField = 'to' | 'cc' | 'bcc';

interface FloatingComposeProps {
  onClose:   () => void;
  onCreated: (c: Conversation) => void;
  /** When true, uses deleteConversation for cleanup on send failure; otherwise uses leaveConversation. */
  isAdmin?: boolean;
}

// ─── RecipientRow ─────────────────────────────────────────────────────────────

interface RecipientRowProps {
  label:         string;
  recipients:    ConversationParticipant[];
  onRemove:      (id: number) => void;
  query:         string;
  onQueryChange: (val: string) => void;
  onFocus:       () => void;
  chipBg:        string;
  chipText:      string;
  searchResults: ConversationParticipant[];
  searching:     boolean;
  showDropdown:  boolean;
  onSelect:      (u: ConversationParticipant) => void;
  rightSlot?:    React.ReactNode;
  placeholder?:  string;
}

function RecipientRow({
  label, recipients, onRemove, query, onQueryChange, onFocus,
  chipBg, chipText, searchResults, searching, showDropdown, onSelect,
  rightSlot, placeholder,
}: RecipientRowProps) {
  return (
    <div
      className="relative border-b px-4 py-2 flex flex-wrap gap-1 items-center flex-shrink-0"
      style={{ borderColor: 'var(--border)', minHeight: 38 }}
    >
      <span className="text-xs font-medium w-9 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
        {label}
      </span>
      {recipients.map((r) => (
        <span
          key={r.id}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: chipBg, color: chipText }}
        >
          {r.name}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onRemove(r.id)}
            aria-label={`Remove ${r.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        placeholder={recipients.length === 0 ? (placeholder ?? 'Search people…') : ''}
        className="flex-1 min-w-16 text-sm bg-transparent outline-none py-0.5"
        style={{ color: 'var(--foreground)' }}
      />
      {rightSlot && <div className="flex items-center gap-1 flex-shrink-0 ml-auto">{rightSlot}</div>}

      {/* Autocomplete dropdown */}
      {showDropdown && (searchResults.length > 0 || searching) && (
        <div
          className="absolute left-0 top-full mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', zIndex: 200 }}
        >
          {searching && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Searching…
            </div>
          )}
          {searchResults.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={() => onSelect(u)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              <Avatar name={u.name} size="sm" fallbackColor={avatarBg(u.name)} />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{u.name}</span>
              <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>{ROLE_LABELS[u.role as RoleName] ?? u.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FloatingCompose ──────────────────────────────────────────────────────────

export function FloatingCompose({ onClose, onCreated, isAdmin = false }: FloatingComposeProps) {
  const { t } = useTranslation();

  // ── Panel state
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // ── Form state
  const [sending, setSending] = useState(false);

  // Three separate recipient lists — TO (required), CC and BCC (optional)
  const [toRecipients,  setToRecipients]  = useState<ConversationParticipant[]>([]);
  const [ccRecipients,  setCcRecipients]  = useState<ConversationParticipant[]>([]);
  const [bccRecipients, setBccRecipients] = useState<ConversationParticipant[]>([]);

  // Show/hide CC and BCC rows (like Gmail's Cc/Bcc toggle buttons)
  const [showCc,  setShowCc]  = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // Single shared search state — activeField tracks which row is typing
  const [activeField,    setActiveField]    = useState<ActiveField>('to');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState<ConversationParticipant[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [showDropdown,   setShowDropdown]   = useState(false);

  const [subject,     setSubject]     = useState(() => loadDraft()?.subject ?? '');
  const [bodyHtml,    setBodyHtml]    = useState(() => loadDraft()?.body ?? '');
  const [category,    setCategory]    = useState<MessageCategory>('general');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle');
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  // ── Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Editor (initialHtml restores a previous draft body on remount)
  const editor = useRichEditor({
    onUpdate: (html) => {
      setBodyHtml(html);
      setSaveStatus('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveDraft({ subject, body: html });
        setSaveStatus('saved');
      }, 1500);
    },
    placeholder: 'Write your message…',
    initialHtml: loadDraft()?.body ?? '',
  });

  function handleSubjectChange(val: string) {
    setSubject(val);
    if (!val && !bodyHtml) return;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft({ subject: val, body: bodyHtml });
      setSaveStatus('saved');
    }, 1500);
  }

  // ── Recipient search (shared across all three fields)
  function handleRecipientInput(field: ActiveField, val: string) {
    setActiveField(field);
    setSearchQuery(val);
    setShowDropdown(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(() => {
      setSearching(true);
      searchInboxUsers(val)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }

  function addRecipient(field: ActiveField, u: ConversationParticipant) {
    // Prevent adding the same person twice across any field
    const allIds = [...toRecipients, ...ccRecipients, ...bccRecipients].map((r) => r.id);
    if (allIds.includes(u.id)) {
      toast.error(`${u.name} is already in the recipient list.`);
      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (field === 'to')       setToRecipients((p) => [...p, u]);
    else if (field === 'cc')  setCcRecipients((p) => [...p, u]);
    else                      setBccRecipients((p) => [...p, u]);

    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }

  function removeRecipient(field: ActiveField, id: number) {
    if (field === 'to')       setToRecipients((p) => p.filter((r) => r.id !== id));
    else if (field === 'cc')  setCcRecipients((p) => p.filter((r) => r.id !== id));
    else                      setBccRecipients((p) => p.filter((r) => r.id !== id));
  }

  // ── Send
  async function handleSend() {
    const plainText = bodyHtml.replace(/<[^>]*>/g, '').trim();
    if (!plainText) { toast.error('Message body is empty.'); return; }
    if (toRecipients.length === 0) { toast.error('Please add at least one recipient in the To field.'); return; }

    setSending(true);
    try {
      // Gather all participant IDs (TO + CC + BCC) for conversation creation
      const allParticipantIds = [
        ...toRecipients.map((r) => r.id),
        ...ccRecipients.map((r) => r.id),
        ...bccRecipients.map((r) => r.id),
      ];

      const payload: NewConversationPayload = { participant_ids: allParticipantIds, category };
      if (subject.trim()) payload.subject = subject.trim();

      const conv = await createConversation(payload);

      // Build the typed recipients array for the first message
      const recipients: RecipientEntry[] = [
        ...toRecipients.map((r)  => ({ user_id: r.id, type: 'to'  as const })),
        ...ccRecipients.map((r)  => ({ user_id: r.id, type: 'cc'  as const })),
        ...bccRecipients.map((r) => ({ user_id: r.id, type: 'bcc' as const })),
      ];

      try {
        await sendMessage(
          conv.id,
          bodyHtml,
          attachments.length > 0 ? attachments : undefined,
          recipients,
        );
      } catch (sendErr: unknown) {
        // Conversation was created but message send failed — clean up to avoid ghost conversations.
        // Admins can hard-delete; non-admins use leaveConversation (soft-remove themselves).
        if (isAdmin) {
          deleteConversation(conv.id).catch(() => {/* best-effort */});
        } else {
          leaveConversation(conv.id).catch(() => {/* best-effort */});
        }
        throw sendErr;
      }

      clearDraft();
      editor?.commands.clearContent();
      setBodyHtml('');
      onCreated(conv);
      toast.success('Message sent.');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg && msg !== 'Validation failed.' ? msg : 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // ── Close guard (attachments included — they can't be saved to draft)
  const hasUnsavedContent =
    toRecipients.length > 0 || ccRecipients.length > 0 || bccRecipients.length > 0 ||
    subject.trim().length > 0 ||
    bodyHtml.replace(/<[^>]*>/g, '').trim().length > 0 ||
    attachments.length > 0;

  function handleClose() {
    if (hasUnsavedContent && saveStatus !== 'saved') {
      setConfirmCloseOpen(true);
      return;
    }
    clearDraft();
    onClose();
  }

  function handleConfirmDiscard() {
    clearDraft();
    setConfirmCloseOpen(false);
    onClose();
  }

  const headerStatusText = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Draft saved' : null;
  const panelHeight = minimized ? undefined : (maximized ? undefined : 480);

  // ── Shared dropdown props for the active field
  const dropdownProps = {
    searchResults,
    searching,
    showDropdown,
    onSelect: (u: ConversationParticipant) => addRecipient(activeField, u),
  };

  return (
    <>
      {/* Fullscreen backdrop */}
      {maximized && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Exit fullscreen"
          className="fixed inset-0 bg-black/30"
          style={{ zIndex: 999 }}
          onClick={() => setMaximized(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMaximized(false); }}
        />
      )}

      {/* ── Compose panel ─────────────────────────────────────────────────── */}
      <div
        className={
          maximized
            ? 'fixed inset-4 rounded-2xl border overflow-hidden shadow-2xl flex flex-col'
            : 'fixed bottom-0 right-8 rounded-t-2xl border overflow-hidden shadow-2xl flex flex-col'
        }
        style={{
          width: maximized ? undefined : 560,
          height: panelHeight,
          background: 'var(--card)',
          borderColor: 'var(--border)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          zIndex: maximized ? 1000 : 500,
        }}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          role="button"
          tabIndex={0}
          aria-label={minimized ? 'Expand compose' : 'Minimize compose'}
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none flex-shrink-0 border-b"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          onClick={() => { if (!maximized) setMinimized((v) => !v); }}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !maximized) setMinimized((v) => !v); }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate max-w-[240px]">
              {minimized && subject ? subject : 'New Message'}
            </span>
            {headerStatusText && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {headerStatusText}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMinimized((v) => !v); }}
              title={minimized ? 'Expand' : 'Minimize'}
              aria-label={minimized ? 'Expand compose' : 'Minimize compose'}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              <Minus className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMaximized((v) => !v); setMinimized(false); }}
              title={maximized ? 'Restore' : 'Maximize'}
              aria-label={maximized ? 'Restore compose' : 'Maximize compose'}
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              {maximized
                ? <Minimize2 className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                : <Maximize2 className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              }
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClose(); }}
              title="Close"
              aria-label="Close compose"
              className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            >
              <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>

        {/* ── Body (hidden when minimized) ──────────────────────────────── */}
        {!minimized && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* ── TO field (always visible) */}
            <RecipientRow
              label="To"
              recipients={toRecipients}
              onRemove={(id) => removeRecipient('to', id)}
              query={activeField === 'to' ? searchQuery : ''}
              onQueryChange={(val) => handleRecipientInput('to', val)}
              onFocus={() => { setActiveField('to'); if (searchQuery.trim()) setShowDropdown(true); }}
              chipBg={BRAND_T}
              chipText={BRAND}
              {...dropdownProps}
              showDropdown={showDropdown && activeField === 'to'}
              placeholder="Search people…"
              rightSlot={
                <>
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => setShowCc(true)}
                      className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      type="button"
                      onClick={() => setShowBcc(true)}
                      className="text-xs px-1.5 py-0.5 rounded transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      Bcc
                    </button>
                  )}
                </>
              }
            />

            {/* ── CC field (shown after toggle) */}
            {showCc && (
              <RecipientRow
                label="Cc"
                recipients={ccRecipients}
                onRemove={(id) => removeRecipient('cc', id)}
                query={activeField === 'cc' ? searchQuery : ''}
                onQueryChange={(val) => handleRecipientInput('cc', val)}
                onFocus={() => { setActiveField('cc'); if (searchQuery.trim()) setShowDropdown(true); }}
                chipBg={CC_COLOR}
                chipText={CC_TEXT}
                {...dropdownProps}
                showDropdown={showDropdown && activeField === 'cc'}
                placeholder="Add CC recipients…"
              />
            )}

            {/* ── BCC field (shown after toggle) */}
            {showBcc && (
              <RecipientRow
                label="Bcc"
                recipients={bccRecipients}
                onRemove={(id) => removeRecipient('bcc', id)}
                query={activeField === 'bcc' ? searchQuery : ''}
                onQueryChange={(val) => handleRecipientInput('bcc', val)}
                onFocus={() => { setActiveField('bcc'); if (searchQuery.trim()) setShowDropdown(true); }}
                chipBg={BCC_COLOR}
                chipText={BCC_TEXT}
                {...dropdownProps}
                showDropdown={showDropdown && activeField === 'bcc'}
                placeholder="Add BCC recipients (hidden from others)…"
              />
            )}

            {/* Subject + Category */}
            <div
              className="border-b px-4 py-2 flex items-center gap-3 flex-shrink-0"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-medium w-9 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>{t('messaging_extra.subject_label')}</span>
              <input
                value={subject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                onFocus={() => setShowDropdown(false)}
                placeholder="Subject (optional)"
                className="flex-1 text-sm bg-transparent outline-none py-0.5"
                style={{ color: 'var(--foreground)' }}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MessageCategory)}
                className="text-xs border rounded-md px-2 py-1 outline-none flex-shrink-0"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <option value="general">{t('messaging_extra.type_general')}</option>
                <option value="application">{t('messaging_extra.type_application')}</option>
                <option value="medical">{t('messaging_extra.type_medical')}</option>
                <option value="other">{t('messaging_extra.type_other')}</option>
              </select>
            </div>

            {/* ── Editor body ──────────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto min-h-0"
              role="presentation"
              onClick={() => setShowDropdown(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowDropdown(false); }}
            >
              <EditorBody
                editor={editor}
                minHeight={maximized ? 320 : 160}
                maxHeight={maximized ? undefined : 320}
                className="px-4 py-3 h-full"
              />
            </div>

            {/* ── Attachment chips ─────────────────────────────────────────── */}
            {attachments.length > 0 && (
              <div
                className="flex flex-wrap gap-1.5 px-4 py-2 border-t flex-shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                {attachments.map((f, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--dash-nav-hover-bg)' }}
                  >
                    <Upload className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="ml-0.5 rounded-full hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Footer toolbar row ────────────────────────────────────────── */}
            <div
              className="flex items-center justify-between px-3 py-2 border-t flex-shrink-0"
              style={{ borderColor: 'var(--border)', minHeight: 52 }}
            >
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  aria-label="Attach file"
                  className="p-1.5 rounded-md transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                >
                  <Upload className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                </button>
                <div className="w-px h-5 mx-1 flex-shrink-0" style={{ background: 'var(--border)' }} />
                <EditorToolbar editor={editor} />
              </div>

              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50 flex-shrink-0"
                style={{ background: BRAND }}
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Discard draft confirm */}
      <ConfirmDialog
        open={confirmCloseOpen}
        title="Discard draft?"
        message="Your draft will be permanently lost."
        confirmLabel="Discard"
        variant="danger"
        onConfirm={handleConfirmDiscard}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  );
}
