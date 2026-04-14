/**
 * CampMedicalDirectoryPage.tsx
 *
 * Dedicated operational lookup page for medical staff to quickly find a camper
 * and access their medical record. Designed for fast lookup, not decoration.
 *
 * Features:
 *  - Prominent search bar
 *  - Filter by alert status and medication status
 *  - Rich camper cards: name, age, session, alert indicators, medication count
 *  - "View Record" links (primary action)
 *  - "Emergency Protocol" link — explicit and safely labeled
 *  - Life-threatening allergy indicators with strong visual priority
 *
 * Route: /medical/directory
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Avatar } from '@/ui/components/Avatar';
import { Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  Search,
  AlertTriangle,
  Stethoscope,
  Pill,
  ArrowRight,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';

import { getMedicalCampers } from '@/features/medical/api/medical.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';

import type { Camper } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';

// ─── Filter types ──────────────────────────────────────────────────────────────

type AlertFilter = '' | 'life_threatening' | 'has_allergy' | 'has_diagnosis';
type MedFilter   = '' | 'on_medication';

interface Filters {
  search: string;
  alertFilter: AlertFilter;
  medFilter: MedFilter;
}

const DEFAULT_FILTERS: Filters = { search: '', alertFilter: '', medFilter: '' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAge(dobStr?: string | null): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ─── Camper card ──────────────────────────────────────────────────────────────

function CamperCard({ camper }: { camper: Camper }) {
  const { t } = useTranslation();
  const record = camper.medical_record;

  const allergyCount       = record?.allergies?.length ?? 0;
  const medCount           = record?.medications?.length ?? 0;
  const hasLifeThreatening = record?.allergies?.some((a) => a.severity.toLowerCase().includes('life')) ?? false;
  const primaryDx          = record?.primary_diagnosis;
  const age                = getAge(camper.date_of_birth);
  // Session from most recent application
  const sessionName        = camper.applications?.[0]?.session?.name ?? null;

  return (
    <div
      className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md flex flex-col"
      style={{
        background: 'var(--card)',
        borderColor: hasLifeThreatening ? 'rgba(220,38,38,0.30)' : 'var(--border)',
        borderLeftWidth: hasLifeThreatening ? '3px' : '1px',
        borderLeftColor: hasLifeThreatening ? 'var(--destructive)' : 'var(--border)',
      }}
    >
      {/* Life-threatening alert banner */}
      {hasLifeThreatening && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold"
          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)', borderBottom: '1px solid rgba(220,38,38,0.15)' }}
        >
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Life-threatening allergy on file
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header: icon + name + age */}
        <div className="flex items-start gap-3">
          <Avatar
            name={camper.full_name}
            size="sm"
            fallbackColor={hasLifeThreatening ? 'rgba(220,38,38,0.65)' : undefined}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--foreground)' }}>
              {camper.full_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {age !== null ? `Age ${age}` : ''}
              {age !== null && sessionName ? ' · ' : ''}
              {sessionName ?? ''}
            </p>
          </div>
        </div>

        {/* Primary diagnosis */}
        {primaryDx && (
          <p className="text-xs px-3 py-1.5 rounded-lg truncate" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
            {primaryDx}
          </p>
        )}

        {/* Medical indicators */}
        <div className="flex flex-wrap gap-1.5">
          {allergyCount > 0 && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: hasLifeThreatening ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.08)',
                color: hasLifeThreatening ? 'var(--destructive)' : 'var(--ember-orange)',
              }}
            >
              <AlertTriangle className="h-3 w-3" />
              {allergyCount} {allergyCount === 1 ? 'Allergy' : 'Allergies'}
            </span>
          )}
          {medCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--night-sky-blue)' }}>
              <Pill className="h-3 w-3" />
              {medCount} {medCount === 1 ? 'Med' : 'Meds'}
            </span>
          )}
          {allergyCount === 0 && medCount === 0 && (
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.directory.no_alerts')}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          <Link
            to={ROUTES.MEDICAL_RECORD_DETAIL(camper.id)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors hover:bg-[var(--muted)]"
            style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }}
          >
            {t('medical.dashboard.directory.view_record')}
          </Link>
          <Link
            to={ROUTES.MEDICAL_RECORD_EMERGENCY(camper.id)}
            className="flex items-center justify-center text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            style={{
              background: hasLifeThreatening ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.08)',
              color: hasLifeThreatening ? 'var(--destructive)' : 'var(--ember-orange)',
              border: `1px solid ${hasLifeThreatening ? 'rgba(220,38,38,0.20)' : 'rgba(22,163,74,0.15)'}`,
            }}
            title="Emergency Protocol — opens critical health summary for first responders"
          >
            Emergency Protocol
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CampMedicalDirectoryPage() {
  const { t } = useTranslation();

  const [camperResponse, setCamperResponse] = useState<PaginatedResponse<Camper> | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(false);
  const [retryKey, setRetryKey]             = useState(0);
  const [filters, setFilters]               = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage]                     = useState(1);
  const [loadingMore, setLoadingMore]       = useState(false);

  // Debounce ref for search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Local search input value (updates immediately for UX, debounced for API)
  const [searchInput, setSearchInput] = useState('');

  // ── Fetch campers ──────────────────────────────────────────────────────────
  const fetchCampers = useCallback(async (pg = 1, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const data = await getMedicalCampers({
        search: filters.search || undefined,
        page: pg,
      });
      if (append && camperResponse) {
        setCamperResponse({ ...data, data: [...camperResponse.data, ...data.data] });
      } else {
        setCamperResponse(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters.search, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1);
    void fetchCampers(1, false);
  }, [filters.search, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search handling ────────────────────────────────────────────────────────
  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
      setPage(1);
    }, 300);
  }

  function clearFilters() {
    setSearchInput('');
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    void fetchCampers(next, true);
  }

  // ── Client-side filters ────────────────────────────────────────────────────
  const displayedCampers = (camperResponse?.data ?? []).filter((c) => {
    const record = c.medical_record;
    if (filters.alertFilter === 'life_threatening') {
      return record?.allergies?.some((a) => a.severity === 'life-threatening');
    }
    if (filters.alertFilter === 'has_allergy') {
      return (record?.allergies?.length ?? 0) > 0;
    }
    if (filters.alertFilter === 'has_diagnosis') {
      return Boolean(record?.diagnoses?.length);
    }
    if (filters.medFilter === 'on_medication') {
      return (record?.medications?.length ?? 0) > 0;
    }
    return true;
  });

  const hasMore = camperResponse && camperResponse.meta.current_page < camperResponse.meta.last_page;
  const totalCount = camperResponse?.meta.total ?? 0;
  const hasActiveFilter = filters.search || filters.alertFilter || filters.medFilter;

  return (
    <div className="p-6 max-w-7xl space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('medical.directory.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.directory.subtitle')}
          </p>
        </div>
        {!loading && totalCount > 0 && (
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium" style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.15)' }}>
            <Stethoscope className="h-4 w-4" />
            {totalCount} {t('medical.directory.camper_count')}
          </div>
        )}
      </div>

      {/* ── Search + Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search bar — prominent */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('medical.dashboard.search_placeholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          {searchInput && (
            <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted-foreground)' }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Alert filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={filters.alertFilter}
            onChange={(e) => setFilters((prev) => ({ ...prev, alertFilter: e.target.value as AlertFilter }))}
            className="pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)] appearance-none"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">{t('medical.directory.filter_all_alerts')}</option>
            <option value="life_threatening">{t('medical.directory.filter_life_threatening')}</option>
            <option value="has_allergy">{t('medical.directory.filter_has_allergy')}</option>
            <option value="has_diagnosis">{t('medical.directory.filter_has_diagnosis')}</option>
          </select>
        </div>

        {/* Medication filter */}
        <div className="relative">
          <Pill className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <select
            value={filters.medFilter}
            onChange={(e) => setFilters((prev) => ({ ...prev, medFilter: e.target.value as MedFilter }))}
            className="pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)] appearance-none"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">{t('medical.directory.filter_all_meds')}</option>
            <option value="on_medication">{t('medical.directory.filter_on_medication')}</option>
          </select>
        </div>

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-colors hover:bg-[var(--muted)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ── Directory grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : displayedCampers.length === 0 ? (
        <EmptyState
          title={t('medical.directory.empty_title')}
          description={hasActiveFilter ? t('medical.directory.empty_filtered_desc') : t('medical.directory.empty_desc')}
          action={hasActiveFilter ? { label: 'Clear filters', onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          {/* Result count */}
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Showing {displayedCampers.length} {displayedCampers.length !== totalCount ? `of ${totalCount} ` : ''}campers
            {hasActiveFilter ? ' (filtered)' : ''}
          </p>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {displayedCampers.map((camper) => (
              <div key={camper.id}>
                <CamperCard camper={camper} />
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && !hasActiveFilter && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                style={{ color: 'var(--foreground)', borderColor: 'var(--border)', background: 'var(--card)' }}
              >
                {loadingMore ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" />{t('common.loading')}</>
                ) : (
                  <>{t('medical.dashboard.directory.load_more')}<ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
