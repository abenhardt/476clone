/**
 * MedicalVisitsPage.tsx
 *
 * Health office visit log page.
 * Dual-mode:
 * - /medical/records/:camperId/visits — camper-scoped with add form
 * - /medical/visits                   — global view, read-only
 */

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Plus, Stethoscope, ChevronDown, ChevronUp,
  Loader2, Save, X, Filter, AlertCircle, ClipboardList,
} from 'lucide-react';

import {
  getMedicalVisits,
  getMedicalVisit,
  createMedicalVisit,
  type MedicalVisit,
  type MedicalVisitVitals,
  type VisitDisposition,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

import { ROUTES } from '@/shared/constants/routes';
import type { Camper } from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DISPOSITION_META: Record<VisitDisposition, { label: string; color: string; bg: string }> = {
  returned_to_activity: {
    label: 'Returned to Activity',
    color: 'var(--ember-orange)',
    bg: 'rgba(22,163,74,0.10)',
  },
  monitoring: {
    label: 'Monitoring',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.10)',
  },
  sent_home: {
    label: 'Sent Home',
    color: '#c2410c',
    bg: 'rgba(194,65,12,0.10)',
  },
  emergency_transfer: {
    label: 'Emergency Transfer',
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.10)',
  },
  other: {
    label: 'Other',
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
  },
};

const DISPOSITION_OPTIONS: { value: VisitDisposition; label: string }[] = [
  { value: 'returned_to_activity', label: 'Returned to Activity' },
  { value: 'monitoring',           label: 'Monitoring' },
  { value: 'sent_home',            label: 'Sent Home' },
  { value: 'emergency_transfer',   label: 'Emergency Transfer' },
  { value: 'other',                label: 'Other' },
];

function DispositionBadge({ disposition }: { disposition: VisitDisposition }) {
  const meta = DISPOSITION_META[disposition] ?? DISPOSITION_META.other;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function VitalsPills({ vitals }: { vitals: MedicalVisitVitals }) {
  const pills: { label: string; value: string }[] = [];
  if (vitals.temp     !== undefined) pills.push({ label: 'Temp',   value: `${vitals.temp}°F` });
  if (vitals.pulse    !== undefined) pills.push({ label: 'Pulse',  value: `${vitals.pulse} bpm` });
  if (vitals.bp_systolic !== undefined && vitals.bp_diastolic !== undefined)
    pills.push({ label: 'BP', value: `${vitals.bp_systolic}/${vitals.bp_diastolic} mmHg` });
  if (vitals.spo2     !== undefined) pills.push({ label: 'SpO2',   value: `${vitals.spo2}%` });
  if (vitals.weight   !== undefined) pills.push({ label: 'Weight', value: `${vitals.weight} lbs` });

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {pills.map((p) => (
        <span
          key={p.label}
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(37,99,235,0.10)', color: 'var(--night-sky-blue)' }}
        >
          {p.label}: {p.value}
        </span>
      ))}
    </div>
  );
}

// ─── Expandable visit card ─────────────────────────────────────────────────────

