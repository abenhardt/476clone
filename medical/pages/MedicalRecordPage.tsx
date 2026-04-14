/**
 * MedicalRecordPage.tsx
 *
 * The complete medical record for a single camper — everything the medical
 * staff needs to know in one place. Content is divided into collapsible
 * sections (allergies, medications, diagnoses, notes, behavioral profile,
 * feeding plan, assistive devices, activity permissions, emergency contacts).
 *
 * Each section can be expanded or collapsed independently. Sections with
 * writable data have an edit button or a "+" add button in the header.
 * Editing opens a modal overlay; saving patches the API and updates local
 * state without a full page reload.
 *
 * All 12 data sources are fetched in parallel on mount using Promise.allSettled so
 * the page loads as one fast batch and partial failures don't block the rest.
 *
 * Route: /medical/records/:camperId
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useParams, Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, AlertTriangle, Pill, Brain, Coffee,
  Clipboard, Wrench, Activity, Phone, ChevronDown, ChevronUp,
  Plus, ClipboardList, FileText, Edit2, X, Save, Loader2,
  AlertOctagon, Stethoscope, TrendingUp,
} from 'lucide-react';

import {
  getMedicalRecordByCamper,
  updateMedicalRecord,
  getAllergiesByCamper,
  createAllergy,
  updateAllergy,
  getMedicationsByCamper,
  createMedication,
  updateMedication,
  getDiagnosesByCamper,
  createDiagnosis,
  updateDiagnosis,
  getEmergencyContacts,
  getActivityPermissions,
  updateActivityPermission,
  getBehavioralProfile,
  updateBehavioralProfile,
  createBehavioralProfile,
  getFeedingPlan,
  updateFeedingPlan,
  createFeedingPlan,
  getAssistiveDevices,
  createAssistiveDevice,
  updateAssistiveDevice,
  getCamperMedicalAlerts,
  getPersonalCarePlan,
  type MedicalAlert,
} from '@/features/medical/api/medical.api';
import { getCamper } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';

import { ROUTES } from '@/shared/constants/routes';
import type {
  Camper, MedicalRecord, Allergy, Medication, Diagnosis,
  EmergencyContact, ActivityPermission, BehavioralProfile,
  FeedingPlan, AssistiveDevice, PersonalCarePlan,
} from '@/features/admin/types/admin.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * FieldRow — renders a label + value pair.
 * Returns nothing if the value is empty so the section doesn't show blank rows.
 */
function FieldRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
    </div>
  );
}

/**
 * SeverityBadge — a small colored pill label showing an allergy's severity.
 * Colors escalate from green (mild) to red (life-threatening) so danger is
 * immediately obvious without reading the text.
 */
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'life-threatening': { bg: 'rgba(220,38,38,0.15)', text: 'var(--destructive)' },
    severe:   { bg: 'rgba(22,163,74,0.12)',  text: 'var(--ember-orange)' },
    moderate: { bg: 'rgba(96,165,250,0.12)',  text: 'var(--night-sky-blue)' },
    mild:     { bg: 'rgba(5,150,105,0.12)',  text: 'var(--forest-green)' },
  };
  // Fall back to a neutral style for any unknown severity value
  const style = colors[severity] ?? { bg: 'var(--muted)', text: 'var(--muted-foreground)' };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: style.bg, color: style.text }}>
      {severity}
    </span>
  );
}

// ─── Modal overlay ────────────────────────────────────────────────────────────

/**
 * Modal — a centered overlay dialog used for all 14 add/edit forms.
 * Clicking the dark backdrop calls onClose, so users can dismiss by clicking
 * anywhere outside the white card. The card itself stops click propagation
 * so clicking inside the card doesn't close it accidentally.
 */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Close"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="presentation"
        className="rounded-2xl border p-6 w-full max-w-lg"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        // Stop clicks inside the card from bubbling up and closing the modal
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Inline text field ────────────────────────────────────────────────────────

/**
 * Field — a reusable labeled input or textarea used inside modal forms.
 * The `multiline` prop switches between a single-line input and a textarea.
 */
