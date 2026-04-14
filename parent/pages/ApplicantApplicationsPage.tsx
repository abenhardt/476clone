/**
 * ApplicantApplicationsPage.tsx
 *
 * Purpose: Lists all applications for the current applicant's campers.
 * Responsibilities:
 *   - Fetch all applications from the API on mount
 *   - Detect a locally-saved draft in sessionStorage and surface a "Continue" card
 *   - Allow filtering by view mode (all / active / past) and by specific status
 *   - Sort the filtered list newest-first or oldest-first
 *   - Render applications in grouped sections: Drafts, Active, Past
 *
 * Plain-English: This is the parent's filing cabinet — every application they've
 * ever started or submitted lives here, organized so the ones that still need
 * attention are easy to find at the top.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  FileText,
  ArrowRight,
  Calendar,
  ChevronDown,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

import { useTranslation } from 'react-i18next';
import {
  getApplications,
  getDrafts,
  deleteDraft as apiDeleteDraft,
  deleteApplication as apiDeleteApplication,
  type ApplicationDraft,
} from '@/features/parent/api/applicant.api';
import type { Application, ApplicationStatus, Camper } from '@/shared/types';
import { NewSessionModal } from '@/features/parent/components/NewSessionModal';
import { ROUTES } from '@/shared/constants/routes';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import { useAppSelector } from '@/store/hooks';

type ViewMode = 'all' | 'active' | 'past';
type SortOrder = 'newest' | 'oldest';

// Statuses that mean the application is still in flight and needs monitoring.
// waitlisted is included here — it can still be promoted to approved, so it is "active".
const ACTIVE_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'waitlisted'];
// Statuses that mean the process is finished (one way or another)
const PAST_STATUSES: ApplicationStatus[]   = ['approved', 'rejected', 'withdrawn', 'cancelled'];

// STATUS_LABELS is built inside the component to pick up language changes from i18next.

// Sort a copy of the list so we never mutate the original state array
function sortApps(apps: Application[], order: SortOrder): Application[] {
  return [...apps].sort((a, b) => {
    // Fall back to created_at if the application hasn't been submitted yet
    const dateA = new Date(a.submitted_at ?? a.created_at ?? '').getTime();
    const dateB = new Date(b.submitted_at ?? b.created_at ?? '').getTime();
    return order === 'newest' ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Confirmation modal for deleting a draft application.
 * Matches the directive spec: specific title, message, Cancel + Delete actions.
 */
