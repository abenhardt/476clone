/**
 * MedicalTreatmentLogPage.tsx
 *
 * Camper medical record — treatment history.
 * When accessed with a camperId param: shows that camper's treatment history
 * and allows adding new entries.
 * When accessed as /medical/treatments (no camperId): shows all treatment logs
 * across all campers (read-only global view).
 *
 * Routes:
 *   /medical/records/:camperId/treatments  — camper-specific (primary)
 *   /medical/treatments                    — global view
 */

import { useState, useEffect, useCallback, type ReactNode, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Plus, ClipboardList, AlertCircle, AlertTriangle,
  Pill, Eye, Wrench, Siren, MoreHorizontal,
  ChevronDown, ChevronUp, Loader2, Save, X,
  CheckCircle2, RotateCcw, ListX,
} from 'lucide-react';

import {
  getTreatmentLogs,
  createTreatmentLog,
  type TreatmentLog,
  type TreatmentType,
  type AllergyConflict,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

import type { Camper } from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<TreatmentType, { label: string; icon: ReactNode; color: string; bg: string }> = {
  medication_administered: {
    label: 'Medication Administered',
    icon: <Pill className="h-3.5 w-3.5" />,
    color: 'var(--night-sky-blue)',
    bg: 'rgba(96,165,250,0.12)',
  },
  first_aid: {
    label: 'First Aid',
    icon: <Wrench className="h-3.5 w-3.5" />,
    color: 'var(--warm-amber)',
    bg: 'rgba(22,163,74,0.10)',
  },
  observation: {
    label: 'Observation',
    icon: <Eye className="h-3.5 w-3.5" />,
    color: 'var(--forest-green)',
    bg: 'rgba(5,150,105,0.10)',
  },
  emergency: {
    label: 'Emergency',
    icon: <Siren className="h-3.5 w-3.5" />,
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.12)',
  },
  other: {
    label: 'Other',
    icon: <MoreHorizontal className="h-3.5 w-3.5" />,
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
  },
};

function TypeBadge({ type }: { type: TreatmentType }) {
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

function FollowUpBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}
    >
      <AlertCircle className="h-3 w-3" />
      Follow-up required
    </span>
  );
}

// ─── Expandable log entry ─────────────────────────────────────────────────────

