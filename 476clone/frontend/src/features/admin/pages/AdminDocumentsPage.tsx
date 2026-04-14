/**
 * AdminDocumentsPage.tsx
 *
 * Redesigned (Phase 13) as a full Document Request system.
 *
 * The page is built around admin-initiated document requests rather than
 * passively reviewing uploaded files.
 *
 * Full lifecycle:
 *   Admin requests document → Applicant receives inbox notification
 *   → Applicant uploads → Admin reviews → Admin approves or rejects
 *   → If rejected, request reopens for resubmission
 *
 * Features:
 *  - Dashboard metrics bar (7 statuses)
 *  - "+ Request Document" modal
 *  - Filterable / searchable requests table
 *  - Per-row review: Download, Approve, Reject
 *  - Reject modal with reason field
 *  - Status badges with full lifecycle colours
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FC, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Search,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  InboxIcon,
  User,
  FileCheck,
  Bell,
  CalendarClock,
  Trash2,
  RotateCcw,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Shield,
  ZoomIn,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  getDocumentRequestStats,
  getDocumentRequests,
  createDocumentRequest,
  approveDocumentRequest,
  rejectDocumentRequest,
  cancelDocumentRequest,
  remindDocumentRequest,
  extendDocumentRequestDeadline,
  requestDocumentReupload,
  getUsers,
  getAdminDocuments,
  verifyDocument,
  downloadAdminDocument,
  deleteDocument,
  archiveDocument,
  restoreDocument,
  type AdminDocument,
  type DocumentRequest,
  type DocumentRequestStats,
  type DocumentRequestStatus,
} from '@/features/admin/api/admin.api';
import { axiosInstance } from '@/api/axios.config';
import { Button } from '@/ui/components/Button';
import { EmptyState, ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { getDocumentLabel } from '@/shared/constants/documentRequirements';

// ── Status badge helpers ───────────────────────────────────────────────────────

type StatusConfigEntry = { bg: string; color: string; icon: FC<{ className?: string }> };

const STATUS_CONFIG: Record<DocumentRequestStatus, StatusConfigEntry> = {
  awaiting_upload: { bg: 'rgba(245,158,11,0.12)', color: '#b45309',              icon: Clock       },
  uploaded:        { bg: 'rgba(59,130,246,0.12)', color: '#1d4ed8',              icon: FileCheck   },
  scanning:        { bg: 'rgba(99,102,241,0.12)', color: '#4338ca',              icon: RefreshCw   },
  under_review:    { bg: 'rgba(234,179,8,0.12)',  color: '#a16207',              icon: Eye         },
  approved:        { bg: 'rgba(5,150,105,0.10)', color: 'var(--forest-green)',   icon: CheckCircle },
  rejected:        { bg: 'rgba(239,68,68,0.12)', color: '#dc2626',               icon: XCircle     },
  overdue:         { bg: 'rgba(239,68,68,0.12)', color: '#dc2626',               icon: AlertCircle },
};

function StatusBadge({ status }: { status: DocumentRequestStatus }) {
  const { t } = useTranslation();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.awaiting_upload;
  const Icon = cfg.icon;
  const STATUS_LABELS: Record<DocumentRequestStatus, string> = {
    awaiting_upload: t('admin_extra.status_awaiting_upload', 'Awaiting Upload'),
    uploaded:        t('admin_extra.status_pending_review',  'Pending Review'),
    scanning:        t('admin_extra.status_processing',      'Processing'),
    under_review:    t('admin_extra.status_under_review',    'Under Review'),
    approved:        t('admin_extra.status_approved',        'Approved'),
    rejected:        t('admin_extra.status_rejected',        'Rejected'),
    overdue:         t('admin_extra.status_overdue',         'Overdue'),
  };
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3 w-3" />
      {STATUS_LABELS[status] ?? STATUS_LABELS.awaiting_upload}
    </span>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1 rounded-xl p-4 border text-left transition-colors"
      style={{
        background: active ? 'var(--ember-orange)' : 'var(--card)',
        borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
        color: active ? '#fff' : 'var(--foreground)',
      }}
    >
      <span className="text-2xl font-bold font-headline">{value}</span>
      <span className="text-xs font-medium" style={{ color: active ? 'rgba(255,255,255,0.8)' : 'var(--muted-foreground)' }}>
        {label}
      </span>
    </button>
  );
}

// ── Document type → human-readable label ──────────────────────────────────────
//
// Maps the raw backend document_type values (snake_case strings) to clean,
// human-readable labels shown in the admin UI.  Unknown types fall back to a
// simple title-case transformation so new values never surface as raw snake_case.

// All document type labels now derive from the shared canonical module so admin
// and applicant views never drift apart. Admin-facing labels (e.g. "SC Immunization
// Certificate") are returned automatically when role='admin'.
function formatDocumentType(raw: string | null): string {
  if (!raw) return '—';
  return getDocumentLabel(raw, 'admin');
}

// ── ParentCombobox — searchable typeahead for parent/guardian selection ────────
//
// Replaces a <select> that doesn't scale past ~20 items. Handles:
//   - In-memory filter on name + email (no round-trip, instant feel)
//   - Keyboard navigation: ↑↓ to move, Enter to select, Escape to close
//   - mousedown + e.preventDefault() on items so blur doesn't collapse the
//     list before the click registers — the critical combobox timing trick
//   - Clear (×) button when a value is selected

interface ParentOption {
  id: number;
  name: string;
  email: string;
}

function ParentCombobox({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Search by name or email…',
}: {
  options: ParentOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query,       setQuery]       = useState('');
  const [open,        setOpen]        = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLUListElement>(null);

  // Derive selection from value — no extra local state needed
  const selected = options.find((o) => String(o.id) === value) ?? null;

  // Filter on every keystroke — pure in-memory, no debounce needed for <500 items
  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
      })
    : options;

  // Reset highlight when results change (e.g. new query)
  useEffect(() => { setHighlighted(0); }, [query]);

  // Keep highlighted item visible while arrowing through the list
  useEffect(() => {
    if (!open || !listRef.current) return;
    (listRef.current.children[highlighted] as HTMLElement | undefined)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, open]);

  function openAndFocus() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleContainerClick() {
    // Clicking the container when something is selected clears and reopens search
    if (selected) { onChange(''); setQuery(''); }
    openAndFocus();
  }

  function selectOption(opt: ParentOption) {
    onChange(String(opt.id));
    setQuery('');
    setOpen(false);
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (open && filtered[highlighted]) selectOption(filtered[highlighted]);
        else setOpen(true);
        break;
      case 'Escape':
        setOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  }

  return (
    <div className="relative">
      {/* ── Input trigger ── */}
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="applicant-combobox-listbox"
        tabIndex={0}
        className="flex items-center rounded-lg border text-sm px-3 min-h-[42px] cursor-text gap-2"
        style={{
          background: 'var(--input)',
          borderColor: open ? 'var(--ember-orange)' : 'var(--border)',
          boxShadow: open ? '0 0 0 1px var(--ember-orange)' : 'none',
          color: 'var(--foreground)',
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={handleContainerClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleContainerClick(); }}
      >
        {selected && !open ? (
          /* SELECTED state — name text + clear × */
          <>
            <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {selected.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={clearSelection}
                className="flex-shrink-0 rounded p-0.5 hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                title="Clear selection"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            )}
          </>
        ) : (
          /* SEARCH state — text input */
          <>
            <input
              ref={inputRef}
              type="text"
              role="searchbox"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={disabled}
              value={query}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-sm min-w-0 py-2.5"
              style={{ color: 'var(--foreground)' }}
              onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
              onFocus={() => setOpen(true)}
              // 160ms delay: lets mousedown on a list item fire before blur collapses the list
              onBlur={() => setTimeout(() => setOpen(false), 160)}
              onKeyDown={handleKeyDown}
            />
            <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          </>
        )}
      </div>

      {/* ── Dropdown list ── */}
      {open && (
        <ul
          ref={listRef}
          id="applicant-combobox-listbox"
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border overflow-y-auto"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            maxHeight: '220px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          }}
        >
          {filtered.length === 0 ? (
            <li
              className="px-4 py-4 text-sm text-center"
              style={{ color: 'var(--muted-foreground)' }}
            >
              No results{query ? ` for "${query}"` : ''}
            </li>
          ) : (
            filtered.map((opt, idx) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={String(opt.id) === value}
                // mousedown + preventDefault keeps focus on the input through selection
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                onMouseEnter={() => setHighlighted(idx)}
                className="flex flex-col px-4 py-2.5 cursor-pointer"
                style={{
                  background: idx === highlighted ? 'var(--dash-nav-hover-bg)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                <span className="text-sm font-medium leading-snug">{opt.name}</span>
                <span className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {opt.email}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// ── Request Document modal ─────────────────────────────────────────────────────

interface RequestDocumentModalProps {
  onClose: () => void;
  onCreated: (req: DocumentRequest) => void;
}

function RequestDocumentModal({ onClose, onCreated }: RequestDocumentModalProps) {
  const { t } = useTranslation();
  const [parents, setParents]           = useState<ParentOption[]>([]);
  const [children, setChildren]         = useState<{ id: number; name: string }[]>([]);
  const [loadingParents, setLoadingParents]   = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [saving, setSaving]             = useState(false);

  const [form, setForm] = useState({
    applicant_id:  '',
    camper_id:     '',   // '' = not yet chosen, 'all' = all children, numeric string = specific child
    document_type: '',
    instructions:  '',
    due_date:      '',
  });

  // Load parent/guardian list on mount
  useEffect(() => {
    let cancelled = false;
    getUsers({ role: 'applicant', page: 1 })
      .then((res) => {
        if (cancelled) return;
        setParents((res.data ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email })));
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = (err as { message?: string })?.message;
        toast.error(msg ? `Unable to load parents: ${msg}` : 'Unable to load parents. Please refresh and try again.');
      })
      .finally(() => { if (!cancelled) setLoadingParents(false); });
    return () => { cancelled = true; };
  }, []);

  // When parent changes, load their children and apply auto-selection
  useEffect(() => {
    if (!form.applicant_id) {
      setChildren([]);
      setForm((prev) => ({ ...prev, camper_id: '' }));
      return;
    }
    setLoadingChildren(true);
    setChildren([]);
    setForm((prev) => ({ ...prev, camper_id: '' }));
    axiosInstance.get('/campers', { params: { user_id: Number(form.applicant_id) } })
      .then((res) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = (res.data as any)?.data ?? res.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped: { id: number; name: string }[] = list.map((c: any) => ({
          id: c.id,
          name: `${c.first_name} ${c.last_name}`,
        }));
        setChildren(mapped);
        // Auto-select the only child; otherwise require explicit selection
        if (mapped.length === 1) {
          setForm((prev) => ({ ...prev, camper_id: String(mapped[0].id) }));
        }
      })
      .catch(() => setChildren([]))
      .finally(() => setLoadingChildren(false));
   
  }, [form.applicant_id]);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.applicant_id || !form.camper_id || !form.document_type.trim()) return;
    setSaving(true);
    try {
      // 'all' maps to null (all children for this parent); otherwise use the specific child id
      const camperId = form.camper_id === 'all' ? null : Number(form.camper_id);
      const req = await createDocumentRequest({
        applicant_id:  Number(form.applicant_id),
        camper_id:     camperId,
        document_type: form.document_type.trim(),
        instructions:  form.instructions.trim() || undefined,
        due_date:      form.due_date || undefined,
      });
      toast.success('Document request created and parent notified.');
      onCreated(req);
    } catch {
      toast.error('Failed to create document request.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full';
  const inputStyle = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };
  const labelCls = 'text-xs font-medium block mb-1';
  const labelStyle = { color: 'var(--muted-foreground)' };

  const canSubmit =
    !saving &&
    !loadingParents &&
    !!form.applicant_id &&
    !!form.camper_id &&
    !!form.document_type.trim();

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('admin_extra.request_document_title', 'Request Document')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.request_document_subtitle', 'The parent/guardian will be notified via their inbox.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          {/* Parent / Guardian */}
          <div>
            <label htmlFor="doc-req-parent" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_parent', 'Parent / Guardian')} *</label>
            {loadingParents ? (
              <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : (
              <ParentCombobox
                options={parents}
                value={form.applicant_id}
                onChange={(id) => set('applicant_id', id)}
                placeholder={t('admin_extra.select_parent_placeholder', 'Search by name or email…')}
              />
            )}
            <p className="text-xs mt-1.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.select_parent_hint', 'Select the parent/guardian, then choose which child this document is for.')}
            </p>
          </div>

          {/* Child — shown as soon as a parent is selected */}
          {form.applicant_id && (
            <div>
              <label htmlFor="doc-req-child" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_child', 'Child')} *</label>
              {loadingChildren ? (
                <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
              ) : (
                <select
                  id="doc-req-child"
                  required
                  value={form.camper_id}
                  onChange={(e) => set('camper_id', e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">{t('admin_extra.select_child_placeholder', 'Select child…')}</option>
                  {children.length > 1 && (
                    <option value="all">{t('admin_extra.all_children', 'All children')}</option>
                  )}
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Document Type */}
          <div>
            <label htmlFor="doc-req-type" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_type', 'Document Type')} *</label>
            <input
              id="doc-req-type"
              type="text"
              required
              placeholder="e.g. Immunization Record, Physician Sign-off…"
              value={form.document_type}
              onChange={(e) => set('document_type', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Instructions */}
          <div>
            <label htmlFor="doc-req-instructions" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_instructions', 'Instructions (optional)')}</label>
            <textarea
              id="doc-req-instructions"
              rows={3}
              placeholder="What should the parent/guardian upload or include?"
              value={form.instructions}
              onChange={(e) => set('instructions', e.target.value)}
              className={inputCls + ' resize-none'}
              style={inputStyle}
            />
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="doc-req-due-date" className={labelCls} style={labelStyle}>{t('admin_extra.doc_form_due', 'Due Date (optional)')}</label>
            <input
              id="doc-req-due-date"
              type="date"
              value={form.due_date}
              onChange={(e) => set('due_date', e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 pt-2 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={!canSubmit}
              loading={saving}
              className="flex items-center gap-1.5"
            >
              <InboxIcon className="h-3.5 w-3.5" />
              {t('admin_extra.send_request', 'Send Request')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({
  requestId,
  documentType,
  onClose,
  onRejected,
}: {
  requestId: number;
  documentType: string;
  onClose: () => void;
  onRejected: (updated: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await rejectDocumentRequest(requestId, reason.trim() || undefined);
      toast.success('Document rejected. Applicant notified.');
      onRejected(updated);
    } catch {
      toast.error('Failed to reject document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('admin_extra.reject_document_title', 'Reject Document')}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.reject_document_body', 'You are rejecting')} <strong style={{ color: 'var(--foreground)' }}>{documentType}</strong>.
            {' '}{t('admin_extra.reject_document_notify', 'The applicant will be notified and asked to resubmit.')}
          </p>
          <div>
            <label htmlFor="reject-reason" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.reject_reason_label', 'Reason (optional)')}
            </label>
            <textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. File is unreadable, wrong document type…"
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
          <div
            className="flex items-center justify-end gap-3 pt-1 border-t"
            style={{ borderColor: 'var(--border)' }}
          >
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button variant="destructive" size="sm" type="submit" loading={saving} disabled={saving}>
              {t('admin_extra.reject_button', 'Reject')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Overflow menu ─────────────────────────────────────────────────────────────

interface OverflowMenuItem {
  label: string;
  icon: FC<{ className?: string; style?: CSSProperties }>;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

function OverflowMenu({ items }: { items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<CSSProperties>({});

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({
        position: 'fixed',
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
      });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="More actions"
        onClick={handleToggle}
        className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
        style={{ color: open ? 'var(--foreground)' : 'var(--muted-foreground)' }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            ...menuPos,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '188px',
            overflow: 'hidden',
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => { item.onClick(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-[var(--dash-nav-hover-bg)] transition-colors text-left disabled:opacity-40"
                style={{ color: item.danger ? '#dc2626' : 'var(--foreground)' }}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: item.danger ? '#dc2626' : 'var(--muted-foreground)' }} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Extend Deadline modal ──────────────────────────────────────────────────────

function ExtendDeadlineModal({
  req,
  onClose,
  onExtended,
}: {
  req: DocumentRequest;
  onClose: () => void;
  onExtended: (updated: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    try {
      const updated = await extendDocumentRequestDeadline(req.id, date);
      toast.success('Deadline extended. Applicant notified.');
      onExtended(updated);
    } catch {
      toast.error('Failed to extend deadline.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] w-full';
  const inputStyle = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.doc_extend_deadline', 'Extend Deadline')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)} className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.extend_deadline_body', 'Set a new due date for')} <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>.
          </p>
          <div>
            <label htmlFor="extend-due-date" className="text-xs font-medium block mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.extend_new_due_date', 'New Due Date')} *</label>
            <input id="extend-due-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
            <Button size="sm" type="submit" loading={saving} disabled={saving || !date}>{t('admin_extra.doc_extend_deadline', 'Extend Deadline')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cancel Confirm modal ───────────────────────────────────────────────────────

function CancelConfirmModal({
  req,
  onClose,
  onConfirm,
}: {
  req: DocumentRequest;
  onClose: () => void;
  onConfirm: (req: DocumentRequest) => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      onConfirm(req);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="button" tabIndex={0} aria-label="Close" className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}>
      <div role="presentation" className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'var(--card)' }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{t('admin_extra.doc_cancel_request', 'Cancel Request')}</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('admin_extra.cancel_request_body', 'Cancel the request for')} <strong style={{ color: 'var(--foreground)' }}>{req.document_type}</strong>? {t('admin_extra.cancel_request_notify', 'The applicant will be notified and this record will be removed.')}
          </p>
          <div className="flex items-center justify-end gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>{t('admin_extra.keep_button', 'Keep')}</Button>
            <Button variant="destructive" size="sm" loading={saving} disabled={saving} onClick={() => void handleConfirm()}>{t('admin_extra.doc_cancel_request', 'Cancel Request')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AdminDocumentsPage() {
  const { t } = useTranslation();

  const STATUS_FILTER_OPTIONS: { label: string; value: string }[] = [
    { label: t('admin_extra.status_all',            'All'),             value: '' },
    { label: t('admin_extra.status_awaiting_upload','Awaiting Upload'), value: 'awaiting_upload' },
    { label: t('admin_extra.status_pending_review', 'Pending Review'),  value: 'uploaded' },
    { label: t('admin_extra.status_processing',     'Processing'),      value: 'scanning' },
    { label: t('admin_extra.status_under_review',   'Under Review'),    value: 'under_review' },
    { label: t('admin_extra.status_approved',       'Approved'),        value: 'approved' },
    { label: t('admin_extra.status_rejected',       'Rejected'),        value: 'rejected' },
    { label: t('admin_extra.status_overdue',        'Overdue'),         value: 'overdue' },
  ];

  // ── Tab ─────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'requests' | 'uploads'>('requests');

  // ── Document Requests state ──────────────────────────────────────────────────
  const [stats, setStats]             = useState<DocumentRequestStats | null>(null);
  const [requests, setRequests]       = useState<DocumentRequest[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [page, setPage]               = useState(1);
  const [lastPage, setLastPage]       = useState(1);
  const [total, setTotal]             = useState(0);

  // Filters
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // ── Uploaded Documents state ─────────────────────────────────────────────────
  const [uploads, setUploads]                 = useState<AdminDocument[]>([]);
  const [uploadsLoading, setUploadsLoading]   = useState(false);
  const [uploadsError, setUploadsError]       = useState(false);
  const [uploadsPage, setUploadsPage]         = useState(1);
  const [uploadsLastPage, setUploadsLastPage] = useState(1);
  const [uploadsTotal, setUploadsTotal]       = useState(0);
  const [uploadsSearch, setUploadsSearch]     = useState('');
  const [uploadsDebouncedSearch, setUploadsDebouncedSearch] = useState('');
  const [uploadsStatusFilter, setUploadsStatusFilter] = useState('');
  const [verifyingId, setVerifyingId]         = useState<number | null>(null);
  // Whether the uploads tab is showing the archived view
  const [showArchived, setShowArchived]       = useState(false);
  // Per-row action loading for archive/restore/delete
  const [archivingId, setArchivingId]         = useState<number | null>(null);
  const [restoringId, setRestoringId]         = useState<number | null>(null);
  const [deletingId, setDeletingId]           = useState<number | null>(null);
  // Delete confirmation modal target
  const [deleteTarget, setDeleteTarget]       = useState<AdminDocument | null>(null);
  // Preview modal target + authenticated blob URL
  const [previewDoc, setPreviewDoc]           = useState<AdminDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl]   = useState<string | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const uploadsSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [rejectTarget, setRejectTarget]         = useState<DocumentRequest | null>(null);
  const [extendTarget, setExtendTarget]         = useState<DocumentRequest | null>(null);
  const [cancelTarget, setCancelTarget]         = useState<DocumentRequest | null>(null);

  // Per-row action loading
  const [approvingId, setApprovingId]   = useState<number | null>(null);
  const [remindingId, setRemindingId]   = useState<number | null>(null);
  const [reuploadingId, setReuploadingId] = useState<number | null>(null);

  // Expanded instructions per row
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  function toggleExpand(id: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getDocumentRequestStats(),
      getDocumentRequests({
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        page,
      }),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRequests(r.data);
        setLastPage(r.meta?.last_page ?? 1);
        setTotal(r.meta?.total ?? 0);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [statusFilter, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  // Debounced search for uploads tab
  useEffect(() => {
    if (uploadsSearchTimer.current) clearTimeout(uploadsSearchTimer.current);
    uploadsSearchTimer.current = setTimeout(() => {
      setUploadsDebouncedSearch(uploadsSearch);
      setUploadsPage(1);
    }, 350);
    return () => { if (uploadsSearchTimer.current) clearTimeout(uploadsSearchTimer.current); };
  }, [uploadsSearch]);

  const loadUploads = useCallback(() => {
    if (tab !== 'uploads') return;
    setUploadsLoading(true);
    setUploadsError(false);
    getAdminDocuments({
      page: uploadsPage,
      search: uploadsDebouncedSearch || undefined,
      verification_status: uploadsStatusFilter || undefined,
      include_archived: showArchived || undefined,
    })
      .then((r) => {
        setUploads(r.data);
        setUploadsLastPage(r.meta?.last_page ?? 1);
        setUploadsTotal(r.meta?.total ?? 0);
      })
      .catch(() => setUploadsError(true))
      .finally(() => setUploadsLoading(false));
  }, [tab, uploadsPage, uploadsDebouncedSearch, uploadsStatusFilter, showArchived]);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  // Fetch the file as an authenticated blob whenever the preview modal opens.
  // Iframes and <img> tags make bare browser requests with no Authorization header,
  // so we can't use the raw API URL directly — it would be rejected with 401/403.
  // Instead we fetch via axios (which carries the Sanctum Bearer token) and create
  // a local object URL the browser can load without needing server auth.
  useEffect(() => {
    if (!previewDoc) {
      // Modal closing — revoke the previous blob URL to free memory
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    downloadAdminDocument(previewDoc.id)
      .then((blob) => {
        if (cancelled) return;
        setPreviewBlobUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (!cancelled) setPreviewBlobUrl(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDoc]);

  async function handleVerifyDocument(doc: AdminDocument, status: 'approved' | 'rejected') {
    setVerifyingId(doc.id);
    try {
      const updated = await verifyDocument(doc.id, status);
      setUploads((prev) => prev.map((d) => d.id === doc.id ? updated : d));
      toast.success(`Document ${status}.`);
    } catch {
      toast.error('Action failed.');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleDownloadUpload(doc: AdminDocument) {
    try {
      const blob = await downloadAdminDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }

  async function handleArchiveDoc(doc: AdminDocument) {
    setArchivingId(doc.id);
    try {
      await archiveDocument(doc.id);
      // Remove from active list; it now lives in the archived view
      setUploads((prev) => prev.filter((d) => d.id !== doc.id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document archived.');
    } catch {
      toast.error('Archive failed.');
    } finally {
      setArchivingId(null);
    }
  }

  async function handleRestoreDoc(doc: AdminDocument) {
    setRestoringId(doc.id);
    try {
      await restoreDocument(doc.id);
      // Remove from archived list; it's now active again
      setUploads((prev) => prev.filter((d) => d.id !== doc.id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document restored to active view.');
    } catch {
      toast.error('Restore failed.');
    } finally {
      setRestoringId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    setDeleteTarget(null);
    try {
      await deleteDocument(id);
      setUploads((prev) => prev.filter((d) => d.id !== id));
      setUploadsTotal((t) => t - 1);
      toast.success('Document permanently deleted.');
    } catch {
      toast.error('Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleMetricClick(status: string) {
    setStatusFilter((prev) => (prev === status ? '' : status));
    setPage(1);
  }

  async function handleApprove(req: DocumentRequest) {
    setApprovingId(req.id);
    try {
      const updated = await approveDocumentRequest(req.id);
      setRequests((prev) => prev.map((r) => r.id === req.id ? updated : r));
      toast.success('Document approved.');
      // Refresh stats
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Approval failed.');
    } finally {
      setApprovingId(null);
    }
  }

  function handleRejected(updated: DocumentRequest) {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    setRejectTarget(null);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleDownload(req: DocumentRequest) {
    if (!req.download_url) return;
    try {
      const path = req.download_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      const res = await axiosInstance.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = req.uploaded_file_name ?? 'document';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }

  function handleCreated(req: DocumentRequest) {
    setShowRequestModal(false);
    setRequests((prev) => [req, ...prev]);
    setTotal((t) => t + 1);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleRemind(req: DocumentRequest) {
    setRemindingId(req.id);
    try {
      await remindDocumentRequest(req.id);
      toast.success('Reminder sent to applicant.');
    } catch {
      toast.error('Failed to send reminder.');
    } finally {
      setRemindingId(null);
    }
  }

  async function handleReupload(req: DocumentRequest) {
    setReuploadingId(req.id);
    try {
      const updated = await requestDocumentReupload(req.id);
      setRequests((prev) => prev.map((r) => r.id === req.id ? updated : r));
      toast.success('Resubmission requested. Applicant notified.');
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Failed to request resubmission.');
    } finally {
      setReuploadingId(null);
    }
  }

  function handleExtended(updated: DocumentRequest) {
    setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
    setExtendTarget(null);
    getDocumentRequestStats().then(setStats).catch(() => {});
  }

  async function handleCancel(req: DocumentRequest) {
    try {
      await cancelDocumentRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      setTotal((t) => t - 1);
      setCancelTarget(null);
      toast.success('Document request cancelled.');
      getDocumentRequestStats().then(setStats).catch(() => {});
    } catch {
      toast.error('Failed to cancel request.');
    }
  }

  // Status → action rules
  const canReview = (status: DocumentRequestStatus) =>
    status === 'uploaded' || status === 'under_review';

  const canRemind = (status: DocumentRequestStatus) =>
    status === 'awaiting_upload' || status === 'overdue';

  const canReupload = (status: DocumentRequestStatus) =>
    status === 'rejected';

  return (
    <>
      {showRequestModal && (
        <RequestDocumentModal
          onClose={() => setShowRequestModal(false)}
          onCreated={handleCreated}
        />
      )}
      {rejectTarget && (
        <RejectModal
          requestId={rejectTarget.id}
          documentType={rejectTarget.document_type}
          onClose={() => setRejectTarget(null)}
          onRejected={handleRejected}
        />
      )}
      {extendTarget && (
        <ExtendDeadlineModal
          req={extendTarget}
          onClose={() => setExtendTarget(null)}
          onExtended={handleExtended}
        />
      )}
      {cancelTarget && (
        <CancelConfirmModal
          req={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
        />
      )}

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'rgba(239,68,68,0.10)' }}>
                <Trash2 className="h-5 w-5" style={{ color: '#dc2626' }} />
              </span>
              <div>
                <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                  Delete document?
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                  <strong className="font-medium" style={{ color: 'var(--foreground)' }}>{deleteTarget.file_name}</strong>
                  {' '}will be permanently removed. This action cannot be undone.
                </p>
                <p className="text-xs mt-2 px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309' }}>
                  Tip: Use Archive instead to hide the document without deleting it.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: '#dc2626' }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document preview modal ─────────────────────────────────────────── */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col" style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh' }}>
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                  {previewDoc.file_name}
                </span>
                {previewDoc.documentable_name && (
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    — {previewDoc.documentable_name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  title="Download"
                  onClick={() => void handleDownloadUpload(previewDoc)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* Preview body */}
            <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-full p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <RefreshCw className="h-6 w-6 animate-spin opacity-50" />
                </div>
              ) : !previewBlobUrl ? (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <AlertCircle className="h-8 w-8 opacity-40" />
                  <p className="text-sm">Could not load preview.</p>
                  <button
                    type="button"
                    onClick={() => void handleDownloadUpload(previewDoc)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download instead
                  </button>
                </div>
              ) : previewDoc.mime_type === 'application/pdf' ? (
                <iframe
                  src={previewBlobUrl}
                  title={previewDoc.file_name}
                  className="w-full"
                  style={{ border: 'none', height: '70vh' }}
                />
              ) : previewDoc.mime_type.startsWith('image/') ? (
                <div className="flex items-center justify-center p-4 h-full" style={{ background: 'var(--dash-bg)' }}>
                  <img
                    src={previewBlobUrl}
                    alt={previewDoc.file_name}
                    className="max-w-full max-h-full object-contain rounded-lg"
                    style={{ maxHeight: '65vh' }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8" style={{ color: 'var(--muted-foreground)' }}>
                  <FileText className="h-12 w-12 opacity-40" />
                  <p className="text-sm">Preview not available for this file type ({previewDoc.mime_type}).</p>
                  <button
                    type="button"
                    onClick={() => void handleDownloadUpload(previewDoc)}
                    className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Download className="h-4 w-4" />
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 max-w-6xl">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('admin_extra.documents_heading', 'Documents')}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.documents_subheading', 'Manage document requests and review applicant-uploaded files.')}
            </p>
          </div>
          {tab === 'requests' && (
            <Button
              size="sm"
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              {t('admin_extra.request_document_button', 'Request Document')}
            </Button>
          )}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--dash-bg)', border: '1px solid var(--border)' }}>
          {(['requests', 'uploads'] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setTab(tabKey)}
              className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors"
              style={{
                background: tab === tabKey ? 'var(--card)' : 'transparent',
                color: tab === tabKey ? 'var(--foreground)' : 'var(--muted-foreground)',
                boxShadow: tab === tabKey ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {tabKey === 'requests' ? t('admin_extra.tab_requests', 'Document Requests') : t('admin_extra.tab_uploads', 'Uploaded Documents')}
            </button>
          ))}
        </div>

        {tab === 'uploads' && (
          <>
            {/* ── Uploads: archive toggle + search bar ────────────── */}
            <div className="flex flex-col gap-3">
              {/* Archive mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowArchived(false); setUploadsPage(1); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{
                    background: !showArchived ? 'var(--ember-orange)' : 'var(--card)',
                    borderColor: !showArchived ? 'var(--ember-orange)' : 'var(--border)',
                    color: !showArchived ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => { setShowArchived(true); setUploadsPage(1); }}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                  style={{
                    background: showArchived ? 'var(--ember-orange)' : 'var(--card)',
                    borderColor: showArchived ? 'var(--ember-orange)' : 'var(--border)',
                    color: showArchived ? '#fff' : 'var(--muted-foreground)',
                  }}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archived
                </button>
                {showArchived && (
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Archived documents are hidden from the active workflow. Use Restore to bring them back.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                <input
                  type="text"
                  placeholder="Search by uploader name…"
                  value={uploadsSearch}
                  onChange={(e) => setUploadsSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                />
              </div>
              <div className="flex items-center gap-2">
                {[
                  { label: t('admin_extra.status_all',      'All'),      value: '' },
                  { label: t('admin_extra.status_pending',  'Pending'),  value: 'pending' },
                  { label: t('admin_extra.status_approved', 'Approved'), value: 'approved' },
                  { label: t('admin_extra.status_rejected', 'Rejected'), value: 'rejected' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setUploadsStatusFilter(opt.value); setUploadsPage(1); }}
                    className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors"
                    style={{
                      background: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--card)',
                      borderColor: uploadsStatusFilter === opt.value ? 'var(--ember-orange)' : 'var(--border)',
                      color: uploadsStatusFilter === opt.value ? '#fff' : 'var(--foreground)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            </div>{/* end outer flex column (search + archive toggle) */}

            {/* ── Uploads table ───────────────────────────────────── */}
            <div className="glass-data rounded-2xl overflow-hidden">
              <div
                className="hidden md:grid gap-x-3 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wide"
                style={{
                  gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 120px 90px 140px',
                  borderColor: 'var(--border)',
                  color: 'var(--muted-foreground)',
                  background: 'var(--dash-bg)',
                }}
              >
                <span>{t('admin_extra.doc_col_file', 'File')}</span>
                <span>{t('admin_extra.doc_col_uploaded_by', 'Uploaded By')}</span>
                <span>{t('admin_extra.doc_col_type', 'Document Type')}</span>
                <span title="Real-time antivirus scan result for this file">{t('admin_extra.doc_col_security', 'Security')}</span>
                <span>{t('admin_extra.doc_col_status', 'Status')}</span>
                <span className="text-right">{t('admin_extra.doc_col_actions', 'Actions')}</span>
              </div>

              {uploadsLoading ? (
                <div className="p-4"><SkeletonTable rows={5} /></div>
              ) : uploadsError ? (
                <ErrorState onRetry={loadUploads} />
              ) : uploads.length === 0 ? (
                <EmptyState
                  title={t('admin_extra.empty_no_uploads', 'No uploaded documents')}
                  description={uploadsSearch || uploadsStatusFilter ? t('admin_extra.empty_no_filter_match', 'No documents match your filters.') : t('admin_extra.empty_uploads_hint', 'Applicants have not uploaded any documents yet.')}
                  icon={FileText}
                />
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {uploads.map((doc) => (
                    <li key={doc.id} className="hidden md:grid gap-x-3 px-6 py-3 items-center"
                      style={{ gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) 120px 90px 140px' }}>

                      {/* File name + linked entity */}
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                          <span className="text-sm font-medium truncate" title={doc.file_name} style={{ color: 'var(--foreground)' }}>
                            {doc.file_name}
                          </span>
                        </div>
                        {doc.documentable_name && (
                          <span className="text-xs pl-5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                            {doc.documentable_name}
                          </span>
                        )}
                      </div>

                      {/* Uploaded by */}
                      <span className="text-sm truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {doc.uploaded_by_name ?? '—'}
                      </span>

                      {/* Document type — human-readable label */}
                      <span className="text-sm truncate" title={doc.document_type ?? undefined} style={{ color: 'var(--muted-foreground)' }}>
                        {formatDocumentType(doc.document_type)}
                      </span>

                      {/* Security scan (real antivirus result) */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                        title={doc.scan_passed === true ? 'Antivirus scan passed — no threats detected' : doc.scan_passed === false ? 'Antivirus scan failed — file blocked for download' : 'Antivirus scan pending'}
                        style={{
                          background: doc.scan_passed === true ? 'rgba(5,150,105,0.10)' : doc.scan_passed === false ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: doc.scan_passed === true ? 'var(--forest-green)' : doc.scan_passed === false ? '#dc2626' : '#b45309',
                        }}>
                        {doc.scan_passed === true
                          ? <><Shield className="h-3 w-3" />{t('admin_extra.scan_passed', 'Clean')}</>
                          : doc.scan_passed === false
                          ? <><XCircle className="h-3 w-3" />{t('admin_extra.scan_failed', 'Threat')}</>
                          : <><Clock className="h-3 w-3" />{t('admin_extra.scan_pending', 'Scanning')}</>
                        }
                      </span>

                      {/* Verification / review status */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium w-fit"
                        style={{
                          background: doc.verification_status === 'approved' ? 'rgba(5,150,105,0.10)' : doc.verification_status === 'rejected' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                          color: doc.verification_status === 'approved' ? 'var(--forest-green)' : doc.verification_status === 'rejected' ? '#dc2626' : '#b45309',
                        }}>
                        {doc.verification_status === 'approved' ? <CheckCircle className="h-3 w-3" /> : doc.verification_status === 'rejected' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {doc.verification_status === 'approved' ? t('admin_extra.status_approved', 'Approved') : doc.verification_status === 'rejected' ? t('admin_extra.status_rejected', 'Rejected') : t('admin_extra.status_pending', 'Pending')}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Preview (PDF or image) */}
                        <button
                          type="button"
                          title="Preview"
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </button>
                        {/* Download */}
                        <button
                          type="button"
                          title="Download"
                          onClick={() => void handleDownloadUpload(doc)}
                          className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {/* Approve / Reject (only while pending review) */}
                        {doc.verification_status === 'pending' && (
                          <>
                            <button
                              type="button"
                              title="Approve"
                              disabled={verifyingId === doc.id}
                              onClick={() => void handleVerifyDocument(doc, 'approved')}
                              className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                              style={{ color: 'var(--forest-green)' }}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Reject"
                              disabled={verifyingId === doc.id}
                              onClick={() => void handleVerifyDocument(doc, 'rejected')}
                              className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                              style={{ color: '#dc2626' }}
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {/* Archive or Restore */}
                        {!showArchived ? (
                          <button
                            type="button"
                            title="Archive — removes from active view without deleting"
                            disabled={archivingId === doc.id}
                            onClick={() => void handleArchiveDoc(doc)}
                            className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                            style={{ color: 'var(--muted-foreground)' }}
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            title="Restore to active view"
                            disabled={restoringId === doc.id}
                            onClick={() => void handleRestoreDoc(doc)}
                            className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                            style={{ color: 'var(--forest-green)' }}
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                        )}
                        {/* Delete — requires confirmation */}
                        <button
                          type="button"
                          title="Delete permanently"
                          disabled={deletingId === doc.id}
                          onClick={() => setDeleteTarget(doc)}
                          className="p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40"
                          style={{ color: '#dc2626' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ── Uploads pagination ──────────────────────────────── */}
            {uploadsLastPage > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {uploadsTotal} document{uploadsTotal !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={uploadsPage <= 1} onClick={() => setUploadsPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{uploadsPage} / {uploadsLastPage}</span>
                  <Button variant="ghost" size="sm" disabled={uploadsPage >= uploadsLastPage} onClick={() => setUploadsPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'requests' && (<>

        {/* ── Metrics bar ─────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <MetricCard label={t('admin_extra.metric_total',          'Total')}          value={stats.total}           active={statusFilter === ''}               onClick={() => handleMetricClick('')} />
            <MetricCard label={t('admin_extra.status_awaiting_upload','Awaiting Upload')} value={stats.awaiting_upload} active={statusFilter === 'awaiting_upload'} onClick={() => handleMetricClick('awaiting_upload')} />
            <MetricCard label={t('admin_extra.metric_uploaded',        'Uploaded')}        value={stats.uploaded}        active={statusFilter === 'uploaded'}        onClick={() => handleMetricClick('uploaded')} />
            <MetricCard label={t('admin_extra.status_under_review',    'Under Review')}    value={stats.under_review}    active={statusFilter === 'under_review'}    onClick={() => handleMetricClick('under_review')} />
            <MetricCard label={t('admin_extra.status_approved',        'Approved')}        value={stats.approved}        active={statusFilter === 'approved'}        onClick={() => handleMetricClick('approved')} />
            <MetricCard label={t('admin_extra.status_rejected',        'Rejected')}        value={stats.rejected}        active={statusFilter === 'rejected'}        onClick={() => handleMetricClick('rejected')} />
            <MetricCard label={t('admin_extra.status_overdue',         'Overdue')}         value={stats.overdue}         active={statusFilter === 'overdue'}         onClick={() => handleMetricClick('overdue')} />
          </div>
        )}

        {/* ── Search + filter bar ──────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <input
              type="text"
              placeholder="Search applicant, camper, or document type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Status filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                className="text-xs px-3 py-2 rounded-lg border font-medium transition-colors"
                style={{
                  background: statusFilter === opt.value ? 'var(--ember-orange)' : 'var(--card)',
                  borderColor: statusFilter === opt.value ? 'var(--ember-orange)' : 'var(--border)',
                  color: statusFilter === opt.value ? '#fff' : 'var(--foreground)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Requests table ───────────────────────────────────────── */}
        <div className="glass-data rounded-2xl overflow-hidden">

          {/* Table header */}
          <div
            className="hidden md:grid gap-x-3 px-6 py-3 border-b text-xs font-semibold uppercase tracking-wide"
            style={{
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 140px 100px 80px',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)',
              background: 'var(--dash-bg)',
            }}
          >
            <span>{t('admin_extra.doc_form_parent', 'Parent / Guardian')}</span>
            <span>{t('admin_extra.doc_form_child', 'Child')}</span>
            <span>{t('admin_extra.col_document', 'Document')}</span>
            <span>{t('admin_extra.doc_col_status', 'Status')}</span>
            <span>{t('admin_extra.col_due_date', 'Due Date')}</span>
            <span className="text-right">{t('admin_extra.doc_col_actions', 'Actions')}</span>
          </div>

          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={6} />
            </div>
          ) : error ? (
            <ErrorState onRetry={load} />
          ) : requests.length === 0 ? (
            <EmptyState
              title={t('admin_extra.empty_no_requests', 'No document requests')}
              description={
                statusFilter || debouncedSearch
                  ? t('admin_extra.empty_no_filter_match', 'No requests match your filters.')
                  : t('admin_extra.empty_requests_hint', 'Click "Request Document" to create the first request.')
              }
              icon={FileText}
            />
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {requests.map((req) => (
                <li key={req.id}>
                  {(() => {
                    const hasDetails = !!(req.instructions || req.rejection_reason);

                    const btnCls = 'p-1 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-40';

                    // Inline actions — max 2 icons to keep column at 80px
                    const inlineActions = canReview(req.status) ? (
                      <>
                        <button type="button" title="Approve"
                          disabled={approvingId === req.id}
                          onClick={() => void handleApprove(req)}
                          className={btnCls}
                          style={{ color: 'var(--forest-green)' }}>
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button type="button" title="Reject"
                          onClick={() => setRejectTarget(req)}
                          className={btnCls}
                          style={{ color: '#dc2626' }}>
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    ) : hasDetails ? (
                      <button type="button"
                        title={expandedRows.has(req.id) ? 'Hide details' : 'View details'}
                        onClick={() => toggleExpand(req.id)}
                        className={btnCls}
                        style={{ color: expandedRows.has(req.id) ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
                        <Eye className="h-4 w-4" />
                      </button>
                    ) : null;

                    // Overflow menu items
                    const overflowItems: OverflowMenuItem[] = (() => {
                      const items: OverflowMenuItem[] = [];
                      if (canReview(req.status)) {
                        if (req.download_url) items.push({ label: 'Download file', icon: Download, onClick: () => void handleDownload(req) });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (req.status === 'approved') {
                        if (req.download_url) items.push({ label: 'Download file', icon: Download, onClick: () => void handleDownload(req) });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (canReupload(req.status)) {
                        items.push({ label: 'Request resubmission', icon: RotateCcw, onClick: () => void handleReupload(req), disabled: reuploadingId === req.id });
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      } else if (canRemind(req.status)) {
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                        items.push({ label: 'Send reminder', icon: Bell, onClick: () => void handleRemind(req), disabled: remindingId === req.id });
                        items.push({ label: 'Extend deadline', icon: CalendarClock, onClick: () => setExtendTarget(req) });
                        items.push({ label: 'Cancel request', icon: Trash2, onClick: () => setCancelTarget(req), danger: true });
                      } else if (req.status === 'scanning') {
                        if (hasDetails) items.push({ label: 'View details', icon: Eye, onClick: () => toggleExpand(req.id) });
                      }
                      return items;
                    })();

                    return (
                      <div
                        className="hidden md:grid gap-x-3 px-6 py-3 items-center"
                        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr) 140px 100px 80px' }}
                      >
                        {/* Applicant */}
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(22,101,52,0.10)' }}>
                            <User className="h-3 w-3" style={{ color: 'var(--forest-green)' }} />
                          </div>
                          <span className="text-sm font-medium truncate" title={req.applicant_name}
                            style={{ color: 'var(--foreground)' }}>
                            {req.applicant_name}
                          </span>
                        </div>

                        {/* Camper */}
                        <span className="text-sm truncate overflow-hidden" title={req.camper_name ?? undefined}
                          style={{ color: 'var(--muted-foreground)' }}>
                          {req.camper_name ?? '—'}
                        </span>

                        {/* Document — fixed-width icon container so text always starts at same position */}
                        <div className="flex items-center overflow-hidden min-w-0">
                          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 20 }}>
                            <FileText className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
                          </span>
                          <span className="text-sm font-medium truncate ml-1.5" title={req.document_type}
                            style={{ color: 'var(--foreground)', whiteSpace: 'nowrap' }}>
                            {req.document_type}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="overflow-hidden">
                          <StatusBadge status={req.status} />
                        </div>

                        {/* Due date */}
                        <span className="text-sm whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                          {req.due_date ? format(new Date(req.due_date), 'MMM d, yyyy') : '—'}
                        </span>

                        {/* Actions — fixed 80px column, always right-aligned so icons anchor to the right edge */}
                        <div className="flex items-center justify-end gap-0.5 w-full">
                          {inlineActions}
                          <OverflowMenu items={overflowItems} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Mobile fallback */}
                  <div className="md:hidden px-4 py-3 flex flex-col gap-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{req.applicant_name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{req.document_type}</span>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Instructions / rejection reason (collapsible secondary row) */}
                  {expandedRows.has(req.id) && (req.instructions || req.rejection_reason) && (
                    <div
                      className="px-6 pb-4 pt-1 text-xs rounded-b-lg border-t mx-0"
                      style={{ background: 'var(--dash-bg)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {req.rejection_reason && (
                        <p className="font-medium" style={{ color: '#dc2626' }}>
                          <strong>{t('admin_extra.doc_rejection_reason', 'Rejection reason:')}</strong> {req.rejection_reason}
                        </p>
                      )}
                      {req.instructions && (
                        <p className={req.rejection_reason ? 'mt-1' : ''}>
                          <strong style={{ color: 'var(--foreground)' }}>{t('admin_extra.instructions_label', 'Instructions:')}</strong> {req.instructions}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {total} request{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {page} / {lastPage}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        </>)}
      </div>
    </>
  );
}
