/**
 * ApplicantDocumentsPage.tsx
 *
 * Purpose: Document management for applicants — a unified task-based system.
 *
 * Architecture:
 *   - UnifiedTask: normalized view over DocumentRequestRecord + RequiredDocument.
 *     Both data sources map to a single task interface sorted by urgency.
 *   - TaskCard: fully self-contained card per task, including its own file input
 *     ref. Upload happens in-card — no separate upload section for tasks.
 *   - Four states per task: not_started → rejected → waiting → completed.
 *   - "Staged" is a client-only sub-state of not_started: file selected, not yet
 *     submitted. This is the honest local analog of "in progress."
 *   - Progress bar covers all unified tasks at the top of the task section.
 *   - Supplementary UploadArea remains below for general (non-required) docs.
 *   - PreviewModal: inline image / PDF iframe / open-in-tab fallback.
 *   - SendDocumentModal: notify admin via inbox conversation thread.
 */

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  X,
  File,
  Send,
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';

import {
  getDocuments,
  deleteDocument,
  uploadDocument,
  submitDocument,
  getRequiredDocuments,
  submitCompletedDocument,
  getDocumentRequests,
  uploadDocumentRequest,
  getApplications,
  type Document,
  type RequiredDocument,
  type DocumentRequestRecord,
} from '@/features/parent/api/applicant.api';
import {
  getDocumentLabel,
  getDocumentNote,
  UNIVERSAL_REQUIRED_DOC_TYPES,
} from '@/shared/constants/documentRequirements';
import {
  searchInboxUsers,
  createConversation,
  sendMessage,
  type ConversationParticipant,
} from '@/features/messaging/api/messaging.api';
import { Button } from '@/ui/components/Button';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import axiosInstance from '@/api/axios.config';
import { ROLE_LABELS, type RoleName } from '@/shared/constants/roles';

// File types accepted by the hidden <input> and the drag-and-drop zone
const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';

// Converts raw byte count into a human-readable string (B / KB / MB)
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// PDF icon is red (conventional); all other file types get a blue generic icon
function FileIcon({ mime }: { mime: string }) {
  const isPdf = mime === 'application/pdf';
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: isPdf ? 'rgba(239,68,68,0.10)' : 'rgba(96,165,250,0.10)' }}
    >
      {isPdf
        ? <FileText className="h-4 w-4" style={{ color: '#ef4444' }} />
        : <File className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
      }
    </div>
  );
}

// ---------------------------------------------------------------------------
// PreviewModal — renders an image, PDF iframe, or a "can't preview" fallback
// ---------------------------------------------------------------------------

function PreviewModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const isImage = doc.mime_type.startsWith('image/');
  const isPdf   = doc.mime_type === 'application/pdf';

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
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--card)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header: filename + close + download */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
            {doc.file_name}
          </span>
          <div className="flex items-center gap-1">
            <a
              href={doc.url}
              download={doc.file_name}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              title="Download"
            >
              <Download className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            >
              <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 'calc(90vh - 56px)' }}>
          {isImage && (
            <img
              src={doc.url}
              alt={doc.file_name}
              className="w-full h-auto object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={doc.url}
              title={doc.file_name}
              className="w-full border-0"
              style={{ height: '75vh' }}
            />
          )}
          {!isImage && !isPdf && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <FileText className="h-12 w-12" style={{ color: 'var(--muted-foreground)' }} />
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Preview not available for this file type.
              </p>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--ember-orange)' }}
              >
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendDocumentModal — notify an admin about a specific document via inbox
// ---------------------------------------------------------------------------

