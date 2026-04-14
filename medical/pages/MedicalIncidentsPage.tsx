/**
 * MedicalIncidentsPage.tsx
 *
 * Dual-mode incident log page.
 * - /medical/records/:camperId/incidents — camper-scoped, allows adding incidents
 * - /medical/incidents               — global read-only view
 */

import { useState, useEffect, useCallback, type ReactNode, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Plus, AlertOctagon, Brain, Cross, Bandage,
  Cloud, Circle, ChevronDown, ChevronUp, Loader2, Save, X,
  Filter, ShieldAlert,
} from 'lucide-react';

import {
  getMedicalIncidents,
  createMedicalIncident,
  type MedicalIncident,
  type IncidentType,
  type IncidentSeverity,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

import { ROUTES } from '@/shared/constants/routes';
import type { Camper } from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_META: Record<IncidentSeverity, { label: string; color: string; bg: string; border: string }> = {
  critical: {
    label: 'Critical',
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.10)',
    border: 'rgba(220,38,38,0.35)',
  },
  severe: {
    label: 'Severe',
    color: '#c2410c',
    bg: 'rgba(194,65,12,0.10)',
    border: 'rgba(194,65,12,0.30)',
  },
  moderate: {
    label: 'Moderate',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.10)',
    border: 'rgba(180,83,9,0.25)',
  },
  minor: {
    label: 'Minor',
    color: 'var(--ember-orange)',
    bg: 'rgba(22,163,74,0.10)',
    border: 'var(--border)',
  },
};

const TYPE_META: Record<IncidentType, { label: string; icon: ReactNode; color: string; bg: string }> = {
  behavioral: {
    label: 'Behavioral',
    icon: <Brain className="h-3.5 w-3.5" />,
    color: 'var(--night-sky-blue)',
    bg: 'rgba(37,99,235,0.10)',
  },
  medical: {
    label: 'Medical',
    icon: <Cross className="h-3.5 w-3.5" />,
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.10)',
  },
  injury: {
    label: 'Injury',
    icon: <Bandage className="h-3.5 w-3.5" />,
    color: '#c2410c',
    bg: 'rgba(194,65,12,0.10)',
  },
  environmental: {
    label: 'Environmental',
    icon: <Cloud className="h-3.5 w-3.5" />,
    color: 'var(--warm-amber)',
    bg: 'rgba(5,150,105,0.10)',
  },
  emergency: {
    label: 'Emergency',
    icon: <AlertOctagon className="h-3.5 w-3.5" />,
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.12)',
  },
  other: {
    label: 'Other',
    icon: <Circle className="h-3.5 w-3.5" />,
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
  },
};