function VisitCard({ visit: initialVisit }: { visit: MedicalVisit }) {
  const [open, setOpen] = useState(false);
  const [visit, setVisit] = useState(initialVisit);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const meta = DISPOSITION_META[visit.disposition] ?? DISPOSITION_META.other;

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    // Load full visit detail (including treatment_logs) on first expand
    if (next && visit.treatment_logs === undefined) {
      setLoadingDetail(true);
      try {
        const detail = await getMedicalVisit(visit.id);
        setVisit(detail);
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const date = new Date(visit.visit_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = visit.visit_time
    ? new Date(`1970-01-01T${visit.visit_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: visit.disposition === 'emergency_transfer' ? 'rgba(220,38,38,0.3)' : 'var(--border)' }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: 'var(--glass-medium)' }}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: meta.bg, color: meta.color }}
          >
            <Stethoscope className="h-4 w-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{visit.chief_complaint}</p>
            {visit.follow_up_required && (
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}
              >
                <AlertCircle className="h-3 w-3" />
                Follow-up required
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DispositionBadge disposition={visit.disposition} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {date}{time && ` · ${time}`}
            </span>
            {visit.camper && (
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                · {visit.camper.full_name}
              </span>
            )}
          </div>
          {visit.vitals && <VitalsPills vitals={visit.vitals} />}
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
              {visit.symptoms && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Symptoms</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{visit.symptoms}</p>
                </div>
              )}
              {visit.treatment_provided && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Treatment Provided</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{visit.treatment_provided}</p>
                </div>
              )}
              {visit.medications_administered && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Medications Administered</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{visit.medications_administered}</p>
                </div>
              )}
              {visit.disposition_notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Disposition Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{visit.disposition_notes}</p>
                </div>
              )}
              {visit.follow_up_required && visit.follow_up_notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--destructive)' }}>Follow-up Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{visit.follow_up_notes}</p>
                </div>
              )}
              {loadingDetail && (
                <div className="flex items-center gap-2 py-2" style={{ color: 'var(--muted-foreground)' }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Loading treatment log…</span>
                </div>
              )}

              {/* Treatment logs nested under this visit */}
              {visit.treatment_logs && visit.treatment_logs.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ClipboardList className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                    <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                      Treatment Log ({visit.treatment_logs.length})
                    </p>
                  </div>
                  <div className="space-y-2">
                    {visit.treatment_logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-lg border px-3 py-2.5"
                        style={{ borderColor: 'var(--border)', background: 'var(--glass-light)' }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{log.title}</p>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(37,99,235,0.10)', color: 'var(--night-sky-blue)' }}
                          >
                            {log.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{log.description}</p>
                        {log.medication_given && (
                          <p className="text-xs mt-1" style={{ color: 'var(--foreground)' }}>
                            <span style={{ color: 'var(--muted-foreground)' }}>Medication: </span>
                            {log.medication_given}{log.dosage_given ? ` — ${log.dosage_given}` : ''}
                          </p>
                        )}
                        {log.recorder && (
                          <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                            by {log.recorder.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visit.recorder && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Recorded by {visit.recorder.name}
                </p>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Add visit form ────────────────────────────────────────────────────────────

const BASE_INPUT = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
const INPUT_STYLE = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

const INITIAL_FORM = {
  visit_date: new Date().toISOString().slice(0, 10),
  visit_time: '',
  chief_complaint: '',
  symptoms: '',
  disposition: '' as VisitDisposition | '',
  disposition_notes: '',
  treatment_provided: '',
  medications_administered: '',
  follow_up_required: false,
  follow_up_notes: '',
  showVitals: false,
  temp: '',
  pulse: '',
  bp_systolic: '',
  bp_diastolic: '',
  weight: '',
  spo2: '',
};

function AddVisitForm({
  camperId,
  onSaved,
  onClose,
}: {
  camperId: number;
  onSaved: (visit: MedicalVisit) => void;
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
    if (!form.chief_complaint || !form.symptoms || !form.disposition || !form.visit_date) {
      setError(t('medical.visits.form_error') || 'Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const vitals: MedicalVisitVitals = {};
      if (form.temp)         vitals.temp         = parseFloat(form.temp);
      if (form.pulse)        vitals.pulse        = parseInt(form.pulse, 10);
      if (form.bp_systolic)  vitals.bp_systolic  = parseInt(form.bp_systolic, 10);
      if (form.bp_diastolic) vitals.bp_diastolic = parseInt(form.bp_diastolic, 10);
      if (form.weight)       vitals.weight       = parseFloat(form.weight);
      if (form.spo2)         vitals.spo2         = parseFloat(form.spo2);

      const hasVitals = Object.keys(vitals).length > 0;

      const visit = await createMedicalVisit({
        camper_id: camperId,
        visit_date: form.visit_date,
        visit_time: form.visit_time || undefined,
        chief_complaint: form.chief_complaint,
        symptoms: form.symptoms,
        disposition: form.disposition as VisitDisposition,
        disposition_notes: form.disposition_notes || undefined,
        treatment_provided: form.treatment_provided || undefined,
        medications_administered: form.medications_administered || undefined,
        follow_up_required: form.follow_up_required,
        follow_up_notes: form.follow_up_notes || undefined,
        vitals: hasVitals ? vitals : undefined,
      });
      onSaved(visit);
    } catch {
      setError(t('medical.visits.save_error') || 'Failed to save visit. Please try again.');
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
          {t('medical.visits.form_title') || 'Record Health Office Visit'}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.visits.date') || 'Visit Date'} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="date"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.visit_date}
              onChange={(e) => setField('visit_date')(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.visits.time') || 'Time'}
            </label>
            <input
              type="time"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.visit_time}
              onChange={(e) => setField('visit_time')(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.visits.chief_complaint') || 'Chief Complaint'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.chief_complaint}
            onChange={(e) => setField('chief_complaint')(e.target.value)}
            placeholder={t('medical.visits.chief_complaint_placeholder') || 'Primary reason for visit'}
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.visits.symptoms') || 'Symptoms'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={3}
            value={form.symptoms}
            onChange={(e) => setField('symptoms')(e.target.value)}
            placeholder={t('medical.visits.symptoms_placeholder') || 'Describe observed symptoms…'}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.visits.disposition') || 'Disposition'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <select className={BASE_INPUT} style={INPUT_STYLE} value={form.disposition} onChange={(e) => setField('disposition')(e.target.value)}>
            <option value="">{t('medical.visits.select_disposition') || 'Select disposition…'}</option>
            {DISPOSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {form.disposition && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.visits.disposition_notes') || 'Disposition Notes'}
            </label>
            <textarea
              className={BASE_INPUT}
              style={INPUT_STYLE}
              rows={2}
              value={form.disposition_notes}
              onChange={(e) => setField('disposition_notes')(e.target.value)}
            />
          </div>
        )}

        {/* Vitals section — collapsible */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--foreground)', background: 'var(--muted)' }}
            onClick={() => setField('showVitals')(!form.showVitals)}
          >
            <span>{t('medical.visits.vitals_section') || 'Record Vitals (optional)'}</span>
            {form.showVitals ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {form.showVitals && (
              <div>
                <div className="p-4 grid grid-cols-3 gap-3" style={{ background: 'var(--card)' }}>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.temp') || 'Temp (°F)'}
                    </label>
                    <input type="number" step="0.1" className={BASE_INPUT} style={INPUT_STYLE} placeholder="98.6" value={form.temp} onChange={(e) => setField('temp')(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.pulse') || 'Pulse (bpm)'}
                    </label>
                    <input type="number" className={BASE_INPUT} style={INPUT_STYLE} placeholder="72" value={form.pulse} onChange={(e) => setField('pulse')(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.spo2') || 'SpO2 (%)'}
                    </label>
                    <input type="number" step="0.1" className={BASE_INPUT} style={INPUT_STYLE} placeholder="98" value={form.spo2} onChange={(e) => setField('spo2')(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.bp_systolic') || 'BP Systolic (mmHg)'}
                    </label>
                    <input type="number" className={BASE_INPUT} style={INPUT_STYLE} placeholder="120" value={form.bp_systolic} onChange={(e) => setField('bp_systolic')(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.bp_diastolic') || 'BP Diastolic (mmHg)'}
                    </label>
                    <input type="number" className={BASE_INPUT} style={INPUT_STYLE} placeholder="80" value={form.bp_diastolic} onChange={(e) => setField('bp_diastolic')(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      {t('medical.visits.weight') || 'Weight (lbs)'}
                    </label>
                    <input type="number" step="0.1" className={BASE_INPUT} style={INPUT_STYLE} placeholder="75" value={form.weight} onChange={(e) => setField('weight')(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.visits.treatment_provided') || 'Treatment Provided'}
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={2}
            value={form.treatment_provided}
            onChange={(e) => setField('treatment_provided')(e.target.value)}
            placeholder={t('medical.visits.treatment_placeholder') || 'What treatment was given?'}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.visits.medications_administered') || 'Medications Administered'}
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={2}
            value={form.medications_administered}
            onChange={(e) => setField('medications_administered')(e.target.value)}
            placeholder={t('medical.visits.medications_placeholder') || 'Any medications given?'}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="follow_up_required"
            type="checkbox"
            checked={form.follow_up_required}
            onChange={(e) => setField('follow_up_required')(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="follow_up_required" className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('medical.visits.follow_up_required') || 'Follow-up required'}
          </label>
        </div>

        {form.follow_up_required && (
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.visits.follow_up_notes') || 'Follow-up Notes'}
            </label>
            <textarea
              className={BASE_INPUT}
              style={INPUT_STYLE}
              rows={2}
              value={form.follow_up_notes}
              onChange={(e) => setField('follow_up_notes')(e.target.value)}
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
            {t('medical.visits.save') || 'Save Visit'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalVisitsPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();

  const id = camperId ? parseInt(camperId, 10) : null;
  const hasCamper = id !== null && !isNaN(id);

  const [camper, setCamper] = useState<Camper | null>(null);
  const [visits, setVisits] = useState<MedicalVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [filterDisposition, setFilterDisposition] = useState<VisitDisposition | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setPage(1);
    try {
      const params = {
        ...(hasCamper && { camper_id: id! }),
        ...(filterDisposition && { disposition: filterDisposition }),
        page: 1,
      };
      if (hasCamper) {
        const [c, res] = await Promise.all([
          getCamper(id!),
          getMedicalVisits(params),
        ]);
        setCamper(c);
        setVisits(res.data);
        setHasMore(res.meta.current_page < res.meta.last_page);
      } else {
        const res = await getMedicalVisits(params);
        setVisits(res.data);
        setHasMore(res.meta.current_page < res.meta.last_page);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hasCamper, id, filterDisposition, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getMedicalVisits({
        ...(hasCamper && { camper_id: id! }),
        ...(filterDisposition && { disposition: filterDisposition }),
        page: nextPage,
      });
      setVisits((prev) => [...prev, ...res.data]);
      setPage(nextPage);
      setHasMore(res.meta.current_page < res.meta.last_page);
    } catch { /* silently fail */ }
    finally { setLoadingMore(false); }
  };

  const handleSaved = (visit: MedicalVisit) => {
    setVisits((prev) => [visit, ...prev]);
    setShowForm(false);
  };

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
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(5,150,105,0.10)' }}>
              <Stethoscope className="h-3.5 w-3.5" style={{ color: 'var(--warm-amber)' }} />
            </div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.visits.title') || 'Health Office Visits'}
            </h1>
            {visits.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                {visits.length}
              </span>
            )}
          </div>
          {camper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{camper.full_name}</p>
          )}
          {!hasCamper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.visits.global_subtitle') || 'All campers — read-only view'}
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
            {t('medical.visits.add') || 'Record Visit'}
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Filter className="h-3.5 w-3.5" />
          {t('common.filter') || 'Filter'}:
        </div>
        <select
          className="text-xs rounded-lg border px-2.5 py-1.5 outline-none"
          style={{ background: 'var(--input)', borderColor: filterDisposition ? 'var(--ember-orange)' : 'var(--border)', color: 'var(--foreground)' }}
          value={filterDisposition}
          onChange={(e) => setFilterDisposition(e.target.value as VisitDisposition | '')}
        >
          <option value="">{t('medical.visits.all_dispositions') || 'All Dispositions'}</option>
          {DISPOSITION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {filterDisposition && (
          <button
            onClick={() => setFilterDisposition('')}
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
          <AddVisitForm
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
          title={t('common.error_loading') || 'Failed to load visits'}
          description={t('common.try_again') || 'Please try again.'}
          action={{ label: t('common.retry') || 'Retry', onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : visits.length === 0 ? (
        <EmptyState
          title={t('medical.visits.empty_title') || 'No visits recorded'}
          description={t('medical.visits.empty_desc') || 'No health office visits have been logged yet.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {visits.map((visit) => (
              <div key={visit.id}>
                <VisitCard visit={visit} />
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