function SendDocumentModal({
  doc,
  onClose,
}: {
  doc: Document;
  onClose: () => void;
}) {
  const [admins, setAdmins]               = useState<ConversationParticipant[]>([]);
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [message, setMessage]             = useState(
    `Hi, I'm sharing a document with you:\n\nDocument: ${doc.file_name}\nType: ${doc.document_type}\n\nPlease let me know if you need anything else.`
  );
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [sending, setSending]             = useState(false);

  useEffect(() => {
    searchInboxUsers('')
      .then((users) => {
        setAdmins(users);
        if (users.length > 0) setSelectedId(users[0].id);
      })
      .catch(() => toast.error('Could not load admin recipients.'))
      .finally(() => setLoadingAdmins(false));
  }, []);

  async function handleSend() {
    if (!selectedId || !message.trim()) return;
    setSending(true);
    try {
      const conv = await createConversation({
        subject: `Document: ${doc.file_name}`,
        participant_ids: [selectedId],
        category: 'general',
      });
      await sendMessage(conv.id, message.trim());
      toast.success('Document notification sent to admin.');
      onClose();
    } catch {
      toast.error('Failed to send. Please try again.');
    } finally {
      setSending(false);
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
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--card)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Send document to admin
            </p>
            <p className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
              {doc.file_name}
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
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="send-doc-recipient" className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Send to
            </label>
            {loadingAdmins ? (
              <div className="h-9 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
            ) : admins.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No admin recipients available.</p>
            ) : (
              <select
                id="send-doc-recipient"
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({ROLE_LABELS[a.role as RoleName] ?? a.role})</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="send-doc-message" className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
              Message
            </label>
            <textarea
              id="send-doc-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)] resize-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        </div>
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!selectedId || !message.trim() || sending || loadingAdmins || admins.length === 0}
            loading={sending}
            onClick={() => void handleSend()}
            className="flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UploadArea — supplementary drag-and-drop for general (non-required) docs
// ---------------------------------------------------------------------------

function UploadArea({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, documentType: string) => Promise<void>;
  uploading: boolean;
}) {
  const inputRef              = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('');
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (!docType.trim()) {
      toast.error('Please enter a document type before uploading.');
      return;
    }
    await onUpload(file, docType.trim());
    setDocType('');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col gap-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Upload additional document</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          For documents not listed above — PDF, JPG, or PNG · Max 10 MB
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Document type (e.g. Insurance Card, ID)"
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        />
      </div>
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors"
        style={{
          borderColor: dragging ? 'var(--ember-orange)' : 'var(--border)',
          background: dragging ? 'rgba(22,101,52,0.04)' : 'var(--dash-bg)',
        }}
      >
        <Upload className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Drag & drop or <span style={{ color: 'var(--ember-orange)' }}>browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {uploading && (
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>Uploading…</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified task system — normalizes DocumentRequestRecord + RequiredDocument
// ---------------------------------------------------------------------------

// Four states a task can be in from the applicant's perspective
type TaskStatus = 'not_started' | 'rejected' | 'waiting' | 'completed';

// Sort order: most urgent first
const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  not_started: 0,
  rejected: 1,
  waiting: 2,
  completed: 3,
};

interface UnifiedTask {
  // Stable key for React reconciliation and staged-file map
  key: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  isRequired: boolean;
  isOverdue: boolean;
  dueDate: string | null;
  requestedBy: string | null;
  requestedAt: string | null;
  rejectionReason: string | null;
  // Filename of an already-uploaded response (shown in waiting/completed states)
  uploadedFileName: string | null;
  // Matched Document from the uploads list — enables the inline View button
  linkedDoc: Document | null;
  // Whether this task has an admin-provided blank form to download first
  canDownload: boolean;
  // Source discriminator for routing submit calls to the right API
  source: 'doc_request' | 'required_doc';
  sourceId: number;
}

// Map a DocumentRequestRecord → UnifiedTask
function fromDocRequest(req: DocumentRequestRecord, documents: Document[]): UnifiedTask {
  const status: TaskStatus =
    req.status === 'approved'                               ? 'completed'   :
    req.status === 'rejected'                               ? 'rejected'    :
    req.status === 'awaiting_upload' || req.status === 'overdue' ? 'not_started' :
    'waiting'; // uploaded | scanning | under_review

  // Best-effort match: find a user document whose type matches the request label
  const linkedDoc = documents.find(
    (d) => d.document_type.toLowerCase() === req.document_type.toLowerCase()
  ) ?? null;

  return {
    key: `req-${req.id}`,
    title: getDocumentLabel(req.document_type, 'applicant'),
    description: req.instructions,
    status,
    isRequired: true,
    isOverdue: req.status === 'overdue',
    dueDate: req.due_date,
    requestedBy: req.requested_by_name,
    requestedAt: req.created_at,
    rejectionReason: req.rejection_reason,
    uploadedFileName: req.uploaded_file_name,
    linkedDoc,
    canDownload: false,
    source: 'doc_request',
    sourceId: req.id,
  };
}

// Map a RequiredDocument → UnifiedTask
function fromRequiredDoc(doc: RequiredDocument, _documents: Document[]): UnifiedTask {
  const status: TaskStatus =
    doc.status === 'reviewed'  ? 'completed'   :
    doc.status === 'submitted' ? 'waiting'     :
    'not_started'; // pending

  return {
    key: `rdoc-${doc.id}`,
    title: doc.original_file_name,
    description: doc.instructions,
    status,
    isRequired: true,
    isOverdue: false,
    dueDate: null,
    requestedBy: null,
    requestedAt: doc.created_at,
    rejectionReason: null,
    uploadedFileName: doc.submitted_file_name ?? null,
    linkedDoc: null,
    canDownload: true, // admin provides a blank form via download_url
    source: 'required_doc',
    sourceId: doc.id,
  };
}

// ---------------------------------------------------------------------------
// TaskCard — self-contained card rendering one task in its current state.
//
// The file input ref lives inside this component so upload always happens
// in-place, adjacent to the task description — no page scrolling required.
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: UnifiedTask;
  stagedFile: File | null;
  submitting: boolean;
  onFileSelected: (file: File) => void;
  onClearStaged: () => void;
  onSubmit: () => void;
  onDownload?: () => void;
  onViewDoc: (doc: Document) => void;
  // View the already-uploaded file for this task (waiting state, private storage)
  onViewUploaded?: () => void;
  viewingUploaded?: boolean;
}

function TaskCard({
  task, stagedFile, submitting, onFileSelected, onClearStaged, onSubmit, onDownload, onViewDoc,
  onViewUploaded, viewingUploaded,
}: TaskCardProps) {
  // Each card manages its own hidden file input — no external ref map needed
  const inputRef = useRef<HTMLInputElement>(null);
  const { status } = task;
  const needsAction = status === 'not_started' || status === 'rejected';

  // All visual tokens derived from status in one place
  const v = {
    not_started: {
      strip: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.12)',
      iconColor: '#f59e0b',
      badgeBg: 'rgba(245,158,11,0.12)',
      badgeColor: '#b45309',
      label: 'Upload Required',
      border: 'rgba(245,158,11,0.45)',
      cardBg: 'rgba(253,230,138,0.04)',
    },
    rejected: {
      strip: '#ef4444',
      iconBg: 'rgba(239,68,68,0.12)',
      iconColor: '#ef4444',
      badgeBg: 'rgba(239,68,68,0.12)',
      badgeColor: '#dc2626',
      label: 'Action Required',
      border: 'rgba(239,68,68,0.45)',
      cardBg: 'rgba(254,202,202,0.06)',
    },
    waiting: {
      strip: null as string | null,
      iconBg: 'rgba(59,130,246,0.10)',
      iconColor: '#3b82f6',
      badgeBg: 'rgba(59,130,246,0.10)',
      badgeColor: '#1d4ed8',
      label: 'Under Review',
      border: 'var(--border)',
      cardBg: 'var(--card)',
    },
    completed: {
      strip: null as string | null,
      iconBg: 'rgba(22,101,52,0.10)',
      iconColor: '#166534',
      badgeBg: 'rgba(22,101,52,0.10)',
      badgeColor: '#166534',
      label: 'Completed',
      border: 'var(--border)',
      cardBg: 'var(--card)',
    },
  }[status];

  const StateIcon = {
    not_started: Upload,
    rejected: AlertTriangle,
    waiting: Clock,
    completed: CheckCircle,
  }[status];

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: v.cardBg,
        borderColor: v.border,
        // Fade completed items so they recede and leave urgency to active tasks
        opacity: status === 'completed' ? 0.68 : 1,
      }}
    >
      {/* Urgency strip — only rendered when action is required */}
      {v.strip && <div className="h-1 w-full" style={{ background: v.strip }} />}

      <div className="p-5 flex flex-col gap-4">

        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* State icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: v.iconBg }}
            >
              <StateIcon className="h-4 w-4" style={{ color: v.iconColor }} />
            </div>
            {/* Title + meta */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
                  {task.title}
                </p>
                {task.isRequired && (
                  <span
                    className="inline-block px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                    style={{
                      background: 'rgba(239,68,68,0.10)',
                      color: '#dc2626',
                      fontSize: '9px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              {task.requestedBy && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Requested by {task.requestedBy}
                  {task.requestedAt && ` · ${format(new Date(task.requestedAt), 'MMM d, yyyy')}`}
                </p>
              )}
              {!task.requestedBy && task.requestedAt && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  Sent {format(new Date(task.requestedAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
          {/* Status pill — top-right, always visible */}
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 whitespace-nowrap"
            style={{ background: v.badgeBg, color: v.badgeColor }}
          >
            {v.label}
          </span>
        </div>

        {/* ── DESCRIPTION ────────────────────────────────────────────── */}
        {task.description && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
            {task.description}
          </p>
        )}

        {/* ── REJECTION REASON ───────────────────────────────────────── */}
        {task.rejectionReason && (
          <div
            className="rounded-xl px-3.5 py-3 text-xs leading-relaxed"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}
          >
            <span className="font-semibold">Why it was rejected: </span>
            {task.rejectionReason}
          </div>
        )}

        {/* ── DUE DATE ───────────────────────────────────────────────── */}
        {task.dueDate && (
          <p
            className="text-xs font-semibold"
            style={{ color: task.isOverdue ? '#dc2626' : '#b45309' }}
          >
            {task.isOverdue ? '⚠ Overdue — ' : 'Due '}
            {format(new Date(task.dueDate), 'MMMM d, yyyy')}
          </p>
        )}

        {/* ── ACTION ZONE ────────────────────────────────────────────── */}
        {/* Separated from metadata by a divider to signal interactivity */}
        <div className="pt-3.5 border-t flex flex-col gap-2" style={{ borderColor: 'var(--border)' }}>

          {/* NOT STARTED / REJECTED: always show Upload + Submit (Submit disabled until file staged) */}
          {needsAction && (
            <div className="flex items-center gap-2 flex-wrap">
              {task.canDownload && onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDownload}
                  className="flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Form
                </Button>
              )}
              {/* Staged file pill */}
              {stagedFile && (
                <div
                  className="flex-1 min-w-0 flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--dash-bg)', border: '1px solid var(--border)' }}
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-xs truncate font-medium" style={{ color: 'var(--foreground)' }}>
                    {stagedFile.name}
                  </span>
                </div>
              )}
              {/* Upload / Change File button */}
              <Button
                variant={stagedFile ? 'ghost' : 'primary'}
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <Upload className="h-3.5 w-3.5" />
                {stagedFile ? 'Change File' : 'Upload Document'}
              </Button>
              {/* Submit — always visible; disabled until a file is staged */}
              <Button
                variant="primary"
                size="sm"
                disabled={!stagedFile || submitting}
                loading={submitting}
                onClick={onSubmit}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                Submit
              </Button>
              {/* Clear staged file */}
              {stagedFile && !submitting && (
                <button
                  type="button"
                  onClick={onClearStaged}
                  className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
                  title="Remove selected file"
                >
                  <X className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                </button>
              )}
            </div>
          )}

          {/* WAITING: uploaded filename + "awaiting review" + View uploaded doc */}
          {status === 'waiting' && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                {task.uploadedFileName && (
                  <>
                    <FileText className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {task.uploadedFileName}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs" style={{ color: '#1d4ed8' }}>
                  <Clock className="h-3.5 w-3.5" />
                  Awaiting review
                </span>
                {/* Show View for doc_request tasks using the private download endpoint */}
                {onViewUploaded && task.uploadedFileName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={viewingUploaded}
                    loading={viewingUploaded}
                    onClick={onViewUploaded}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                )}
                {/* Fallback: linkedDoc from documents list (required_doc tasks) */}
                {!onViewUploaded && task.linkedDoc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDoc(task.linkedDoc!)}
                    className="flex items-center gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* COMPLETED: green checkmark + optional View */}
          {status === 'completed' && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#166534' }}>
                <CheckCircle className="h-4 w-4" />
                Approved — no further action needed
              </div>
              {task.linkedDoc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDoc(task.linkedDoc!)}
                  className="flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </Button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Hidden file input — lives inside the card, triggered by the Upload button */}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelected(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ApplicantDocumentsPage() {
  useTranslation(); // i18n hook kept for future label keys

  // ── API data ──────────────────────────────────────────────────────────────
  const [documents,        setDocuments]        = useState<Document[]>([]);
  const [requiredDocs,     setRequiredDocs]     = useState<RequiredDocument[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(false);

  // ── Active application — required docs are linked to this application ─────
  // We prefer a submitted (non-draft) application; fall back to any draft.
  // Without an applicationId, required doc uploads would be orphaned (no
  // documentable association) and admin queries would not find them.
  const [activeApplicationId, setActiveApplicationId] = useState<number | null>(null);

  // ── Required doc upload state (per-type) ─────────────────────────────────
  // Each key is a document type string from UNIVERSAL_REQUIRED_DOC_TYPES.
  const [requiredDocUploading, setRequiredDocUploading] = useState<string | null>(null);
  // Per-type file input refs so each card triggers its own hidden <input>.
  const requiredDocInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── General upload state (UploadArea — supplementary docs) ───────────────
  const [uploading, setUploading] = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  // Whichever Document is being previewed (from My Documents OR from a task card)
  const [preview, setPreview]   = useState<Document | null>(null);
  const [sendDoc, setSendDoc]   = useState<Document | null>(null);

  // ── My Documents list ─────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ── Unified task upload state ─────────────────────────────────────────────
  // Staged files: keyed by UnifiedTask.key ('req-3' or 'rdoc-7')
  const [stagedTaskFiles,   setStagedTaskFiles]   = useState<Record<string, File>>({});
  const [submittingTaskKey, setSubmittingTaskKey] = useState<string | null>(null);
  // Track which doc_request is being fetched for preview
  const [viewingUploadedId, setViewingUploadedId] = useState<number | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = () => {
    setLoading(true);
    setError(false);
    Promise.allSettled([getDocuments(), getRequiredDocuments(), getDocumentRequests()])
      .then(([docsResult, reqResult, docReqResult]) => {
        if (docsResult.status === 'fulfilled') setDocuments(docsResult.value);
        else setError(true);
        if (reqResult.status === 'fulfilled')   setRequiredDocs(reqResult.value);
        if (docReqResult.status === 'fulfilled')
          setDocumentRequests(Array.isArray(docReqResult.value) ? docReqResult.value : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Load the active application ID so required doc uploads can be associated
    // with the correct application record (not orphaned with null documentable).
    getApplications()
      .then((apps) => {
        const submitted = apps.find((a) => !a.is_draft && a.submitted_at);
        const draft = apps.find((a) => a.is_draft);
        setActiveApplicationId((submitted ?? draft)?.id ?? null);
      })
      .catch(() => { /* non-critical — page still works, uploads fall back to orphaned */ });
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Required document upload — canonical type enforced, linked to the active
  // application, immediately submitted so admin can see it without a second step.
  async function handleRequiredDocUpload(file: File, docType: string) {
    setRequiredDocUploading(docType);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', docType);
      // Association: link to the application record, not orphaned.
      // Both ApplicationController::show() and DocumentEnforcementService query
      // Application-polymorphic docs, so this ensures admin can see the doc.
      if (activeApplicationId !== null) {
        fd.append('documentable_type', 'App\\Models\\Application');
        fd.append('documentable_id', String(activeApplicationId));
      }
      const uploaded = await uploadDocument(fd);
      // Submit immediately — applicant uploads start as drafts (submitted_at = null)
      // and are invisible to admin until submitted. Required docs must be visible
      // to staff as soon as they are uploaded; there is no reason to stage them.
      await submitDocument(uploaded.id);
      toast.success(`${getDocumentLabel(docType, 'applicant')} submitted to staff.`);
      load();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setRequiredDocUploading(null);
    }
  }

  // Supplementary upload (UploadArea — not linked to a specific task)
  async function handleUpload(file: File, documentType: string) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('document_type', documentType);
      await uploadDocument(fd);
      toast.success('Document uploaded.');
      load();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // Unified task submit — routes to the correct API based on source
  async function handleTaskSubmit(task: UnifiedTask) {
    const file = stagedTaskFiles[task.key];
    if (!file) return;
    setSubmittingTaskKey(task.key);
    try {
      if (task.source === 'doc_request') {
        const updated = await uploadDocumentRequest(task.sourceId, file);
        setDocumentRequests((prev) => prev.map((r) => r.id === task.sourceId ? updated : r));
      } else {
        const updated = await submitCompletedDocument(task.sourceId, file);
        setRequiredDocs((prev) => prev.map((d) => d.id === task.sourceId ? { ...d, ...updated } : d));
      }
      setStagedTaskFiles((prev) => { const n = { ...prev }; delete n[task.key]; return n; });
      toast.success('Document submitted successfully.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Upload failed: ${msg}` : 'Upload failed. Please try again.');
    } finally {
      setSubmittingTaskKey(null);
    }
  }

  // Fetch and preview the applicant's own uploaded file for a doc_request task.
  // Files are stored on private disk — served via the authenticated download route.
  async function handleViewUploaded(req: DocumentRequestRecord) {
    setViewingUploadedId(req.id);
    try {
      const res = await axiosInstance.get(
        `/applicant/document-requests/${req.id}/download`,
        { responseType: 'blob' }
      );
      const contentType = (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream';
      const blob = res.data as Blob;
      const objectUrl = URL.createObjectURL(blob);
      // Construct a synthetic Document so PreviewModal can render it directly
      setPreview({
        id: req.id,
        file_name: req.uploaded_file_name ?? 'document',
        mime_type: contentType.split(';')[0].trim(),
        url: objectUrl,
        size: blob.size,
        document_type: req.document_type,
        created_at: req.uploaded_at ?? req.created_at,
      } as Document);
    } catch {
      toast.error('Could not load document preview.');
    } finally {
      setViewingUploadedId(null);
    }
  }

  // View the applicant's own submitted file for a required_doc task.
  // Uses the authenticated download-submitted endpoint (private disk, blob response).
  const [viewingSubmittedId, setViewingSubmittedId] = useState<number | null>(null);

  async function handleViewSubmitted(doc: RequiredDocument) {
    setViewingSubmittedId(doc.id);
    try {
      const res = await axiosInstance.get(
        `/applicant/applicant-documents/${doc.id}/download-submitted`,
        { responseType: 'blob' }
      );
      const contentType = (res.headers['content-type'] as string | undefined) ?? 'application/octet-stream';
      const blob = res.data as Blob;
      const objectUrl = URL.createObjectURL(blob);
      setPreview({
        id: doc.id,
        file_name: doc.submitted_file_name ?? 'document',
        mime_type: contentType.split(';')[0].trim(),
        url: objectUrl,
        size: blob.size,
        document_type: doc.original_file_name,
        created_at: doc.created_at,
      } as Document);
    } catch {
      toast.error('Could not load document preview.');
    } finally {
      setViewingSubmittedId(null);
    }
  }

  // Download the admin-provided blank form for a RequiredDocument task
  async function handleTaskDownload(task: UnifiedTask) {
    const doc = requiredDocs.find((d) => d.id === task.sourceId);
    if (!doc) return;
    try {
      const path = doc.download_url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '');
      const res  = await axiosInstance.get(path, { responseType: 'blob' });
      const url  = URL.createObjectURL(res.data as Blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = doc.original_file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  }

  async function handleDelete(doc: Document) {
    if (!window.confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document deleted.');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg ? `Delete failed: ${msg}` : 'Delete failed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Unified task list ─────────────────────────────────────────────────────
  // Merge both data sources, sort urgently-needed tasks to the top
  const unifiedTasks: UnifiedTask[] = [
    ...documentRequests.map((r) => fromDocRequest(r, documents)),
    ...requiredDocs.map((d) => fromRequiredDoc(d, documents)),
  ].sort((a, b) => TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status]);

  const completedTaskCount = unifiedTasks.filter((t) => t.status === 'completed').length;
  const totalTaskCount     = unifiedTasks.length;
  const allComplete        = totalTaskCount > 0 && completedTaskCount === totalTaskCount;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Modals — rendered at root level to avoid z-index stacking issues */}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
      {sendDoc  && <SendDocumentModal doc={sendDoc} onClose={() => setSendDoc(null)} />}

      <div className="flex flex-col gap-8 max-w-4xl">

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Documents
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Complete the tasks below, then upload any additional documents required for your application.
          </p>
        </div>

        {/* ── Universal Required Documents ─────────────────────────────── */}
        {/* Immunization Record and Insurance Card are required for every applicant.
            This section provides a dedicated, typed upload path so the canonical
            document_type key is always stored correctly and the document is linked
            to the active application (not orphaned) and submitted to staff immediately.
            Without this section, applicants would use the free-text supplementary
            upload area, which risks type mismatches and orphaned draft records that
            are invisible to admin due to the submitted_at IS NOT NULL filter. */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Required Documents
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            These documents are required for all applicants. Upload each one — they will be submitted to staff automatically.
          </p>

          <div className="flex flex-col gap-3">
            {UNIVERSAL_REQUIRED_DOC_TYPES.map((docType) => {
              // Find the best match: prefer submitted, then draft (most recent first).
              const submittedDoc = documents
                .filter((d) => d.document_type === docType && d.submitted_at)
                .sort((a, b) => new Date(b.submitted_at!).getTime() - new Date(a.submitted_at!).getTime())[0] ?? null;
              const draftDoc = !submittedDoc
                ? documents
                    .filter((d) => d.document_type === docType && !d.submitted_at)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
                : null;
              const existingDoc = submittedDoc ?? draftDoc;
              const isSubmitted = !!submittedDoc;
              const isDraft = !!draftDoc && !submittedDoc;
              const isUploading = requiredDocUploading === docType;
              const label = getDocumentLabel(docType, 'applicant');
              const note = getDocumentNote(docType);

              return (
                <div
                  key={docType}
                  className="rounded-2xl border px-5 py-4 flex items-center justify-between gap-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isSubmitted
                          ? 'rgba(22,163,74,0.10)'
                          : 'rgba(234,88,12,0.08)',
                      }}
                    >
                      {isSubmitted ? (
                        <CheckCircle className="h-4 w-4" style={{ color: '#16a34a' }} />
                      ) : (
                        <AlertTriangle className="h-4 w-4" style={{ color: '#ca8a04' }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
                      {note && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {note}
                        </p>
                      )}
                      {existingDoc && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {existingDoc.file_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isSubmitted ? (
                      <>
                        <span className="text-xs font-medium" style={{ color: '#16a34a' }}>Submitted to staff</span>
                        {/* Allow re-upload if needed (e.g. document expired) */}
                        <label className="cursor-pointer">
                          <input
                            ref={(el) => { requiredDocInputRefs.current[docType] = el; }}
                            type="file"
                            className="sr-only"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleRequiredDocUpload(f, docType);
                              e.target.value = '';
                            }}
                          />
                          <span
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors cursor-pointer"
                            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
                          >
                            Replace
                          </span>
                        </label>
                      </>
                    ) : isDraft ? (
                      <>
                        <span className="text-xs" style={{ color: '#ca8a04' }}>Draft — not visible to staff</span>
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={async () => {
                            if (draftDoc) {
                              setRequiredDocUploading(docType);
                              try {
                                await submitDocument(draftDoc.id);
                                toast.success(`${label} submitted to staff.`);
                                load();
                              } catch {
                                toast.error('Submit failed. Please try again.');
                              } finally {
                                setRequiredDocUploading(null);
                              }
                            }
                          }}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                          style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)', background: 'transparent' }}
                        >
                          {isUploading ? 'Submitting…' : 'Submit to Staff'}
                        </button>
                      </>
                    ) : (
                      <label className="cursor-pointer">
                        <input
                          ref={(el) => { requiredDocInputRefs.current[docType] = el; }}
                          type="file"
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png"
                          disabled={isUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleRequiredDocUpload(f, docType);
                            e.target.value = '';
                          }}
                        />
                        <span
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          style={{ background: 'var(--ember-orange)', color: '#fff' }}
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {isUploading ? 'Uploading…' : 'Upload'}
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Task panel — Documents Requested From You ─────────────────── */}
        {/* Always rendered — admins can create requests at any time and users
            need a stable place to look. Hidden section = hidden expectation. */}
        <section>

          {/* Section header */}
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
              Documents Requested From You
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {unifiedTasks.length > 0
              ? 'Upload each document below. The camp cannot process your application until all required items are submitted.'
              : 'If camp staff needs additional documents from you, they will appear here.'}
          </p>

          {loading ? (
            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <SkeletonTable rows={3} />
            </div>
          ) : unifiedTasks.length === 0 ? (
            /* Empty state — always visible so users know where to look */
            <div
              className="rounded-2xl border px-6 py-10 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(234,88,12,0.08)' }}
              >
                <ClipboardList className="h-5 w-5" style={{ color: 'var(--ember-orange)' }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  No documents requested yet
                </p>
                <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Camp staff will send you a request here if they need specific documents from you. Check back after submitting your application.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Progress bar — only shown when tasks exist */}
              <div
                className="rounded-2xl border px-5 py-4 mb-4 flex items-center gap-4"
                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                      {allComplete
                        ? 'All documents submitted'
                        : `${totalTaskCount - completedTaskCount} document${totalTaskCount - completedTaskCount !== 1 ? 's' : ''} still needed`}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: allComplete ? '#166534' : '#b45309' }}
                    >
                      {completedTaskCount} / {totalTaskCount}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(completedTaskCount / totalTaskCount) * 100}%`,
                        background: allComplete ? '#166534' : 'var(--ember-orange)',
                      }}
                    />
                  </div>
                </div>
                {allComplete && (
                  <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: '#166534' }} />
                )}
              </div>

              {/* Task cards */}
              <div className="flex flex-col gap-3">
                {unifiedTasks.map((task) => {
                    // doc_request: view via private download endpoint
                    const req = task.source === 'doc_request'
                      ? documentRequests.find((r) => r.id === task.sourceId) ?? null
                      : null;
                    // required_doc: view the submitted file via its own endpoint
                    const rdoc = task.source === 'required_doc'
                      ? requiredDocs.find((d) => d.id === task.sourceId) ?? null
                      : null;
                    const viewUploadedHandler =
                      req  ? () => void handleViewUploaded(req)  :
                      rdoc ? () => void handleViewSubmitted(rdoc) :
                      undefined;
                    const isViewingUploaded =
                      req  ? viewingUploadedId  === req.id  :
                      rdoc ? viewingSubmittedId === rdoc.id :
                      false;
                    return (
                      <TaskCard
                        key={task.key}
                        task={task}
                        stagedFile={stagedTaskFiles[task.key] ?? null}
                        submitting={submittingTaskKey === task.key}
                        onFileSelected={(file) =>
                          setStagedTaskFiles((prev) => ({ ...prev, [task.key]: file }))
                        }
                        onClearStaged={() =>
                          setStagedTaskFiles((prev) => {
                            const n = { ...prev };
                            delete n[task.key];
                            return n;
                          })
                        }
                        onSubmit={() => void handleTaskSubmit(task)}
                        onDownload={task.canDownload ? () => void handleTaskDownload(task) : undefined}
                        onViewDoc={(doc) => setPreview(doc)}
                        onViewUploaded={viewUploadedHandler}
                        viewingUploaded={isViewingUploaded}
                      />
                    );
                  })}
                </div>
              </>
            )}
        </section>

        {/* ── Supplementary upload ─────────────────────────────────────── */}
        <UploadArea onUpload={handleUpload} uploading={uploading} />

        {/* ── My Documents ─────────────────────────────────────────────── */}
        <div>
          <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--foreground)' }}>
            My Documents
          </h3>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {loading ? (
              <div className="p-4"><SkeletonTable rows={4} /></div>
            ) : error ? (
              <ErrorState onRetry={load} />
            ) : documents.length === 0 ? (
              <EmptyState
                title="No documents uploaded"
                description="Upload your first document using the area above."
                icon={FileText}
              />
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <div className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileIcon mime={doc.mime_type} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                            {doc.file_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                            <span>{getDocumentLabel(doc.document_type, 'applicant')}</span>
                            <span aria-hidden="true">&middot;</span>
                            <span>{formatBytes(doc.size)}</span>
                            <span aria-hidden="true">&middot;</span>
                            <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreview(doc)}
                          className="flex items-center gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSendDoc(doc)}
                          className="flex items-center gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          loading={deletingId === doc.id}
                          disabled={deletingId === doc.id}
                          onClick={() => void handleDelete(doc)}
                          className="flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