function DeleteDraftModal({
  camperName,
  onConfirm,
  onCancel,
  loading,
}: {
  camperName: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  // Trap focus inside the modal when open
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return (
    // Backdrop
    <div
      role="button"
      tabIndex={-1}
      aria-label="Close dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onCancel(); }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-draft-dialog-title"
        className="w-full max-w-sm rounded-2xl p-6 shadow-xl flex flex-col gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(220,38,38,0.1)' }}
          >
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 id="delete-draft-dialog-title" className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Delete Draft Application
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {camperName
                ? `This will permanently delete the draft for ${camperName}.`
                : 'This will permanently delete this draft.'}{' '}
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-xl font-medium transition-colors bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Terminal application statuses — these allow initiating a new session application
// directly from the list row without navigating into the detail page.
const TERMINAL_STATUSES_SET = new Set(['approved', 'rejected', 'withdrawn', 'cancelled']);

// Single application row — a card that links to the detail page
function AppCard({
  app,
  onDeleteDraft,
  onNewSession,
}: {
  app: Application;
  onDeleteDraft?: (app: Application) => void;
  /** Called when the user clicks "New Session" on a terminal application row. */
  onNewSession?: (app: Application) => void;
}) {
  const navigate = useNavigate();
  const isDraft = app.is_draft === true;
  const isTerminal = !isDraft && TERMINAL_STATUSES_SET.has(app.status);

  return (
    <li>
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        {/* The entire left side is a link to the detail page */}
        <Link
          to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}
          className="flex items-center gap-4 min-w-0 flex-1 hover:bg-[var(--dash-nav-hover-bg)] rounded-lg transition-colors -mx-2 px-2 py-1"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isDraft ? 'rgba(234,88,12,0.10)' : 'rgba(96,165,250,0.1)' }}
          >
            <FileText
              className="h-4 w-4"
              style={{ color: isDraft ? 'var(--ember-orange)' : 'var(--night-sky-blue)' }}
            />
          </div>
          <div className="min-w-0">
            {/* Fall back to a generic label if the camper was not eager-loaded */}
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {app.camper?.full_name ?? `Camper #${app.camper_id}`}
            </p>
            <div
              className="flex items-center gap-2 text-xs mt-0.5"
              style={{ color: 'var(--muted-foreground)' }}
            >
              <Calendar className="h-3 w-3" />
              <span>{app.session?.name ?? `Session #${app.session_id}`}</span>
              {isDraft ? (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Draft – Not Submitted</span>
                </>
              ) : app.submitted_at ? (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>Submitted {format(new Date(app.submitted_at), 'MMM d, yyyy')}</span>
                </>
              ) : null}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isDraft ? (
            // Draft: show Continue and Delete
            <>
              <Button
                size="sm"
                onClick={() => navigate(ROUTES.PARENT_APPLICATION_NEW, { state: { applicationId: app.id } })}
              >
                Continue
              </Button>
              {onDeleteDraft && (
                <button
                  type="button"
                  onClick={() => onDeleteDraft(app)}
                  className="p-2 rounded-lg border transition-colors hover:bg-red-50 hover:border-red-300"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  title="Delete draft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            // Submitted/reviewed: show status badge, optional "New Session" for terminal, and link to detail
            <>
              <StatusBadge status={app.status} />
              {/* "New Session" shortcut on terminal rows — lets the user start a
                  reapplication directly from the list without opening the detail page. */}
              {isTerminal && onNewSession && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onNewSession(app); }}
                  className="hidden sm:flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] whitespace-nowrap"
                  style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
                  title={`Apply for a new session for ${app.camper?.full_name ?? 'this camper'}`}
                >
                  <Plus className="h-3 w-3" />
                  New Session
                </button>
              )}
              <Link to={ROUTES.PARENT_APPLICATION_DETAIL(app.id)}>
                <ArrowRight className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// A labeled section card grouping a set of application rows under a title
function AppGroup({
  title,
  apps,
  onDeleteDraft,
  onNewSession,
}: {
  title: string;
  apps: Application[];
  onDeleteDraft?: (app: Application) => void;
  onNewSession?: (app: Application) => void;
}) {
  // Render nothing when there are no apps in this group — avoids empty section headers
  if (apps.length === 0) return null;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <div
        className="px-6 py-3 border-b"
        style={{ background: 'var(--dash-bg)', borderColor: 'var(--border)' }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {title}
        </span>
        {/* Count badge next to the section title */}
        <span
          className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          {apps.length}
        </span>
      </div>
      <ul
        className="divide-y"
        style={{ borderColor: 'var(--border)' }}
      >
        {apps.map((app) => (
          <AppCard key={app.id} app={app} onDeleteDraft={onDeleteDraft} onNewSession={onNewSession} />
        ))}
      </ul>
    </div>
  );
}

// Special card shown when a sessionStorage draft is detected (not yet submitted to the server)
function LocalDraftCard({ camperName, onDelete }: { camperName: string | null; onDelete: () => void }) {
  const navigate = useNavigate();
  return (
    // Ember-orange border draws the eye to this unfinished draft
    <div
      className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--ember-orange)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,101,52,0.10)' }}
        >
          <FileText className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {/* Show the camper name parsed from the draft, or a generic label */}
            {camperName ? `Draft — ${camperName}` : 'Application draft (in progress)'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Saved locally · Not yet submitted
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* "Continue" navigates back to the form, which re-hydrates from sessionStorage */}
        <Button size="sm" onClick={() => navigate(ROUTES.PARENT_APPLICATION_NEW)}>
          Continue
        </Button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg border transition-colors hover:bg-red-50 hover:border-red-300"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          title="Delete draft"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Card for a server-side draft — survives logout/login, deleteable
function ServerDraftCard({
  draft,
  onDelete,
}: {
  draft: ApplicationDraft;
  onDelete: (id: number) => void;
}) {
  const navigate = useNavigate();
  // Try to parse a camper name from the stored draft_data blob
  const label = draft.label && draft.label !== 'New Application' ? draft.label : null;
  return (
    <div
      className="flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border"
      style={{ background: 'var(--card)', borderColor: 'var(--ember-orange)' }}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(234,88,12,0.10)' }}
        >
          <FileText className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
              {label ?? 'Untitled application'}
            </p>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(234,88,12,0.12)', color: '#c2410c' }}
            >
              Draft – Not Submitted
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Last saved {new Date(draft.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={() => navigate(ROUTES.PARENT_APPLICATION_NEW, { state: { draftId: draft.id } })}
        >
          Continue
        </Button>
        <button
          type="button"
          onClick={() => onDelete(draft.id)}
          className="p-2 rounded-lg border transition-colors hover:bg-red-50 hover:border-red-300"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          title="Delete draft"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ApplicantApplicationsPage() {
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const localDraftKey = `cbg_app_draft_${userId ?? 'anon'}`;
  const navigate = useNavigate();

  // Built inside the component so labels re-compute when language changes.
  const STATUS_LABELS: Record<ApplicationStatus, string> = {
    submitted:    t('status_labels.submitted'),
    under_review: t('status_labels.under_review'),
    approved:     t('status_labels.approved'),
    rejected:     t('status_labels.rejected'),
    withdrawn:    t('status_labels.withdrawn'),
    cancelled:    t('status_labels.cancelled'),
    waitlisted:   t('status_labels.waitlisted'),
  };
  const [applications, setApplications] = useState<Application[]>([]);
  const [serverDrafts, setServerDrafts] = useState<ApplicationDraft[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(false);
  // View mode: 'all' shows all groups, 'active' only in-flight, 'past' only resolved
  const [view, setView]                 = useState<ViewMode>('all');
  // Specific status filter (overrides view mode when set).
  // 'draft' is not an ApplicationStatus — it maps to the is_draft boolean on the server.
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'draft' | ''>('');
  const [sortOrder, setSortOrder]       = useState<SortOrder>('newest');
  // Free-text search — filters by camper name (partial, case-insensitive, client-side)
  const [search, setSearch]             = useState('');
  // Holds camper name parsed from sessionStorage draft if one exists
  const [localDraft, setLocalDraft]     = useState<{ camperName: string | null } | null>(null);
  // Delete-draft confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'localDraft'; camperName: string | null }
    | { type: 'draft'; id: number; camperName: string | null }
    | { type: 'application'; app: Application }
    | null
  >(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // "Apply for a New Session" modal — opened from a terminal application row.
  // Stores: the camper for the modal header, and the source application ID for audit trail.
  const [newSessionTarget, setNewSessionTarget] = useState<{
    camper: Camper;
    reappliedFromId: number;
  } | null>(null);

  /**
   * Called when the user clicks "New Session" on a terminal application row.
   * Uses the clicked application as the audit-trail source for the new application.
   * The camper object must be present on the application (eager-loaded by the API).
   */
  function handleNewSessionFromApp(app: Application) {
    if (!app.camper) return;
    setNewSessionTarget({ camper: app.camper as Camper, reappliedFromId: app.id });
  }

  // On mount, try to read the local draft key and extract the camper's name
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(localDraftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { s1?: { camper_first_name?: string; camper_last_name?: string } };
      const first = (parsed.s1?.camper_first_name ?? '').trim();
      const last  = (parsed.s1?.camper_last_name  ?? '').trim();
      setLocalDraft({ camperName: first || last ? `${first} ${last}`.trim() : null });
    } catch { /* ignore corrupt draft */ }
  }, [localDraftKey]);

  // Fetch all applications + server drafts in parallel
  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([getApplications(), getDrafts()])
      .then(([apps, drafts]) => { setApplications(apps); setServerDrafts(drafts); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  /** Opens the delete-draft confirmation modal for a server-side ApplicationDraft. */
  function requestDeleteDraft(draftId: number, camperName: string | null) {
    setDeleteTarget({ type: 'draft', id: draftId, camperName });
  }

  /** Opens the delete confirmation modal for an Application record that is still a draft. */
  function requestDeleteApplication(app: Application) {
    setDeleteTarget({ type: 'application', app });
  }

  /** Executes the deletion after the user confirms in the modal. */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'localDraft') {
        // Local-only draft — no server record, just clear sessionStorage
        sessionStorage.removeItem(localDraftKey);
        setLocalDraft(null);
      } else if (deleteTarget.type === 'draft') {
        await apiDeleteDraft(deleteTarget.id);
        setServerDrafts((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      } else {
        await apiDeleteApplication(deleteTarget.app.id);
        setApplications((prev) => prev.filter((a) => a.id !== deleteTarget.app.id));
      }
    } catch { /* record already gone */ }
    setDeleteLoading(false);
    setDeleteTarget(null);
  }

  // Derive the filtered + sorted list without modifying state directly (useMemo)
  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter === 'draft') {
      // Drafts are flagged via is_draft rather than having a unique status value
      list = list.filter((a) => a.is_draft === true);
    } else if (statusFilter) {
      list = list.filter((a) => a.status === statusFilter && !a.is_draft);
    } else if (view === 'active') {
      list = list.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.is_draft);
    } else if (view === 'past') {
      list = list.filter((a) => PAST_STATUSES.includes(a.status));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) =>
        (a.camper?.full_name ?? `Camper #${a.camper_id}`).toLowerCase().includes(q)
      );
    }
    return sortApps(list, sortOrder);
  }, [applications, statusFilter, view, sortOrder, search]);

  // Pre-split the filtered list into three groups for the sectioned "all" view
  const draftApps = useMemo(
    () => filtered.filter((a) => a.is_draft === true),
    [filtered]
  );
  const activeApps = useMemo(
    () => filtered.filter((a) => ACTIVE_STATUSES.includes(a.status) && !a.is_draft),
    [filtered]
  );
  const pastApps = useMemo(
    () => filtered.filter((a) => PAST_STATUSES.includes(a.status)),
    [filtered]
  );

  // Resolve the camper name for the delete modal based on target type
  const deleteModalCamperName =
    deleteTarget?.type === 'localDraft' ? deleteTarget.camperName
    : deleteTarget?.type === 'draft'    ? deleteTarget.camperName
    : deleteTarget?.type === 'application' ? (deleteTarget.app.camper?.full_name ?? null)
    : null;

  return (
    <>
    {deleteTarget && (
      <DeleteDraftModal
        camperName={deleteModalCamperName}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />
    )}
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-headline font-semibold" style={{ color: 'var(--foreground)' }}>
            Applications
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            Track the status of your camper applications.
          </p>
        </div>
        <Button as={Link} to={ROUTES.PARENT_APPLICATION_START} size="sm">
          <Plus className="h-4 w-4" />
          New application
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode toggle — clears status filter when switching modes */}
        <div
          className="flex rounded-xl border p-0.5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {(['all', 'active', 'past'] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); setStatusFilter(''); }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg capitalize transition-colors"
              style={{
                // Highlighted button gets the brand color; inactive buttons are transparent
                background: view === v ? 'var(--ember-orange)' : 'transparent',
                color: view === v ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Status dropdown — selecting a status overrides the view mode grouping */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'draft' | '')}
            className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-xl border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">{t('admin_extra.all_statuses')}</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        {/* Sort order dropdown */}
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="appearance-none text-xs pl-3 pr-7 py-1.5 rounded-xl border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
        </div>

        {/* Camper name search — client-side partial match */}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by camper name…"
            className="text-xs pl-7 pr-3 py-1.5 rounded-xl border outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)', width: '180px' }}
          />
        </div>

        {/* Reset button appears only when a non-default filter is active */}
        {(statusFilter || view !== 'all') && (
          <button
            type="button"
            onClick={() => { setStatusFilter(''); setView('all'); setSortOrder('newest'); }}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Main content area */}
      {loading ? (
        <div className="rounded-2xl border p-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <SkeletonTable rows={5} />
        </div>
      ) : error ? (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <ErrorState onRetry={load} />
        </div>
      ) : filtered.length === 0 && !localDraft && serverDrafts.length === 0 ? (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
          <EmptyState
            title={applications.length === 0 ? 'No applications yet' : 'No matching applications'}
            description={
              applications.length === 0
                ? 'Submit an application to register a camper for a session.'
                : 'Try adjusting the filters to see more results.'
            }
            icon={FileText}
            action={
              applications.length === 0
                ? { label: 'Start your first application', onClick: () => navigate(ROUTES.PARENT_APPLICATION_START) }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
            {view === 'all' && !statusFilter ? (
              // Default grouped view: Drafts → Active → Past sections
              <>
                {(draftApps.length > 0 || localDraft || serverDrafts.length > 0) && (
                  <div className="flex flex-col gap-3">
                    <div className="px-1">
                      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                        Drafts
                      </span>
                      <span
                        className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        {serverDrafts.length + draftApps.length + (localDraft ? 1 : 0)}
                      </span>
                    </div>
                    {/* Server drafts — authoritative; survive logout/login */}
                    {serverDrafts.map((draft) => (
                      <ServerDraftCard
                        key={draft.id}
                        draft={draft}
                        onDelete={(id) => requestDeleteDraft(id, draft.label && draft.label !== 'New Application' ? draft.label : null)}
                      />
                    ))}
                    {/* LocalDraftCard is a fallback for pre-server-draft sessionStorage drafts */}
                    {localDraft && serverDrafts.length === 0 && (
                      <LocalDraftCard
                        camperName={localDraft.camperName}
                        onDelete={() => setDeleteTarget({ type: 'localDraft', camperName: localDraft.camperName })}
                      />
                    )}
                    {draftApps.length > 0 && (
                      <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <ul
                          className="divide-y"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {draftApps.map((app) => (
                            <AppCard key={app.id} app={app} onDeleteDraft={requestDeleteApplication} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <AppGroup title="Active Applications" apps={activeApps} />
                <AppGroup
                  title="Past Applications"
                  apps={pastApps}
                  onNewSession={handleNewSessionFromApp}
                />
              </>
            ) : statusFilter === 'draft' ? (
              // When "Draft" is selected in the status filter, show server drafts + local draft
              <div className="flex flex-col gap-3">
                {serverDrafts.map((draft) => (
                  <ServerDraftCard
                    key={draft.id}
                    draft={draft}
                    onDelete={(id) => requestDeleteDraft(id, draft.label && draft.label !== 'New Application' ? draft.label : null)}
                  />
                ))}
                {localDraft && serverDrafts.length === 0 && (
                  <LocalDraftCard
                    camperName={localDraft.camperName}
                    onDelete={() => setDeleteTarget({ type: 'localDraft', camperName: localDraft.camperName })}
                  />
                )}
                {filtered.length > 0 && (
                  <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <ul
                      className="divide-y"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {filtered.map((app) => (
                        <AppCard key={app.id} app={app} onDeleteDraft={requestDeleteApplication} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              // Flat list when a specific status or view mode filter is active
              <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <ul
                  className="divide-y"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {filtered.map((app) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      onDeleteDraft={requestDeleteApplication}
                      onNewSession={handleNewSessionFromApp}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
      )}
    </div>

    {/* "Apply for a New Session" modal — opened from a terminal application row.
        The camper and source application are determined by the row the user clicked. */}
    {newSessionTarget && (
      <NewSessionModal
        camper={newSessionTarget.camper}
        reappliedFromId={newSessionTarget.reappliedFromId}
        existingApplications={applications}
        onClose={() => setNewSessionTarget(null)}
      />
    )}
    </>
  );
}
