/**
 * AdminApplicationEditPage.tsx
 *
 * Unified admin application editor. Mirrors the applicant's ApplicationFormPage
 * across all 11 sections with full data coverage.
 *
 * Routes: /admin/applications/:id/edit  |  /super-admin/applications/:id/edit
 *
 * Architecture:
 *   - Load: getApplication() + getCamper() (with all medical sub-records)
 *   - State: one useState per section, useRef snapshot for dirty-checking
 *   - List CRUD: DraftItem<T> with _key + id? + _deleted markers
 *   - Save: diff all sections → build ops array → Promise.allSettled
 */

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, AlertTriangle, Save, Plus, Trash2, UserCog,
  User, Heart, Brain, Accessibility, Utensils, ShieldCheck,
  Activity, Pill, MessageSquare, Upload, PenLine, FileText, Eye,
} from 'lucide-react';

import {
  getApplication, getCamper, getSessions,
  updateCamper, updateApplication,
  createEmergencyContact, updateEmergencyContact, deleteEmergencyContact,
  createBehavioralProfile, updateBehavioralProfile,
  updateMedicalRecord, storeHealthProfile,
  createDiagnosis, updateDiagnosis, deleteDiagnosis,
  createAllergy, updateAllergy, deleteAllergy,
  createAssistiveDevice, updateAssistiveDevice, deleteAssistiveDevice,
  createFeedingPlan, updateFeedingPlan,
  storePersonalCarePlan,
  createActivityPermission, updateActivityPermission,
  createMedication, updateMedication, deleteMedication,
  uploadDocumentOnBehalf, deleteDocument,
  type UpdateCamperPayload,
  type UpdateApplicationPayload,
  type UpdateEmergencyContactPayload,
  type UpdateBehavioralProfilePayload,
  type UpdateMedicalRecordPayload,
  type StoreHealthProfilePayload,
  type DiagnosisPayload,
  type AllergyPayload,
  type AssistiveDevicePayload,
  type FeedingPlanPayload,
  type ActivityPermissionPayload,
  type MedicationPayload,
} from '@/features/admin/api/admin.api';
import type {
  Application, CampSession, Camper, Allergy,
} from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/ui/components/Button';

// ─── Draft types ──────────────────────────────────────────────────────────────

type DraftItem<T> = { _key: string; id?: number; _deleted: boolean; data: T };

