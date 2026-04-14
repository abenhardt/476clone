/**
 * MedicalRecordTreatmentPage.tsx
 *
 * Camper Medical Records directory.
 * Staff search for and select a camper to view or update their medical record.
 *
 * Route: /medical/record-treatment
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Avatar } from '@/ui/components/Avatar';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  Search, BookOpen, ChevronRight, Loader2, AlertCircle,
  X, Filter, Users, AlertTriangle, Pill, Shield, Stethoscope,
} from 'lucide-react';

import { getCampers } from '@/features/admin/api/admin.api';
import { ROUTES } from '@/shared/constants/routes';
import type { Camper } from '@/features/admin/types/admin.types';

// ─── Age helpers ──────────────────────────────────────────────────────────────

function getAgeYears(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000);
}

function formatDOB(dob: string): string {
  return new Date(dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type AgeGroup         = '' | 'under10' | '10-12' | '13-15' | '16plus';
type MedAlertFilter   = '' | 'allergies' | 'medication' | 'special_care';

const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: '',        label: 'All Ages'  },
  { value: 'under10', label: 'Under 10' },
  { value: '10-12',   label: '10 – 12'  },
  { value: '13-15',   label: '13 – 15'  },
  { value: '16plus',  label: '16 +'     },
];

const MED_ALERT_OPTIONS: { value: MedAlertFilter; label: string }[] = [
  { value: '',            label: 'Medical Alerts' },
  { value: 'allergies',   label: 'Allergies'      },
  { value: 'medication',  label: 'Medication'     },
  { value: 'special_care', label: 'Special Care'  },
];

function matchesAgeGroup(camper: Camper, group: AgeGroup): boolean {
  if (!group) return true;
  const age = getAgeYears(camper.date_of_birth);
  if (group === 'under10') return age < 10;
  if (group === '10-12')   return age >= 10 && age <= 12;
  if (group === '13-15')   return age >= 13 && age <= 15;
  if (group === '16plus')  return age >= 16;
  return true;
}

function matchesMedAlert(camper: Camper, filter: MedAlertFilter): boolean {
  if (!filter) return true;
  const rec = camper.medical_record;
  if (!rec) return false;
  if (filter === 'allergies')   return (rec.allergies?.length ?? 0) > 0;
  if (filter === 'medication')  return (rec.medications?.length ?? 0) > 0;
  if (filter === 'special_care') return Boolean(rec.special_needs);
  return true;
}

// ─── Camper card ─────────────────────────────────────────────────────────────

function CamperCard({
  camper,
  onOpen,
  onLogVisit,
}: {
  camper: Camper;
  onOpen: () => void;
  onLogVisit: () => void;
}) {
  const age = getAgeYears(camper.date_of_birth);
  const rec = camper.medical_record;
  const allergyCount       = rec?.allergies?.length ?? 0;
  const medCount           = rec?.medications?.length ?? 0;
  const hasLifeThreatening = rec?.allergies?.some((a) => a.severity === 'life-threatening');
  const hasSpecialCare     = Boolean(rec?.special_needs);

  return (
    <div
      className="rounded-xl border overflow-hidden transition-shadow hover:shadow-sm"
      style={{
        background: 'var(--card)',
        borderColor: hasLifeThreatening ? 'rgba(220,38,38,0.30)' : 'var(--border)',
        borderLeftWidth: hasLifeThreatening ? '3px' : '1px',
        borderLeftColor: hasLifeThreatening ? 'var(--destructive)' : 'var(--border)',
      }}
    >
      {/* Main row — click to open record */}
      <button
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)] cursor-pointer group"
      >
        {/* Avatar */}
        <Avatar
          name={camper.full_name}
          size="sm"
          fallbackColor={hasLifeThreatening ? 'rgba(220,38,38,0.65)' : undefined}
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--foreground)' }}>
            {camper.full_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            DOB: {formatDOB(camper.date_of_birth)} &middot; Age {age}
          </p>

          {/* Medical alert badges */}
          {(allergyCount > 0 || medCount > 0 || hasSpecialCare) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {allergyCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: hasLifeThreatening ? 'rgba(220,38,38,0.10)' : 'rgba(22,163,74,0.10)',
                    color: hasLifeThreatening ? 'var(--destructive)' : 'var(--ember-orange)',
                  }}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {allergyCount} {allergyCount === 1 ? 'Allergy' : 'Allergies'}
                </span>
              )}
              {medCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(37,99,235,0.10)', color: 'var(--night-sky-blue)' }}
                >
                  <Pill className="h-2.5 w-2.5" />
                  {medCount} Med{medCount !== 1 ? 's' : ''}
                </span>
              )}
              {hasSpecialCare && (
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(217,119,6,0.10)', color: '#d97706' }}
                >
                  <Shield className="h-2.5 w-2.5" />
                  Special Care
                </span>
              )}
            </div>
          )}

          {!rec && (
            <span
              className="inline-flex text-xs px-1.5 py-0.5 rounded-full mt-1"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              No medical record
            </span>
          )}
        </div>

        {/* CTA */}
        <div
          className="flex items-center gap-1 text-xs font-medium flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--ember-orange)' }}
        >
          Open Medical Record
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </button>

      {/* Footer quick action */}
      <div
        className="border-t px-4 py-1.5 flex items-center justify-end"
        style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}
      >
        <button
          onClick={onLogVisit}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--night-sky-blue)' }}
        >
          <Stethoscope className="h-3 w-3" />
          Log Visit
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalRecordTreatmentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [query, setQuery]           = useState('');
  const [ageGroup, setAgeGroup]     = useState<AgeGroup>('');
  const [alertFilter, setAlertFilter] = useState<MedAlertFilter>('');
  const [campers, setCampers]       = useState<Camper[]>([]);
  const [meta, setMeta]             = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState(false);

  const hasFilters = query.trim() !== '' || ageGroup !== '' || alertFilter !== '';

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (q: string, page: number, append = false) => {
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(false); }

    try {
      const isNumericId = /^\d+$/.test(q.trim()) && q.trim().length > 0;
      const params = isNumericId
        ? { page, id: parseInt(q.trim(), 10) }
        : { page, search: q.trim() || undefined };

      const res = await getCampers(params);

      if (append) setCampers((prev) => [...prev, ...res.data]);
      else setCampers(res.data);
      setMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page, total: res.meta.total });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => { void fetchPage('', 1, false); }, [fetchPage]);

  // Debounced re-fetch on text query change
  useEffect(() => {
    const timer = setTimeout(() => void fetchPage(query, 1, false), 300);
    return () => clearTimeout(timer);
  }, [query, fetchPage]);

  // ── Client-side filters ──────────────────────────────────────────────────────

  const visibleCampers = useMemo(
    () => campers
      .filter((c) => matchesAgeGroup(c, ageGroup))
      .filter((c) => matchesMedAlert(c, alertFilter)),
    [campers, ageGroup, alertFilter],
  );

  // ── Handlers ────────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setQuery('');
    setAgeGroup('');
    setAlertFilter('');
  };

  const loadMore = () => {
    if (meta.current_page < meta.last_page) {
      void fetchPage(query, meta.current_page + 1, true);
    }
  };

  const openRecord  = (camper: Camper) => navigate(ROUTES.MEDICAL_RECORD_DETAIL(camper.id));
  const logVisit    = (camper: Camper) => navigate(ROUTES.MEDICAL_RECORD_VISITS(camper.id));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(22,163,74,0.1)' }}
          >
            <BookOpen className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
          </div>
          <div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.record_treatment.title')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.record_treatment.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">

        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('medical.record_treatment.search_placeholder')}
            className="w-full rounded-xl border pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 transition-shadow"
            style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          {loading && !loadingMore && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
              </span>
            )}
            {query && !loading && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--muted-foreground)' }}
                onClick={() => setQuery('')}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
        </div>

        {/* Age group */}
        <div className="relative">
          <Filter
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
            className="pl-8 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 appearance-none transition-shadow"
            style={{
              background: ageGroup ? 'rgba(22,163,74,0.06)' : 'var(--input)',
              borderColor: ageGroup ? 'rgba(22,163,74,0.4)' : 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>

        {/* Medical alerts */}
        <div className="relative">
          <AlertTriangle
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: alertFilter ? 'var(--destructive)' : 'var(--muted-foreground)' }}
          />
          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value as MedAlertFilter)}
            className="pl-8 pr-8 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 appearance-none transition-shadow"
            style={{
              background: alertFilter ? 'rgba(220,38,38,0.06)' : 'var(--input)',
              borderColor: alertFilter ? 'rgba(220,38,38,0.35)' : 'var(--border)',
              color: 'var(--foreground)',
            }}
          >
            {MED_ALERT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2.5 rounded-xl border text-sm whitespace-nowrap transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && !error && (
        <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {(ageGroup || alertFilter)
            ? `${visibleCampers.length} camper${visibleCampers.length !== 1 ? 's' : ''} shown (filtered)`
            : `${meta.total} camper${meta.total !== 1 ? 's' : ''} total`
          }
        </p>
      )}

      {/* Content */}
      {error ? (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {t('common.error_loading')}
          <button
            className="ml-auto underline text-xs"
            onClick={() => void fetchPage(query, 1, false)}
          >
            {t('common.retry')}
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--muted)' }} />
          ))}
        </div>
      ) : visibleCampers.length === 0 ? (
        <div className="text-center py-12">
          <div
            className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'var(--muted)' }}
          >
            <Users className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
            {hasFilters ? t('medical.record_treatment.no_results') : t('medical.record_treatment.empty_hint')}
          </p>
          {hasFilters && (
            <button
              className="text-xs mt-2 underline"
              style={{ color: 'var(--ember-orange)' }}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleCampers.map((camper) => (
              <CamperCard
                key={camper.id}
                camper={camper}
                onOpen={() => openRecord(camper)}
                onLogVisit={() => logVisit(camper)}
              />
            ))}
          </div>

          {/* Load more */}
          {meta.current_page < meta.last_page && !ageGroup && !alertFilter && (
            <div className="mt-4 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl border text-sm transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {loadingMore ? 'Loading…' : t('medical.record_treatment.load_more', { defaultValue: 'Load more campers' })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
