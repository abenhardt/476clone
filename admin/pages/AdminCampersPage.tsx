/**
 * AdminCampersPage.tsx
 *
 * Purpose: A searchable, filterable, paginated flat directory of all registered campers.
 * Route: /admin/campers (also /super-admin/campers)
 *
 * Design rule: this is a directory, not a family tree.
 * Each camper occupies exactly one row. Parent is a column value, not a structural grouper.
 * Family hierarchy belongs on the Families page and Family Workspace — not here.
 *
 * Columns: Name | DOB | Parent | Session | Risk | Actions
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { format } from 'date-fns';

import { getCampers } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { Tooltip } from '@/ui/components/Tooltip';
import type { Camper } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { useSessionWorkspace } from '@/features/sessions/context/SessionWorkspaceContext';
import { SessionHeroBanner } from '@/features/sessions/components/SessionHeroBanner';

export function AdminCampersPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const isSuper = location.pathname.startsWith('/super-admin');
  // Correct link prefixes for both portal variants.
  const camperBase   = isSuper ? '/super-admin/campers'   : '/admin/campers';
  const familiesBase = isSuper ? '/super-admin/families'  : '/admin/families';

  // Session is the global workspace environment — not a per-page filter dropdown.
  const sessionCtx = useSessionWorkspace();

  // URL param (?session_id=X) takes precedence; otherwise workspace session scopes the data.
  const urlParams  = new URLSearchParams(location.search);
  const urlSession = urlParams.get('session_id');
  const workspaceSessionId = urlSession
    ? Number(urlSession)
    : (sessionCtx?.currentSession?.id ?? undefined);

  // ── State ──────────────────────────────────────────────────────────────────

  const [response, setResponse] = useState<PaginatedResponse<Camper> | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [filters, setFilters]   = useState({ search: '', page: 1 });
  const [retryKey, setRetryKey] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  // Re-fetches when filters change OR when the workspace session changes.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) { setLoading(true); setError(false); }
      try {
        const data = await getCampers({
          page: filters.page,
          search: filters.search || undefined,
          // Session scoping comes from workspace context — no per-page dropdown.
          session_id: workspaceSessionId,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl">

      {/* Session hero banner — unconditionally rendered.
          The component owns its own visibility: it returns null outside admin portals
          and switches between global and session mode internally.
          Never guarded here so it cannot be suppressed by a falsy context check. */}
      <div
        key={sessionCtx?.isGlobalMode ? 'global' : (sessionCtx?.currentSession?.id ?? 'loading')}
        className="-mt-6 -mx-6 lg:-mt-8 lg:-mx-8 mb-6"
      >
        <SessionHeroBanner />
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          Camper Directory
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {response ? t('admin.campers.subtitle', { total: response.meta.total }) : null}
        </p>
      </div>

      {/* Filter row — search only; session scoping is handled by the workspace context */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div
          className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2 border max-w-sm"
          style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('admin.campers.search_placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--foreground)' }}
          />
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
          title={t('admin.campers.empty_title')}
          description={t('admin.campers.empty_desc')}
        />
      ) : (
        <>
          <div
            className="glass-data rounded-xl overflow-hidden"
          >
            {/* Column headers — Name | DOB | Parent/Guardian | Status | Risk | Action */}
            <div
              className="grid grid-cols-12 px-4 py-3 text-xs font-medium uppercase tracking-wide border-b"
              style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <div className="col-span-3">{t('admin.campers.col_name')}</div>
              <div className="col-span-2">{t('admin.campers.col_dob')}</div>
              <div className="col-span-3">Parent / Guardian</div>
              <div className="col-span-2">
                <Tooltip
                  placement="top"
                  content="Active — camper has an approved application for the current session. Inactive — no approved application on file."
                >
                  <span className="cursor-default underline decoration-dotted">Status</span>
                </Tooltip>
              </div>
              <div className="col-span-1">{t('admin.campers.col_risk')}</div>
              <div className="col-span-1" />
            </div>

            {/* One flat row per camper — no grouping, no nesting, no session column */}
            {response.data.map((camper) => (
              <div
                key={camper.id}
                className="grid grid-cols-12 items-center px-4 py-3.5 border-b last:border-b-0"
                style={{ borderColor: 'var(--border)' }}
              >
                {/* Camper name */}
                <div className="col-span-3">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {camper.full_name}
                  </p>
                </div>

                {/* Date of birth */}
                <div className="col-span-2">
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {camper.date_of_birth
                      ? format(new Date(camper.date_of_birth), 'MMM d, yyyy')
                      : t('common.not_provided')}
                  </p>
                </div>

                {/* Parent — plain column value, not a structural grouper */}
                <div className="col-span-3 min-w-0">
                  {camper.user ? (
                    <div className="min-w-0">
                      <Link
                        to={`${familiesBase}/${camper.user.id}`}
                        className="text-sm font-medium truncate block hover:underline"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {camper.user.name}
                      </Link>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {camper.user.email}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {t('common.not_provided')}
                    </p>
                  )}
                </div>

                {/* Active status — reflects whether camper has an approved application */}
                <div className="col-span-2">
                  {camper.is_active != null && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={camper.is_active
                        ? { background: 'rgba(22,163,74,0.12)', color: '#16a34a' }
                        : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                    >
                      {camper.is_active ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>

                {/* Risk link — goes directly to the dedicated risk assessment page */}
                <div className="col-span-1">
                  <Link
                    to={`${camperBase}/${camper.id}/risk`}
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--night-sky-blue)' }}
                  >
                    <Shield className="h-3 w-3" />
                    <span className="hidden lg:inline">{t('admin.campers.view_risk')}</span>
                  </Link>
                </div>

                {/* View button */}
                <div className="col-span-1 flex justify-end">
                  <Link
                    to={`${camperBase}/${camper.id}`}
                    className="text-xs px-2.5 py-1 rounded border transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    {t('admin.campers.view_profile')}
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
                  from: (filters.page - 1) * response.meta.per_page + 1,
                  to: Math.min(filters.page * response.meta.per_page, response.meta.total),
                  total: response.meta.total,
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                  disabled={filters.page === 1}
                  className="p-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
                </button>
                <span className="text-sm px-2" style={{ color: 'var(--foreground)' }}>
                  {filters.page} / {response.meta.last_page}
                </span>
                <button
                  onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                  disabled={filters.page === response.meta.last_page}
                  className="p-1.5 rounded-lg border disabled:opacity-40"
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