function mkKey(): string { return `k-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function mkItem<T>(data: T, id?: number): DraftItem<T> { return { _key: mkKey(), id, _deleted: false, data }; }
function itemChanged<T>(item: DraftItem<T>, init: DraftItem<T>[]): boolean {
  const orig = init.find(i => i._key === item._key);
  return !orig || JSON.stringify(orig.data) !== JSON.stringify(item.data);
}

// ─── Section-state types ──────────────────────────────────────────────────────

interface S1State {
  first_name: string; last_name: string; preferred_name: string;
  date_of_birth: string; gender: string; tshirt_size: string;
  county: string; needs_interpreter: boolean; preferred_language: string;
}

interface ContactFields {
  name: string; relationship: string;
  phone_primary: string; phone_secondary: string; phone_work: string;
  email: string; is_primary: boolean; is_authorized_pickup: boolean;
  is_guardian: boolean; address: string; city: string; state: string;
  zip: string; primary_language: string; interpreter_needed: boolean;
}

interface S2State {
  physician_name: string; physician_phone: string; physician_address: string;
  insurance_type: 'none' | 'medicaid' | 'other';
  insurance_provider: string; insurance_policy_number: string;
  insurance_group: string; medicaid_number: string;
  has_seizures: boolean; last_seizure_date: string; seizure_description: string;
  has_neurostimulator: boolean;
  immunizations_current: boolean; tetanus_date: string; date_of_medical_exam: string;
  tubes_in_ears: boolean;
  has_contagious_illness: boolean; contagious_illness_description: string;
  has_recent_illness: boolean; recent_illness_description: string;
  mobility_notes: string; special_needs: string;
}

interface S3State {
  aggression: boolean; aggression_description: string;
  self_abuse: boolean; self_abuse_description: string;
  wandering_risk: boolean; wandering_description: string;
  one_to_one_supervision: boolean; one_to_one_description: string;
  developmental_delay: boolean; functioning_age_level: string;
  functional_reading: boolean; functional_writing: boolean;
  independent_mobility: boolean; verbal_communication: boolean;
  social_skills: boolean; behavior_plan: boolean;
  sexual_behaviors: boolean; sexual_behaviors_description: string;
  interpersonal_behavior: boolean; interpersonal_behavior_description: string;
  social_emotional: boolean; social_emotional_description: string;
  follows_instructions: boolean; follows_instructions_description: string;
  group_participation: boolean; group_participation_description: string;
  attends_school: boolean; classroom_type: string;
  communication_methods: string[];
  triggers: string; de_escalation_strategies: string;
  communication_style: string; notes: string;
}


interface S5State {
  special_diet: boolean; diet_description: string;
  texture_modified: boolean; texture_level: string;
  fluid_restriction: boolean; fluid_details: string;
  g_tube: boolean; formula: string; amount_per_feeding: string;
  feedings_per_day: string; feeding_times: string; bolus_only: boolean; notes: string;
}

interface S6State {
  bathing_level: string; bathing_notes: string;
  toileting_level: string; toileting_notes: string;
  nighttime_toileting: boolean; nighttime_notes: string;
  dressing_level: string; dressing_notes: string;
  oral_hygiene_level: string; oral_hygiene_notes: string;
  positioning_notes: string; sleep_notes: string;
  falling_asleep_issues: boolean; sleep_walking: boolean; night_wandering: boolean;
  bowel_control_notes: string; irregular_bowel: boolean; irregular_bowel_notes: string;
  urinary_catheter: boolean; menstruation_support: boolean;
}

type PermLevel = 'yes' | 'no' | 'restricted' | '';
interface ActivityPerm { id?: number; permission_level: PermLevel; restriction_notes: string; }

interface MedFields {
  name: string; dosage: string; frequency: string;
  route: string; purpose: string; prescribing_physician: string; notes: string;
}

interface SnState {
  notes: string;
  narrative_rustic_environment: string; narrative_staff_suggestions: string;
  narrative_participation_concerns: string; narrative_camp_benefit: string;
  narrative_heat_tolerance: string; narrative_transportation: string;
  narrative_additional_info: string; narrative_emergency_protocols: string;
}

interface DocItem {
  id: number; file_name: string; document_type: string | null;
  url?: string; created_at: string; _pendingDelete: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { label: 'General Info',   icon: User },
  { label: 'Health',         icon: Heart },
  { label: 'Behavior',       icon: Brain },
  { label: 'Equipment',      icon: Accessibility },
  { label: 'Diet',           icon: Utensils },
  { label: 'Personal Care',  icon: ShieldCheck },
  { label: 'Activities',     icon: Activity },
  { label: 'Medications',    icon: Pill },
  { label: 'Narratives',     icon: MessageSquare },
  { label: 'Documents',      icon: Upload },
  { label: 'Consents',       icon: PenLine },
] as const;

const ACTIVITIES = [
  { key: 'sports_games', label: 'Sports & Games' },
  { key: 'arts_crafts',  label: 'Arts & Crafts' },
  { key: 'nature',       label: 'Nature Activities' },
  { key: 'fine_arts',    label: 'Fine Arts' },
  { key: 'swimming',     label: 'Swimming' },
  { key: 'boating',      label: 'Boating' },
  { key: 'camp_out',     label: 'Camp Out' },
] as const;

const ADL_LEVELS = [
  { value: '',                label: '— Select —' },
  { value: 'independent',     label: 'Independent' },
  { value: 'verbal_cue',      label: 'Verbal Cue' },
  { value: 'physical_assist', label: 'Physical Assist' },
  { value: 'full_assist',     label: 'Full Assist' },
];

const TEXTURE_LEVELS = [
  'Regular', 'Minced & moist', 'Minced', 'Puréed', 'Liquidised',
  'Thin liquids', 'Slightly thick', 'Mildly thick', 'Moderately thick', 'Extremely thick',
];

const DEVICE_TYPES = [
  'Wheelchair (manual)', 'Wheelchair (power)', 'Walker', 'Crutches', 'Cane',
  'Leg brace(s)', 'CPAP / BiPAP', 'Hearing aid', 'Cochlear implant',
  'Glasses / contacts', 'Prosthetic limb', 'Orthotics / AFOs',
  'Computerized communication device', 'Gait trainer', 'Other',
];

const COMMUNICATION_METHODS = [
  'Verbal speech', 'AAC device', 'Sign language', 'Picture symbols',
  'Gestures', 'Written text', 'Eye gaze',
];

const TSHIRT_SIZES = ['YXS', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'];
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Other', 'Prefer not to say'];
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];
const SEVERITY_OPTIONS: Array<{ value: Allergy['severity']; label: string }> = [
  { value: 'mild',            label: 'Mild' },
  { value: 'moderate',        label: 'Moderate' },
  { value: 'severe',          label: 'Severe' },
  { value: 'life-threatening',label: 'Life-threatening' },
];
const NARRATIVE_FIELDS: { key: keyof SnState; label: string; help: string }[] = [
  { key: 'narrative_rustic_environment',     label: 'Rustic Environment',     help: 'How does the camper adapt to outdoor/rustic settings?' },
  { key: 'narrative_staff_suggestions',      label: 'Staff Suggestions',      help: 'What should staff know to best support this camper?' },
  { key: 'narrative_participation_concerns', label: 'Participation Concerns',  help: 'Activities the camper cannot or should not do.' },
  { key: 'narrative_camp_benefit',           label: 'Camp Benefit',           help: 'How will the camper benefit from attending camp?' },
  { key: 'narrative_heat_tolerance',         label: 'Heat Tolerance',         help: "Describe the camper's tolerance for heat and sun." },
  { key: 'narrative_transportation',         label: 'Transportation',          help: 'Transportation needs or arrangements.' },
  { key: 'narrative_additional_info',        label: 'Additional Information',  help: 'Any other information staff should know.' },
  { key: 'narrative_emergency_protocols',    label: 'Emergency Protocols',    help: 'Special emergency procedures for this camper.' },
];

const RESTRICTED_STATUSES = new Set(['approved', 'rejected', 'cancelled', 'withdrawn', 'waitlisted']);

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inp: CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 14,
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--card)', color: 'var(--foreground)',
};
const lbl: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted-foreground)', marginBottom: 3,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

function SectionCard({
  id, title, icon: Icon, children, secRef,
}: {
  id: string; title: string; icon: React.ElementType;
  children: React.ReactNode; secRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <section
      id={id}
      ref={secRef as React.RefObject<HTMLElement>}
      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, scrollMarginTop: 72 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--ember-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} color="#fff" />
        </div>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--foreground)' }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Fld({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>{children}</div>;
}
function Grid3({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>{children}</div>;
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6, marginTop: 12,
      border: '1px dashed var(--border)', borderRadius: 8, padding: '8px 14px',
      background: 'none', cursor: 'pointer', color: 'var(--ember-orange)',
      fontSize: 13, fontWeight: 600, width: '100%', justifyContent: 'center',
    }}>
      <Plus size={14} /> {label}
    </button>
  );
}

function DraftRow({ children, deleted, onDelete, onUndo }: {
  children: React.ReactNode; deleted: boolean; onDelete: () => void; onUndo: () => void;
}) {
  return (
    <div style={{
      border: `1px solid ${deleted ? 'var(--border)' : 'var(--border)'}`,
      borderRadius: 10, padding: 16, marginTop: 12,
      opacity: deleted ? 0.45 : 1, background: deleted ? 'var(--muted)' : 'var(--background)',
      position: 'relative',
    }}>
      {deleted ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Marked for deletion</span>
          <button onClick={onUndo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ember-orange)', fontSize: 13, fontWeight: 600 }}>Undo</button>
        </div>
      ) : (
        <>
          <button onClick={onDelete} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <Trash2 size={13} /> Remove
          </button>
          {children}
        </>
      )}
    </div>
  );
}

function FlagRow({ label, checked, onChange, children }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
        {label}
      </label>
      {checked && children && (
        <div style={{ marginTop: 6, marginLeft: 24 }}>{children}</div>
      )}
    </div>
  );
}

// ─── Default states ───────────────────────────────────────────────────────────

const defaultS1: S1State = { first_name: '', last_name: '', preferred_name: '', date_of_birth: '', gender: '', tshirt_size: '', county: '', needs_interpreter: false, preferred_language: '' };
const defaultS2: S2State = { physician_name: '', physician_phone: '', physician_address: '', insurance_type: 'none', insurance_provider: '', insurance_policy_number: '', insurance_group: '', medicaid_number: '', has_seizures: false, last_seizure_date: '', seizure_description: '', has_neurostimulator: false, immunizations_current: false, tetanus_date: '', date_of_medical_exam: '', tubes_in_ears: false, has_contagious_illness: false, contagious_illness_description: '', has_recent_illness: false, recent_illness_description: '', mobility_notes: '', special_needs: '' };
const defaultS3: S3State = { aggression: false, aggression_description: '', self_abuse: false, self_abuse_description: '', wandering_risk: false, wandering_description: '', one_to_one_supervision: false, one_to_one_description: '', developmental_delay: false, functioning_age_level: '', functional_reading: false, functional_writing: false, independent_mobility: false, verbal_communication: false, social_skills: false, behavior_plan: false, sexual_behaviors: false, sexual_behaviors_description: '', interpersonal_behavior: false, interpersonal_behavior_description: '', social_emotional: false, social_emotional_description: '', follows_instructions: false, follows_instructions_description: '', group_participation: false, group_participation_description: '', attends_school: false, classroom_type: '', communication_methods: [], triggers: '', de_escalation_strategies: '', communication_style: '', notes: '' };
const defaultS5: S5State = { special_diet: false, diet_description: '', texture_modified: false, texture_level: '', fluid_restriction: false, fluid_details: '', g_tube: false, formula: '', amount_per_feeding: '', feedings_per_day: '', feeding_times: '', bolus_only: false, notes: '' };
const defaultS6: S6State = { bathing_level: '', bathing_notes: '', toileting_level: '', toileting_notes: '', nighttime_toileting: false, nighttime_notes: '', dressing_level: '', dressing_notes: '', oral_hygiene_level: '', oral_hygiene_notes: '', positioning_notes: '', sleep_notes: '', falling_asleep_issues: false, sleep_walking: false, night_wandering: false, bowel_control_notes: '', irregular_bowel: false, irregular_bowel_notes: '', urinary_catheter: false, menstruation_support: false };
const defaultSn: SnState = { notes: '', narrative_rustic_environment: '', narrative_staff_suggestions: '', narrative_participation_concerns: '', narrative_camp_benefit: '', narrative_heat_tolerance: '', narrative_transportation: '', narrative_additional_info: '', narrative_emergency_protocols: '' };
const defaultActivities = (): Record<string, ActivityPerm> => Object.fromEntries(ACTIVITIES.map(a => [a.key, { permission_level: '' as PermLevel, restriction_notes: '' }]));

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminApplicationEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith('/super-admin');

  // ── Core state ─────────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(true);
  const [saving,  setSaving]        = useState(false);
  const [error,   setError]         = useState<string | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [camper,      setCamper]      = useState<Camper | null>(null);
  const [sessions,    setSessions]    = useState<CampSession[]>([]);
  const [activeTab,   setActiveTab]   = useState(0);

  // ── Section state ──────────────────────────────────────────────────────────
  const [s1,          setS1]          = useState<S1State>(defaultS1);
  const [contacts,    setContacts]    = useState<DraftItem<ContactFields>[]>([]);
  const [s2,          setS2]          = useState<S2State>(defaultS2);
  const [diagnoses,   setDiagnoses]   = useState<DraftItem<DiagnosisPayload>[]>([]);
  const [allergies,   setAllergies]   = useState<DraftItem<AllergyPayload>[]>([]);
  const [s3,          setS3]          = useState<S3State>(defaultS3);
  const [devices,     setDevices]     = useState<DraftItem<AssistiveDevicePayload>[]>([]);
  const [s5,          setS5]          = useState<S5State>(defaultS5);
  const [s6,          setS6]          = useState<S6State>(defaultS6);
  const [s7,          setS7]          = useState<Record<string, ActivityPerm>>(defaultActivities());
  const [medications, setMedications] = useState<DraftItem<MedFields>[]>([]);
  const [sn,          setSn]          = useState<SnState>(defaultSn);
  const [documents,   setDocuments]   = useState<DocItem[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Server IDs for single-record models ────────────────────────────────────
  const medRecordIdRef    = useRef<number | undefined>();
  const behavProfileIdRef = useRef<number | undefined>();
  const feedingPlanIdRef  = useRef<number | undefined>();

  // ── Init snapshots for dirty-checking ──────────────────────────────────────
  const s1Init       = useRef<S1State>(defaultS1);
  const contactsInit = useRef<DraftItem<ContactFields>[]>([]);
  const s2Init       = useRef<S2State>(defaultS2);
  const s3Init       = useRef<S3State>(defaultS3);
  const s5Init       = useRef<S5State>(defaultS5);
  const s6Init       = useRef<S6State>(defaultS6);
  const s7Init       = useRef<Record<string, ActivityPerm>>(defaultActivities());
  const snInit       = useRef<SnState>(defaultSn);

  // ── Section scroll refs ────────────────────────────────────────────────────
  const secRef0  = useRef<HTMLElement | null>(null);
  const secRef1  = useRef<HTMLElement | null>(null);
  const secRef2  = useRef<HTMLElement | null>(null);
  const secRef3  = useRef<HTMLElement | null>(null);
  const secRef4  = useRef<HTMLElement | null>(null);
  const secRef5  = useRef<HTMLElement | null>(null);
  const secRef6  = useRef<HTMLElement | null>(null);
  const secRef7  = useRef<HTMLElement | null>(null);
  const secRef8  = useRef<HTMLElement | null>(null);
  const secRef9  = useRef<HTMLElement | null>(null);
  const secRef10 = useRef<HTMLElement | null>(null);
  const secRefs = useMemo(() => [secRef0, secRef1, secRef2, secRef3, secRef4, secRef5, secRef6, secRef7, secRef8, secRef9, secRef10], []);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    Promise.all([getApplication(Number(id)), getSessions()])
      .then(async ([app, sess]) => {
        setApplication(app);
        setSessions(sess);

        // Narratives + admin notes
        const snVal: SnState = {
          notes: app.notes ?? '',
          narrative_rustic_environment:     app.narrative_rustic_environment ?? '',
          narrative_staff_suggestions:      app.narrative_staff_suggestions ?? '',
          narrative_participation_concerns: app.narrative_participation_concerns ?? '',
          narrative_camp_benefit:           app.narrative_camp_benefit ?? '',
          narrative_heat_tolerance:         app.narrative_heat_tolerance ?? '',
          narrative_transportation:         app.narrative_transportation ?? '',
          narrative_additional_info:        app.narrative_additional_info ?? '',
          narrative_emergency_protocols:    app.narrative_emergency_protocols ?? '',
        };
        setSn(snVal);
        snInit.current = { ...snVal };

        // Documents
        setDocuments((app.documents ?? []).map(d => ({
          id: d.id, file_name: d.file_name ?? '', document_type: d.document_type,
          url: d.url, created_at: d.created_at, _pendingDelete: false,
        })));

        // Full camper with all medical relations
        if (app.camper_id) {
          const fc = await getCamper(app.camper_id);
          setCamper(fc);

          // S1 — Camper identity
          const s1Val: S1State = {
            first_name: fc.first_name, last_name: fc.last_name,
            preferred_name: fc.preferred_name ?? '',
            date_of_birth: fc.date_of_birth,
            gender: fc.gender ?? '', tshirt_size: fc.tshirt_size ?? '',
            county: fc.county ?? '',
            needs_interpreter: fc.needs_interpreter ?? false,
            preferred_language: fc.preferred_language ?? '',
          };
          setS1(s1Val); s1Init.current = { ...s1Val };

          // Emergency contacts
          const ctDrafts = (fc.emergency_contacts ?? []).map(c => mkItem<ContactFields>({
            name: c.name, relationship: c.relationship,
            phone_primary: c.phone_primary, phone_secondary: c.phone_secondary ?? '',
            phone_work: c.phone_work ?? '', email: c.email ?? '',
            is_primary: c.is_primary ?? false, is_authorized_pickup: c.is_authorized_pickup ?? false,
            is_guardian: c.is_guardian ?? false,
            address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', zip: c.zip ?? '',
            primary_language: c.primary_language ?? '', interpreter_needed: c.interpreter_needed ?? false,
          }, c.id));
          setContacts(ctDrafts);
          contactsInit.current = ctDrafts.map(d => ({ ...d, data: { ...d.data } }));

          // S2 — Medical record
          const mr = fc.medical_record;
          medRecordIdRef.current = mr?.id;
          const s2Val: S2State = {
            physician_name: mr?.physician_name ?? '', physician_phone: mr?.physician_phone ?? '',
            physician_address: mr?.physician_address ?? '',
            insurance_type: mr?.medicaid_number ? 'medicaid' : mr?.insurance_provider ? 'other' : 'none',
            insurance_provider: mr?.insurance_provider ?? '', insurance_policy_number: mr?.insurance_policy_number ?? '',
            insurance_group: mr?.insurance_group ?? '', medicaid_number: mr?.medicaid_number ?? '',
            has_seizures: mr?.has_seizures ?? false, last_seizure_date: mr?.last_seizure_date ?? '',
            seizure_description: mr?.seizure_description ?? '',
            has_neurostimulator: mr?.has_neurostimulator ?? false,
            immunizations_current: mr?.immunizations_current ?? false,
            tetanus_date: mr?.tetanus_date ?? '', date_of_medical_exam: mr?.date_of_medical_exam ?? '',
            tubes_in_ears: mr?.tubes_in_ears ?? false,
            has_contagious_illness: mr?.has_contagious_illness ?? false,
            contagious_illness_description: mr?.contagious_illness_description ?? '',
            has_recent_illness: mr?.has_recent_illness ?? false,
            recent_illness_description: mr?.recent_illness_description ?? '',
            mobility_notes: mr?.mobility_notes ?? '', special_needs: mr?.special_needs ?? '',
          };
          setS2(s2Val); s2Init.current = { ...s2Val };

          // Diagnoses
          const dxDrafts = (fc.diagnoses ?? []).map(d => mkItem<DiagnosisPayload>({ name: d.name, notes: d.notes ?? '' }, d.id));
          setDiagnoses(dxDrafts); diagInit.current = dxDrafts.map(d => ({ ...d, data: { ...d.data } }));

          // Allergies
          const alDrafts = (fc.allergies ?? []).map(a => mkItem<AllergyPayload>({ allergen: a.allergen, severity: a.severity, reaction: a.reaction ?? '', treatment: a.treatment ?? '' }, a.id));
          setAllergies(alDrafts); alInit.current = alDrafts.map(d => ({ ...d, data: { ...d.data } }));

          // S3 — Behavioral profile
          const bp = fc.behavioral_profile;
          behavProfileIdRef.current = bp?.id;
          const s3Val: S3State = {
            aggression: bp?.aggression ?? false, aggression_description: bp?.aggression_description ?? '',
            self_abuse: bp?.self_abuse ?? false, self_abuse_description: bp?.self_abuse_description ?? '',
            wandering_risk: bp?.wandering_risk ?? false, wandering_description: bp?.wandering_description ?? '',
            one_to_one_supervision: bp?.one_to_one_supervision ?? false, one_to_one_description: bp?.one_to_one_description ?? '',
            developmental_delay: bp?.developmental_delay ?? false, functioning_age_level: bp?.functioning_age_level ?? '',
            functional_reading: bp?.functional_reading ?? false,
            functional_writing: bp?.functional_writing ?? false,
            independent_mobility: bp?.independent_mobility ?? false,
            verbal_communication: bp?.verbal_communication ?? false,
            social_skills: bp?.social_skills ?? false,
            behavior_plan: bp?.behavior_plan ?? false,
            sexual_behaviors: bp?.sexual_behaviors ?? false, sexual_behaviors_description: bp?.sexual_behaviors_description ?? '',
            interpersonal_behavior: bp?.interpersonal_behavior ?? false, interpersonal_behavior_description: bp?.interpersonal_behavior_description ?? '',
            social_emotional: bp?.social_emotional ?? false, social_emotional_description: bp?.social_emotional_description ?? '',
            follows_instructions: bp?.follows_instructions ?? false, follows_instructions_description: bp?.follows_instructions_description ?? '',
            group_participation: bp?.group_participation ?? false, group_participation_description: bp?.group_participation_description ?? '',
            attends_school: bp?.attends_school ?? false, classroom_type: bp?.classroom_type ?? '',
            communication_methods: bp?.communication_methods ?? [],
            triggers: bp?.triggers ?? '', de_escalation_strategies: bp?.de_escalation_strategies ?? '',
            communication_style: bp?.communication_style ?? '', notes: bp?.notes ?? '',
          };
          setS3(s3Val); s3Init.current = { ...s3Val };

          // S4 — Assistive devices
          const devDrafts = (fc.assistive_devices ?? []).map(d => mkItem<AssistiveDevicePayload>({ device_type: d.device_type, requires_transfer_assistance: d.requires_transfer_assistance ?? false, notes: d.notes ?? '' }, d.id));
          setDevices(devDrafts); devInit.current = devDrafts.map(d => ({ ...d, data: { ...d.data } }));

          // S5 — Feeding plan
          const fp = fc.feeding_plan;
          feedingPlanIdRef.current = fp?.id;
          const s5Val: S5State = {
            special_diet: fp?.special_diet ?? false, diet_description: fp?.diet_description ?? '',
            texture_modified: fp?.texture_modified ?? false, texture_level: fp?.texture_level ?? '',
            fluid_restriction: fp?.fluid_restriction ?? false, fluid_details: fp?.fluid_details ?? '',
            g_tube: fp?.g_tube ?? false, formula: fp?.formula ?? '',
            amount_per_feeding: fp?.amount_per_feeding ?? '',
            feedings_per_day: fp?.feedings_per_day != null ? String(fp.feedings_per_day) : '',
            feeding_times: (fp?.feeding_times ?? []).join(', '),
            bolus_only: fp?.bolus_only ?? false, notes: fp?.notes ?? '',
          };
          setS5(s5Val); s5Init.current = { ...s5Val };

          // S6 — Personal care plan
          const pcp = fc.personal_care_plan;
          const s6Val: S6State = {
            bathing_level: pcp?.bathing_level ?? '', bathing_notes: pcp?.bathing_notes ?? '',
            toileting_level: pcp?.toileting_level ?? '', toileting_notes: pcp?.toileting_notes ?? '',
            nighttime_toileting: pcp?.nighttime_toileting ?? false, nighttime_notes: pcp?.nighttime_notes ?? '',
            dressing_level: pcp?.dressing_level ?? '', dressing_notes: pcp?.dressing_notes ?? '',
            oral_hygiene_level: pcp?.oral_hygiene_level ?? '', oral_hygiene_notes: pcp?.oral_hygiene_notes ?? '',
            positioning_notes: pcp?.positioning_notes ?? '', sleep_notes: pcp?.sleep_notes ?? '',
            falling_asleep_issues: pcp?.falling_asleep_issues ?? false,
            sleep_walking: pcp?.sleep_walking ?? false, night_wandering: pcp?.night_wandering ?? false,
            bowel_control_notes: pcp?.bowel_control_notes ?? '',
            irregular_bowel: pcp?.irregular_bowel ?? false, irregular_bowel_notes: pcp?.irregular_bowel_notes ?? '',
            urinary_catheter: pcp?.urinary_catheter ?? false, menstruation_support: pcp?.menstruation_support ?? false,
          };
          setS6(s6Val); s6Init.current = { ...s6Val };

          // S7 — Activity permissions
          const actMap = defaultActivities();
          (fc.activity_permissions ?? []).forEach(p => {
            const a = ACTIVITIES.find(x => x.label === p.activity_name);
            if (a) actMap[a.key] = { id: p.id, permission_level: p.permission_level as PermLevel, restriction_notes: p.restriction_notes ?? '' };
          });
          setS7(actMap); s7Init.current = JSON.parse(JSON.stringify(actMap));

          // S8 — Medications
          const medDrafts = (fc.medications ?? []).map(m => mkItem<MedFields>({
            name: m.name, dosage: m.dosage, frequency: m.frequency,
            route: m.route ?? '', purpose: m.purpose ?? '',
            prescribing_physician: m.prescribing_physician ?? '', notes: m.notes ?? '',
          }, m.id));
          setMedications(medDrafts); medsInit.current = medDrafts.map(d => ({ ...d, data: { ...d.data } }));
        }
      })
      .catch(() => setError('Failed to load application data. Go back and try again.'))
      .finally(() => setLoading(false));
   
  }, [id]);

  // ── Extra refs for list inits (declared here to avoid hook order issues) ───
  const diagInit = useRef<DraftItem<DiagnosisPayload>[]>([]);
  const alInit   = useRef<DraftItem<AllergyPayload>[]>([]);
  const devInit  = useRef<DraftItem<AssistiveDevicePayload>[]>([]);
  const medsInit = useRef<DraftItem<MedFields>[]>([]);

  // ── List helpers ───────────────────────────────────────────────────────────
  function updList<T>(set: React.Dispatch<React.SetStateAction<DraftItem<T>[]>>, key: string, patch: Partial<T>) {
    set(prev => prev.map(it => it._key === key ? { ...it, data: { ...it.data, ...patch } } : it));
  }
  function toggleDel<T>(set: React.Dispatch<React.SetStateAction<DraftItem<T>[]>>, key: string) {
    set(prev => prev.map(it => it._key === key
      ? it.id ? { ...it, _deleted: !it._deleted }  // existing: mark/unmark
               : null!                              // new (no ID): remove entirely
      : it
    ).filter(Boolean));
  }

  // ── Save All ───────────────────────────────────────────────────────────────
  const handleSaveAll = useCallback(async () => {
    if (!application || !camper) return;
    setSaving(true);

    const ops: Promise<unknown>[] = [];

    // 1. Camper identity
    if (JSON.stringify(s1) !== JSON.stringify(s1Init.current)) {
      const payload: UpdateCamperPayload = {
        first_name: s1.first_name, last_name: s1.last_name,
        preferred_name: s1.preferred_name || undefined,
        date_of_birth: s1.date_of_birth,
        gender: s1.gender || undefined, tshirt_size: s1.tshirt_size || undefined,
        county: s1.county || undefined,
        needs_interpreter: s1.needs_interpreter,
        preferred_language: s1.preferred_language || undefined,
      };
      ops.push(updateCamper(camper.id, payload));
    }

    // 2. Application (narratives + admin notes)
    if (JSON.stringify(sn) !== JSON.stringify(snInit.current)) {
      const payload: UpdateApplicationPayload = {
        notes: sn.notes,
        narrative_rustic_environment:     sn.narrative_rustic_environment,
        narrative_staff_suggestions:      sn.narrative_staff_suggestions,
        narrative_participation_concerns: sn.narrative_participation_concerns,
        narrative_camp_benefit:           sn.narrative_camp_benefit,
        narrative_heat_tolerance:         sn.narrative_heat_tolerance,
        narrative_transportation:         sn.narrative_transportation,
        narrative_additional_info:        sn.narrative_additional_info,
        narrative_emergency_protocols:    sn.narrative_emergency_protocols,
      };
      ops.push(updateApplication(application.id, payload));
    }

    // 3. Emergency contacts
    for (const c of contacts) {
      const p: UpdateEmergencyContactPayload = {
        name: c.data.name, relationship: c.data.relationship,
        phone_primary: c.data.phone_primary, phone_secondary: c.data.phone_secondary || undefined,
        phone_work: c.data.phone_work || undefined, email: c.data.email || undefined,
        is_primary: c.data.is_primary, is_authorized_pickup: c.data.is_authorized_pickup,
        is_guardian: c.data.is_guardian,
        address: c.data.address || undefined, city: c.data.city || undefined,
        state: c.data.state || undefined, zip: c.data.zip || undefined,
        primary_language: c.data.primary_language || undefined,
        interpreter_needed: c.data.interpreter_needed,
      };
      if (c._deleted && c.id) {
        ops.push(deleteEmergencyContact(c.id));
      } else if (!c._deleted && !c.id) {
        ops.push(createEmergencyContact({ camper_id: camper.id, name: c.data.name, relationship: c.data.relationship, phone_primary: c.data.phone_primary, ...p }));
      } else if (!c._deleted && c.id && itemChanged(c, contactsInit.current)) {
        ops.push(updateEmergencyContact(c.id, p));
      }
    }

    // 4. Medical record (core fields) + health profile (extended fields)
    if (JSON.stringify(s2) !== JSON.stringify(s2Init.current)) {
      if (medRecordIdRef.current) {
        const corePayload: UpdateMedicalRecordPayload = {
          physician_name: s2.physician_name || undefined,
          physician_phone: s2.physician_phone || undefined,
          insurance_provider: s2.insurance_type === 'other' ? s2.insurance_provider : undefined,
          insurance_policy_number: s2.insurance_type === 'other' ? s2.insurance_policy_number : undefined,
          has_seizures: s2.has_seizures,
          last_seizure_date: s2.has_seizures ? s2.last_seizure_date || undefined : undefined,
          seizure_description: s2.has_seizures ? s2.seizure_description || undefined : undefined,
          has_neurostimulator: s2.has_neurostimulator,
          date_of_medical_exam: s2.date_of_medical_exam || undefined,
          special_needs: s2.special_needs || undefined,
        };
        ops.push(updateMedicalRecord(medRecordIdRef.current, corePayload));
      }
      const extPayload: StoreHealthProfilePayload = {
        physician_address: s2.physician_address || undefined,
        insurance_group: s2.insurance_group || undefined,
        medicaid_number: s2.insurance_type === 'medicaid' ? s2.medicaid_number || undefined : undefined,
        immunizations_current: s2.immunizations_current,
        tetanus_date: s2.tetanus_date || undefined,
        mobility_notes: s2.mobility_notes || undefined,
        tubes_in_ears: s2.tubes_in_ears,
        has_contagious_illness: s2.has_contagious_illness,
        contagious_illness_description: s2.has_contagious_illness ? s2.contagious_illness_description || undefined : undefined,
        has_recent_illness: s2.has_recent_illness,
        recent_illness_description: s2.has_recent_illness ? s2.recent_illness_description || undefined : undefined,
      };
      ops.push(storeHealthProfile(camper.id, extPayload));
    }

    // 5. Diagnoses
    for (const dx of diagnoses) {
      if (dx._deleted && dx.id)                                              ops.push(deleteDiagnosis(dx.id));
      else if (!dx._deleted && !dx.id)                                       ops.push(createDiagnosis({ camper_id: camper.id, ...dx.data }));
      else if (!dx._deleted && dx.id && itemChanged(dx, diagInit.current))  ops.push(updateDiagnosis(dx.id, dx.data));
    }

    // 6. Allergies
    for (const al of allergies) {
      if (al._deleted && al.id)                                              ops.push(deleteAllergy(al.id));
      else if (!al._deleted && !al.id)                                       ops.push(createAllergy({ camper_id: camper.id, ...al.data }));
      else if (!al._deleted && al.id && itemChanged(al, alInit.current))    ops.push(updateAllergy(al.id, al.data));
    }

    // 7. Behavioral profile
    if (JSON.stringify(s3) !== JSON.stringify(s3Init.current)) {
      const { ...bpData } = s3;
      const payload: UpdateBehavioralProfilePayload = bpData;
      if (behavProfileIdRef.current) {
        ops.push(updateBehavioralProfile(behavProfileIdRef.current, payload));
      } else {
        ops.push(createBehavioralProfile({ camper_id: camper.id, ...payload }));
      }
    }

    // 8. Assistive devices
    for (const dev of devices) {
      if (dev._deleted && dev.id)                                              ops.push(deleteAssistiveDevice(dev.id));
      else if (!dev._deleted && !dev.id)                                       ops.push(createAssistiveDevice({ camper_id: camper.id, ...dev.data }));
      else if (!dev._deleted && dev.id && itemChanged(dev, devInit.current))  ops.push(updateAssistiveDevice(dev.id, dev.data));
    }

    // 9. Feeding plan
    if (JSON.stringify(s5) !== JSON.stringify(s5Init.current)) {
      const { feedings_per_day, feeding_times, ...rest } = s5;
      const fpPayload: FeedingPlanPayload = {
        ...rest,
        feedings_per_day: feedings_per_day ? Number(feedings_per_day) : undefined,
        feeding_times: feeding_times ? feeding_times.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      if (feedingPlanIdRef.current) ops.push(updateFeedingPlan(feedingPlanIdRef.current, fpPayload));
      else                           ops.push(createFeedingPlan({ camper_id: camper.id, ...fpPayload }));
    }

    // 10. Personal care plan (idempotent POST)
    if (JSON.stringify(s6) !== JSON.stringify(s6Init.current)) {
      ops.push(storePersonalCarePlan(camper.id, s6));
    }

    // 11. Activity permissions
    for (const a of ACTIVITIES) {
      const perm = s7[a.key];
      const initPerm = s7Init.current[a.key];
      if (JSON.stringify(perm) !== JSON.stringify(initPerm) && perm.permission_level) {
        const permPayload: ActivityPermissionPayload = {
          activity_name: a.label,
          permission_level: perm.permission_level as 'yes' | 'no' | 'restricted',
          restriction_notes: perm.restriction_notes || undefined,
        };
        if (perm.id) ops.push(updateActivityPermission(perm.id, permPayload));
        else          ops.push(createActivityPermission({ camper_id: camper.id, ...permPayload }));
      }
    }

    // 12. Medications
    for (const med of medications) {
      const p: MedicationPayload = { name: med.data.name, dosage: med.data.dosage, frequency: med.data.frequency, route: med.data.route || undefined, purpose: med.data.purpose || undefined, prescribing_physician: med.data.prescribing_physician || undefined, notes: med.data.notes || undefined };
      if (med._deleted && med.id)                                              ops.push(deleteMedication(med.id));
      else if (!med._deleted && !med.id)                                       ops.push(createMedication({ camper_id: camper.id, ...p }));
      else if (!med._deleted && med.id && itemChanged(med, medsInit.current)) ops.push(updateMedication(med.id, p));
    }

    // 13. Document deletions
    for (const doc of documents) {
      if (doc._pendingDelete) ops.push(deleteDocument(doc.id));
    }

    if (ops.length === 0) {
      toast.info('No changes to save.');
      setSaving(false);
      return;
    }

    const results = await Promise.allSettled(ops);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length === 0) {
      toast.success('Application saved successfully.');
      const detailRoute = isSuperAdmin
        ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(application.id).replace('/edit', '')
        : ROUTES.ADMIN_APPLICATION_DETAIL(application.id);
      navigate(detailRoute);
    } else {
      toast.error(`${failures.length} of ${ops.length} update(s) failed. Other changes were saved.`);
    }
    setSaving(false);
  }, [application, camper, s1, contacts, s2, diagnoses, allergies, s3, devices, s5, s6, s7, medications, sn, documents, isSuperAdmin, navigate]);

  // ── Document upload ────────────────────────────────────────────────────────
  async function handleDocUpload(file: File) {
    if (!application) return;
    setUploading(true);
    try {
      const doc = await uploadDocumentOnBehalf(application.id, file);
      setDocuments(prev => [...prev, { id: doc.id, file_name: doc.file_name, document_type: doc.document_type, url: doc.url, created_at: doc.created_at, _pendingDelete: false }]);
      toast.success(`"${file.name}" uploaded.`);
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ width: 28, height: 28, border: '3px solid var(--ember-orange)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    );
  }
  if (error || !application || !camper) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertTriangle size={28} style={{ color: 'var(--destructive)', marginBottom: 8 }} />
        <p style={{ color: 'var(--destructive)' }}>{error ?? 'Application not found.'}</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const isRestricted = RESTRICTED_STATUSES.has(application.status);
  const session = sessions.find(s => s.id === application.camp_session_id);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 120px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(isSuperAdmin ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(application.id).replace('/edit','') : ROUTES.ADMIN_APPLICATION_DETAIL(application.id))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted-foreground)', fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to Review
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
          Edit Application — {camper.first_name} {camper.last_name}
        </h1>
      </div>

      {/* Editing-on-behalf banner */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 8, marginBottom: 14 }}>
        <UserCog size={18} style={{ color: '#2563eb', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#1d4ed8', fontSize: 14 }}>Editing on behalf of applicant</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#3b82f6' }}>
            All changes update the applicant's record directly and are logged to the audit trail.
          </p>
        </div>
      </div>

      {/* Status warning */}
      {isRestricted && (
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.3)', borderRadius: 8, marginBottom: 20 }}>
          <AlertTriangle size={18} style={{ color: '#ea580c', flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#c2410c' }}>
            This application is <strong>{application.status}</strong>. Edits take effect immediately.
          </p>
        </div>
      )}

      {/* Sticky section nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)', borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, padding: '10px 0' }}>
          {SECTIONS.map((sec, i) => {
            const Icon = sec.icon;
            return (
              <button key={i} onClick={() => { setActiveTab(i); secRefs[i].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', background: activeTab === i ? 'var(--ember-orange)' : 'transparent', color: activeTab === i ? '#fff' : 'var(--muted-foreground)', transition: 'all 0.15s' }}>
                <Icon size={13} /> {sec.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* All sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── SECTION 0: General Information ─────────────────────────────────── */}
        <SectionCard id="sec-0" title="General Information" icon={User} secRef={secRefs[0]}>
          {/* Session display (read-only) */}
          <div style={{ marginBottom: 20, padding: '12px 16px', background: 'var(--muted)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              <strong>Session:</strong> {session ? `${session.name} (${new Date(session.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} – ${new Date(session.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })})` : `ID ${application.camp_session_id}`}
              &nbsp;&nbsp;
              <strong>Application ID:</strong> #{application.id}
              &nbsp;&nbsp;
              <strong>Status:</strong> <span style={{ textTransform: 'capitalize' }}>{application.status}</span>
              {application.first_application !== undefined && <>&nbsp;&nbsp;<strong>First Application:</strong> {application.first_application ? 'Yes' : 'No'}</>}
            </p>
          </div>

          {/* Camper Identity */}
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Camper Identity</h3>
          <div style={{ marginBottom: 20 }}>
            <Grid2>
              <Fld label="First Name"><input style={inp} value={s1.first_name} onChange={e => setS1(p => ({ ...p, first_name: e.target.value }))} /></Fld>
              <Fld label="Last Name"><input style={inp} value={s1.last_name} onChange={e => setS1(p => ({ ...p, last_name: e.target.value }))} /></Fld>
            </Grid2>
            <div style={{ marginTop: 14 }}><Grid3>
              <Fld label="Preferred Name"><input style={inp} value={s1.preferred_name} placeholder="Optional" onChange={e => setS1(p => ({ ...p, preferred_name: e.target.value }))} /></Fld>
              <Fld label="Date of Birth"><input type="date" style={inp} value={s1.date_of_birth} onChange={e => setS1(p => ({ ...p, date_of_birth: e.target.value }))} /></Fld>
              <Fld label="County"><input style={inp} value={s1.county} onChange={e => setS1(p => ({ ...p, county: e.target.value }))} /></Fld>
            </Grid3></div>
            <div style={{ marginTop: 14 }}><Grid3>
              <Fld label="Gender">
                <select style={inp} value={s1.gender} onChange={e => setS1(p => ({ ...p, gender: e.target.value }))}>
                  <option value="">— Select —</option>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Fld>
              <Fld label="T-Shirt Size">
                <select style={inp} value={s1.tshirt_size} onChange={e => setS1(p => ({ ...p, tshirt_size: e.target.value }))}>
                  <option value="">— Select —</option>
                  {TSHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Fld>
              <div style={{ paddingTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={s1.needs_interpreter} onChange={e => setS1(p => ({ ...p, needs_interpreter: e.target.checked }))} />
                  Needs interpreter
                </label>
                {s1.needs_interpreter && (
                  <input style={{ ...inp, marginTop: 8 }} value={s1.preferred_language} placeholder="Preferred language" onChange={e => setS1(p => ({ ...p, preferred_language: e.target.value }))} />
                )}
              </div>
            </Grid3></div>
          </div>

          {/* Emergency Contacts / Guardians */}
          <h3 style={{ margin: '20px 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Emergency Contacts &amp; Guardians</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>Guardians are contacts with "Is guardian" checked.</p>
          {contacts.map((c, idx) => (
            <DraftRow key={c._key} deleted={c._deleted}
              onDelete={() => toggleDel(setContacts, c._key)}
              onUndo={() => toggleDel(setContacts, c._key)}>
              <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 13, paddingRight: 60 }}>Contact {idx + 1}{c.data.is_guardian ? ' — Guardian' : ''}{c.data.is_primary ? ' (Primary)' : ''}</p>
              <Grid2>
                <Fld label="Full Name"><input style={inp} value={c.data.name} onChange={e => updList(setContacts, c._key, { name: e.target.value })} /></Fld>
                <Fld label="Relationship"><input style={inp} value={c.data.relationship} onChange={e => updList(setContacts, c._key, { relationship: e.target.value })} /></Fld>
              </Grid2>
              <div style={{ marginTop: 10 }}><Grid3>
                <Fld label="Cell / Primary Phone"><input style={inp} value={c.data.phone_primary} onChange={e => updList(setContacts, c._key, { phone_primary: e.target.value })} /></Fld>
                <Fld label="Home Phone"><input style={inp} value={c.data.phone_secondary} onChange={e => updList(setContacts, c._key, { phone_secondary: e.target.value })} /></Fld>
                <Fld label="Work Phone"><input style={inp} value={c.data.phone_work} onChange={e => updList(setContacts, c._key, { phone_work: e.target.value })} /></Fld>
              </Grid3></div>
              <div style={{ marginTop: 10 }}><Grid2>
                <Fld label="Email"><input style={inp} value={c.data.email} onChange={e => updList(setContacts, c._key, { email: e.target.value })} /></Fld>
                <Fld label="Preferred Language"><input style={inp} value={c.data.primary_language} onChange={e => updList(setContacts, c._key, { primary_language: e.target.value })} /></Fld>
              </Grid2></div>
              <div style={{ marginTop: 10 }}><Grid2>
                <Fld label="Address"><input style={inp} value={c.data.address} onChange={e => updList(setContacts, c._key, { address: e.target.value })} /></Fld>
                <Grid3>
                  <Fld label="City"><input style={inp} value={c.data.city} onChange={e => updList(setContacts, c._key, { city: e.target.value })} /></Fld>
                  <Fld label="State">
                    <select style={inp} value={c.data.state} onChange={e => updList(setContacts, c._key, { state: e.target.value })}>
                      <option value="">—</option>
                      {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Fld>
                  <Fld label="ZIP"><input style={inp} value={c.data.zip} onChange={e => updList(setContacts, c._key, { zip: e.target.value })} /></Fld>
                </Grid3>
              </Grid2></div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                {[['Is guardian', 'is_guardian'], ['Primary contact', 'is_primary'], ['Authorized pickup', 'is_authorized_pickup'], ['Needs interpreter', 'interpreter_needed']].map(([lbl, key]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={c.data[key as keyof ContactFields] as boolean} onChange={e => updList(setContacts, c._key, { [key]: e.target.checked })} />
                    {lbl}
                  </label>
                ))}
              </div>
            </DraftRow>
          ))}
          <AddBtn label="Add Contact" onClick={() => setContacts(prev => [...prev, mkItem<ContactFields>({ name: '', relationship: '', phone_primary: '', phone_secondary: '', phone_work: '', email: '', is_primary: false, is_authorized_pickup: false, is_guardian: false, address: '', city: '', state: '', zip: '', primary_language: '', interpreter_needed: false })])} />
        </SectionCard>

        {/* ── SECTION 1: Health & Medical ────────────────────────────────────── */}
        <SectionCard id="sec-1" title="Health & Medical" icon={Heart} secRef={secRefs[1]}>
          <Grid3>
            <Fld label="Insurance Type" span={1}>
              <select style={inp} value={s2.insurance_type} onChange={e => setS2(p => ({ ...p, insurance_type: e.target.value as S2State['insurance_type'] }))}>
                <option value="none">No insurance</option>
                <option value="medicaid">Medicaid</option>
                <option value="other">Private / Other</option>
              </select>
            </Fld>
            {s2.insurance_type === 'medicaid' && <Fld label="Medicaid Number"><input style={inp} value={s2.medicaid_number} onChange={e => setS2(p => ({ ...p, medicaid_number: e.target.value }))} /></Fld>}
            {s2.insurance_type === 'other' && <>
              <Fld label="Provider"><input style={inp} value={s2.insurance_provider} onChange={e => setS2(p => ({ ...p, insurance_provider: e.target.value }))} /></Fld>
              <Fld label="Policy #"><input style={inp} value={s2.insurance_policy_number} onChange={e => setS2(p => ({ ...p, insurance_policy_number: e.target.value }))} /></Fld>
            </>}
          </Grid3>
          {s2.insurance_type === 'other' && <div style={{ marginTop: 10 }}><Fld label="Group Number"><input style={{ ...inp, maxWidth: 220 }} value={s2.insurance_group} onChange={e => setS2(p => ({ ...p, insurance_group: e.target.value }))} /></Fld></div>}

          <h4 style={{ margin: '20px 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Physician</h4>
          <Grid3>
            <Fld label="Physician Name"><input style={inp} value={s2.physician_name} onChange={e => setS2(p => ({ ...p, physician_name: e.target.value }))} /></Fld>
            <Fld label="Phone"><input style={inp} value={s2.physician_phone} onChange={e => setS2(p => ({ ...p, physician_phone: e.target.value }))} /></Fld>
            <Fld label="Date of Medical Exam"><input type="date" style={inp} value={s2.date_of_medical_exam} onChange={e => setS2(p => ({ ...p, date_of_medical_exam: e.target.value }))} /></Fld>
          </Grid3>
          <div style={{ marginTop: 10 }}><Fld label="Physician Address"><input style={inp} value={s2.physician_address} onChange={e => setS2(p => ({ ...p, physician_address: e.target.value }))} /></Fld></div>

          <h4 style={{ margin: '20px 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Health Flags</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <div>
              <FlagRow label="Has seizure history" checked={s2.has_seizures} onChange={v => setS2(p => ({ ...p, has_seizures: v }))}>
                <Grid2>
                  <Fld label="Last Seizure"><input type="date" style={inp} value={s2.last_seizure_date} onChange={e => setS2(p => ({ ...p, last_seizure_date: e.target.value }))} /></Fld>
                  <Fld label="Description"><input style={inp} value={s2.seizure_description} onChange={e => setS2(p => ({ ...p, seizure_description: e.target.value }))} /></Fld>
                </Grid2>
              </FlagRow>
              <FlagRow label="Has neurostimulator / implanted device" checked={s2.has_neurostimulator} onChange={v => setS2(p => ({ ...p, has_neurostimulator: v }))} />
              <FlagRow label="Tubes in ears" checked={s2.tubes_in_ears} onChange={v => setS2(p => ({ ...p, tubes_in_ears: v }))} />
              <FlagRow label="Immunizations current" checked={s2.immunizations_current} onChange={v => setS2(p => ({ ...p, immunizations_current: v }))}>
                <Fld label="Tetanus Date"><input type="date" style={{ ...inp, maxWidth: 180 }} value={s2.tetanus_date} onChange={e => setS2(p => ({ ...p, tetanus_date: e.target.value }))} /></Fld>
              </FlagRow>
            </div>
            <div>
              <FlagRow label="Has contagious illness" checked={s2.has_contagious_illness} onChange={v => setS2(p => ({ ...p, has_contagious_illness: v }))}>
                <Fld label="Description"><input style={inp} value={s2.contagious_illness_description} onChange={e => setS2(p => ({ ...p, contagious_illness_description: e.target.value }))} /></Fld>
              </FlagRow>
              <FlagRow label="Recent illness / hospitalization" checked={s2.has_recent_illness} onChange={v => setS2(p => ({ ...p, has_recent_illness: v }))}>
                <Fld label="Description"><input style={inp} value={s2.recent_illness_description} onChange={e => setS2(p => ({ ...p, recent_illness_description: e.target.value }))} /></Fld>
              </FlagRow>
            </div>
          </div>
          <div style={{ marginTop: 10 }}><Fld label="Mobility Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={s2.mobility_notes} onChange={e => setS2(p => ({ ...p, mobility_notes: e.target.value }))} /></Fld></div>
          <div style={{ marginTop: 10 }}><Fld label="Special Needs / Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={s2.special_needs} onChange={e => setS2(p => ({ ...p, special_needs: e.target.value }))} /></Fld></div>

          <h4 style={{ margin: '20px 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Diagnoses</h4>
          {diagnoses.map(dx => (
            <DraftRow key={dx._key} deleted={dx._deleted} onDelete={() => toggleDel(setDiagnoses, dx._key)} onUndo={() => toggleDel(setDiagnoses, dx._key)}>
              <Grid2>
                <Fld label="Condition / Diagnosis"><input style={inp} value={dx.data.name} onChange={e => updList(setDiagnoses, dx._key, { name: e.target.value })} /></Fld>
                <Fld label="Notes"><input style={inp} value={dx.data.notes ?? ''} onChange={e => updList(setDiagnoses, dx._key, { notes: e.target.value })} /></Fld>
              </Grid2>
            </DraftRow>
          ))}
          <AddBtn label="Add Diagnosis" onClick={() => setDiagnoses(prev => [...prev, mkItem<DiagnosisPayload>({ name: '', notes: '' })])} />

          <h4 style={{ margin: '20px 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Allergies</h4>
          {allergies.map(al => (
            <DraftRow key={al._key} deleted={al._deleted} onDelete={() => toggleDel(setAllergies, al._key)} onUndo={() => toggleDel(setAllergies, al._key)}>
              <Grid2>
                <Fld label="Allergen"><input style={inp} value={al.data.allergen} onChange={e => updList(setAllergies, al._key, { allergen: e.target.value })} /></Fld>
                <Fld label="Severity">
                  <select style={inp} value={al.data.severity} onChange={e => updList(setAllergies, al._key, { severity: e.target.value as AllergyPayload['severity'] })}>
                    <option value="">— Select —</option>
                    {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Fld>
              </Grid2>
              <div style={{ marginTop: 10 }}><Grid2>
                <Fld label="Reaction"><input style={inp} value={al.data.reaction ?? ''} onChange={e => updList(setAllergies, al._key, { reaction: e.target.value })} /></Fld>
                <Fld label="Treatment / EpiPen details"><input style={inp} value={al.data.treatment ?? ''} onChange={e => updList(setAllergies, al._key, { treatment: e.target.value })} /></Fld>
              </Grid2></div>
            </DraftRow>
          ))}
          <AddBtn label="Add Allergy" onClick={() => setAllergies(prev => [...prev, mkItem<AllergyPayload>({ allergen: '', severity: 'mild', reaction: '', treatment: '' })])} />
        </SectionCard>

        {/* ── SECTION 2: Development & Behavior ──────────────────────────────── */}
        <SectionCard id="sec-2" title="Development & Behavior" icon={Brain} secRef={secRefs[2]}>
          <Grid2>
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Behavioral Flags</h4>
              <FlagRow label="Aggression / violent behavior" checked={s3.aggression} onChange={v => setS3(p => ({ ...p, aggression: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.aggression_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, aggression_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Self-injurious behavior" checked={s3.self_abuse} onChange={v => setS3(p => ({ ...p, self_abuse: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.self_abuse_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, self_abuse_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Wandering / elopement risk" checked={s3.wandering_risk} onChange={v => setS3(p => ({ ...p, wandering_risk: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.wandering_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, wandering_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Requires 1:1 supervision" checked={s3.one_to_one_supervision} onChange={v => setS3(p => ({ ...p, one_to_one_supervision: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.one_to_one_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, one_to_one_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Sexual behaviors of concern" checked={s3.sexual_behaviors} onChange={v => setS3(p => ({ ...p, sexual_behaviors: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.sexual_behaviors_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, sexual_behaviors_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Interpersonal behavior concerns" checked={s3.interpersonal_behavior} onChange={v => setS3(p => ({ ...p, interpersonal_behavior: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.interpersonal_behavior_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, interpersonal_behavior_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Social / emotional challenges" checked={s3.social_emotional} onChange={v => setS3(p => ({ ...p, social_emotional: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.social_emotional_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, social_emotional_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Difficulty following instructions" checked={s3.follows_instructions} onChange={v => setS3(p => ({ ...p, follows_instructions: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.follows_instructions_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, follows_instructions_description: e.target.value }))} />
              </FlagRow>
              <FlagRow label="Difficulty with group participation" checked={s3.group_participation} onChange={v => setS3(p => ({ ...p, group_participation: v }))}>
                <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s3.group_participation_description} placeholder="Describe..." onChange={e => setS3(p => ({ ...p, group_participation_description: e.target.value }))} />
              </FlagRow>
            </div>
            <div>
              <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Functional Abilities</h4>
              {([['developmental_delay','Developmental delay'],['functional_reading','Functional reading'],['functional_writing','Functional writing'],['independent_mobility','Independent mobility'],['verbal_communication','Verbal communication'],['social_skills','Age-appropriate social skills'],['behavior_plan','Active behavior plan']] as [keyof S3State, string][]).map(([k, lbl]) => (
                <FlagRow key={k} label={lbl} checked={s3[k] as boolean} onChange={v => setS3(p => ({ ...p, [k]: v }))} />
              ))}
              <FlagRow label="Developmental delay" checked={s3.developmental_delay} onChange={v => setS3(p => ({ ...p, developmental_delay: v }))}>
                <Fld label="Functioning Age Level"><input style={inp} value={s3.functioning_age_level} placeholder="e.g. 3–5 years" onChange={e => setS3(p => ({ ...p, functioning_age_level: e.target.value }))} /></Fld>
              </FlagRow>
              <FlagRow label="Attends school" checked={s3.attends_school} onChange={v => setS3(p => ({ ...p, attends_school: v }))}>
                <Fld label="Classroom Type"><input style={inp} value={s3.classroom_type} placeholder="e.g. self-contained, inclusive" onChange={e => setS3(p => ({ ...p, classroom_type: e.target.value }))} /></Fld>
              </FlagRow>
            </div>
          </Grid2>

          <h4 style={{ margin: '20px 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Communication Methods</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {COMMUNICATION_METHODS.map(m => (
              <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 6, background: s3.communication_methods.includes(m) ? 'rgba(var(--ember-orange-rgb),0.1)' : 'transparent' }}>
                <input type="checkbox" checked={s3.communication_methods.includes(m)} onChange={e => setS3(p => ({ ...p, communication_methods: e.target.checked ? [...p.communication_methods, m] : p.communication_methods.filter(x => x !== m) }))} />
                {m}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Fld label="Known Triggers"><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={s3.triggers} onChange={e => setS3(p => ({ ...p, triggers: e.target.value }))} /></Fld>
            <Fld label="De-escalation Strategies"><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={s3.de_escalation_strategies} onChange={e => setS3(p => ({ ...p, de_escalation_strategies: e.target.value }))} /></Fld>
            <Fld label="Communication Style Notes"><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={s3.communication_style} onChange={e => setS3(p => ({ ...p, communication_style: e.target.value }))} /></Fld>
            <Fld label="Additional Behavioral Notes"><textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={s3.notes} onChange={e => setS3(p => ({ ...p, notes: e.target.value }))} /></Fld>
          </div>
        </SectionCard>

        {/* ── SECTION 3: Equipment & Mobility ────────────────────────────────── */}
        <SectionCard id="sec-3" title="Equipment & Mobility" icon={Accessibility} secRef={secRefs[3]}>
          {devices.map(dev => (
            <DraftRow key={dev._key} deleted={dev._deleted} onDelete={() => toggleDel(setDevices, dev._key)} onUndo={() => toggleDel(setDevices, dev._key)}>
              <Grid2>
                <Fld label="Device Type">
                  <select style={inp} value={dev.data.device_type} onChange={e => updList(setDevices, dev._key, { device_type: e.target.value })}>
                    <option value="">— Select —</option>
                    {DEVICE_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Fld>
                <div style={{ paddingTop: 20 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={dev.data.requires_transfer_assistance ?? false} onChange={e => updList(setDevices, dev._key, { requires_transfer_assistance: e.target.checked })} />
                    Requires transfer assistance
                  </label>
                </div>
              </Grid2>
              <div style={{ marginTop: 10 }}><Fld label="Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={dev.data.notes ?? ''} onChange={e => updList(setDevices, dev._key, { notes: e.target.value })} /></Fld></div>
            </DraftRow>
          ))}
          <AddBtn label="Add Device / Equipment" onClick={() => setDevices(prev => [...prev, mkItem<AssistiveDevicePayload>({ device_type: '', requires_transfer_assistance: false, notes: '' })])} />
        </SectionCard>

        {/* ── SECTION 4: Diet & Feeding ───────────────────────────────────────── */}
        <SectionCard id="sec-4" title="Diet & Feeding" icon={Utensils} secRef={secRefs[4]}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <FlagRow label="Requires special diet" checked={s5.special_diet} onChange={v => setS5(p => ({ ...p, special_diet: v }))}>
              <Fld label="Diet Description"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={s5.diet_description} onChange={e => setS5(p => ({ ...p, diet_description: e.target.value }))} /></Fld>
            </FlagRow>
            <FlagRow label="Texture-modified diet" checked={s5.texture_modified} onChange={v => setS5(p => ({ ...p, texture_modified: v }))}>
              <Fld label="Texture Level">
                <select style={inp} value={s5.texture_level} onChange={e => setS5(p => ({ ...p, texture_level: e.target.value }))}>
                  <option value="">— Select —</option>
                  {TEXTURE_LEVELS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Fld>
            </FlagRow>
            <FlagRow label="Fluid restriction" checked={s5.fluid_restriction} onChange={v => setS5(p => ({ ...p, fluid_restriction: v }))}>
              <Fld label="Details"><input style={inp} value={s5.fluid_details} onChange={e => setS5(p => ({ ...p, fluid_details: e.target.value }))} /></Fld>
            </FlagRow>
            <FlagRow label="G-tube / tube feeding" checked={s5.g_tube} onChange={v => setS5(p => ({ ...p, g_tube: v }))}>
              <Grid2>
                <Fld label="Formula"><input style={inp} value={s5.formula} onChange={e => setS5(p => ({ ...p, formula: e.target.value }))} /></Fld>
                <Fld label="Amount per Feeding"><input style={inp} value={s5.amount_per_feeding} onChange={e => setS5(p => ({ ...p, amount_per_feeding: e.target.value }))} /></Fld>
              </Grid2>
              <Grid2>
                <Fld label="Feedings per Day"><input type="number" style={inp} value={s5.feedings_per_day} onChange={e => setS5(p => ({ ...p, feedings_per_day: e.target.value }))} /></Fld>
                <Fld label="Feeding Times (comma-separated)"><input style={inp} value={s5.feeding_times} placeholder="e.g. 8:00am, 12:00pm, 6:00pm" onChange={e => setS5(p => ({ ...p, feeding_times: e.target.value }))} /></Fld>
              </Grid2>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={s5.bolus_only} onChange={e => setS5(p => ({ ...p, bolus_only: e.target.checked }))} /> Bolus feeds only
              </label>
            </FlagRow>
            <Fld label="Additional Feeding Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={s5.notes} onChange={e => setS5(p => ({ ...p, notes: e.target.value }))} /></Fld>
          </div>
        </SectionCard>

        {/* ── SECTION 5: Personal Care ────────────────────────────────────────── */}
        <SectionCard id="sec-5" title="Personal Care (ADL)" icon={ShieldCheck} secRef={secRefs[5]}>
          {([['Bathing', 'bathing'], ['Toileting', 'toileting'], ['Dressing', 'dressing'], ['Oral Hygiene', 'oral_hygiene']] as [string, string][]).map(([title, key]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>{title}</h4>
              <Grid2>
                <Fld label="Assistance Level">
                  <select style={inp} value={s6[`${key}_level` as keyof S6State] as string} onChange={e => setS6(p => ({ ...p, [`${key}_level`]: e.target.value }))}>
                    {ADL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </Fld>
                <Fld label="Notes"><input style={inp} value={s6[`${key}_notes` as keyof S6State] as string} onChange={e => setS6(p => ({ ...p, [`${key}_notes`]: e.target.value }))} /></Fld>
              </Grid2>
            </div>
          ))}

          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Sleep</h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            {[['falling_asleep_issues','Difficulty falling asleep'],['sleep_walking','Sleep walking'],['night_wandering','Night wandering'],['nighttime_toileting','Nighttime toileting']].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={s6[k as keyof S6State] as boolean} onChange={e => setS6(p => ({ ...p, [k]: e.target.checked }))} /> {lbl}
              </label>
            ))}
          </div>
          <Grid2>
            <Fld label="Sleep Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s6.sleep_notes} onChange={e => setS6(p => ({ ...p, sleep_notes: e.target.value }))} /></Fld>
            {s6.nighttime_toileting && <Fld label="Nighttime Toileting Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s6.nighttime_notes} onChange={e => setS6(p => ({ ...p, nighttime_notes: e.target.value }))} /></Fld>}
          </Grid2>

          <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase' }}>Bowel / Bladder</h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
            {[['urinary_catheter','Urinary catheter'],['irregular_bowel','Irregular bowel'],['menstruation_support','Menstruation support']].map(([k, lbl]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={s6[k as keyof S6State] as boolean} onChange={e => setS6(p => ({ ...p, [k]: e.target.checked }))} /> {lbl}
              </label>
            ))}
          </div>
          {s6.irregular_bowel && <div style={{ marginBottom: 10 }}><Fld label="Irregular Bowel Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s6.irregular_bowel_notes} onChange={e => setS6(p => ({ ...p, irregular_bowel_notes: e.target.value }))} /></Fld></div>}
          <Fld label="Bowel Control Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s6.bowel_control_notes} onChange={e => setS6(p => ({ ...p, bowel_control_notes: e.target.value }))} /></Fld>
          <div style={{ marginTop: 14 }}><Fld label="Positioning / Transfer Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={s6.positioning_notes} onChange={e => setS6(p => ({ ...p, positioning_notes: e.target.value }))} /></Fld></div>
        </SectionCard>

        {/* ── SECTION 6: Activities & Permissions ────────────────────────────── */}
        <SectionCard id="sec-6" title="Activities & Permissions" icon={Activity} secRef={secRefs[6]}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12, textTransform: 'uppercase' }}>Activity</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12, textTransform: 'uppercase', width: 160 }}>Permission</th>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, color: 'var(--muted-foreground)', fontSize: 12, textTransform: 'uppercase' }}>Restriction Notes</th>
              </tr>
            </thead>
            <tbody>
              {ACTIVITIES.map(a => (
                <tr key={a.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 0', fontWeight: 500 }}>{a.label}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={s7[a.key]?.permission_level ?? ''} onChange={e => setS7(p => ({ ...p, [a.key]: { ...p[a.key], permission_level: e.target.value as PermLevel } }))}>
                      <option value="">— Not set —</option>
                      <option value="yes">✓ Allowed</option>
                      <option value="restricted">⚠ Restricted</option>
                      <option value="no">✕ Not allowed</option>
                    </select>
                  </td>
                  <td style={{ padding: '10px 0' }}>
                    {s7[a.key]?.permission_level === 'restricted' && (
                      <input style={inp} value={s7[a.key]?.restriction_notes ?? ''} placeholder="Describe restrictions..." onChange={e => setS7(p => ({ ...p, [a.key]: { ...p[a.key], restriction_notes: e.target.value } }))} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* ── SECTION 7: Medications ──────────────────────────────────────────── */}
        <SectionCard id="sec-7" title="Medications" icon={Pill} secRef={secRefs[7]}>
          {medications.length === 0 && <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 8 }}>No medications on file. Add below if applicable.</p>}
          {medications.map(med => (
            <DraftRow key={med._key} deleted={med._deleted} onDelete={() => toggleDel(setMedications, med._key)} onUndo={() => toggleDel(setMedications, med._key)}>
              <Grid3>
                <Fld label="Medication Name"><input style={inp} value={med.data.name} onChange={e => updList(setMedications, med._key, { name: e.target.value })} /></Fld>
                <Fld label="Dosage"><input style={inp} value={med.data.dosage} onChange={e => updList(setMedications, med._key, { dosage: e.target.value })} /></Fld>
                <Fld label="Frequency"><input style={inp} value={med.data.frequency} placeholder="e.g. Twice daily" onChange={e => updList(setMedications, med._key, { frequency: e.target.value })} /></Fld>
              </Grid3>
              <div style={{ marginTop: 10 }}><Grid3>
                <Fld label="Route"><input style={inp} value={med.data.route} placeholder="e.g. Oral, IV" onChange={e => updList(setMedications, med._key, { route: e.target.value })} /></Fld>
                <Fld label="Purpose / Condition"><input style={inp} value={med.data.purpose} onChange={e => updList(setMedications, med._key, { purpose: e.target.value })} /></Fld>
                <Fld label="Prescribing Physician"><input style={inp} value={med.data.prescribing_physician} onChange={e => updList(setMedications, med._key, { prescribing_physician: e.target.value })} /></Fld>
              </Grid3></div>
              <div style={{ marginTop: 10 }}><Fld label="Notes"><textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={med.data.notes} onChange={e => updList(setMedications, med._key, { notes: e.target.value })} /></Fld></div>
            </DraftRow>
          ))}
          <AddBtn label="Add Medication" onClick={() => setMedications(prev => [...prev, mkItem<MedFields>({ name: '', dosage: '', frequency: '', route: '', purpose: '', prescribing_physician: '', notes: '' })])} />
        </SectionCard>

        {/* ── SECTION 8: Narratives ───────────────────────────────────────────── */}
        <SectionCard id="sec-8" title="Application Narratives" icon={MessageSquare} secRef={secRefs[8]}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {NARRATIVE_FIELDS.map(({ key, label, help }) => (
              <Fld key={key} label={label}>
                <p style={{ margin: '2px 0 6px', fontSize: 12, color: 'var(--muted-foreground)' }}>{help}</p>
                <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }} value={sn[key] as string} onChange={e => setSn(p => ({ ...p, [key]: e.target.value }))} />
              </Fld>
            ))}
            <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 16 }}>
              <Fld label="Admin Notes (Internal — not visible to applicant)">
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={sn.notes} onChange={e => setSn(p => ({ ...p, notes: e.target.value }))} />
              </Fld>
            </div>
          </div>
        </SectionCard>

        {/* ── SECTION 9: Documents ────────────────────────────────────────────── */}
        <SectionCard id="sec-9" title="Documents" icon={Upload} secRef={secRefs[9]}>
          {documents.length === 0 && <p style={{ color: 'var(--muted-foreground)', fontSize: 14, marginBottom: 12 }}>No documents uploaded yet.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: `1px solid ${doc._pendingDelete ? 'var(--destructive)' : 'var(--border)'}`, borderRadius: 8, background: doc._pendingDelete ? 'rgba(239,68,68,0.05)' : 'var(--background)', opacity: doc._pendingDelete ? 0.65 : 1 }}>
                <FileText size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.file_name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>{doc.document_type ?? 'General'} · {new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {doc.url && (
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>
                      <Eye size={13} /> View
                    </a>
                  )}
                  {doc._pendingDelete ? (
                    <button onClick={() => setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, _pendingDelete: false } : d))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ember-orange)' }}>Undo</button>
                  ) : (
                    <button onClick={() => setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, _pendingDelete: true } : d))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--destructive)' }}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleDocUpload(e.target.files[0]); }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: '1px dashed var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', color: 'var(--ember-orange)', fontWeight: 600, fontSize: 13 }}>
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Document on Behalf of Applicant'}
          </button>
          {documents.some(d => d._pendingDelete) && (
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--destructive)' }}>
              Documents marked for deletion will be permanently removed when you click "Save Changes".
            </p>
          )}
        </SectionCard>

        {/* ── SECTION 10: Consents (view-only) ────────────────────────────────── */}
        <SectionCard id="sec-10" title="Consents" icon={PenLine} secRef={secRefs[10]}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--muted)', borderRadius: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)' }}>
              Consent records are legal signatures and cannot be edited. Shown here for reference only.
            </p>
          </div>
          {!application.consents?.length ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No consent records on file.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {application.consents.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <span style={{ fontSize: 18 }}>{c.consent_given ? '✅' : '❌'}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{c.consent_type.replace(/_/g, ' ')}</p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
                      Signed by {c.guardian_name} ({c.guardian_relationship}) · {new Date(c.signed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

      </div>

      {/* ── Sticky save bar ─────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, padding: '14px 24px', background: 'var(--card)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <Button variant="ghost" disabled={saving}
          onClick={() => navigate(isSuperAdmin ? ROUTES.SUPER_ADMIN_APPLICATION_EDIT(application.id).replace('/edit','') : ROUTES.ADMIN_APPLICATION_DETAIL(application.id))}>
          Cancel
        </Button>
        <Button onClick={handleSaveAll} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--ember-orange)', color: '#fff', border: 'none', paddingLeft: 20, paddingRight: 20 }}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>

    </div>
  );
}