function TypeBadge({ type }: { type: IncidentType }) {
  const meta = TYPE_META[type] ?? TYPE_META.other;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.minor;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

// ─── Expandable incident card ─────────────────────────────────────────────────

function IncidentCard({ incident }: { incident: MedicalIncident }) {
  const [open, setOpen] = useState(false);
  const sevMeta = SEVERITY_META[incident.severity] ?? SEVERITY_META.minor;

  const date = new Date(incident.incident_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = incident.incident_time
    ? new Date(`1970-01-01T${incident.incident_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: sevMeta.border }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: 'var(--glass-medium)' }}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: TYPE_META[incident.type]?.bg ?? 'var(--muted)', color: TYPE_META[incident.type]?.color ?? 'var(--muted-foreground)' }}
          >
            {TYPE_META[incident.type]?.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{incident.title}</p>
            {incident.escalation_required && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}
              >
                <ShieldAlert className="h-3 w-3" />
                Escalated
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={incident.type} />
            <SeverityBadge severity={incident.severity} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {date}{time && ` · ${time}`}
            </span>
            {incident.location && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                · {incident.location}
              </span>
            )}
            {incident.camper && (
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                · {incident.camper.full_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
          <div
            className="border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Description</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{incident.description}</p>
              </div>
              {incident.witnesses && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Witnesses</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{incident.witnesses}</p>
                </div>
              )}
              {incident.escalation_required && incident.escalation_notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--destructive)' }}>Escalation Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{incident.escalation_notes}</p>
                </div>
              )}
              {incident.recorder && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Recorded by {incident.recorder.name}
                </p>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Add incident form ─────────────────────────────────────────────────────────

const BASE_INPUT = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
const INPUT_STYLE = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

const INITIAL_FORM = {
  type: '' as IncidentType | '',
  severity: '' as IncidentSeverity | '',
  title: '',
  incident_date: new Date().toISOString().slice(0, 10),
  incident_time: '',
  location: '',
  description: '',
  witnesses: '',
  escalation_required: false,
  escalation_notes: '',
};

const TYPE_OPTIONS: { value: IncidentType; label: string }[] = [
  { value: 'behavioral',   label: 'Behavioral' },
  { value: 'medical',      label: 'Medical' },
  { value: 'injury',       label: 'Injury' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'emergency',    label: 'Emergency' },
  { value: 'other',        label: 'Other' },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity; label: string }[] = [
  { value: 'minor',    label: 'Minor' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe',   label: 'Severe' },
  { value: 'critical', label: 'Critical' },
];

function AddIncidentForm({
  camperId,
  onSaved,
  onClose,
}: {
  camperId: number;
  onSaved: (incident: MedicalIncident) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.severity || !form.title || !form.description || !form.incident_date) {
      setError(t('medical.incidents.form_error') || 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const incident = await createMedicalIncident({
        camper_id: camperId,
        type: form.type as IncidentType,
        severity: form.severity as IncidentSeverity,
        title: form.title,
        incident_date: form.incident_date,
        incident_time: form.incident_time || undefined,
        location: form.location || undefined,
        description: form.description,
        witnesses: form.witnesses || undefined,
        escalation_required: form.escalation_required,
        escalation_notes: form.escalation_notes || undefined,
      });
      onSaved(incident);
    } catch {
      setError(t('medical.incidents.save_error') || 'Failed to save incident. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('medical.incidents.form_title') || 'Record Incident'}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.type') || 'Type'} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <select className={BASE_INPUT} style={INPUT_STYLE} value={form.type} onChange={(e) => setField('type')(e.target.value)}>
              <option value="">{t('medical.incidents.select_type') || 'Select type…'}</option>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.severity') || 'Severity'} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <select className={BASE_INPUT} style={INPUT_STYLE} value={form.severity} onChange={(e) => setField('severity')(e.target.value)}>
              <option value="">{t('medical.incidents.select_severity') || 'Select severity…'}</option>
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.incidents.title_field') || 'Title'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.title}
            onChange={(e) => setField('title')(e.target.value)}
            placeholder={t('medical.incidents.title_placeholder') || 'Brief summary of the incident'}
            maxLength={255}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.date') || 'Date'} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="date"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.incident_date}
              onChange={(e) => setField('incident_date')(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.time') || 'Time'}
            </label>
            <input
              type="time"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.incident_time}
              onChange={(e) => setField('incident_time')(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.incidents.location') || 'Location'}
          </label>
          <input
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.location}
            onChange={(e) => setField('location')(e.target.value)}
            placeholder={t('medical.incidents.location_placeholder') || 'Where did this occur?'}
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.incidents.description') || 'Description'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={4}
            value={form.description}
            onChange={(e) => setField('description')(e.target.value)}
            placeholder={t('medical.incidents.description_placeholder') || 'Describe what occurred…'}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.incidents.witnesses') || 'Witnesses'}
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={2}
            value={form.witnesses}
            onChange={(e) => setField('witnesses')(e.target.value)}
            placeholder={t('medical.incidents.witnesses_placeholder') || 'Names of any witnesses'}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="escalation_required"
            type="checkbox"
            checked={form.escalation_required}
            onChange={(e) => setField('escalation_required')(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="escalation_required" className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('medical.incidents.escalation_required') || 'Escalation required'}
          </label>
        </div>

        {form.escalation_required && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.escalation_notes') || 'Escalation Notes'}
            </label>
            <textarea
              className={BASE_INPUT}
              style={INPUT_STYLE}
              rows={2}
              value={form.escalation_notes}
              onChange={(e) => setField('escalation_notes')(e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('medical.incidents.save') || 'Save Incident'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalIncidentsPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();

  const id = camperId ? parseInt(camperId, 10) : null;
  const hasCamper = id !== null && !isNaN(id);

  const [camper, setCamper] = useState<Camper | null>(null);
  const [incidents, setIncidents] = useState<MedicalIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<IncidentType | ''>('');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setPage(1);
    try {
      const params = {
        ...(hasCamper && { camper_id: id! }),
        ...(filterType && { type: filterType }),
        ...(filterSeverity && { severity: filterSeverity }),
        page: 1,
      };
      if (hasCamper) {
        const [c, res] = await Promise.all([
          getCamper(id!),
          getMedicalIncidents(params),
        ]);
        setCamper(c);
        setIncidents(Array.isArray(res.data) ? res.data : []);
        setHasMore(res.meta.current_page < res.meta.last_page);
      } else {
        const res = await getMedicalIncidents(params);
        setIncidents(Array.isArray(res.data) ? res.data : []);
        setHasMore(res.meta.current_page < res.meta.last_page);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hasCamper, id, filterType, filterSeverity, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getMedicalIncidents({
        ...(hasCamper && { camper_id: id! }),
        ...(filterType && { type: filterType }),
        ...(filterSeverity && { severity: filterSeverity }),
        page: nextPage,
      });
      setIncidents((prev) => [...prev, ...(Array.isArray(res.data) ? res.data : [])]);
      setPage(nextPage);
      setHasMore(res.meta.current_page < res.meta.last_page);
    } catch {
      // silently fail load more
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSaved = (incident: MedicalIncident) => {
    setIncidents((prev) => [incident, ...prev]);
    setShowForm(false);
  };

  const hasFilters = filterType !== '' || filterSeverity !== '';

  return (
    <div className="p-6 max-w-4xl">

      {hasCamper && (
        <Link
          to={ROUTES.MEDICAL_RECORD_DETAIL(id!)}
          className="inline-flex items-center gap-2 text-sm mb-6 transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('medical.record.back_to_record') || 'Back to Medical Record'}
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(220,38,38,0.10)' }}>
              <AlertOctagon className="h-3.5 w-3.5" style={{ color: 'var(--destructive)' }} />
            </div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.incidents.title') || 'Incident Reports'}
            </h1>
            {incidents.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                {incidents.length}
              </span>
            )}
          </div>
          {camper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {camper.full_name}
            </p>
          )}
          {!hasCamper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.incidents.global_subtitle') || 'All campers — read-only view'}
            </p>
          )}
        </div>

        {hasCamper && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            <Plus className="h-4 w-4" />
            {t('medical.incidents.add') || 'Record Incident'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Filter className="h-3.5 w-3.5" />
          {t('common.filter') || 'Filter'}:
        </div>
        <select
          className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ background: 'var(--input)', borderColor: filterType ? 'var(--ember-orange)' : 'var(--border)', color: 'var(--foreground)' }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as IncidentType | '')}
        >
          <option value="">{t('medical.incidents.all_types') || 'All Types'}</option>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ background: 'var(--input)', borderColor: filterSeverity ? 'var(--ember-orange)' : 'var(--border)', color: 'var(--foreground)' }}
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as IncidentSeverity | '')}
        >
          <option value="">{t('medical.incidents.all_severities') || 'All Severities'}</option>
          {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setFilterType(''); setFilterSeverity(''); }}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ color: 'var(--muted-foreground)', background: 'var(--muted)' }}
          >
            <X className="h-3 w-3" />
            {t('common.clear') || 'Clear'}
          </button>
        )}
      </div>

      {/* Add form */}
      {hasCamper && showForm && (
        <div className="mb-6">
          <AddIncidentForm
            camperId={id!}
            onSaved={handleSaved}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading') || 'Failed to load incidents'}
          description={t('common.try_again') || 'Please try again.'}
          action={{ label: t('common.retry') || 'Retry', onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : incidents.length === 0 ? (
        <EmptyState
          title={t('medical.incidents.empty_title') || 'No incidents recorded'}
          description={t('medical.incidents.empty_desc') || 'No incident reports have been filed yet.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {incidents.map((incident) => (
              <div key={incident.id}>
                <IncidentCard incident={incident} />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('common.load_more') || 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