function LogEntry({ log }: { log: TreatmentLog }) {
  const [open, setOpen] = useState(false);
  const date = new Date(log.treatment_date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = log.treatment_time
    ? new Date(`1970-01-01T${log.treatment_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: log.type === 'emergency' ? 'rgba(220,38,38,0.3)' : 'var(--border)' }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left transition-colors"
        style={{ background: 'var(--glass-medium)' }}
      >
        <div className="flex-shrink-0 mt-0.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: TYPE_META[log.type]?.bg ?? 'var(--muted)',
              color: TYPE_META[log.type]?.color ?? 'var(--muted-foreground)',
            }}
          >
            {TYPE_META[log.type]?.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{log.title}</p>
            {log.follow_up_required && <FollowUpBadge />}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <TypeBadge type={log.type} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {date}{time && ` · ${time}`}
            </span>
            {log.recorder && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                by {log.recorder.name}
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
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Symptoms & Description</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.description}</p>
              </div>
              {log.outcome && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Treatment Provided</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.outcome}</p>
                </div>
              )}
              {(log.medication_given || log.dosage_given) && (
                <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(96,165,250,0.08)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--night-sky-blue)' }}>
                    <Pill className="inline h-3 w-3 mr-1" />
                    Medication
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                    {log.medication_given}
                    {log.dosage_given && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        · Dosage: {log.dosage_given}
                      </span>
                    )}
                  </p>
                </div>
              )}
              {log.follow_up_required && log.follow_up_notes && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--destructive)' }}>Follow-up Notes</p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{log.follow_up_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

// ─── Add log form ─────────────────────────────────────────────────────────────

const INITIAL_FORM = {
  treatment_date: new Date().toISOString().slice(0, 10),
  treatment_time: new Date().toTimeString().slice(0, 5),
  type: '' as TreatmentType | '',
  title: '',
  description: '',
  outcome: '',
  medication_given: '',
  dosage_given: '',
  follow_up_required: false,
  follow_up_notes: '',
};

const BASE_INPUT = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40 transition-shadow";
const INPUT_STYLE = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

const TYPE_OPTIONS: { value: TreatmentType; label: string }[] = [
  { value: 'medication_administered', label: 'Medication Administered' },
  { value: 'first_aid',               label: 'First Aid' },
  { value: 'observation',             label: 'Observation' },
  { value: 'emergency',               label: 'Emergency' },
  { value: 'other',                   label: 'Other' },
];

function AddLogForm({
  camperId,
  onSaved,
  onClose,
}: {
  camperId: number;
  onSaved: (log: TreatmentLog) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [allergyWarnings, setAllergyWarnings] = useState<AllergyConflict[]>([]);

  const setField = (k: keyof typeof form) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const showMedication =
    form.type === 'medication_administered' ||
    form.medication_given.trim() !== '';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.type || !form.title || !form.description || !form.treatment_date) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    setAllergyWarnings([]);
    try {
      const result = await createTreatmentLog({
        camper_id:        camperId,
        treatment_date:   form.treatment_date,
        treatment_time:   form.treatment_time || undefined,
        type:             form.type as TreatmentType,
        title:            form.title,
        description:      form.description,
        outcome:          form.outcome || undefined,
        medication_given: form.medication_given || undefined,
        dosage_given:     form.dosage_given || undefined,
        follow_up_required: form.follow_up_required,
        follow_up_notes:  form.follow_up_notes || undefined,
      });
      if (result.allergyWarnings.length > 0) {
        setAllergyWarnings(result.allergyWarnings);
        // Still save — medic decides clinically. Bubble up with warnings visible.
      }
      onSaved(result.log);
    } catch {
      setError('Failed to save treatment entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const REQ = <span style={{ color: 'var(--destructive)' }}>*</span>;

  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          New Treatment Entry
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Date {REQ}
            </label>
            <input
              type="date"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.treatment_date}
              onChange={(e) => setField('treatment_date')(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div>
            <label htmlFor="tl-time" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Time</label>
            <input
              id="tl-time"
              type="time"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.treatment_time}
              onChange={(e) => setField('treatment_time')(e.target.value)}
            />
          </div>
        </div>

        {/* Type */}
        <div>
          <label htmlFor="tl-type" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Treatment Type {REQ}
          </label>
          <select
            id="tl-type"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.type}
            onChange={(e) => setField('type')(e.target.value)}
          >
            <option value="">Select type…</option>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Chief complaint */}
        <div>
          <label htmlFor="tl-title" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Chief Complaint {REQ}
          </label>
          <input
            id="tl-title"
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.title}
            onChange={(e) => setField('title')(e.target.value)}
            placeholder="e.g. Headache, Scraped knee, Stomach pain…"
            maxLength={255}
          />
        </div>

        {/* Symptoms & description */}
        <div>
          <label htmlFor="tl-description" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Symptoms & Description {REQ}
          </label>
          <textarea
            id="tl-description"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={3}
            value={form.description}
            onChange={(e) => setField('description')(e.target.value)}
            placeholder="Describe the symptoms and what was observed…"
          />
        </div>

        {/* Treatment provided */}
        <div>
          <label htmlFor="tl-outcome" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Treatment Provided</label>
          <textarea
            id="tl-outcome"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={2}
            value={form.outcome}
            onChange={(e) => setField('outcome')(e.target.value)}
            placeholder="What was done? e.g. Rest and hydration, wound cleaned and dressed…"
          />
        </div>

        {/* Medication */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            borderColor: showMedication ? 'rgba(96,165,250,0.3)' : 'var(--border)',
            background: showMedication ? 'rgba(96,165,250,0.04)' : 'transparent',
          }}
        >
          <div className="flex items-center gap-2">
            <Pill className="h-3.5 w-3.5" style={{ color: 'var(--night-sky-blue)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>Medication</p>
            <span className="text-xs ml-auto" style={{ color: 'var(--muted-foreground)' }}>optional</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="tl-medication" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Medication Given</label>
              <input
                id="tl-medication"
                type="text"
                className={BASE_INPUT}
                style={INPUT_STYLE}
                value={form.medication_given}
                onChange={(e) => setField('medication_given')(e.target.value)}
                placeholder="e.g. Tylenol, Benadryl…"
                maxLength={255}
              />
            </div>
            <div>
              <label htmlFor="tl-dosage" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>Dosage</label>
              <input
                id="tl-dosage"
                type="text"
                className={BASE_INPUT}
                style={INPUT_STYLE}
                value={form.dosage_given}
                onChange={(e) => setField('dosage_given')(e.target.value)}
                placeholder="e.g. 500 mg, 1 tablet…"
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {/* Follow-up */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              id="follow_up"
              type="checkbox"
              checked={form.follow_up_required}
              onChange={(e) => setField('follow_up_required')(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="follow_up" className="text-sm" style={{ color: 'var(--foreground)' }}>
              Follow-up required
            </label>
          </div>

          {form.follow_up_required && (
              <div>
                <label htmlFor="tl-followup-notes" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
                  Follow-up Notes
                </label>
                <textarea
                  id="tl-followup-notes"
                  className={BASE_INPUT}
                  style={INPUT_STYLE}
                  rows={2}
                  value={form.follow_up_notes}
                  onChange={(e) => setField('follow_up_notes')(e.target.value)}
                  placeholder="Describe the follow-up needed…"
                />
              </div>
            )}
        </div>

        {error && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}
          >
            {error}
          </p>
        )}

        {allergyWarnings.length > 0 && (
          <div className="rounded-xl border px-4 py-3 space-y-2" style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.30)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
                Allergy Conflict Detected
              </p>
            </div>
            {allergyWarnings.map((w, i) => (
              <div key={i} className="pl-6 text-xs space-y-0.5">
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  {w.allergen} ({w.severity})
                </p>
                {w.reaction && (
                  <p style={{ color: 'var(--muted-foreground)' }}>Reaction: {w.reaction}</p>
                )}
                {w.treatment && (
                  <p style={{ color: 'var(--muted-foreground)' }}>Treatment: {w.treatment}</p>
                )}
              </div>
            ))}
            <p className="text-xs pl-6" style={{ color: 'var(--destructive)' }}>
              Log saved. Verify this order with the prescribing physician.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Entry
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Post-save success panel ──────────────────────────────────────────────────

function SavedBanner({
  log,
  onAddAnother,
  onReturnToList,
}: {
  log: TreatmentLog;
  onAddAnother: () => void;
  onReturnToList: () => void;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'rgba(22,163,74,0.06)', borderColor: 'rgba(22,163,74,0.3)' }}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--forest-green)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            Treatment Entry Saved
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            &ldquo;{log.title}&rdquo; was recorded successfully.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={onAddAnother}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'var(--ember-orange)', color: '#fff' }}
            >
              <RotateCcw className="h-3 w-3" />
              Add Another Entry
            </button>
            <button
              onClick={onReturnToList}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              <ListX className="h-3 w-3" />
              Return to Camper List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalTreatmentLogPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();
  const navigate = useNavigate();

  const id = camperId ? Number(camperId) : null;
  const hasCamper = id !== null && !isNaN(id);

  const [camper, setCamper]       = useState<Camper | null>(null);
  const [logs, setLogs]           = useState<TreatmentLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [savedLog, setSavedLog]   = useState<TreatmentLog | null>(null);
  const [retryKey, setRetryKey]   = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (hasCamper) {
        const [c, l] = await Promise.all([
          getCamper(id!),
          getTreatmentLogs({ camper_id: id! }),
        ]);
        setCamper(c);
        setLogs(Array.isArray(l.data) ? l.data : []);
      } else {
        const l = await getTreatmentLogs();
        setLogs(Array.isArray(l.data) ? l.data : []);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [hasCamper, id, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (log: TreatmentLog) => {
    setLogs((prev) => [log, ...prev]);
    setShowForm(false);
    setSavedLog(log);
  };

  const handleAddAnother = () => {
    setSavedLog(null);
    setShowForm(true);
  };

  const handleReturnToList = () => {
    navigate('/medical/record-treatment');
  };

  // ── Camper allergy alerts ────────────────────────────────────────────────────

  const allergies = camper?.medical_record?.allergies ?? [];
  const severeAllergies = allergies.filter((a) => a.severity === 'severe' || a.severity.toLowerCase().includes('life'));

  return (
    <div className="p-6 max-w-4xl">

      {/* Back */}
      {hasCamper && (
        <Link
          to={`/medical/records/${id}`}
          className="inline-flex items-center gap-2 text-sm mb-5 transition-colors"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('medical.record.back_to_record')}
        </Link>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(22,163,74,0.1)' }}
            >
              <ClipboardList className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
            </div>
            <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {hasCamper ? 'Treatment History' : t('medical.treatments.title')}
            </h1>
          </div>
          {camper && (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {camper.full_name}
              {camper.date_of_birth && (
                <span className="ml-2">
                  · DOB: {new Date(camper.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </p>
          )}
        </div>

        {hasCamper && !showForm && !savedLog && (
          <button
            onClick={() => { setSavedLog(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            <Plus className="h-4 w-4" />
            {t('medical.treatments.add')}
          </button>
        )}
      </div>

      {/* Severe allergy alert strip */}
      {severeAllergies.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl px-4 py-2.5 mb-5 text-sm"
          style={{ background: 'rgba(220,38,38,0.08)', borderLeft: '3px solid var(--destructive)', color: 'var(--destructive)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Severe Allergy Alert: </span>
            {severeAllergies.map((a) => a.allergen).join(', ')}
          </div>
        </div>
      )}

      {/* Saved banner */}
      {savedLog && (
        <div className="mb-5">
          <SavedBanner
            log={savedLog}
            onAddAnother={handleAddAnother}
            onReturnToList={handleReturnToList}
          />
        </div>
      )}

      {/* Entry form */}
      {hasCamper && showForm && (
        <div className="mb-6">
          <AddLogForm
            camperId={id!}
            onSaved={handleSaved}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* History section header */}
      {logs.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--muted-foreground)' }}>
            {hasCamper ? `${logs.length} treatment entr${logs.length !== 1 ? 'ies' : 'y'}` : 'All Treatment Logs'}
          </h2>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading')}
          description={t('common.try_again')}
          action={{ label: t('common.retry'), onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : logs.length === 0 ? (
        <EmptyState
          title={t('medical.treatments.empty_title')}
          description={hasCamper ? t('medical.treatments.empty_desc') : t('medical.treatments.global_empty_desc')}
        />
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id}>
              <LogEntry log={log} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