function Field({
  label, name, value, onChange, required, type = 'text', multiline,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; multiline?: boolean;
}) {
  const base = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
  const style = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      {multiline ? (
        <textarea className={base} style={style} name={name} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <input className={base} style={style} name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/**
 * SelectField — a labeled dropdown used for fields with fixed option lists
 * (e.g., allergy severity). Always includes a blank "Select…" placeholder.
 */
function SelectField({
  label, name, value, onChange, options, required,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
        {label}{required && <span style={{ color: 'var(--destructive)' }}> *</span>}
      </label>
      <select
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
        style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/**
 * SaveBtn — the Cancel + Save button row used at the bottom of every modal form.
 * Shows a spinning loader icon while the save API call is in flight.
 */
function SaveBtn({ loading, onClose }: { loading: boolean; onClose: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-5">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-sm border transition-colors"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'var(--ember-orange)', color: '#fff' }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

interface MedSectionProps {
  title: string;
  icon: ReactNode;
  color: string;
  bg: string;
  defaultOpen?: boolean;
  children: ReactNode;
  empty?: boolean;
  emptyText?: string;
  onAdd?: () => void;
  /** Short summary shown in the header row when the section is collapsed. */
  preview?: string | null;
}

/**
 * MedSection — a reusable collapsible card used for every data category on the
 * page (allergies, medications, etc.). The header is always visible and acts as
 * the toggle button. The "+" button in the header opens the add modal.
 *
 * When `empty` is true, the body shows `emptyText` instead of `children` so
 * blank sections communicate clearly rather than showing nothing.
 */
function MedSection({ title, icon, color, bg, defaultOpen = true, children, empty, emptyText, onAdd, preview }: MedSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center" style={{ background: 'var(--glass-medium)' }}>
        {/* The entire header row (except the + button) toggles open/closed */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center justify-between px-5 py-4 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0" style={{ background: bg }}>
              <span style={{ color }}>{icon}</span>
            </div>
            <div className="min-w-0">
              <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{title}</span>
              {!open && preview && (
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{preview}</p>
              )}
            </div>
          </div>
          {open ? (
            <ChevronUp className="h-4 w-4 flex-shrink-0 ml-3" style={{ color: 'var(--muted-foreground)' }} />
          ) : (
            <ChevronDown className="h-4 w-4 flex-shrink-0 ml-3" style={{ color: 'var(--muted-foreground)' }} />
          )}
        </button>
        {/* Add button is separate from the toggle so clicking + doesn't collapse the section */}
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1 px-4 py-4 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--ember-orange)' }}
            title={`Add ${title}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {empty ? (
            <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>{emptyText}</p>
          ) : children}
        </div>
      )}
    </div>
  );
}

// ─── State shape ──────────────────────────────────────────────────────────────

/**
 * RecordState — holds all the data fetched for one camper.
 * Using a single state object instead of 10 separate useState calls keeps
 * updates atomic: `setState((s) => ({ ...s, allergies: newList }))` updates
 * only one field without touching the rest.
 */
interface RecordState {
  camper: Camper | null;
  record: MedicalRecord | null;
  allergies: Allergy[];
  medications: Medication[];
  diagnoses: Diagnosis[];
  contacts: EmergencyContact[];
  permissions: ActivityPermission[];
  behavioral: BehavioralProfile | null;
  feeding: FeedingPlan | null;
  devices: AssistiveDevice[];
  personalCarePlan: PersonalCarePlan | null;
}

/**
 * ModalType — a union of all possible open modals on this page.
 * Having an explicit union instead of a plain string helps TypeScript catch
 * typos and makes the code self-documenting about which modals exist.
 */
type ModalType =
  | 'add-allergy' | 'edit-allergy'
  | 'add-medication' | 'edit-medication'
  | 'add-diagnosis' | 'edit-diagnosis'
  | 'edit-notes'
  | 'edit-behavioral'
  | 'edit-feeding'
  | 'add-device' | 'edit-device'
  | null;

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalRecordPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();
  // Convert the URL string param to a number for use in API calls
  const id = Number(camperId);

  // All camper data in one consolidated state object
  const [state, setState] = useState<RecordState>({
    camper: null, record: null, allergies: [], medications: [],
    diagnoses: [], contacts: [], permissions: [],
    behavioral: null, feeding: null, devices: [], personalCarePlan: null,
  });
  const [loading, setLoading] = useState(true);
  // `saving` is true while any modal form's API call is in flight
  const [saving, setSaving] = useState(false);
  // Medical alerts are separate from RecordState since they come from their own endpoint
  const [alerts, setAlerts] = useState<MedicalAlert[]>([]);

  // Which modal is currently open (null = none)
  const [modal, setModal] = useState<ModalType>(null);
  // For edit modals: the ID of the item being edited
  const [editTarget, setEditTarget] = useState<number | null>(null);
  // Shared form state for all modals — each modal only uses its own keys
  const [form, setForm] = useState<Record<string, string>>({});

  /** closeModal — resets all modal-related state back to a clean slate. */
  const closeModal = () => { setModal(null); setEditTarget(null); setForm({}); };

  /**
   * setField — returns an onChange handler that updates a single field in the
   * shared form state by key name. Usage: onChange={setField('name')}
   */
  const setField = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // ─── Load ───────────────────────────────────────────────────────────────────

  /**
   * load — fetches all 12 data sources simultaneously with Promise.allSettled.
   * A failure on any one source (e.g. 404 for a missing profile) falls back to
   * a safe default so the rest of the page still renders correctly.
   */
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const ok = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === 'fulfilled' ? r.value : fallback;

      const [
        rCamper, rRecord, rAllergies, rMedications, rDiagnoses,
        rContacts, rPermissions, rBehavioral, rFeeding, rDevices,
        rAlerts, rPlan,
      ] = await Promise.allSettled([
        getCamper(id),
        getMedicalRecordByCamper(id),
        getAllergiesByCamper(id),
        getMedicationsByCamper(id),
        getDiagnosesByCamper(id),
        getEmergencyContacts(id),
        getActivityPermissions(id),
        getBehavioralProfile(id),
        getFeedingPlan(id),
        getAssistiveDevices(id),
        getCamperMedicalAlerts(id),
        getPersonalCarePlan(id),
      ]);

      // rCamper failure is non-recoverable — let the finally block handle loading state
      if (rCamper.status === 'rejected') throw rCamper.reason;

      setState({
        camper:          ok(rCamper,      null),
        record:          ok(rRecord,      undefined) ?? null,
        allergies:       ok(rAllergies,   []),
        medications:     ok(rMedications, []),
        diagnoses:       ok(rDiagnoses,   []),
        contacts:        ok(rContacts,    []),
        permissions:     ok(rPermissions, []),
        behavioral:      ok(rBehavioral,  null),
        feeding:         ok(rFeeding,     null),
        devices:         ok(rDevices,     []),
        personalCarePlan: ok(rPlan,       null),
      });
      setAlerts(ok(rAlerts, []));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // ─── Modal openers ──────────────────────────────────────────────────────────
  // Each opener pre-fills the shared `form` state with the item's current values
  // before opening the edit modal, so the user sees the existing data to modify.

  const openEditAllergy = (a: Allergy) => {
    setEditTarget(a.id);
    setForm({ name: a.allergen, severity: a.severity, reaction: a.reaction ?? '' });
    setModal('edit-allergy');
  };

  const openEditMedication = (m: Medication) => {
    setEditTarget(m.id);
    setForm({ name: m.name, dosage: m.dosage, frequency: m.frequency, notes: m.notes ?? '' });
    setModal('edit-medication');
  };

  const openEditDiagnosis = (d: Diagnosis) => {
    setEditTarget(d.id);
    setForm({ name: d.name, icd_code: d.icd_code ?? '', notes: d.notes ?? '' });
    setModal('edit-diagnosis');
  };

  const openEditNotes = () => {
    const r = state.record;
    setForm({
      special_needs: r?.special_needs ?? '',
      dietary_restrictions: r?.dietary_restrictions ?? '',
      notes: r?.notes ?? '',
    });
    setModal('edit-notes');
  };

  const openEditBehavioral = () => {
    const b = state.behavioral;
    setForm({
      triggers: b?.triggers ?? '',
      de_escalation_strategies: b?.de_escalation_strategies ?? '',
      communication_style: b?.communication_style ?? '',
      notes: b?.notes ?? '',
    });
    setModal('edit-behavioral');
  };

  const openEditFeeding = () => {
    const f = state.feeding;
    setForm({ method: f?.method ?? '', restrictions: f?.restrictions ?? '', notes: f?.notes ?? '' });
    setModal('edit-feeding');
  };

  const openEditDevice = (d: AssistiveDevice) => {
    setEditTarget(d.id);
    setForm({ type: d.device_type, description: d.notes ?? '' });
    setModal('edit-device');
  };

  // ─── Saves ──────────────────────────────────────────────────────────────────
  // Each save handler calls the API, then merges the returned object back into
  // the local RecordState so the page reflects the change without a full reload.

  const handleAddAllergy = async () => {
    // Guard: name and severity are required fields
    if (!form.name || !form.severity) return;
    setSaving(true);
    try {
      const a = await createAllergy({ camper_id: id, allergen: form.name, severity: form.severity, reaction: form.reaction });
      // Append the new allergy to the existing list
      setState((s) => ({ ...s, allergies: [...s.allergies, a] }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAllergy = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const a = await updateAllergy(editTarget, { allergen: form.name, severity: form.severity, reaction: form.reaction });
      // Replace only the edited item in the list using map
      setState((s) => ({ ...s, allergies: s.allergies.map((x) => x.id === editTarget ? a : x) }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMedication = async () => {
    if (!form.name || !form.dosage || !form.frequency) return;
    setSaving(true);
    try {
      const m = await createMedication({ camper_id: id, name: form.name, dosage: form.dosage, frequency: form.frequency, notes: form.notes });
      setState((s) => ({ ...s, medications: [...s.medications, m] }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMedication = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const m = await updateMedication(editTarget, { name: form.name, dosage: form.dosage, frequency: form.frequency, notes: form.notes });
      setState((s) => ({ ...s, medications: s.medications.map((x) => x.id === editTarget ? m : x) }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDiagnosis = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      // Send icd_code only if the user filled it in (undefined is omitted by the API)
      const d = await createDiagnosis({ camper_id: id, name: form.name, icd_code: form.icd_code || undefined, notes: form.notes });
      setState((s) => ({ ...s, diagnoses: [...s.diagnoses, d] }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditDiagnosis = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const d = await updateDiagnosis(editTarget, { name: form.name, icd_code: form.icd_code || undefined, notes: form.notes });
      setState((s) => ({ ...s, diagnoses: s.diagnoses.map((x) => x.id === editTarget ? d : x) }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditNotes = async () => {
    if (!state.record) return;
    setSaving(true);
    try {
      const r = await updateMedicalRecord(state.record.id, {
        special_needs: form.special_needs || undefined,
        dietary_restrictions: form.dietary_restrictions || undefined,
        notes: form.notes || undefined,
      });
      setState((s) => ({ ...s, record: r }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditBehavioral = async () => {
    setSaving(true);
    try {
      // If a profile already exists, update it; otherwise create a new one
      if (state.behavioral) {
        const b = await updateBehavioralProfile(state.behavioral.id, form);
        setState((s) => ({ ...s, behavioral: b }));
      } else {
        const b = await createBehavioralProfile({ camper_id: id, ...form });
        setState((s) => ({ ...s, behavioral: b }));
      }
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditFeeding = async () => {
    if (!form.method) return;
    setSaving(true);
    try {
      // Same create-or-update pattern as behavioral profile
      if (state.feeding) {
        const f = await updateFeedingPlan(state.feeding.id, form);
        setState((s) => ({ ...s, feeding: f }));
      } else {
        const f = await createFeedingPlan({ camper_id: id, ...form });
        setState((s) => ({ ...s, feeding: f }));
      }
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDevice = async () => {
    if (!form.type) return;
    setSaving(true);
    try {
      const d = await createAssistiveDevice({ camper_id: id, type: form.type, description: form.description });
      setState((s) => ({ ...s, devices: [...s.devices, d] }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditDevice = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const d = await updateAssistiveDevice(editTarget, { device_type: form.type, notes: form.description });
      setState((s) => ({ ...s, devices: s.devices.map((x) => x.id === editTarget ? d : x) }));
      closeModal();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * handleToggleActivityPermission — flips a permission between 'yes' and 'no'.
   * Sends the API call then replaces the updated item in the local list.
   */
  const handleToggleActivityPermission = async (p: ActivityPermission) => {
    setSaving(true);
    try {
      const updated = await updateActivityPermission(p.id, { permission_level: p.permission_level === 'yes' ? 'no' : 'yes' });
      setState((s) => ({ ...s, permissions: s.permissions.map((x) => x.id === p.id ? updated : x) }));
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        {/* Nav row */}
        <div className="flex items-center justify-between mb-6">
          <Skeletons.Block height={14} width={80} />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeletons.Block key={i} height={28} width={88} />)}
          </div>
        </div>
        {/* Camper name */}
        <div className="mb-6 space-y-2">
          <Skeletons.Block height={24} width={200} />
          <Skeletons.Block height={13} width={140} />
        </div>
        {/* Key Safety Flags panel skeleton */}
        <div className="mb-6 rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'rgba(220,38,38,0.20)' }}>
          <div className="px-4 py-2.5" style={{ background: 'rgba(220,38,38,0.05)' }}>
            <Skeletons.Block height={11} width={110} />
          </div>
          <div className="grid grid-cols-2" style={{ background: 'var(--card)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-3 border-b border-r last:border-r-0 [&:nth-child(n+3)]:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="h-2 w-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'rgba(0,0,0,0.10)' }} />
                <Skeletons.Block height={11} />
              </div>
            ))}
          </div>
        </div>
        {/* Section header skeletons — mimics the collapsed MedSection rows */}
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--glass-medium)' }}>
                <Skeletons.Block height={28} width={28} />
                <div className="flex-1 space-y-1.5">
                  <Skeletons.Block height={13} width={100 + (i % 3) * 40} />
                  {i % 2 === 0 && <Skeletons.Block height={11} width={180} />}
                </div>
                <Skeletons.Block height={14} width={14} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Destructure from state for cleaner JSX references below
  const { camper, record, allergies, medications, diagnoses, contacts, permissions, behavioral, feeding, devices, personalCarePlan } = state;

  // Severity options used by both add-allergy and edit-allergy modals
  const SEVERITY_OPTIONS = [
    { value: 'mild',            label: 'Mild' },
    { value: 'moderate',        label: 'Moderate' },
    { value: 'severe',          label: 'Severe' },
    { value: 'life-threatening', label: 'Life-Threatening' },
  ];

  return (
    <>
      <div className="p-6 max-w-4xl">

        {/* Back navigation + quick-nav buttons to sub-pages */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to={ROUTES.MEDICAL_RECORD_TREATMENT}
            className="inline-flex items-center gap-2 text-sm transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('medical.record.back')}
          </Link>

          {/* Quick-nav pill buttons to related sub-pages for this camper */}
          <div className="flex items-center gap-2">
            <Link
              to={`/medical/records/${id}/treatments`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              {t('medical.record.treatment_log')}
            </Link>
            <Link
              to={`/medical/records/${id}/documents`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <FileText className="h-3.5 w-3.5" />
              {t('medical.record.documents')}
            </Link>
            <Link
              to={`/medical/records/${id}/incidents`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <AlertOctagon className="h-3.5 w-3.5" />
              {t('medical.record.incidents')}
            </Link>
            <Link
              to={`/medical/records/${id}/visits`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              {t('medical.record.visits')}
            </Link>
            <Link
              to={`/medical/records/${id}/risk`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: 'rgba(22,101,52,0.3)', color: '#166534', background: 'rgba(22,101,52,0.07)' }}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {t('medical.record.risk_assessment', 'Risk Assessment')}
            </Link>
          </div>
        </div>

        {/* Camper name + primary diagnosis */}
        <div className="mb-6">
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {camper?.full_name ?? t('medical.record.unknown')}
          </h1>
          {record?.primary_diagnosis && (
            <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {record.primary_diagnosis}
            </p>
          )}
        </div>

        {/* ── Key Safety Flags ──────────────────────────────────────────────────
            Always-visible panel derived directly from loaded data. Shows the 4
            highest-stakes conditions at a glance so staff never have to dig
            into collapsible sections for critical safety information.        */}
        {(() => {
          const severeAllergies = allergies.filter(
            (a) => a.severity.toLowerCase().includes('life') || a.severity === 'severe'
          );
          const hasSeizures  = record?.has_seizures ?? false;
          const needs1to1    = behavioral?.one_to_one_supervision ?? false;
          const mobilityNote = record?.mobility_notes || personalCarePlan?.positioning_notes || null;

          /** Smooth-scroll to a section by its DOM id, opening it if collapsed. */
          const scrollTo = (sectionId: string) => {
            const el = document.getElementById(sectionId);
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          };

          const flags = [
            {
              active:    severeAllergies.length > 0,
              label:     severeAllergies.length > 0
                ? `Allergies: ${severeAllergies.map((a) => a.allergen).join(', ')}`
                : 'Allergies: None severe',
              level:     'critical' as const,
              sectionId: 'section-allergies',
            },
            {
              active:    hasSeizures,
              label:     hasSeizures ? 'Seizures: History on record' : 'Seizures: None reported',
              level:     'critical' as const,
              sectionId: 'section-diagnoses',
            },
            {
              active:    needs1to1,
              label:     needs1to1 ? 'Supervision: 1:1 required' : 'Supervision: Not required',
              level:     'warning' as const,
              sectionId: 'section-behavioral',
            },
            {
              active:    !!mobilityNote,
              label:     mobilityNote ? `Mobility: ${mobilityNote}` : 'Mobility: No limitations noted',
              level:     'warning' as const,
              sectionId: 'section-extended-health',
            },
          ];

          const activeFlags = flags.filter((f) => f.active);

          return (
            <div className="mb-6 rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'rgba(220,38,38,0.30)' }}>
              {/* Panel header */}
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <AlertOctagon className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--destructive)' }}>
                  Key Safety Flags
                </p>
                <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Click a flag to jump to its section
                </span>
              </div>
              {/* Flag grid — each cell is a button that scrolls to the relevant section */}
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ background: 'var(--card)' }}>
                {flags.map((flag, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(flag.sectionId)}
                    className="flex items-start gap-2.5 px-4 py-3 border-b text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)] sm:[&:nth-child(odd)]:border-r"
                    style={{ borderColor: 'var(--border)' }}
                    title={`Jump to ${flag.sectionId.replace('section-', '').replace(/-/g, ' ')}`}
                  >
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: flag.active ? (flag.level === 'critical' ? 'var(--destructive)' : '#ca8a04') : 'rgba(5,150,105,0.7)' }}
                    />
                    <p className="text-xs leading-snug" style={{ color: flag.active ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                      {flag.label}
                    </p>
                  </button>
                ))}
              </div>
              {/* Secondary alerts from backend endpoint (only if any exist beyond the 4 above) */}
              {activeFlags.length === 0 && alerts.length === 0 && (
                <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No active safety flags.</p>
                </div>
              )}
              {alerts.length > 0 && (
                <div className="border-t space-y-0" style={{ borderColor: 'var(--border)' }}>
                  {alerts.map((alert, i) => {
                    const s = alert.level === 'critical'
                      ? { icon: 'var(--destructive)', text: 'var(--destructive)' }
                      : alert.level === 'warning'
                      ? { icon: '#ca8a04', text: '#ca8a04' }
                      : { icon: '#2563eb', text: '#2563eb' };
                    return (
                      <div key={i} className="flex items-start gap-2.5 px-4 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: s.icon }} />
                        <div>
                          <p className="text-xs font-medium" style={{ color: s.text }}>{alert.title}</p>
                          {alert.detail && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{alert.detail}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Collapsible data sections */}
        <div className="space-y-4">

          {/* Allergies — icon turns red if any allergy is life-threatening */}
          <div id="section-allergies">
            <MedSection
              title={t('medical.record.allergies')}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              color={allergies.some(a => a.severity.toLowerCase().includes('life')) ? 'var(--destructive)' : 'var(--warm-amber)'}
              bg={allergies.some(a => a.severity.toLowerCase().includes('life')) ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.10)'}
              empty={allergies.length === 0}
              emptyText={t('medical.record.no_allergies')}
              preview={allergies.length > 0 ? `Allergies: ${allergies.map((a) => a.allergen).join(', ')}` : null}
              onAdd={() => { setForm({ name: '', severity: '', reaction: '' }); setModal('add-allergy'); }}
            >
              <div className="space-y-3">
                {allergies.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.allergen}</p>
                      {a.reaction && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{a.reaction}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={a.severity} />
                      <button onClick={() => openEditAllergy(a)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </MedSection>
          </div>

          {/* Medications */}
          <div>
            <MedSection
              title={t('medical.record.medications')}
              icon={<Pill className="h-3.5 w-3.5" />}
              color="var(--night-sky-blue)"
              bg="rgba(96,165,250,0.1)"
              empty={medications.length === 0}
              emptyText={t('medical.record.no_medications')}
              preview={medications.length > 0 ? `Meds: ${medications.map((m) => m.name).join(', ')}` : null}
              onAdd={() => { setForm({ name: '', dosage: '', frequency: '', notes: '' }); setModal('add-medication'); }}
            >
              <div className="space-y-3">
                {medications.map((m) => (
                  <div key={m.id} className="flex items-start justify-between gap-3">
                    {/* Two-column grid for dosage + frequency labels */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm flex-1">
                      <p className="font-medium col-span-2" style={{ color: 'var(--foreground)' }}>{m.name}</p>
                      <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.dosage')}: {m.dosage}</p>
                      <p style={{ color: 'var(--muted-foreground)' }}>{t('medical.record.frequency')}: {m.frequency}</p>
                      {m.notes && <p className="col-span-2 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                    </div>
                    <button onClick={() => openEditMedication(m)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </div>

          {/* Diagnoses — ICD code shown as a monospace badge when present */}
          <div id="section-diagnoses">
            <MedSection
              title={t('medical.record.diagnoses')}
              icon={<Clipboard className="h-3.5 w-3.5" />}
              color="var(--ember-orange)"
              bg="rgba(22,163,74,0.1)"
              empty={diagnoses.length === 0}
              emptyText={t('medical.record.no_diagnoses')}
              preview={diagnoses.length > 0 ? `Diagnoses: ${diagnoses.map((d) => d.name).join(', ')}` : null}
              onAdd={() => { setForm({ name: '', icd_code: '', notes: '' }); setModal('add-diagnosis'); }}
            >
              <div className="space-y-2">
                {diagnoses.map((d) => (
                  <div key={d.id} className="flex items-start gap-3">
                    {d.icd_code && (
                      <span className="text-xs px-2 py-0.5 rounded font-mono flex-shrink-0 mt-0.5" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--ember-orange)' }}>
                        {d.icd_code}
                      </span>
                    )}
                    <div className="flex-1">
                      <p className="text-sm" style={{ color: 'var(--foreground)' }}>{d.name}</p>
                      {d.notes && <p className="text-xs mt-0.5 italic" style={{ color: 'var(--muted-foreground)' }}>{d.notes}</p>}
                    </div>
                    <button onClick={() => openEditDiagnosis(d)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </div>

          {/* Extended Health Information — Phase 2 medical record fields (always rendered) */}
          <div id="section-extended-health">
            <MedSection
              title="Extended Health Information"
              icon={<Stethoscope className="h-3.5 w-3.5" />}
              color="var(--night-sky-blue)"
              bg="rgba(96,165,250,0.10)"
              defaultOpen={false}
              empty={
                !record ||
                (!record.insurance_group && !record.medicaid_number &&
                !record.physician_address && record.immunizations_current == null &&
                !record.tetanus_date && !record.mobility_notes &&
                record.has_contagious_illness == null && record.tubes_in_ears == null &&
                record.has_recent_illness == null)
              }
              emptyText="No extended health information available."
              preview={record ? `Flags: ${[
                record.insurance_group && 'Insured',
                record.has_contagious_illness && 'Contagious illness',
                record.has_recent_illness && 'Recent illness',
                record.tubes_in_ears && 'Tubes in ears',
                record.mobility_notes && 'Mobility notes',
              ].filter(Boolean).join(' · ') || 'None'}` : null}
            >
                {record && <div className="space-y-4">
                  {/* Insurance / Coverage */}
                  {(record.insurance_group || record.medicaid_number) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Coverage</p>
                      <div className="grid grid-cols-2 gap-3">
                        <FieldRow label="Insurance Group" value={record.insurance_group} />
                        <FieldRow label="Medicaid Number" value={record.medicaid_number} />
                      </div>
                    </div>
                  )}
                  {/* Physician */}
                  {record.physician_address && (
                    <FieldRow label="Physician Address" value={record.physician_address} />
                  )}
                  {/* Immunizations */}
                  <div className="grid grid-cols-2 gap-3">
                    {record.immunizations_current != null && (
                      <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>Immunizations Current</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{
                            background: record.immunizations_current ? 'rgba(5,150,105,0.12)' : 'rgba(220,38,38,0.12)',
                            color: record.immunizations_current ? 'var(--forest-green)' : 'var(--destructive)',
                          }}>
                          {record.immunizations_current ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {record.tetanus_date && (
                      <FieldRow label="Tetanus Date" value={record.tetanus_date} />
                    )}
                  </div>
                  {/* Clinical flags */}
                  {(record.has_contagious_illness != null || record.tubes_in_ears != null || record.has_recent_illness != null) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Clinical Flags</p>
                      <div className="space-y-2">
                        {record.has_contagious_illness != null && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: record.has_contagious_illness ? 'rgba(220,38,38,0.12)' : 'rgba(5,150,105,0.12)',
                                  color: record.has_contagious_illness ? 'var(--destructive)' : 'var(--forest-green)',
                                }}>
                                {record.has_contagious_illness ? 'Yes' : 'No'}
                              </span>
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Contagious Illness</p>
                            </div>
                            {record.has_contagious_illness && record.contagious_illness_description && (
                              <p className="text-xs mt-1 ml-0 italic" style={{ color: 'var(--muted-foreground)' }}>{record.contagious_illness_description}</p>
                            )}
                          </div>
                        )}
                        {record.tubes_in_ears != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{
                                background: record.tubes_in_ears ? 'rgba(96,165,250,0.12)' : 'rgba(5,150,105,0.12)',
                                color: record.tubes_in_ears ? 'var(--night-sky-blue)' : 'var(--forest-green)',
                              }}>
                              {record.tubes_in_ears ? 'Yes' : 'No'}
                            </span>
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Tubes in Ears</p>
                          </div>
                        )}
                        {record.has_recent_illness != null && (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{
                                  background: record.has_recent_illness ? 'rgba(234,179,8,0.12)' : 'rgba(5,150,105,0.12)',
                                  color: record.has_recent_illness ? '#ca8a04' : 'var(--forest-green)',
                                }}>
                                {record.has_recent_illness ? 'Yes' : 'No'}
                              </span>
                              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Recent Illness</p>
                            </div>
                            {record.has_recent_illness && record.recent_illness_description && (
                              <p className="text-xs mt-1 italic" style={{ color: 'var(--muted-foreground)' }}>{record.recent_illness_description}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {record.mobility_notes && (
                    <FieldRow label="Mobility Notes" value={record.mobility_notes} />
                  )}
                </div>}
            </MedSection>
          </div>

          {/* Personal Care Plan (ADL) — always rendered; empty state shown when no plan exists */}
          <div id="section-adl">
            <MedSection
              title="Personal Care Plan (ADL)"
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              color="var(--forest-green)"
              bg="rgba(5,150,105,0.10)"
              defaultOpen={false}
              empty={!personalCarePlan}
              emptyText="No personal care plan recorded."
              preview={personalCarePlan ? (() => {
                const adl = (level?: string | null) => {
                  switch (level) {
                    case 'independent':     return 'Independent';
                    case 'verbal_cue':
                    case 'physical_assist': return 'Needs assistance';
                    case 'full_assist':     return 'Fully dependent';
                    default:               return null;
                  }
                };
                const parts = [
                  personalCarePlan.bathing_level   && `Bathing: ${adl(personalCarePlan.bathing_level)}`,
                  personalCarePlan.toileting_level && `Toileting: ${adl(personalCarePlan.toileting_level)}`,
                  personalCarePlan.dressing_level  && `Dressing: ${adl(personalCarePlan.dressing_level)}`,
                ].filter(Boolean);
                return `ADL: ${parts.length > 0 ? parts.join(' · ') : 'Plan on file'}`;
              })() : null}
            >
                {personalCarePlan && <div className="space-y-4">
                  {/* ADL color key: green=Independent, amber=Needs Assistance, red=Fully Dependent */}
                  {(() => {
                    const adlColor = (level?: string | null) => {
                      switch (level) {
                        case 'independent':     return { bg: 'rgba(5,150,105,0.12)',  text: 'var(--forest-green)' };
                        case 'verbal_cue':      return { bg: 'rgba(234,179,8,0.12)',  text: '#ca8a04' };
                        case 'physical_assist': return { bg: 'rgba(234,179,8,0.12)',  text: '#ca8a04' };
                        case 'full_assist':     return { bg: 'rgba(220,38,38,0.12)',  text: 'var(--destructive)' };
                        default:                return null;
                      }
                    };
                    const adlLabel = (level?: string | null): string | null => {
                      switch (level) {
                        case 'independent':     return 'Independent';
                        case 'verbal_cue':      return 'Needs Assistance';
                        case 'physical_assist': return 'Needs Assistance';
                        case 'full_assist':     return 'Fully Dependent';
                        default:                return null;
                      }
                    };

                    const ADLRow = ({ label, level, notes }: { label: string; level?: string | null; notes?: string | null }) => {
                      if (!level && !notes) return null;
                      const colors = adlColor(level);
                      return (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                            {notes && <p className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{notes}</p>}
                          </div>
                          {level && colors && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{ background: colors.bg, color: colors.text }}>
                              {adlLabel(level)}
                            </span>
                          )}
                        </div>
                      );
                    };

                    return (
                      <>
                        {/* Daily care activities */}
                        {(personalCarePlan.bathing_level || personalCarePlan.bathing_notes ||
                          personalCarePlan.toileting_level || personalCarePlan.toileting_notes ||
                          personalCarePlan.dressing_level || personalCarePlan.dressing_notes ||
                          personalCarePlan.oral_hygiene_level || personalCarePlan.oral_hygiene_notes) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Daily Activities</p>
                            <div className="space-y-2">
                              <ADLRow label="Bathing" level={personalCarePlan.bathing_level} notes={personalCarePlan.bathing_notes} />
                              <ADLRow label="Toileting" level={personalCarePlan.toileting_level} notes={personalCarePlan.toileting_notes} />
                              <ADLRow label="Dressing" level={personalCarePlan.dressing_level} notes={personalCarePlan.dressing_notes} />
                              <ADLRow label="Oral Hygiene" level={personalCarePlan.oral_hygiene_level} notes={personalCarePlan.oral_hygiene_notes} />
                            </div>
                          </div>
                        )}
                        {/* Sleep */}
                        {(personalCarePlan.sleep_notes || personalCarePlan.falling_asleep_issues ||
                          personalCarePlan.sleep_walking || personalCarePlan.night_wandering ||
                          personalCarePlan.nighttime_toileting || personalCarePlan.nighttime_notes) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Sleep & Nighttime</p>
                            <div className="space-y-1.5">
                              {[
                                { flag: personalCarePlan.falling_asleep_issues, label: 'Falling Asleep Issues' },
                                { flag: personalCarePlan.sleep_walking,         label: 'Sleep Walking' },
                                { flag: personalCarePlan.night_wandering,       label: 'Night Wandering' },
                                { flag: personalCarePlan.nighttime_toileting,   label: 'Nighttime Toileting Required' },
                              ].filter(f => f.flag).map(({ label }) => (
                                <div key={label} className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--warm-amber)' }} />
                                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>{label}</p>
                                </div>
                              ))}
                              {personalCarePlan.sleep_notes && (
                                <p className="text-xs italic mt-1" style={{ color: 'var(--muted-foreground)' }}>{personalCarePlan.sleep_notes}</p>
                              )}
                              {personalCarePlan.nighttime_notes && (
                                <p className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{personalCarePlan.nighttime_notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Continence & positioning */}
                        {(personalCarePlan.bowel_control_notes || personalCarePlan.urinary_catheter ||
                          personalCarePlan.menstruation_support || personalCarePlan.positioning_notes) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Continence & Positioning</p>
                            <div className="space-y-1.5">
                              {personalCarePlan.urinary_catheter && (
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--destructive)' }} />
                                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>Urinary Catheter</p>
                                </div>
                              )}
                              {personalCarePlan.menstruation_support && (
                                <div className="flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--muted-foreground)' }} />
                                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>Menstruation Support Required</p>
                                </div>
                              )}
                              {personalCarePlan.bowel_control_notes && (
                                <p className="text-xs italic" style={{ color: 'var(--muted-foreground)' }}>{personalCarePlan.bowel_control_notes}</p>
                              )}
                              {personalCarePlan.positioning_notes && (
                                <FieldRow label="Positioning Notes" value={personalCarePlan.positioning_notes} />
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>}
            </MedSection>
          </div>

          {/* General Notes — special needs, dietary restrictions, free-form notes */}
          <div>
            <MedSection
              title={t('medical.record.notes')}
              icon={<Edit2 className="h-3.5 w-3.5" />}
              color="var(--muted-foreground)"
              bg="var(--muted)"
              empty={!record?.special_needs && !record?.dietary_restrictions && !record?.notes}
              emptyText={t('medical.record.no_notes')}
              onAdd={record ? openEditNotes : undefined}
            >
              <div className="space-y-3 text-sm">
                <FieldRow label={t('medical.record.special_needs')} value={record?.special_needs} />
                <FieldRow label={t('medical.record.dietary_restrictions')} value={record?.dietary_restrictions} />
                <FieldRow label={t('medical.record.general_notes')} value={record?.notes} />
              </div>
            </MedSection>
          </div>

          {/* Behavioral Profile */}
          <div id="section-behavioral">
            <MedSection
              title={t('medical.record.behavioral')}
              icon={<Brain className="h-3.5 w-3.5" />}
              color="var(--forest-green)"
              bg="rgba(5,150,105,0.1)"
              empty={!behavioral}
              emptyText={t('medical.record.no_behavioral')}
              preview={behavioral ? `Behavior: ${[
                behavioral.one_to_one_supervision && '1:1 supervision',
                behavioral.wandering_risk && 'Wandering risk',
                behavioral.aggression && 'Aggression noted',
                !behavioral.one_to_one_supervision && !behavioral.wandering_risk && !behavioral.aggression
                  && (behavioral.triggers ? `Triggers noted` : null),
              ].filter(Boolean).join(' · ') || 'Profile on file'}` : null}
              onAdd={openEditBehavioral}
            >
              {behavioral && (
                <div className="space-y-3 text-sm">
                  <FieldRow label={t('medical.record.triggers')} value={behavioral.triggers} />
                  <FieldRow label={t('medical.record.de_escalation')} value={behavioral.de_escalation_strategies} />
                  <FieldRow label={t('medical.record.communication')} value={behavioral.communication_style} />
                  <FieldRow label={t('common.notes')} value={behavioral.notes} />
                  <button onClick={openEditBehavioral} className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                    <Edit2 className="h-3 w-3" /> {t('common.edit')}
                  </button>
                </div>
              )}
            </MedSection>
          </div>

          {/* Feeding Plan — collapsed by default since less commonly needed */}
          <div>
            <MedSection
              title={t('medical.record.feeding')}
              icon={<Coffee className="h-3.5 w-3.5" />}
              color="var(--warm-amber)"
              bg="rgba(22,163,74,0.1)"
              defaultOpen={false}
              empty={!feeding}
              emptyText={t('medical.record.no_feeding')}
              onAdd={openEditFeeding}
            >
              {feeding && (
                <div className="space-y-2 text-sm">
                  <FieldRow label={t('medical.record.method')} value={feeding.method} />
                  <FieldRow label={t('medical.record.restrictions')} value={feeding.restrictions} />
                  <FieldRow label={t('common.notes')} value={feeding.notes} />
                  <button onClick={openEditFeeding} className="inline-flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--ember-orange)' }}>
                    <Edit2 className="h-3 w-3" /> {t('common.edit')}
                  </button>
                </div>
              )}
            </MedSection>
          </div>

          {/* Assistive Devices — collapsed by default */}
          <div>
            <MedSection
              title={t('medical.record.devices')}
              icon={<Wrench className="h-3.5 w-3.5" />}
              color="var(--night-sky-blue)"
              bg="rgba(96,165,250,0.1)"
              defaultOpen={false}
              empty={devices.length === 0}
              emptyText={t('medical.record.no_devices')}
              onAdd={() => { setForm({ type: '', description: '' }); setModal('add-device'); }}
            >
              <div className="space-y-2">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{d.device_type}</p>
                      {d.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{d.notes}</p>}
                    </div>
                    <button onClick={() => openEditDevice(d)} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </div>

          {/* Activity Permissions — toggle between yes/no with a single click */}
          <div>
            <MedSection
              title={t('medical.record.activity_permissions')}
              icon={<Activity className="h-3.5 w-3.5" />}
              color="var(--forest-green)"
              bg="rgba(5,150,105,0.1)"
              defaultOpen={false}
              empty={permissions.length === 0}
              emptyText={t('medical.record.no_permissions')}
            >
              <div className="space-y-2">
                {permissions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{p.activity_name}</p>
                    {/* Button color reflects the current permission level */}
                    <button
                      onClick={() => handleToggleActivityPermission(p)}
                      disabled={saving}
                      className="text-xs px-2 py-0.5 rounded-full font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: p.permission_level === 'yes' ? 'rgba(5,150,105,0.12)' : p.permission_level === 'restricted' ? 'rgba(234,179,8,0.12)' : 'rgba(220,38,38,0.12)',
                        color: p.permission_level === 'yes' ? 'var(--forest-green)' : p.permission_level === 'restricted' ? '#ca8a04' : 'var(--destructive)',
                      }}
                      title="Toggle permission"
                    >
                      {p.permission_level === 'yes' ? t('common.permitted') : p.permission_level === 'restricted' ? 'Restricted' : t('common.not_permitted')}
                    </button>
                  </div>
                ))}
              </div>
            </MedSection>
          </div>

          {/* Emergency Contacts — split into Guardians and Additional Contacts */}
          <div>
            <MedSection
              title={t('medical.record.emergency_contacts')}
              icon={<Phone className="h-3.5 w-3.5" />}
              color="var(--destructive)"
              bg="rgba(220,38,38,0.10)"
              defaultOpen={false}
              empty={contacts.length === 0}
              emptyText={t('medical.record.no_contacts')}
              preview={contacts.length > 0 ? `Contacts: ${contacts.map((c) => c.name).join(', ')}` : null}
            >
              {(() => {
                const guardians  = contacts.filter((c) => c.is_guardian);
                const additional = contacts.filter((c) => !c.is_guardian);
                const renderContact = (c: EmergencyContact) => (
                  <div key={c.id}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{c.name}</p>
                      {c.is_primary && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--forest-green)' }}>
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                      {c.relationship} &middot; {c.phone_primary}
                      {c.phone_secondary && ` · ${c.phone_secondary}`}
                      {c.email && ` · ${c.email}`}
                    </p>
                    {c.address && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                );
                return (
                  <div className="space-y-4">
                    {guardians.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Guardians</p>
                        <div className="space-y-3">{guardians.map(renderContact)}</div>
                      </div>
                    )}
                    {additional.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>Additional Contacts</p>
                        <div className="space-y-3">{additional.map(renderContact)}</div>
                      </div>
                    )}
                    {/* Fallback: render all contacts flat if none have is_guardian set */}
                    {guardians.length === 0 && additional.length === 0 && contacts.map(renderContact)}
                  </div>
                );
              })()}
            </MedSection>
          </div>

        </div>
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────────── */}
      {/* Only one modal is rendered at a time based on the `modal` state value */}

      {modal === 'add-allergy' && (
        <Modal title={t('medical.modal.add_allergy')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddAllergy(); }} className="space-y-4">
            <Field label={t('medical.modal.allergen')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <SelectField label={t('medical.modal.severity')} name="severity" value={form.severity ?? ''} onChange={setField('severity')} options={SEVERITY_OPTIONS} required />
            <Field label={t('medical.modal.reaction')} name="reaction" value={form.reaction ?? ''} onChange={setField('reaction')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-allergy' && (
        <Modal title={t('medical.modal.edit_allergy')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditAllergy(); }} className="space-y-4">
            <Field label={t('medical.modal.allergen')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <SelectField label={t('medical.modal.severity')} name="severity" value={form.severity ?? ''} onChange={setField('severity')} options={SEVERITY_OPTIONS} required />
            <Field label={t('medical.modal.reaction')} name="reaction" value={form.reaction ?? ''} onChange={setField('reaction')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-medication' && (
        <Modal title={t('medical.modal.add_medication')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddMedication(); }} className="space-y-4">
            <Field label={t('medical.modal.med_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('medical.record.dosage')} name="dosage" value={form.dosage ?? ''} onChange={setField('dosage')} required />
              <Field label={t('medical.record.frequency')} name="frequency" value={form.frequency ?? ''} onChange={setField('frequency')} required />
            </div>
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-medication' && (
        <Modal title={t('medical.modal.edit_medication')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditMedication(); }} className="space-y-4">
            <Field label={t('medical.modal.med_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('medical.record.dosage')} name="dosage" value={form.dosage ?? ''} onChange={setField('dosage')} required />
              <Field label={t('medical.record.frequency')} name="frequency" value={form.frequency ?? ''} onChange={setField('frequency')} required />
            </div>
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-diagnosis' && (
        <Modal title={t('medical.modal.add_diagnosis')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddDiagnosis(); }} className="space-y-4">
            <Field label={t('medical.modal.diagnosis_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <Field label={t('medical.modal.icd_code')} name="icd_code" value={form.icd_code ?? ''} onChange={setField('icd_code')} />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-diagnosis' && (
        <Modal title={t('medical.modal.edit_diagnosis')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditDiagnosis(); }} className="space-y-4">
            <Field label={t('medical.modal.diagnosis_name')} name="name" value={form.name ?? ''} onChange={setField('name')} required />
            <Field label={t('medical.modal.icd_code')} name="icd_code" value={form.icd_code ?? ''} onChange={setField('icd_code')} />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-notes' && (
        <Modal title={t('medical.modal.edit_notes')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditNotes(); }} className="space-y-4">
            <Field label={t('medical.record.special_needs')} name="special_needs" value={form.special_needs ?? ''} onChange={setField('special_needs')} multiline />
            <Field label={t('medical.record.dietary_restrictions')} name="dietary_restrictions" value={form.dietary_restrictions ?? ''} onChange={setField('dietary_restrictions')} multiline />
            <Field label={t('medical.record.general_notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-behavioral' && (
        // Title changes depending on whether a profile already exists
        <Modal title={state.behavioral ? t('medical.modal.edit_behavioral') : t('medical.modal.add_behavioral')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditBehavioral(); }} className="space-y-4">
            <Field label={t('medical.record.triggers')} name="triggers" value={form.triggers ?? ''} onChange={setField('triggers')} multiline />
            <Field label={t('medical.record.de_escalation')} name="de_escalation_strategies" value={form.de_escalation_strategies ?? ''} onChange={setField('de_escalation_strategies')} multiline />
            <Field label={t('medical.record.communication')} name="communication_style" value={form.communication_style ?? ''} onChange={setField('communication_style')} multiline />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-feeding' && (
        <Modal title={state.feeding ? t('medical.modal.edit_feeding') : t('medical.modal.add_feeding')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditFeeding(); }} className="space-y-4">
            <Field label={t('medical.record.method')} name="method" value={form.method ?? ''} onChange={setField('method')} required />
            <Field label={t('medical.record.restrictions')} name="restrictions" value={form.restrictions ?? ''} onChange={setField('restrictions')} multiline />
            <Field label={t('common.notes')} name="notes" value={form.notes ?? ''} onChange={setField('notes')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'add-device' && (
        <Modal title={t('medical.modal.add_device')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleAddDevice(); }} className="space-y-4">
            <Field label={t('medical.modal.device_type')} name="type" value={form.type ?? ''} onChange={setField('type')} required />
            <Field label={t('common.description')} name="description" value={form.description ?? ''} onChange={setField('description')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}

      {modal === 'edit-device' && (
        <Modal title={t('medical.modal.edit_device')} onClose={closeModal}>
          <form onSubmit={(e) => { e.preventDefault(); void handleEditDevice(); }} className="space-y-4">
            <Field label={t('medical.modal.device_type')} name="type" value={form.type ?? ''} onChange={setField('type')} required />
            <Field label={t('common.description')} name="description" value={form.description ?? ''} onChange={setField('description')} multiline />
            <SaveBtn loading={saving} onClose={closeModal} />
          </form>
        </Modal>
      )}
    </>
  );
}
