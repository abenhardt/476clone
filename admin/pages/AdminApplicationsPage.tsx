/**
 * AdminApplicationsPage.tsx
 *
 * Purpose: Paginated, filterable list of all camp applications for admins.
 * Route: /admin/applications (also /super-admin/applications)
 *
 * Columns:
 *   Queue # | Camper (app number) | Session | Submitted | Time Since | Status | Action
 *
 * Default sort: submitted_at ASC (FIFO — oldest first = highest priority).
 * Queue # = rank within the current sorted/filtered view. For drafts: "—".
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Filter, ChevronLeft, ChevronRight, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { getApplications } from '@/features/admin/api/admin.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type { Application } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { useSessionWorkspace } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionHeroBanner } from '@/features/sessions/components/SessionHeroBanner';

const STATUS_FILTERS = ['all', 'draft', 'submitted', 'under_review', 'approved', 'waitlisted', 'rejected', 'cancelled'] as const;

type SortKey = 'submitted_at' | 'status' | 'reviewed_at';

interface Filters {
  search: string;
  status: string;
  page: number;
  sort: SortKey;
  direction: 'asc' | 'desc';
}

export function AdminApplicationsPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const reviewBase = location.pathname.startsWith('/super-admin')
    ? '/super-admin/applications'
    : '/admin/applications';

  const sessionCtx = useSessionWorkspace();
  const urlParams  = new URLSearchParams(location.search);
  const urlSession = urlParams.get('camp_session_id');
  const workspaceSessionId = urlSession
    ? Number(urlSession)
    : (sessionCtx?.currentSession?.id ?? undefined);

  const [response, setResponse] = useState<PaginatedResponse<Application> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filters, setFilters]   = useState<Filters>({
    search: '',
    status: 'all',
    page: 1,
    sort: 'submitted_at',
    direction: 'asc',
  });
  const [retryKey, setRetryKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setSearch(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }
  const setStatus = (s: string)    => setFilters((f) => ({ ...f, status: s, page: 1 }));
  const setPage   = (p: number)    => setFilters((f) => ({ ...f, page: p }));
  function toggleSort(col: SortKey) {
    setFilters((f) => ({
      ...f, page: 1, sort: col,
      direction: f.sort === col ? (f.direction === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) { setLoading(true); setError(false); }
      try {
        const isDraft = filters.status === 'draft';
        const data = await getApplications({
          page:            filters.page,
          search:          filters.search || undefined,
          status:          !isDraft && filters.status !== 'all' ? filters.status : undefined,
          drafts_only:     isDraft || undefined,
          camp_session_id: workspaceSessionId,
          sort:            filters.sort,
          direction:       filters.direction,
        });
        if (!cancelled) setResponse(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filters, workspaceSessionId, retryKey]);

  function SortIcon({ col }: { col: SortKey }) {
    if (filters.sort !== col) return <ArrowUp className="h-3 w-3 opacity-25" />;
    return filters.direction === 'asc'
      ? <ArrowUp   className="h-3 w-3" style={{ color: 'var(--ember-orange)' }} />
      : <ArrowDown className="h-3 w-3" style={{ color: 'var(--ember-orange)' }} />;
  }

  return (
    <div className="p-6 max-w-7xl">
      <div
        key={sessionCtx?.isGlobalMode ? 'global' : (sessionCtx?.currentSession?.id ?? 'loading')}
        className="-mt-6 -mx-6 lg:-mt-8 lg:-mx-8 mb-6"
      >
        <SessionHeroBanner />
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('admin.applications.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response && t('admin.applications.subtitle', { total: response.meta.total })}
          {response?.meta.queue_total != null && (
            <span className="ml-2">
              &middot;{' '}
              <span style={{ color: 'var(--ember-orange)' }}>
                {response.meta.queue_total} {t('admin.applications.pending_review')}
              </span>
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={searchInput}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.applications.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
        </div>
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Filter className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={filters.status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s} style={{ background: 'var(--card)' }}>
                {t(`admin.applications.filter_${s}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeletons.Row key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : !response || response.data.length === 0 ? (
        <EmptyState
          title={t('admin.applications.empty_title')}
          description={t('admin.applications.empty_desc')}
        />
      ) : (
        <>
          <div className="glass-data rounded-xl overflow-hidden">
            {/* Column headers
                Grid: Q#(1) | Camper(2) | Session(3) | Submitted(3) | Status(2) | Action(1) = 12 */}
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              {/* Queue # — always 1 col, not sortable (it follows the sort) */}
              <div className="col-span-1 text-center">#</div>

              {/* Camper — 2 cols */}
              <div className="col-span-2">{t('admin.applications.col_camper')}</div>

              {/* Session — 3 cols */}
              <div className="col-span-3">{t('admin.applications.col_session')}</div>

              {/* Submitted — 3 cols, sortable */}
              <button
                type="button"
                onClick={() => toggleSort('submitted_at')}
                className="col-span-3 flex items-center gap-1 hover:opacity-80 transition-opacity"
                title={
                  filters.sort !== 'submitted_at'
                    ? 'Sort by submission date (oldest first)'
                    : filters.direction === 'asc'
                    ? 'Sorted oldest first · Click to sort newest first'
                    : 'Sorted newest first · Click to sort oldest first'
                }
              >
                {t('admin.applications.col_submitted')}
                <SortIcon col="submitted_at" />
              </button>

              {/* Status — 2 cols, sortable */}
              <button
                type="button"
                onClick={() => toggleSort('status')}
                className="col-span-2 flex items-center gap-1 hover:opacity-80 transition-opacity"
                title={
                  filters.sort !== 'status'
                    ? 'Sort by application status'
                    : filters.direction === 'asc'
                    ? 'Sorted A → Z by status · Click to reverse'
                    : 'Sorted Z → A by status · Click to reverse'
                }
              >
                {t('admin.applications.col_status')}
                <SortIcon col="status" />
              </button>

              {/* Action — 1 col */}
              <div className="col-span-1 text-right">{t('admin.applications.col_action')}</div>
            </div>

            {/* Rows */}
            {response.data.map((app) => (
              <div
                key={app.id}
                className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* ── Queue # (1 col) ─────────────────────────────────── */}
                <div className="col-span-1 text-center">
                  {app.queue_rank != null ? (
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
                    >
                      {app.queue_rank}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>
                  )}
                </div>

                {/* ── Camper (2 cols) ──────────────────────────────────── */}
                <div className="col-span-2">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {app.camper?.full_name ?? `Camper #${app.camper_id}`}
                  </p>
                  {app.application_number && (
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {app.application_number}
                    </p>
                  )}
                  {app.reapplied_from_id != null && (
                    <span
                      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full mt-1 font-medium"
                      style={{ background: 'rgba(99,102,241,0.10)', color: 'rgb(99,102,241)' }}
                    >
                      ↩ {t('admin.applications.reapplication')}
                    </span>
                  )}
                </div>

                {/* ── Session (3 cols) ─────────────────────────────────── */}
                <div className="col-span-3">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {app.session?.name ?? t('admin.applications.unknown_session')}
                  </p>
                  {app.session?.camp && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {app.session.camp.name}
                    </p>
                  )}
                </div>

                {/* ── Submitted (3 cols) ───────────────────────────────── */}
                <div className="col-span-3">
                  {app.submitted_at ? (
                    <>
                      {/* Exact datetime — date on top, time below */}
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                        <span className="ml-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {format(new Date(app.submitted_at), 'h:mm a')}
                        </span>
                      </p>
                      {/* Relative time — how long this family has been waiting */}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {formatDistanceToNow(new Date(app.submitted_at), { addSuffix: true })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>
                      {app.is_draft ? t('common.draft') : t('common.not_submitted')}
                    </p>
                  )}
                </div>

                {/* ── Status (2 cols) ──────────────────────────────────── */}
                <div className="col-span-2">
                  {app.is_draft ? (
                    <span
                      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.10)', color: 'rgb(99,102,241)' }}
                    >
                      Draft
                    </span>
                  ) : (
                    <StatusBadge status={app.status} />
                  )}
                </div>

                {/* ── Action (1 col) ───────────────────────────────────── */}
                {/* Route uses app.id (correct for routing); display uses app.application_number */}
                <div className="col-span-1 flex justify-end">
                  <Link
                    to={`${reviewBase}/${app.id}`}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all"
                    style={app.is_draft
                      ? { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                      : { borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }
                    }
                  >
                    {app.is_draft ? t('common.view') : t('common.review')}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {response.meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('common.pagination', {
                  from: (response.meta.current_page - 1) * response.meta.per_page + 1,
                  to: Math.min(response.meta.current_page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(filters.page - 1)}
                  disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                <button
                  onClick={() => setPage(filters.page + 1)}
                  disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
