/**
 * ApplicationFormPage.tsx
 *
 * Full Camp Burnt Gin CYSHCN Camper Application — 10-section accordion form.
 * Replaces the legacy 6-step wizard with a free-navigation, auto-saving system.
 *
 * Route: /applicant/applications/new
 *
 * Architecture:
 * - State: single FormState object, mirrored to sessionStorage on every change
 * - Auto-save: debounced 3 s write to "cbg_app_draft"
 * - Draft storage uses sessionStorage (not localStorage) so PHI does not persist
 *   across browser sessions — required for HIPAA compliance on shared devices.
 * - Layout: 260 px left sidebar (section nav) + right accordion main
 * - Free navigation: user may open any section at any time
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
  type ChangeEvent,
  type ReactNode,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User,
  Heart,
  Brain,
  Accessibility,
  Utensils,
  ShieldCheck,
  Activity,
  Pill,
  Upload,
  PenLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  Calendar,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

import {
  getSessions,
  createCamper,
  createApplication,
  createEmergencyContact,
  createDiagnosis,
  createAllergy,
  createBehavioralProfile,
  createAssistiveDevice,
  createFeedingPlan,
  storeHealthProfile,
  createPersonalCarePlan,
  createMedication,
  createActivityPermission,
  uploadDocument,
  submitDocument,
  signApplication,
  storeConsents,
  getDraft,
  saveDraft as apiSaveDraft,
  deleteDraft as apiDeleteDraft,
} from '@/features/parent/api/applicant.api';
import { ROUTES } from '@/shared/constants/routes';
import type { Session } from '@/shared/types';
import { Button } from '@/ui/components/Button';
import { useAppSelector } from '@/store/hooks';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAFT_KEY_BASE = 'cbg_app_draft';
const AUTOSAVE_DELAY = 3000; // 3 s

/** Deep-merge a persisted draft with INITIAL_STATE so null/missing fields
 *  never override the safe string defaults (prevents .trim() on null crashes). */
function mergeDraft(parsed: Partial<FormState>): FormState {
  const mergeSection = <T extends object>(initial: T, saved: Partial<T> | undefined): T => {
    if (!saved) return initial;
    const result = { ...initial } as Record<string, unknown>;
    for (const key of Object.keys(initial) as (keyof T)[]) {
      const v = (saved as Record<string, unknown>)[key as string];
      result[key as string] = v == null ? initial[key] : v;
    }
    return result as T;
  };

  const s4 = mergeSection(INITIAL_STATE.s4, parsed.s4);
  // Backward-compatibility: drafts saved before the section_reviewed field existed will
  // not have it set. Infer it as true when the user had already entered meaningful data,
  // so those drafts don't suddenly appear as 'empty' after this change.
  const s4Merged: FormState['s4'] = {
    ...s4,
    section_reviewed: s4.section_reviewed || s4.devices.length > 0 || s4.mobility_notes.trim() !== '',
  };

  const s5 = mergeSection(INITIAL_STATE.s5, parsed.s5);
  const s5Merged: FormState['s5'] = {
    ...s5,
    section_reviewed: s5.section_reviewed || s5.g_tube || s5.special_diet
      || s5.texture_modified || s5.fluid_restriction || s5.feeding_notes.trim() !== '',
  };

  // Backward-compatibility: drafts saved before section_reviewed was added to sn
  // will not have it set. Infer it as true when the parent had already typed any
  // narrative text, so existing drafts don't suddenly revert to 'empty'.
  const sn = mergeSection(INITIAL_STATE.sn, parsed.sn);
  const snMerged: FormState['sn'] = {
    ...sn,
    section_reviewed: sn.section_reviewed || [
      sn.narrative_rustic_environment, sn.narrative_staff_suggestions,
      sn.narrative_participation_concerns, sn.narrative_camp_benefit,
      sn.narrative_heat_tolerance, sn.narrative_transportation,
      sn.narrative_additional_info, sn.narrative_emergency_protocols,
    ].some((v) => v.trim() !== ''),
  };

  return {
    ...INITIAL_STATE,
    s1:  mergeSection(INITIAL_STATE.s1,  parsed.s1),
    s2:  mergeSection(INITIAL_STATE.s2,  parsed.s2),
    s3:  mergeSection(INITIAL_STATE.s3,  parsed.s3),
    s4:  s4Merged,
    s5:  s5Merged,
    s6:  mergeSection(INITIAL_STATE.s6,  parsed.s6),
    s7:  mergeSection(INITIAL_STATE.s7,  parsed.s7),
    s8:  mergeSection(INITIAL_STATE.s8,  parsed.s8),
    sn:  snMerged,
    // s9 document slots are intentionally NOT merged from the persisted draft.
    // DocSlot stores only metadata (name/size/mime); the actual File object lives in
    // docFilesRef.current which is never serialized. After any page reload or draft
    // resume the file reference is gone, so merging the slot would show a false
    // "uploaded" state that silently drops the file at submission (line 4101 skips
    // slots with no File ref). Resetting forces the user to re-select, which is
    // the only safe behaviour.
    s9:  INITIAL_STATE.s9,
    s10: mergeSection(INITIAL_STATE.s10, parsed.s10),
    meta: { ...INITIAL_STATE.meta, ...(parsed.meta ?? {}) },
  };
}

const STATES_US = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// COMMUNICATION_METHODS, DEVICE_TYPES, TEXTURE_LEVELS are defined inside the
// component (or passed via helpers) so they rebuild when the language changes.

// ---------------------------------------------------------------------------
// FormState type
// ---------------------------------------------------------------------------

interface Allergy {
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening' | '';
  epi_pen: boolean;
}

interface DiagnosisEntry {
  condition: string;
  notes: string;
}

interface DeviceEntry {
  device_type: string;
  requires_transfer: boolean;
  notes: string;
}

/** Metadata for a user-selected document (File object stored in docFilesRef, not in state) */
type DocSlot = { file_name: string; size: number; mime: string } | null;

type SignatureType = 'drawn' | 'typed';

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  reason: string;
  physician: string;
  self_admin: boolean;
  refrigeration: boolean;
  notes: string;
}

export interface FormState {
  /** Section 1 — General Information */
  s1: {
    // Application meta
    first_application: boolean;
    attended_before: boolean;
    // Camper info
    camper_first_name: string;
    camper_last_name: string;
    camper_dob: string;
    camper_gender: string;
    tshirt_size: string;
    camper_preferred_name: string;
    county: string;
    // Camper mailing address (may differ from guardian)
    camper_address: string;
    camper_city: string;
    camper_state: string;
    camper_zip: string;
    // Guardian 1
    g1_name: string;
    g1_relationship: string;
    g1_phone_home: string;
    g1_phone_work: string;
    g1_phone_cell: string;
    g1_email: string;
    g1_address: string;
    g1_city: string;
    g1_state: string;
    g1_zip: string;
    // Guardian 2 (full fields matching official form)
    g2_name: string;
    g2_relationship: string;
    g2_phone_home: string;
    g2_phone_work: string;
    g2_phone_cell: string;
    g2_email: string;
    g2_address: string;
    g2_city: string;
    g2_state: string;
    g2_zip: string;
    g2_primary_language: string;
    g2_interpreter: boolean;
    // Emergency contact (full fields matching official form)
    ec_name: string;
    ec_relationship: string;
    ec_phone: string;       // primary/cell (existing field — preserved for compat)
    ec_phone_home: string;
    ec_phone_work: string;
    ec_address: string;
    ec_city: string;
    ec_state: string;
    ec_zip: string;
    ec_primary_language: string;
    ec_interpreter: boolean;
    // Session selection
    session_id: number | '';
    session_id_2nd: number | '';
    // Language & interpreter (applicant)
    needs_interpreter: boolean;
    preferred_language: string;
  };
  /** Section 2 — Health & Medical */
  s2: {
    // Insurance type (radio: none | medicaid | other)
    insurance_type: 'none' | 'medicaid' | 'other' | '';
    insurance_provider: string;
    insurance_policy: string;
    insurance_group: string;
    medicaid_number: string;
    physician_name: string;
    physician_phone: string;
    physician_address: string;
    diagnoses: DiagnosisEntry[];
    allergies: Allergy[];
    has_seizures: boolean | '';
    last_seizure_date: string;
    seizure_description: string;
    has_neurostimulator: boolean | '';
    immunizations_current: boolean | '';
    tetanus_date: string;
    date_of_medical_exam: string;
    // Form parity — PDF Section 4 "Other Health Information"
    has_contagious_illness: boolean | '';
    contagious_illness_description: string;
    has_recent_illness: boolean | '';
    recent_illness_description: string;
    tubes_in_ears: boolean | '';
  };
  /** Section 3 — Development & Behavior */
  s3: {
    // Existing flags
    aggression: boolean;
    aggression_description: string;
    self_abuse: boolean;
    self_abuse_description: string;
    wandering: boolean;
    wandering_description: string;
    one_to_one: boolean;
    one_to_one_description: string;
    developmental_delay: boolean;
    functional_age_level: string;
    functional_reading: boolean;
    functional_writing: boolean;
    independent_mobility: boolean;
    verbal_communication: boolean;
    social_skills: boolean;
    behavior_plan: boolean;
    // Form parity — PDF Section 5 missing flags
    sexual_behaviors: boolean;
    sexual_behaviors_description: string;
    interpersonal_behavior: boolean;
    interpersonal_behavior_description: string;
    social_emotional: boolean;
    social_emotional_description: string;
    follows_instructions: boolean;
    follows_instructions_description: string;
    group_participation: boolean;
    group_participation_description: string;
    attends_school: boolean | '';
    classroom_type: string;
    communication_methods: string[];
    behavior_notes: string;
  };
  /** Section 4 — Equipment & Mobility */
  s4: {
    devices: DeviceEntry[];
    uses_cpap: boolean;
    cpap_notes: string;
    mobility_notes: string;
    /** Explicit confirmation that the parent has reviewed this section. Required for
     *  'complete' status — prevents falsely marking the section complete on a new
     *  application where all fields are at their default (empty/false) values. */
    section_reviewed: boolean;
  };
  /** Section 5 — Diet & Feeding */
  s5: {
    special_diet: boolean;
    diet_description: string;
    texture_modified: boolean;
    texture_level: string;
    fluid_restriction: boolean;
    fluid_details: string;
    g_tube: boolean;
    formula: string;
    amount_per_feeding: string;
    feedings_per_day: string;
    feeding_times: string;
    bolus_only: boolean;
    feeding_notes: string;
    /** Explicit confirmation that the parent has reviewed this section. Required for
     *  'complete' status — prevents falsely marking the section complete on a new
     *  application where all fields are at their default (empty/false) values. */
    section_reviewed: boolean;
  };
  /** Section 6 — Personal Care */
  s6: {
    bathing_level: string;
    bathing_notes: string;
    toileting_level: string;
    toileting_notes: string;
    nighttime_toileting: boolean;
    nighttime_notes: string;
    dressing_level: string;
    dressing_notes: string;
    oral_hygiene_level: string;
    oral_hygiene_notes: string;
    positioning_notes: string;
    sleep_notes: string;
    falling_asleep_issues: boolean;
    sleep_walking: boolean;
    night_wandering: boolean;
    bowel_control_notes: string;
    irregular_bowel: boolean;
    irregular_bowel_notes: string;
    urinary_catheter: boolean;
    menstruation_support: boolean;
  };
  /** Section 7 — Activities & Permissions (matches CYSHCN form 0717-ENG-DPH §9) */
  s7: {
    sports_games: { level: string; notes: string };
    arts_crafts:  { level: string; notes: string };
    nature:       { level: string; notes: string };
    fine_arts:    { level: string; notes: string };
    swimming:     { level: string; notes: string };
    boating:      { level: string; notes: string };
    camp_out:     { level: string; notes: string };
  };
  /** Section 8 — Medications */
  s8: {
    no_medications: boolean;
    medications: MedicationEntry[];
  };
  /** Section 9 — Required Documents */
  s9: {
    immunization:  DocSlot;
    medical_exam:  DocSlot;
    insurance_card: DocSlot;
    cpap_waiver:   DocSlot;
    seizure_plan:  DocSlot;
    gtube_plan:    DocSlot;
  };
  /** Section 9 (display) — Narratives (PDF §10) */
  sn: {
    narrative_rustic_environment:  string;
    narrative_staff_suggestions:   string;
    narrative_participation_concerns: string;
    narrative_camp_benefit:        string;
    narrative_heat_tolerance:      string;
    narrative_transportation:      string;
    narrative_additional_info:     string;
    narrative_emergency_protocols: string;
    /** Explicit acknowledgment that the parent has reviewed this section.
     *  All narrative fields are optional, so this flag is the only reliable
     *  signal distinguishing "reviewed with nothing to add" from "never opened".
     *  Without it the section would have to default to complete (since all fields
     *  are optional), which falsely shows a checkmark on a fresh application. */
    section_reviewed: boolean;
  };
  /** Section 10 — Consents & Signatures */
  s10: {
    // PDF consent #1 — General consent
    consent_general:    boolean;
    consent_medical:    boolean;
    consent_photo:      boolean;
    consent_liability:  boolean;
    // PDF consent #4 — Permission to participate in activities
    consent_permission_activities: boolean;
    consent_medication: boolean;
    consent_hipaa:      boolean;
    signed_name:        string;
    signed_date:        string;
    signature_type:     SignatureType;
    signature_data:     string; // base64 PNG (drawn) or '' (typed-only)
  };
  /** Meta */
  meta: {
    activeSection: number;
    lastSaved: number;
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: FormState = {
  s1: {
    first_application: false,
    attended_before: false,
    camper_first_name: '',
    camper_last_name: '',
    camper_dob: '',
    camper_gender: '',
    tshirt_size: '',
    camper_preferred_name: '',
    county: '',
    camper_address: '',
    camper_city: '',
    camper_state: 'SC',
    camper_zip: '',
    g1_name: '',
    g1_relationship: '',
    g1_phone_home: '',
    g1_phone_work: '',
    g1_phone_cell: '',
    g1_email: '',
    g1_address: '',
    g1_city: '',
    g1_state: 'SC',
    g1_zip: '',
    g2_name: '',
    g2_relationship: '',
    g2_phone_home: '',
    g2_phone_work: '',
    g2_phone_cell: '',
    g2_email: '',
    g2_address: '',
    g2_city: '',
    g2_state: 'SC',
    g2_zip: '',
    g2_primary_language: '',
    g2_interpreter: false,
    ec_name: '',
    ec_relationship: '',
    ec_phone: '',
    ec_phone_home: '',
    ec_phone_work: '',
    ec_address: '',
    ec_city: '',
    ec_state: 'SC',
    ec_zip: '',
    ec_primary_language: '',
    ec_interpreter: false,
    session_id: '',
    session_id_2nd: '',
    needs_interpreter: false,
    preferred_language: '',
  },
  s2: {
    insurance_type: '',
    insurance_provider: '',
    insurance_policy: '',
    insurance_group: '',
    medicaid_number: '',
    physician_name: '',
    physician_phone: '',
    physician_address: '',
    diagnoses: [],
    allergies: [],
    has_seizures: '',
    last_seizure_date: '',
    seizure_description: '',
    has_neurostimulator: '',
    immunizations_current: '',
    tetanus_date: '',
    date_of_medical_exam: '',
    has_contagious_illness: '',
    contagious_illness_description: '',
    has_recent_illness: '',
    recent_illness_description: '',
    tubes_in_ears: '',
  },
  s3: {
    aggression: false,
    aggression_description: '',
    self_abuse: false,
    self_abuse_description: '',
    wandering: false,
    wandering_description: '',
    one_to_one: false,
    one_to_one_description: '',
    developmental_delay: false,
    functional_age_level: '',
    functional_reading: false,
    functional_writing: false,
    independent_mobility: false,
    verbal_communication: false,
    social_skills: false,
    behavior_plan: false,
    sexual_behaviors: false,
    sexual_behaviors_description: '',
    interpersonal_behavior: false,
    interpersonal_behavior_description: '',
    social_emotional: false,
    social_emotional_description: '',
    follows_instructions: false,
    follows_instructions_description: '',
    group_participation: false,
    group_participation_description: '',
    attends_school: '',
    classroom_type: '',
    communication_methods: [],
    behavior_notes: '',
  },
  s4: {
    devices: [],
    uses_cpap: false,
    cpap_notes: '',
    mobility_notes: '',
    section_reviewed: false,
  },
  s5: {
    special_diet: false,
    diet_description: '',
    texture_modified: false,
    texture_level: '',
    fluid_restriction: false,
    fluid_details: '',
    g_tube: false,
    formula: '',
    amount_per_feeding: '',
    feedings_per_day: '',
    feeding_times: '',
    bolus_only: false,
    feeding_notes: '',
    section_reviewed: false,
  },
  s6: {
    bathing_level: '',
    bathing_notes: '',
    toileting_level: '',
    toileting_notes: '',
    nighttime_toileting: false,
    nighttime_notes: '',
    dressing_level: '',
    dressing_notes: '',
    oral_hygiene_level: '',
    oral_hygiene_notes: '',
    positioning_notes: '',
    sleep_notes: '',
    falling_asleep_issues: false,
    sleep_walking: false,
    night_wandering: false,
    bowel_control_notes: '',
    irregular_bowel: false,
    irregular_bowel_notes: '',
    urinary_catheter: false,
    menstruation_support: false,
  },
  s7: {
    sports_games: { level: '', notes: '' },
    arts_crafts:  { level: '', notes: '' },
    nature:       { level: '', notes: '' },
    fine_arts:    { level: '', notes: '' },
    swimming:     { level: '', notes: '' },
    boating:      { level: '', notes: '' },
    camp_out:     { level: '', notes: '' },
  },
  s8: { no_medications: false, medications: [] },
  sn: {
    narrative_rustic_environment:     '',
    narrative_staff_suggestions:      '',
    narrative_participation_concerns: '',
    narrative_camp_benefit:           '',
    narrative_heat_tolerance:         '',
    narrative_transportation:         '',
    narrative_additional_info:        '',
    narrative_emergency_protocols:    '',
    section_reviewed: false,
  },
  s9: {
    immunization:  null,
    medical_exam:  null,
    insurance_card: null,
    cpap_waiver:   null,
    seizure_plan:  null,
    gtube_plan:    null,
  },
  s10: {
    consent_general:               false,
    consent_medical:               false,
    consent_photo:                 false,
    consent_liability:             false,
    consent_permission_activities: false,
    consent_medication:            false,
    consent_hipaa:                 false,
    signed_name:        '',
    signed_date:        '',
    signature_type:     'typed',
    signature_data:     '',
  },
  meta: { activeSection: 0, lastSaved: 0 },
};

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

interface SectionDef {
  id: number;
  key: keyof FormState;
  label: string;
  shortLabel: string;
  icon: typeof User;
}

function getSections(t: TFunction): SectionDef[] {
  return [
    { id: 0,  key: 's1',  label: t('applicant.form.s0_label'),  shortLabel: t('applicant.form.s0_short'),  icon: User          },
    { id: 1,  key: 's2',  label: t('applicant.form.s1_label'),  shortLabel: t('applicant.form.s1_short'),  icon: Heart         },
    { id: 2,  key: 's3',  label: t('applicant.form.s2_label'),  shortLabel: t('applicant.form.s2_short'),  icon: Brain         },
    { id: 3,  key: 's4',  label: t('applicant.form.s3_label'),  shortLabel: t('applicant.form.s3_short'),  icon: Accessibility },
    { id: 4,  key: 's5',  label: t('applicant.form.s4_label'),  shortLabel: t('applicant.form.s4_short'),  icon: Utensils      },
    { id: 5,  key: 's6',  label: t('applicant.form.s5_label'),  shortLabel: t('applicant.form.s5_short'),  icon: ShieldCheck   },
    { id: 6,  key: 's7',  label: t('applicant.form.s6_label'),  shortLabel: t('applicant.form.s6_short'),  icon: Activity      },
    { id: 7,  key: 's8',  label: t('applicant.form.s7_label'),  shortLabel: t('applicant.form.s7_short'),  icon: Pill          },
    { id: 8,  key: 'sn',  label: t('applicant.form.sn_label'),  shortLabel: t('applicant.form.sn_short'),  icon: MessageSquare },
    { id: 9,  key: 's9',  label: t('applicant.form.s8_label'),  shortLabel: t('applicant.form.s8_short'),  icon: Upload        },
    { id: 10, key: 's10', label: t('applicant.form.s9_label'),  shortLabel: t('applicant.form.s9_short'),  icon: PenLine       },
  ];
}

// ---------------------------------------------------------------------------
// Section completion
// ---------------------------------------------------------------------------

type SectionStatus = 'complete' | 'partial' | 'empty';

function getSectionStatus(sectionId: number, form: FormState): SectionStatus {
  switch (sectionId) {
    case 0: {
      const { s1 } = form;
      const required = [
        s1.camper_first_name, s1.camper_last_name, s1.camper_dob, s1.camper_gender,
        s1.g1_name, s1.g1_phone_cell, s1.ec_name, s1.ec_phone,
      ];
      const filled = required.filter(Boolean).length;
      if (filled === 0) return 'empty';
      const sessionFilled = s1.session_id !== '';
      if (filled === required.length && sessionFilled) return 'complete';
      return 'partial';
    }
    case 1: {
      const { s2 } = form;
      const hasInsuranceAnswer = s2.insurance_type !== '';
      // Required sub-field depends on which insurance type was selected
      const insuranceFilled = s2.insurance_type === 'none'
        ? true
        : s2.insurance_type === 'medicaid'
        ? Boolean(s2.medicaid_number)
        : Boolean(s2.insurance_provider); // 'other'
      const hasPhysician = Boolean(s2.physician_name);
      const hasSeizureAnswer = s2.has_seizures !== '';
      const hasImmunizationAnswer = s2.immunizations_current !== '';
      if (!hasInsuranceAnswer && !hasPhysician && !hasSeizureAnswer) return 'empty';
      if (hasInsuranceAnswer && insuranceFilled && hasPhysician && hasSeizureAnswer && hasImmunizationAnswer) return 'complete';
      return 'partial';
    }
    case 2: {
      const { s3 } = form;
      // Any active behavioral flag must have a description — an empty description
      // when the flag is true is not actionable for staff planning.
      const flagsNeedingDesc: [boolean, string][] = [
        [s3.aggression,             s3.aggression_description],
        [s3.self_abuse,             s3.self_abuse_description],
        [s3.wandering,              s3.wandering_description],
        [s3.one_to_one,             s3.one_to_one_description],
        [s3.sexual_behaviors,       s3.sexual_behaviors_description],
        [s3.interpersonal_behavior, s3.interpersonal_behavior_description],
        [s3.social_emotional,       s3.social_emotional_description],
        [s3.follows_instructions,   s3.follows_instructions_description],
        [s3.group_participation,    s3.group_participation_description],
      ];
      if (flagsNeedingDesc.some(([flag, desc]) => flag && !desc.trim())) return 'partial';
      // attends_school is the minimum required answer that proves the parent has visited
      // this section. Without it we cannot distinguish "reviewed, no concerns" from
      // "never opened the section" — all boolean flags default to false.
      if (s3.attends_school === '') {
        const anyFlagSet   = flagsNeedingDesc.some(([flag]) => flag);
        const hasOtherData = s3.communication_methods.length > 0 || s3.behavior_notes.trim() !== '';
        return (anyFlagSet || hasOtherData) ? 'partial' : 'empty';
      }
      return 'complete';
    }
    case 3: {
      // Equipment section: all fields are opt-in so the default state (no devices,
      // no notes) is indistinguishable from "never visited". Require explicit review.
      const { s4 } = form;
      if (!s4.section_reviewed) return 'empty';
      return 'complete';
    }
    case 4: {
      const { s5 } = form;
      // G-tube required sub-fields: formula and amount are marked required in the UI.
      const gTubeAnswered = !s5.g_tube || (s5.formula.trim() !== '' && s5.amount_per_feeding.trim() !== '');
      if (!gTubeAnswered) return 'partial';
      // Special diet requires a description when checked.
      const dietAnswered = !s5.special_diet || s5.diet_description.trim() !== '';
      if (!dietAnswered) return 'partial';
      // Feeding section: all items are opt-in checkboxes so the default state
      // (all false) is indistinguishable from "never visited". Require explicit review.
      if (!s5.section_reviewed) return 'empty';
      return 'complete';
    }
    case 5: {
      const { s6 } = form;
      // Only count levels that are valid backend enum values — a truthy-but-wrong string
      // (e.g. a human-readable label loaded from a stale draft) must not mark the
      // section complete and allow an invalid payload through to the server.
      const VALID_ADL = new Set(['independent', 'verbal_cue', 'physical_assist', 'full_assist']);
      const levels = [s6.bathing_level, s6.toileting_level, s6.dressing_level, s6.oral_hygiene_level];
      const filled = levels.filter((v) => VALID_ADL.has(v)).length;
      if (filled === 0) {
        // A parent may enter notes before selecting levels — show 'partial' rather
        // than 'empty' so they know their data has been registered.
        const hasAnyData = s6.bathing_notes.trim() || s6.toileting_notes.trim()
          || s6.dressing_notes.trim() || s6.oral_hygiene_notes.trim()
          || s6.positioning_notes.trim() || s6.sleep_notes.trim()
          || s6.bowel_control_notes.trim() || s6.nighttime_toileting
          || s6.falling_asleep_issues || s6.irregular_bowel || s6.urinary_catheter
          || s6.menstruation_support;
        return hasAnyData ? 'partial' : 'empty';
      }
      if (filled === levels.length) return 'complete';
      return 'partial';
    }
    case 6: {
      const { s7 } = form;
      // Only count levels that are valid backend enum values: yes | restricted | no
      const VALID_ACTIVITY = new Set(['yes', 'restricted', 'no']);
      const activities = Object.values(s7) as { level: string; notes: string }[];
      const answered = activities.filter((a) => VALID_ACTIVITY.has(a.level)).length;
      if (answered === 0) return 'empty';
      if (answered === activities.length) return 'complete';
      return 'partial';
    }
    case 7: {
      const { s8 } = form;
      if (s8.no_medications) return 'complete';
      if (s8.medications.length === 0) return 'empty';
      const allFilled = s8.medications.every((m) => m.name.trim() !== '' && m.dosage.trim() !== '');
      return allFilled ? 'complete' : 'partial';
    }
    case 8: {
      // Narratives — all fields are optional, so the only reliable way to know
      // whether the parent has actually reviewed this section (vs. never opened it)
      // is the explicit `section_reviewed` acknowledgment checkbox.
      // Without it, every fresh application would show Narratives as complete.
      const { sn } = form;
      if (!sn.section_reviewed) {
        const hasContent = [
          sn.narrative_rustic_environment, sn.narrative_staff_suggestions,
          sn.narrative_participation_concerns, sn.narrative_camp_benefit,
          sn.narrative_heat_tolerance, sn.narrative_transportation,
          sn.narrative_additional_info, sn.narrative_emergency_protocols,
        ].some((v) => v.trim() !== '');
        // Typing into narratives without checking "reviewed" is partial progress.
        return hasContent ? 'partial' : 'empty';
      }
      return 'complete';
    }
    case 9: {
      const { s9 } = form;
      const hasCpap  = form.s4.devices.some((d) => d.device_type.includes('CPAP'));
      const hasSeizures = form.s2.has_seizures === true;
      const hasGtube = form.s5.g_tube === true;
      const required: (keyof typeof s9)[] = ['immunization', 'medical_exam', 'insurance_card'];
      if (hasCpap)      required.push('cpap_waiver');
      if (hasSeizures)  required.push('seizure_plan');
      if (hasGtube)     required.push('gtube_plan');
      const uploaded = required.filter((k) => s9[k] !== null).length;
      if (uploaded === 0) return 'empty';
      if (uploaded === required.length) return 'complete';
      return 'partial';
    }
    case 10: {
      const { s10 } = form;
      const allConsents = s10.consent_general && s10.consent_medical && s10.consent_photo
        && s10.consent_liability && s10.consent_permission_activities
        && s10.consent_medication && s10.consent_hipaa;
      const hasSigned = s10.signed_name.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(s10.signed_date);
      if (!s10.consent_general && !s10.consent_medical && !s10.consent_photo
          && !s10.consent_liability && !s10.consent_permission_activities
          && !s10.consent_medication && !s10.consent_hipaa && s10.signed_name === '') {
        return 'empty';
      }
      if (allConsents && hasSigned) return 'complete';
      return 'partial';
    }
    default:
      return 'empty';
  }
}

function countMissing(form: FormState): number {
  let missing = 0;
  for (let i = 0; i <= 10; i++) {
    const st = getSectionStatus(i, form);
    if (st !== 'complete') missing++;
  }
  return missing;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground)' }}>
      {children}
      {required && <span className="ml-1 text-xs" style={{ color: 'var(--destructive)' }}>*</span>}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg px-4 py-3 text-sm border outline-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)] min-h-[48px] ${className}`}
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      className="w-full rounded-lg px-4 py-3 text-sm border outline-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)] min-h-[48px]"
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    >
      {children}
    </select>
  );
}

function TextArea({
  id,
  value,
  onChange,
  placeholder = '',
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-lg px-3 py-2.5 text-sm border outline-none resize-none transition-colors focus:ring-1 focus:ring-[var(--ember-orange)]"
      style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
    />
  );
}

function YesNoField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: boolean | '';
  onChange: (v: boolean) => void;
  id: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm flex-1 mr-4" style={{ color: 'var(--foreground)' }}>{label}</span>
      <div className="flex items-center gap-4 flex-shrink-0">
        {(['yes', 'no'] as const).map((opt) => {
          const isYes = opt === 'yes';
          const active = value !== '' && (isYes ? value === true : value === false);
          return (
            <label
              key={opt}
              htmlFor={`${id}_${opt}`}
              className="flex items-center gap-1.5 cursor-pointer relative"
            >
              <input
                id={`${id}_${opt}`}
                type="radio"
                name={id}
                checked={active}
                onChange={() => onChange(isYes)}
                className="sr-only"
              />
              <span
                className="w-16 text-center text-xs font-medium py-1 rounded-full border transition-all"
                style={{
                  background: active
                    ? isYes
                      ? 'rgba(22,163,74,0.12)'
                      : 'rgba(220,38,38,0.08)'
                    : 'var(--card)',
                  borderColor: active
                    ? isYes
                      ? 'var(--ember-orange)'
                      : 'var(--destructive)'
                    : 'var(--border)',
                  color: active
                    ? isYes
                      ? 'var(--ember-orange)'
                      : 'var(--destructive)'
                    : 'var(--muted-foreground)',
                }}
              >
                {opt === 'yes' ? t('applicant.form.yes') : t('applicant.form.no')}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {children}
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-widest mb-4 pb-2 border-b" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--border)' }}>
      {children}
    </h4>
  );
}

function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const gridClass = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-2';
  return <div className={`grid ${gridClass} gap-y-6 gap-x-6`}>{children}</div>;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Section 1 — General Information
// ---------------------------------------------------------------------------

function Section1({
  data,
  sessions,
  onChange,
}: {
  data: FormState['s1'];
  sessions: Session[];
  onChange: (patch: Partial<FormState['s1']>) => void;
}) {
  const { t } = useTranslation();
  const set = (field: keyof FormState['s1']) => (v: string | boolean) =>
    onChange({ [field]: v } as Partial<FormState['s1']>);

  return (
    <div className="flex flex-col gap-6 p-8">

      {/* Application meta */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s1_application_type_heading')}</SubHeading>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.first_application}
              onChange={(e) => onChange({ first_application: e.target.checked, attended_before: e.target.checked ? false : data.attended_before })}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s1_first_application_label')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.attended_before}
              onChange={(e) => onChange({ attended_before: e.target.checked, first_application: e.target.checked ? false : data.first_application })}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s1_attended_before_label')}</span>
          </label>
        </div>
      </SectionCard>

      {/* Camper Info */}
      <SectionCard>
        <SubHeading>{t('applicant.form.section_camper_info')}</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>{t('applicant.form.first_name')}</FieldLabel>
            <TextInput value={data.camper_first_name} onChange={set('camper_first_name')} placeholder={t('applicant.form.first_name')} />
          </div>
          <div>
            <FieldLabel required>{t('applicant.form.last_name')}</FieldLabel>
            <TextInput value={data.camper_last_name} onChange={set('camper_last_name')} placeholder={t('applicant.form.last_name')} />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel required>{t('applicant.form.dob')}</FieldLabel>
            <TextInput type="date" value={data.camper_dob} onChange={set('camper_dob')} />
          </div>
          <div>
            <FieldLabel required>{t('applicant.form.gender')}</FieldLabel>
            <SelectInput value={data.camper_gender} onChange={set('camper_gender')}>
              <option value="">{t('applicant.form.s1_select_gender')}</option>
              <option value="male">{t('applicant.form.s1_gender_male')}</option>
              <option value="female">{t('applicant.form.s1_gender_female')}</option>
              <option value="non_binary">{t('applicant.form.s1_gender_nonbinary')}</option>
              <option value="prefer_not_to_say">{t('applicant.form.s1_gender_prefer_not')}</option>
              <option value="other">{t('applicant.form.s1_gender_other')}</option>
            </SelectInput>
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>{t('applicant.form.preferred_name')}</FieldLabel>
            <TextInput value={data.camper_preferred_name} onChange={set('camper_preferred_name')} placeholder={t('applicant.form.optional')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.county')}</FieldLabel>
            <TextInput value={data.county} onChange={set('county')} placeholder={t('applicant.form.county')} />
          </div>
        </FormRow>
        <div>
          <FieldLabel>{t('applicant.form.s1_camper_address_label')}</FieldLabel>
          <TextInput value={data.camper_address} onChange={set('camper_address')} placeholder={t('applicant.form.s1_street_address_placeholder')} />
        </div>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.city')}</FieldLabel>
            <TextInput value={data.camper_city} onChange={set('camper_city')} placeholder={t('applicant.form.city')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.state')}</FieldLabel>
            <SelectInput value={data.camper_state} onChange={set('camper_state')}>
              {STATES_US.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>{t('applicant.form.zip')}</FieldLabel>
            <TextInput value={data.camper_zip} onChange={set('camper_zip')} placeholder="00000" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>{t('applicant.form.tshirt_size')}</FieldLabel>
            <SelectInput value={data.tshirt_size} onChange={set('tshirt_size')}>
              <option value="">{t('applicant.form.s1_select_size')}</option>
              <option value="YXS">{t('applicant.form.s1_size_yxs')}</option>
              <option value="YS">{t('applicant.form.s1_size_ys')}</option>
              <option value="YM">{t('applicant.form.s1_size_ym')}</option>
              <option value="YL">{t('applicant.form.s1_size_yl')}</option>
              <option value="YXL">{t('applicant.form.s1_size_yxl')}</option>
              <option value="AS">{t('applicant.form.s1_size_as')}</option>
              <option value="AM">{t('applicant.form.s1_size_am')}</option>
              <option value="AL">{t('applicant.form.s1_size_al')}</option>
              <option value="AXL">{t('applicant.form.s1_size_axl')}</option>
              <option value="A2XL">{t('applicant.form.s1_size_a2xl')}</option>
              <option value="A3XL">{t('applicant.form.s1_size_a3xl')}</option>
            </SelectInput>
          </div>
          <div />
        </FormRow>
      </SectionCard>

      {/* Guardian 1 */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s1_primary_guardian_heading')}</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>{t('applicant.form.s1_full_name_label')}</FieldLabel>
            <TextInput value={data.g1_name} onChange={set('g1_name')} placeholder={t('applicant.form.s1_full_legal_name_placeholder')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_relationship_to_camper_label')}</FieldLabel>
            <TextInput value={data.g1_relationship} onChange={set('g1_relationship')} placeholder={t('applicant.form.s1_relationship_placeholder')} />
          </div>
        </FormRow>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.s1_home_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g1_phone_home} onChange={set('g1_phone_home')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_work_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g1_phone_work} onChange={set('g1_phone_work')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel required>{t('applicant.form.s1_cell_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g1_phone_cell} onChange={set('g1_phone_cell')} placeholder="(xxx) xxx-xxxx" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>{t('applicant.form.s1_email_label')}</FieldLabel>
          <TextInput type="email" value={data.g1_email} onChange={set('g1_email')} placeholder="email@example.com" />
        </div>
        <div>
          <FieldLabel>{t('applicant.form.s1_street_address_label')}</FieldLabel>
          <TextInput value={data.g1_address} onChange={set('g1_address')} placeholder={t('applicant.form.s1_street_address_placeholder')} />
        </div>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.city')}</FieldLabel>
            <TextInput value={data.g1_city} onChange={set('g1_city')} placeholder={t('applicant.form.city')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.state')}</FieldLabel>
            <SelectInput value={data.g1_state} onChange={set('g1_state')}>
              {STATES_US.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>{t('applicant.form.zip')}</FieldLabel>
            <TextInput value={data.g1_zip} onChange={set('g1_zip')} placeholder="00000" />
          </div>
        </FormRow>
      </SectionCard>

      {/* Guardian 2 (optional) */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s1_secondary_guardian_heading')}</SubHeading>
        <FormRow>
          <div>
            <FieldLabel>{t('applicant.form.s1_full_name_label')}</FieldLabel>
            <TextInput value={data.g2_name} onChange={set('g2_name')} placeholder={t('applicant.form.s1_full_legal_name_placeholder')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_relationship_to_camper_label')}</FieldLabel>
            <SelectInput value={data.g2_relationship} onChange={set('g2_relationship')}>
              <option value="">{t('applicant.form.s1_select_relationship')}</option>
              <option value="Parent">{t('applicant.form.s1_rel_parent')}</option>
              <option value="Foster parent">{t('applicant.form.s1_rel_foster_parent')}</option>
              <option value="Other">{t('applicant.form.s1_gender_other')}</option>
            </SelectInput>
          </div>
        </FormRow>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.s1_home_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g2_phone_home} onChange={set('g2_phone_home')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_work_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g2_phone_work} onChange={set('g2_phone_work')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_cell_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.g2_phone_cell} onChange={set('g2_phone_cell')} placeholder="(xxx) xxx-xxxx" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>{t('applicant.form.s1_email_label')}</FieldLabel>
          <TextInput type="email" value={data.g2_email} onChange={set('g2_email')} placeholder="email@example.com" />
        </div>
        <div>
          <FieldLabel>{t('applicant.form.s1_street_address_label')}</FieldLabel>
          <TextInput value={data.g2_address} onChange={set('g2_address')} placeholder={t('applicant.form.s1_g2_address_placeholder')} />
        </div>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.city')}</FieldLabel>
            <TextInput value={data.g2_city} onChange={set('g2_city')} placeholder={t('applicant.form.city')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.state')}</FieldLabel>
            <SelectInput value={data.g2_state} onChange={set('g2_state')}>
              {STATES_US.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>{t('applicant.form.zip')}</FieldLabel>
            <TextInput value={data.g2_zip} onChange={set('g2_zip')} placeholder="00000" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>{t('applicant.form.s1_primary_language_label')}</FieldLabel>
            <SelectInput value={data.g2_primary_language} onChange={set('g2_primary_language')}>
              <option value="">{t('applicant.form.s1_lang_english')}</option>
              <option value="Spanish">{t('applicant.form.s1_lang_spanish')}</option>
              <option value="Other">{t('applicant.form.s1_gender_other')}</option>
            </SelectInput>
          </div>
          <div className="flex items-center self-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.g2_interpreter}
                onChange={(e) => onChange({ g2_interpreter: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s1_interpreter_needed_label')}</span>
            </label>
          </div>
        </FormRow>
      </SectionCard>

      {/* Emergency Contact */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s1_emergency_contact_heading')}</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>{t('applicant.form.s1_full_name_label')}</FieldLabel>
            <TextInput value={data.ec_name} onChange={set('ec_name')} placeholder={t('applicant.form.s1_full_name_label')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_relationship_label')}</FieldLabel>
            <TextInput value={data.ec_relationship} onChange={set('ec_relationship')} placeholder={t('applicant.form.s1_relationship_label')} />
          </div>
        </FormRow>
        <FormRow cols={3}>
          <div>
            <FieldLabel required>{t('applicant.form.s1_cell_primary_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.ec_phone} onChange={set('ec_phone')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_home_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.ec_phone_home} onChange={set('ec_phone_home')} placeholder="(xxx) xxx-xxxx" />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s1_work_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.ec_phone_work} onChange={set('ec_phone_work')} placeholder="(xxx) xxx-xxxx" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>{t('applicant.form.s1_street_address_label')}</FieldLabel>
          <TextInput value={data.ec_address} onChange={set('ec_address')} placeholder={t('applicant.form.s1_street_address_placeholder')} />
        </div>
        <FormRow cols={3}>
          <div>
            <FieldLabel>{t('applicant.form.city')}</FieldLabel>
            <TextInput value={data.ec_city} onChange={set('ec_city')} placeholder={t('applicant.form.city')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.state')}</FieldLabel>
            <SelectInput value={data.ec_state} onChange={set('ec_state')}>
              {STATES_US.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
          <div>
            <FieldLabel>{t('applicant.form.zip')}</FieldLabel>
            <TextInput value={data.ec_zip} onChange={set('ec_zip')} placeholder="00000" />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <FieldLabel>{t('applicant.form.s1_primary_language_label')}</FieldLabel>
            <SelectInput value={data.ec_primary_language} onChange={set('ec_primary_language')}>
              <option value="">{t('applicant.form.s1_lang_english')}</option>
              <option value="Spanish">{t('applicant.form.s1_lang_spanish')}</option>
              <option value="Other">{t('applicant.form.s1_gender_other')}</option>
            </SelectInput>
          </div>
          <div className="flex items-center self-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.ec_interpreter}
                onChange={(e) => onChange({ ec_interpreter: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s1_interpreter_needed_label')}</span>
            </label>
          </div>
        </FormRow>
      </SectionCard>

      {/* Session & Language */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s1_camp_session_heading')}</SubHeading>
        {sessions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Loading available sessions…
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => {
              const selected = data.session_id === session.id;
              return (
                <label
                  key={session.id}
                  aria-label={session.name}
                  className="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all"
                  style={{
                    background: selected ? 'rgba(22,163,74,0.06)' : 'var(--card)',
                    borderColor: selected ? 'var(--ember-orange)' : 'var(--border)',
                  }}
                >
                  <input
                    type="radio"
                    checked={selected}
                    onChange={() => onChange({ session_id: session.id })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                      {session.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <Calendar className="h-3 w-3" />
                      {new Date(session.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(session.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="ml-2">{t('applicant.form.s1_spots_open', { count: session.available_spots })}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        <div className="border-t pt-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          <SubHeading>{t('applicant.form.s1_second_choice_heading')}</SubHeading>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s1_second_choice_desc')}
          </p>
          <div className="flex flex-col gap-2">
            <label
              className="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all"
              style={{
                background: data.session_id_2nd === '' ? 'rgba(22,163,74,0.06)' : 'var(--card)',
                borderColor: data.session_id_2nd === '' ? 'var(--ember-orange)' : 'var(--border)',
              }}
            >
              <input
                type="radio"
                checked={data.session_id_2nd === ''}
                onChange={() => onChange({ session_id_2nd: '' })}
                className="mt-0.5"
              />
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s1_no_second_choice')}</p>
            </label>
            {sessions.filter((s) => s.id !== data.session_id).map((session) => {
              const selected = data.session_id_2nd === session.id;
              return (
                <label
                  key={session.id}
                  htmlFor={`session-2nd-${session.id}`}
                  aria-label={session.name}
                  className="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all"
                  style={{
                    background: selected ? 'rgba(22,163,74,0.06)' : 'var(--card)',
                    borderColor: selected ? 'var(--ember-orange)' : 'var(--border)',
                  }}
                >
                  <input
                    id={`session-2nd-${session.id}`}
                    type="radio"
                    checked={selected}
                    onChange={() => onChange({ session_id_2nd: session.id })}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{session.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      <Calendar className="h-3 w-3" />
                      {new Date(session.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' – '}
                      {new Date(session.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
          <SubHeading>{t('applicant.form.s1_language_interpreter_heading')}</SubHeading>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.needs_interpreter}
              onChange={(e) => onChange({ needs_interpreter: e.target.checked })}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>
              {t('applicant.form.s1_interpreter_family_label')}
            </span>
          </label>
          {data.needs_interpreter && (
            <div className="max-w-xs">
              <FieldLabel>{t('applicant.form.preferred_language')}</FieldLabel>
              <TextInput value={data.preferred_language} onChange={set('preferred_language')} placeholder={t('applicant.form.s1_preferred_language_placeholder')} />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Health & Medical
// ---------------------------------------------------------------------------

function Section2({
  data,
  onChange,
}: {
  data: FormState['s2'];
  onChange: (patch: Partial<FormState['s2']>) => void;
}) {
  const { t } = useTranslation();

  function addDiagnosis() {
    onChange({ diagnoses: [...data.diagnoses, { condition: '', notes: '' }] });
  }

  function removeDiagnosis(i: number) {
    onChange({ diagnoses: data.diagnoses.filter((_, idx) => idx !== i) });
  }

  function updateDiagnosis(i: number, field: keyof DiagnosisEntry, value: string) {
    const updated = data.diagnoses.map((d, idx) =>
      idx === i ? { ...d, [field]: value } : d
    );
    onChange({ diagnoses: updated });
  }

  function addAllergy() {
    onChange({
      allergies: [...data.allergies, { allergen: '', reaction: '', severity: '', epi_pen: false }],
    });
  }

  function removeAllergy(i: number) {
    onChange({ allergies: data.allergies.filter((_, idx) => idx !== i) });
  }

  function updateAllergy(i: number, field: keyof Allergy, value: string | boolean) {
    const updated = data.allergies.map((a, idx) =>
      idx === i ? { ...a, [field]: value } : a
    );
    onChange({ allergies: updated });
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Insurance */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s2_insurance_heading')}</SubHeading>
        <div className="flex flex-col gap-1 mb-4">
          <FieldLabel required>{t('applicant.form.s2_insurance_type_label')}</FieldLabel>
          <div className="flex flex-col gap-1.5">
            {([
              { value: 'none',     label: t('applicant.form.s2_insurance_none') },
              { value: 'medicaid', label: t('applicant.form.s2_insurance_medicaid') },
              { value: 'other',    label: t('applicant.form.s2_insurance_other') },
            ] as const).map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--foreground)' }}>
                <input
                  type="radio"
                  name="insurance_type"
                  value={value}
                  checked={data.insurance_type === value}
                  onChange={() => onChange({
                    insurance_type: value,
                    // Clear all insurance detail fields when the type changes so
                    // stale values from the previous selection are never submitted.
                    insurance_provider: '',
                    insurance_policy: '',
                    insurance_group: '',
                    medicaid_number: '',
                  })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {/* Medicaid number — only relevant when Medicaid is selected */}
        {data.insurance_type === 'medicaid' && (
          <FormRow>
            <div>
              <FieldLabel required>{t('applicant.form.s2_medicaid_number_label')}</FieldLabel>
              <TextInput value={data.medicaid_number} onChange={(v) => onChange({ medicaid_number: v })} placeholder={t('applicant.form.s2_medicaid_number_placeholder')} />
            </div>
          </FormRow>
        )}
        {/* Provider / policy / group — only relevant for private or other insurance */}
        {data.insurance_type === 'other' && (
          <>
            <FormRow>
              <div>
                <FieldLabel required>{t('applicant.form.s2_insurance_provider_label')}</FieldLabel>
                <TextInput value={data.insurance_provider} onChange={(v) => onChange({ insurance_provider: v })} placeholder={t('applicant.form.s2_insurance_provider_placeholder')} />
              </div>
              <div>
                <FieldLabel>{t('applicant.form.s2_policy_number_label')}</FieldLabel>
                <TextInput value={data.insurance_policy} onChange={(v) => onChange({ insurance_policy: v })} placeholder={t('applicant.form.s2_policy_number_placeholder')} />
              </div>
            </FormRow>
            <FormRow>
              <div>
                <FieldLabel>{t('applicant.form.s2_group_number_label')}</FieldLabel>
                <TextInput value={data.insurance_group} onChange={(v) => onChange({ insurance_group: v })} placeholder={t('applicant.form.s2_group_number_placeholder')} />
              </div>
            </FormRow>
          </>
        )}
      </SectionCard>

      {/* Physician */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s2_physician_heading')}</SubHeading>
        <FormRow>
          <div>
            <FieldLabel required>{t('applicant.form.s2_physician_name_label')}</FieldLabel>
            <TextInput value={data.physician_name} onChange={(v) => onChange({ physician_name: v })} placeholder={t('applicant.form.s2_physician_name_placeholder')} />
          </div>
          <div>
            <FieldLabel>{t('applicant.form.s2_physician_phone_label')}</FieldLabel>
            <TextInput type="tel" value={data.physician_phone} onChange={(v) => onChange({ physician_phone: v })} placeholder="(xxx) xxx-xxxx" />
          </div>
        </FormRow>
        <div>
          <FieldLabel>{t('applicant.form.s2_practice_address_label')}</FieldLabel>
          <TextInput value={data.physician_address} onChange={(v) => onChange({ physician_address: v })} placeholder={t('applicant.form.s2_practice_address_placeholder')} />
        </div>
      </SectionCard>

      {/* Diagnoses */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>{t('applicant.form.s2_diagnoses_heading')}</SubHeading>
          <button
            type="button"
            onClick={addDiagnosis}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> {t('applicant.form.s2_add_diagnosis')}
          </button>
        </div>
        {data.diagnoses.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s2_no_diagnoses')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.diagnoses.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <FormRow>
                  <div>
                    <FieldLabel>{t('applicant.form.s2_condition_label')}</FieldLabel>
                    <TextInput value={d.condition} onChange={(v) => updateDiagnosis(i, 'condition', v)} placeholder={t('applicant.form.s2_condition_placeholder')} />
                  </div>
                  <div>
                    <FieldLabel>{t('applicant.form.notes')}</FieldLabel>
                    <TextInput value={d.notes} onChange={(v) => updateDiagnosis(i, 'notes', v)} placeholder={t('applicant.form.s2_notes_placeholder')} />
                  </div>
                </FormRow>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeDiagnosis(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> {t('applicant.form.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Allergies */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>{t('applicant.form.s2_allergies_heading')}</SubHeading>
          <button
            type="button"
            onClick={addAllergy}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> {t('applicant.form.s2_add_allergy')}
          </button>
        </div>
        {data.allergies.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s2_no_allergies')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.allergies.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <FormRow>
                  <div>
                    <FieldLabel>{t('applicant.form.s2_allergen_label')}</FieldLabel>
                    <TextInput value={a.allergen} onChange={(v) => updateAllergy(i, 'allergen', v)} placeholder={t('applicant.form.s2_allergen_placeholder')} />
                  </div>
                  <div>
                    <FieldLabel>{t('applicant.form.s2_reaction_label')}</FieldLabel>
                    <TextInput value={a.reaction} onChange={(v) => updateAllergy(i, 'reaction', v)} placeholder={t('applicant.form.s2_reaction_placeholder')} />
                  </div>
                </FormRow>
                <FormRow>
                  <div>
                    <FieldLabel>{t('applicant.form.s2_severity_label')}</FieldLabel>
                    <SelectInput value={a.severity} onChange={(v) => updateAllergy(i, 'severity', v)}>
                      <option value="">{t('applicant.form.s2_select_severity')}</option>
                      <option value="mild">{t('applicant.form.s2_severity_mild')}</option>
                      <option value="moderate">{t('applicant.form.s2_severity_moderate')}</option>
                      <option value="severe">{t('applicant.form.s2_severity_severe')}</option>
                      <option value="life-threatening">{t('applicant.form.s2_severity_life_threatening')}</option>
                    </SelectInput>
                  </div>
                  <div className="flex items-center gap-2 self-end pb-1">
                    <input
                      id={`epi_pen_${i}`}
                      type="checkbox"
                      checked={a.epi_pen}
                      onChange={(e) => updateAllergy(i, 'epi_pen', e.target.checked)}
                    />
                    <label htmlFor={`epi_pen_${i}`} className="text-sm cursor-pointer" style={{ color: 'var(--foreground)' }}>
                      {t('applicant.form.s2_epi_pen_label')}
                    </label>
                  </div>
                </FormRow>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeAllergy(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> {t('applicant.form.remove')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Seizures & Neurostimulator */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s2_seizure_heading')}</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="has_seizures"
            label={t('applicant.form.s2_has_seizures_label')}
            value={data.has_seizures}
            onChange={(v) => onChange({ has_seizures: v })}
          />
          <YesNoField
            id="has_neurostimulator"
            label={t('applicant.form.s2_has_neurostimulator_label')}
            value={data.has_neurostimulator}
            onChange={(v) => onChange({ has_neurostimulator: v })}
          />
        </div>
        {data.has_seizures === true && (
          <div className="flex flex-col gap-4 pt-2">
            <FormRow>
              <div>
                <FieldLabel>{t('applicant.form.s2_last_seizure_date_label')}</FieldLabel>
                <TextInput type="date" value={data.last_seizure_date} onChange={(v) => onChange({ last_seizure_date: v })} />
              </div>
            </FormRow>
            <div>
              <FieldLabel>{t('applicant.form.s2_seizure_description_label')}</FieldLabel>
              <TextArea value={data.seizure_description} onChange={(v) => onChange({ seizure_description: v })} placeholder={t('applicant.form.s2_seizure_description_placeholder')} />
            </div>
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs"
              style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {t('applicant.form.s2_seizure_plan_required')}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Immunizations */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s2_immunizations_heading')}</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="immunizations_current"
            label={t('applicant.form.s2_immunizations_current_label')}
            value={data.immunizations_current}
            onChange={(v) => onChange({ immunizations_current: v })}
          />
        </div>
        <div className="max-w-xs">
          <FieldLabel>{t('applicant.form.s2_tetanus_date_label')}</FieldLabel>
          <TextInput type="date" value={data.tetanus_date} onChange={(v) => onChange({ tetanus_date: v })} />
        </div>
        <div className="max-w-xs">
          <FieldLabel>{t('applicant.form.s2_medical_exam_date_label')}</FieldLabel>
          <p className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s2_medical_exam_note')}
          </p>
          <TextInput type="date" value={data.date_of_medical_exam} onChange={(v) => onChange({ date_of_medical_exam: v })} />
        </div>
        <div
          className="flex items-start gap-2 rounded-lg p-3 text-xs"
          style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
        >
          <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          {t('applicant.form.s2_immunization_cert_required')}
        </div>
      </SectionCard>

      {/* Other Health Information */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s2_other_health_heading')}</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="tubes_in_ears"
            label={t('applicant.form.s2_tubes_in_ears_label')}
            value={data.tubes_in_ears}
            onChange={(v) => onChange({ tubes_in_ears: v })}
          />
          <YesNoField
            id="has_contagious_illness"
            label={t('applicant.form.s2_contagious_illness_label')}
            value={data.has_contagious_illness}
            onChange={(v) => onChange({ has_contagious_illness: v })}
          />
          {data.has_contagious_illness === true && (
            <div className="ml-8 mt-1 mb-3">
              <FieldLabel>{t('applicant.form.s2_describe_illness_label')}</FieldLabel>
              <TextInput
                value={data.contagious_illness_description}
                onChange={(v) => onChange({ contagious_illness_description: v })}
                placeholder={t('applicant.form.s2_describe_illness_placeholder')}
              />
            </div>
          )}
          <YesNoField
            id="has_recent_illness"
            label={t('applicant.form.s2_recent_illness_label')}
            value={data.has_recent_illness}
            onChange={(v) => onChange({ has_recent_illness: v })}
          />
          {data.has_recent_illness === true && (
            <div className="ml-8 mt-1 mb-3">
              <FieldLabel>{t('applicant.form.s2_please_describe_label')}</FieldLabel>
              <TextInput
                value={data.recent_illness_description}
                onChange={(v) => onChange({ recent_illness_description: v })}
                placeholder={t('applicant.form.s2_recent_illness_placeholder')}
              />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Development & Behavior
// ---------------------------------------------------------------------------


function Section3({
  data,
  onChange,
}: {
  data: FormState['s3'];
  onChange: (patch: Partial<FormState['s3']>) => void;
}) {
  const { t } = useTranslation();

  const COMMUNICATION_METHODS = [
    t('applicant.form.dev_comm_verbal'),
    t('applicant.form.dev_comm_aac'),
    t('applicant.form.dev_comm_sign'),
    t('applicant.form.dev_comm_picture'),
    t('applicant.form.dev_comm_gestures'),
    t('applicant.form.dev_comm_written'),
    t('applicant.form.dev_comm_eye_gaze'),
  ];

  function toggleMethod(method: string) {
    const current = data.communication_methods;
    if (current.includes(method)) {
      onChange({ communication_methods: current.filter((m) => m !== method) });
    } else {
      onChange({ communication_methods: [...current, method] });
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <SectionCard>
        <SubHeading>{t('applicant.form.s3_behavioral_heading')}</SubHeading>
        <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.form.s3_behavioral_instructions')}
        </p>
        <div className="flex flex-col">
          <YesNoField id="aggression" label={t('applicant.form.s3_aggression_label')} value={data.aggression} onChange={(v) => onChange({ aggression: v })} />
          {data.aggression && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_aggression_desc_label')}</FieldLabel>
              <TextInput value={data.aggression_description} onChange={(v) => onChange({ aggression_description: v })} placeholder={t('applicant.form.s3_aggression_desc_placeholder')} />
            </div>
          )}
          <YesNoField id="self_abuse" label={t('applicant.form.s3_self_abuse_label')} value={data.self_abuse} onChange={(v) => onChange({ self_abuse: v })} />
          {data.self_abuse && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_self_abuse_desc_label')}</FieldLabel>
              <TextInput value={data.self_abuse_description} onChange={(v) => onChange({ self_abuse_description: v })} placeholder={t('applicant.form.s3_self_abuse_desc_placeholder')} />
            </div>
          )}
          <YesNoField id="wandering" label={t('applicant.form.s3_wandering_label')} value={data.wandering} onChange={(v) => onChange({ wandering: v })} />
          {data.wandering && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_wandering_desc_label')}</FieldLabel>
              <TextInput value={data.wandering_description} onChange={(v) => onChange({ wandering_description: v })} placeholder={t('applicant.form.s3_wandering_desc_placeholder')} />
            </div>
          )}
          <YesNoField id="one_to_one" label={t('applicant.form.s3_one_to_one_label')} value={data.one_to_one} onChange={(v) => onChange({ one_to_one: v })} />
          {data.one_to_one && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_one_to_one_desc_label')}</FieldLabel>
              <TextInput value={data.one_to_one_description} onChange={(v) => onChange({ one_to_one_description: v })} placeholder={t('applicant.form.s3_one_to_one_desc_placeholder')} />
            </div>
          )}
          <YesNoField id="developmental_delay" label={t('applicant.form.s3_developmental_delay_label')} value={data.developmental_delay} onChange={(v) => onChange({ developmental_delay: v })} />
          <YesNoField id="sexual_behaviors" label={t('applicant.form.s3_sexual_behaviors_label')} value={data.sexual_behaviors} onChange={(v) => onChange({ sexual_behaviors: v })} />
          {data.sexual_behaviors && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_describe_behaviors_label')}</FieldLabel>
              <TextInput value={data.sexual_behaviors_description} onChange={(v) => onChange({ sexual_behaviors_description: v })} placeholder={t('applicant.form.s3_sexual_behaviors_placeholder')} />
            </div>
          )}
          <YesNoField id="interpersonal_behavior" label={t('applicant.form.s3_interpersonal_label')} value={data.interpersonal_behavior} onChange={(v) => onChange({ interpersonal_behavior: v })} />
          {data.interpersonal_behavior && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_describe_challenges_label')}</FieldLabel>
              <TextInput value={data.interpersonal_behavior_description} onChange={(v) => onChange({ interpersonal_behavior_description: v })} placeholder={t('applicant.form.s3_interpersonal_placeholder')} />
            </div>
          )}
          <YesNoField id="social_emotional" label={t('applicant.form.s3_social_emotional_label')} value={data.social_emotional} onChange={(v) => onChange({ social_emotional: v })} />
          {data.social_emotional && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_describe_difficulties_label')}</FieldLabel>
              <TextInput value={data.social_emotional_description} onChange={(v) => onChange({ social_emotional_description: v })} placeholder={t('applicant.form.s3_social_emotional_placeholder')} />
            </div>
          )}
          <YesNoField id="follows_instructions" label={t('applicant.form.s3_follows_instructions_label')} value={data.follows_instructions} onChange={(v) => onChange({ follows_instructions: v })} />
          {data.follows_instructions && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_prompting_label')}</FieldLabel>
              <TextInput value={data.follows_instructions_description} onChange={(v) => onChange({ follows_instructions_description: v })} placeholder={t('applicant.form.s3_prompting_placeholder')} />
            </div>
          )}
          <YesNoField id="group_participation" label={t('applicant.form.s3_group_participation_label')} value={data.group_participation} onChange={(v) => onChange({ group_participation: v })} />
          {data.group_participation && (
            <div className="ml-8 mb-3">
              <FieldLabel required>{t('applicant.form.s3_participation_desc_label')}</FieldLabel>
              <TextInput value={data.group_participation_description} onChange={(v) => onChange({ group_participation_description: v })} placeholder={t('applicant.form.s3_participation_desc_placeholder')} />
            </div>
          )}
          <YesNoField id="functional_reading" label={t('applicant.form.s3_functional_reading_label')} value={data.functional_reading} onChange={(v) => onChange({ functional_reading: v })} />
          <YesNoField id="functional_writing" label={t('applicant.form.s3_functional_writing_label')} value={data.functional_writing} onChange={(v) => onChange({ functional_writing: v })} />
          <YesNoField id="independent_mobility" label={t('applicant.form.s3_independent_mobility_label')} value={data.independent_mobility} onChange={(v) => onChange({ independent_mobility: v })} />
          <YesNoField id="verbal_communication" label={t('applicant.form.s3_verbal_communication_label')} value={data.verbal_communication} onChange={(v) => onChange({ verbal_communication: v })} />
          <YesNoField id="social_skills" label={t('applicant.form.s3_social_skills_label')} value={data.social_skills} onChange={(v) => onChange({ social_skills: v })} />
          <YesNoField id="behavior_plan" label={t('applicant.form.s3_behavior_plan_label')} value={data.behavior_plan} onChange={(v) => onChange({ behavior_plan: v })} />
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s3_school_attendance_heading')}</SubHeading>
        <div className="flex flex-col">
          <YesNoField
            id="attends_school"
            label={t('applicant.form.s3_attends_school_label')}
            value={data.attends_school}
            onChange={(v) => onChange({ attends_school: v })}
          />
          {data.attends_school === true && (
            <div className="ml-8 mt-1 mb-3">
              <FieldLabel>{t('applicant.form.s3_classroom_type_label')}</FieldLabel>
              <SelectInput value={data.classroom_type} onChange={(v) => onChange({ classroom_type: v })}>
                <option value="">{t('applicant.form.s3_select_type')}</option>
                <option value="General education">{t('applicant.form.s3_class_general')}</option>
                <option value="Resource room">{t('applicant.form.s3_class_resource')}</option>
                <option value="Self-contained">{t('applicant.form.s3_class_self_contained')}</option>
                <option value="Life skills">{t('applicant.form.s3_class_life_skills')}</option>
                <option value="Home school">{t('applicant.form.s3_class_home_school')}</option>
                <option value="Other">{t('applicant.form.s1_gender_other')}</option>
              </SelectInput>
            </div>
          )}
        </div>
        <div className="mt-2">
          <FieldLabel>{t('applicant.form.s3_functional_age_label')}</FieldLabel>
          <TextInput
            value={data.functional_age_level}
            onChange={(v) => onChange({ functional_age_level: v })}
            placeholder={t('applicant.form.s3_functional_age_placeholder')}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s3_comm_methods_heading')}</SubHeading>
        <div className="flex flex-wrap gap-2">
          {COMMUNICATION_METHODS.map((m) => {
            const active = data.communication_methods.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className="px-3 py-1.5 text-xs rounded-full border font-medium transition-all"
                style={{
                  background: active ? 'rgba(22,163,74,0.12)' : 'var(--card)',
                  borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
                  color: active ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s3_behavior_notes_heading')}</SubHeading>
        <TextArea
          value={data.behavior_notes}
          onChange={(v) => onChange({ behavior_notes: v })}
          placeholder={t('applicant.form.s3_behavior_notes_placeholder')}
          rows={4}
        />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Equipment & Mobility
// ---------------------------------------------------------------------------

function Section4({
  data,
  onChange,
}: {
  data: FormState['s4'];
  onChange: (patch: Partial<FormState['s4']>) => void;
}) {
  const { t } = useTranslation();

  const DEVICE_TYPES = [
    t('applicant.form.device_wheelchair_manual'),
    t('applicant.form.device_wheelchair_power'),
    t('applicant.form.device_walker'),
    t('applicant.form.device_crutches'),
    t('applicant.form.device_cane'),
    t('applicant.form.device_leg_brace'),
    t('applicant.form.device_cpap'),
    t('applicant.form.device_hearing_aid'),
    t('applicant.form.device_cochlear'),
    t('applicant.form.device_glasses'),
    t('applicant.form.device_prosthetic'),
    t('applicant.form.device_orthotics'),
    t('applicant.form.device_comm_device'),
    t('applicant.form.device_gait_trainer'),
    t('applicant.form.s1_gender_other'),
  ];

  function addDevice() {
    onChange({ devices: [...data.devices, { device_type: '', requires_transfer: false, notes: '' }] });
  }

  function removeDevice(i: number) {
    onChange({ devices: data.devices.filter((_, idx) => idx !== i) });
  }

  function updateDevice(i: number, field: keyof DeviceEntry, value: string | boolean) {
    const updated = data.devices.map((d, idx) =>
      idx === i ? { ...d, [field]: value } : d
    );
    onChange({ devices: updated });
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <SectionCard>
        <div className="flex items-center justify-between">
          <SubHeading>{t('applicant.form.s4_devices_heading')}</SubHeading>
          <button
            type="button"
            onClick={addDevice}
            className="flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3 w-3" /> {t('applicant.form.s4_add_device')}
          </button>
        </div>
        {data.devices.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s4_no_devices')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.devices.map((d, i) => (
              <div
                key={i}
                className="rounded-xl border p-3.5 flex flex-col gap-3"
                style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
              >
                <div>
                  <FieldLabel>{t('applicant.form.s4_device_type_label')}</FieldLabel>
                  <SelectInput value={d.device_type} onChange={(v) => updateDevice(i, 'device_type', v)}>
                    <option value="">{t('applicant.form.s3_select_type')}</option>
                    {DEVICE_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>{t('applicant.form.s4_device_notes_label')}</FieldLabel>
                  <TextInput value={d.notes} onChange={(v) => updateDevice(i, 'notes', v)} placeholder={t('applicant.form.s2_notes_placeholder')} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.requires_transfer}
                      onChange={(e) => updateDevice(i, 'requires_transfer', e.target.checked)}
                    />
                    <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                      {t('applicant.form.s4_requires_transfer_label')}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeDevice(i)}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--destructive)' }}
                  >
                    <Trash2 className="h-3 w-3" /> {t('applicant.form.remove')}
                  </button>
                </div>
                {d.device_type.includes('CPAP') && (
                  <div
                    className="flex items-start gap-2 rounded-lg p-3 text-xs"
                    style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    {t('applicant.form.s4_cpap_waiver_required')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s4_mobility_notes_heading')}</SubHeading>
        <TextArea
          value={data.mobility_notes}
          onChange={(v) => onChange({ mobility_notes: v })}
          placeholder={t('applicant.form.s4_mobility_notes_placeholder')}
          rows={3}
        />
      </SectionCard>

      <SectionCard>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 flex-shrink-0"
            checked={data.section_reviewed}
            onChange={(e) => onChange({ section_reviewed: e.target.checked })}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s4_section_reviewed_label')}
          </span>
        </label>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5 — Diet & Feeding
// ---------------------------------------------------------------------------

function Section5({
  data,
  onChange,
}: {
  data: FormState['s5'];
  onChange: (patch: Partial<FormState['s5']>) => void;
}) {
  const { t } = useTranslation();

  const TEXTURE_LEVELS = [
    t('applicant.form.s5_texture_regular'),
    t('applicant.form.s5_texture_minced_moist'),
    t('applicant.form.s5_texture_minced'),
    t('applicant.form.s5_texture_pureed'),
    t('applicant.form.s5_texture_liquidised'),
    t('applicant.form.s5_texture_thin_liquids'),
    t('applicant.form.s5_texture_slightly_thick'),
    t('applicant.form.s5_texture_mildly_thick'),
    t('applicant.form.s5_texture_moderately_thick'),
    t('applicant.form.s5_texture_extremely_thick'),
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Special Diet */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s5_dietary_heading')}</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.special_diet}
            onChange={(e) => onChange({ special_diet: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s5_special_diet_label')}
          </span>
        </label>
        {data.special_diet && (
          <div>
            <FieldLabel required>{t('applicant.form.s5_describe_diet_label')}</FieldLabel>
            <TextArea
              value={data.diet_description}
              onChange={(v) => onChange({ diet_description: v })}
              placeholder={t('applicant.form.s5_describe_diet_placeholder')}
              rows={3}
            />
          </div>
        )}
      </SectionCard>

      {/* Texture & Fluid */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s5_texture_heading')}</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.texture_modified}
            onChange={(e) => onChange({ texture_modified: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s5_texture_modified_label')}
          </span>
        </label>
        {data.texture_modified && (
          <div className="max-w-xs">
            <FieldLabel>{t('applicant.form.s5_texture_level_label')}</FieldLabel>
            <SelectInput value={data.texture_level} onChange={(v) => onChange({ texture_level: v })}>
              <option value="">{t('applicant.form.s5_select_texture')}</option>
              {TEXTURE_LEVELS.map((tl) => <option key={tl} value={tl}>{tl}</option>)}
            </SelectInput>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={data.fluid_restriction}
            onChange={(e) => onChange({ fluid_restriction: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s5_fluid_restriction_label')}
          </span>
        </label>
        {data.fluid_restriction && (
          <div>
            <FieldLabel>{t('applicant.form.s5_details_label')}</FieldLabel>
            <TextInput value={data.fluid_details} onChange={(v) => onChange({ fluid_details: v })} placeholder={t('applicant.form.s5_fluid_details_placeholder')} />
          </div>
        )}
      </SectionCard>

      {/* G-Tube */}
      <SectionCard>
        <SubHeading>{t('applicant.form.s5_gtube_heading')}</SubHeading>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.g_tube}
            onChange={(e) => onChange({ g_tube: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s5_gtube_label')}
          </span>
        </label>
        {data.g_tube && (
          <div className="flex flex-col gap-4 pt-1">
            <FormRow>
              <div>
                <FieldLabel required>{t('applicant.form.s5_formula_label')}</FieldLabel>
                <TextInput value={data.formula} onChange={(v) => onChange({ formula: v })} placeholder={t('applicant.form.s5_formula_placeholder')} />
              </div>
              <div>
                <FieldLabel required>{t('applicant.form.s5_amount_per_feeding_label')}</FieldLabel>
                <TextInput value={data.amount_per_feeding} onChange={(v) => onChange({ amount_per_feeding: v })} placeholder={t('applicant.form.s5_amount_per_feeding_placeholder')} />
              </div>
            </FormRow>
            <FormRow>
              <div>
                <FieldLabel>{t('applicant.form.s5_feedings_per_day_label')}</FieldLabel>
                <TextInput value={data.feedings_per_day} onChange={(v) => onChange({ feedings_per_day: v })} placeholder={t('applicant.form.s5_feedings_per_day_placeholder')} />
              </div>
              <div>
                <FieldLabel>{t('applicant.form.s5_feeding_times_label')}</FieldLabel>
                <TextInput value={data.feeding_times} onChange={(v) => onChange({ feeding_times: v })} placeholder={t('applicant.form.s5_feeding_times_placeholder')} />
              </div>
            </FormRow>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.bolus_only}
                onChange={(e) => onChange({ bolus_only: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s5_bolus_only_label')}</span>
            </label>
            <div
              className="flex items-start gap-2 rounded-lg p-3 text-xs"
              style={{ background: 'rgba(251,191,36,0.10)', color: '#92400e', border: '1px solid rgba(251,191,36,0.30)' }}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {t('applicant.form.s5_gtube_plan_required')}
            </div>
          </div>
        )}
        <div>
          <FieldLabel>{t('applicant.form.s5_feeding_notes_label')}</FieldLabel>
          <TextArea
            value={data.feeding_notes}
            onChange={(v) => onChange({ feeding_notes: v })}
            placeholder={t('applicant.form.s5_feeding_notes_placeholder')}
            rows={2}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 flex-shrink-0"
            checked={data.section_reviewed}
            onChange={(e) => onChange({ section_reviewed: e.target.checked })}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s5_section_reviewed_label')}
          </span>
        </label>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Section 6 — Personal Care
// ---------------------------------------------------------------------------

// ASSISTANCE_LEVELS is kept module-level with English labels; AssistanceLevelSelect
// has its own useTranslation call so the displayed labels update on language change.

function AssistanceLevelSelect({
  id,
  label,
  value,
  onChange,
  notes,
  onNotesChange,
  notesPlaceholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  notesPlaceholder?: string;
}) {
  const { t } = useTranslation();

  // Values match the backend StorePersonalCarePlanRequest `in:` constraint:
  // independent | verbal_cue | physical_assist | full_assist
  const ASSISTANCE_LEVELS = [
    { value: 'independent',    label: t('applicant.form.s6_level_independent') },
    { value: 'verbal_cue',     label: t('applicant.form.s6_level_verbal_cue') },
    { value: 'physical_assist', label: t('applicant.form.s6_level_physical_assist') },
    { value: 'full_assist',    label: t('applicant.form.s6_level_full_assist') },
  ];

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</p>
      <div className="flex gap-2 flex-wrap">
        {ASSISTANCE_LEVELS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="px-3 py-1.5 text-xs rounded-full border font-medium transition-all"
              style={{
                background: active ? 'rgba(22,163,74,0.12)' : 'var(--input)',
                borderColor: active ? 'var(--ember-orange)' : 'var(--border)',
                color: active ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              }}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {value && (
        <TextInput
          id={`${id}_notes`}
          value={notes}
          onChange={onNotesChange}
          placeholder={notesPlaceholder ?? t('applicant.form.s6_notes_staff_placeholder')}
        />
      )}
    </div>
  );
}

function Section6({
  data,
  onChange,
}: {
  data: FormState['s6'];
  onChange: (patch: Partial<FormState['s6']>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 p-8">
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
      >
        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        {t('applicant.form.s6_instructions')}
      </div>

      <AssistanceLevelSelect
        id="bathing"
        label={t('applicant.form.s6_bathing_label')}
        value={data.bathing_level}
        onChange={(v) => onChange({ bathing_level: v })}
        notes={data.bathing_notes}
        onNotesChange={(v) => onChange({ bathing_notes: v })}
        notesPlaceholder={t('applicant.form.s6_bathing_placeholder')}
      />

      <AssistanceLevelSelect
        id="toileting"
        label={t('applicant.form.s6_toileting_label')}
        value={data.toileting_level}
        onChange={(v) => onChange({ toileting_level: v })}
        notes={data.toileting_notes}
        onNotesChange={(v) => onChange({ toileting_notes: v })}
        notesPlaceholder={t('applicant.form.s6_toileting_placeholder')}
      />

      <SectionCard>
        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s6_nighttime_toileting_label')}</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.nighttime_toileting}
            onChange={(e) => onChange({ nighttime_toileting: e.target.checked })}
          />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s6_nighttime_help_label')}
          </span>
        </label>
        {data.nighttime_toileting && (
          <TextInput
            value={data.nighttime_notes}
            onChange={(v) => onChange({ nighttime_notes: v })}
            placeholder={t('applicant.form.s6_nighttime_notes_placeholder')}
          />
        )}
      </SectionCard>

      <AssistanceLevelSelect
        id="dressing"
        label={t('applicant.form.s6_dressing_label')}
        value={data.dressing_level}
        onChange={(v) => onChange({ dressing_level: v })}
        notes={data.dressing_notes}
        onNotesChange={(v) => onChange({ dressing_notes: v })}
        notesPlaceholder={t('applicant.form.s6_dressing_placeholder')}
      />

      <AssistanceLevelSelect
        id="oral_hygiene"
        label={t('applicant.form.s6_oral_hygiene_label')}
        value={data.oral_hygiene_level}
        onChange={(v) => onChange({ oral_hygiene_level: v })}
        notes={data.oral_hygiene_notes}
        onNotesChange={(v) => onChange({ oral_hygiene_notes: v })}
        notesPlaceholder={t('applicant.form.s6_oral_hygiene_placeholder')}
      />

      <SectionCard>
        <SubHeading>{t('applicant.form.s6_positioning_heading')}</SubHeading>
        <TextArea
          value={data.positioning_notes}
          onChange={(v) => onChange({ positioning_notes: v })}
          placeholder={t('applicant.form.s6_positioning_placeholder')}
          rows={3}
        />
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s6_sleep_heading')}</SubHeading>
        <TextArea
          value={data.sleep_notes}
          onChange={(v) => onChange({ sleep_notes: v })}
          placeholder={t('applicant.form.s6_sleep_placeholder')}
          rows={3}
        />
        <div className="mt-4 flex flex-col gap-2.5">
          {([
            ['falling_asleep_issues', t('applicant.form.s6_falling_asleep_label')],
            ['sleep_walking',         t('applicant.form.s6_sleep_walking_label')],
            ['night_wandering',       t('applicant.form.s6_night_wandering_label')],
            ['urinary_catheter',      t('applicant.form.s6_urinary_catheter_label')],
            ['menstruation_support',  t('applicant.form.s6_menstruation_label')],
          ] as [keyof FormState['s6'], string][]).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data[field] as boolean}
                onChange={(e) => onChange({ [field]: e.target.checked } as Partial<FormState['s6']>)}
              />
              <span className="text-sm" style={{ color: 'var(--foreground)' }}>{label}</span>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SubHeading>{t('applicant.form.s6_bowel_heading')}</SubHeading>
        <TextArea
          value={data.bowel_control_notes}
          onChange={(v) => onChange({ bowel_control_notes: v })}
          placeholder={t('applicant.form.s6_bowel_placeholder')}
          rows={3}
        />
        <div className="flex flex-col mt-3">
          <label className="flex items-center gap-2 cursor-pointer py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <input
              type="checkbox"
              checked={data.irregular_bowel}
              onChange={(e) => onChange({ irregular_bowel: e.target.checked })}
            />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s6_irregular_bowel_label')}</span>
          </label>
          {data.irregular_bowel && (
            <div className="mt-2">
              <FieldLabel>{t('applicant.form.s6_irregular_bowel_desc_label')}</FieldLabel>
              <TextInput
                value={data.irregular_bowel_notes}
                onChange={(v) => onChange({ irregular_bowel_notes: v })}
                placeholder={t('applicant.form.s6_irregular_bowel_placeholder')}
              />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 9 (display) — Narratives
// ---------------------------------------------------------------------------

// String-only narrative keys; excludes the boolean section_reviewed flag so
// TypeScript knows data[key] is always a string when iterating questions.
type NarrativeTextKey = Exclude<keyof FormState['sn'], 'section_reviewed'>;

function SectionNarratives({
  data,
  onChange,
}: {
  data: FormState['sn'];
  onChange: (patch: Partial<FormState['sn']>) => void;
}) {
  const { t } = useTranslation();

  const NARRATIVE_QUESTIONS: { key: NarrativeTextKey; label: string; placeholder: string }[] = [
    {
      key: 'narrative_rustic_environment',
      label: t('applicant.form.sn_rustic_label'),
      placeholder: t('applicant.form.sn_rustic_placeholder'),
    },
    {
      key: 'narrative_staff_suggestions',
      label: t('applicant.form.sn_staff_suggestions_label'),
      placeholder: t('applicant.form.sn_staff_suggestions_placeholder'),
    },
    {
      key: 'narrative_participation_concerns',
      label: t('applicant.form.sn_participation_label'),
      placeholder: t('applicant.form.sn_participation_placeholder'),
    },
    {
      key: 'narrative_camp_benefit',
      label: t('applicant.form.sn_camp_benefit_label'),
      placeholder: t('applicant.form.sn_camp_benefit_placeholder'),
    },
    {
      key: 'narrative_heat_tolerance',
      label: t('applicant.form.sn_heat_label'),
      placeholder: t('applicant.form.sn_heat_placeholder'),
    },
    {
      key: 'narrative_transportation',
      label: t('applicant.form.sn_transportation_label'),
      placeholder: t('applicant.form.sn_transportation_placeholder'),
    },
    {
      key: 'narrative_additional_info',
      label: t('applicant.form.sn_additional_info_label'),
      placeholder: t('applicant.form.sn_additional_info_placeholder'),
    },
    {
      key: 'narrative_emergency_protocols',
      label: t('applicant.form.sn_emergency_protocols_label'),
      placeholder: t('applicant.form.sn_emergency_protocols_placeholder'),
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
      >
        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        {t('applicant.form.sn_instructions')}
      </div>
      {NARRATIVE_QUESTIONS.map(({ key, label, placeholder }) => (
        <SectionCard key={key}>
          <SubHeading>{label}</SubHeading>
          <TextArea
            value={data[key]}
            onChange={(v) => onChange({ [key]: v })}
            placeholder={placeholder}
            rows={4}
          />
        </SectionCard>
      ))}

      {/* Explicit review acknowledgment — required to mark this section complete.
          All narrative fields are optional, so without this checkbox there is no
          signal distinguishing "reviewed, nothing to add" from "never opened". */}
      <label
        className="flex items-start gap-3 cursor-pointer select-none rounded-xl border p-4"
        style={{
          background: data.section_reviewed ? 'rgba(22,163,74,0.06)' : 'var(--card)',
          borderColor: data.section_reviewed ? 'rgba(22,163,74,0.30)' : 'var(--border)',
        }}
      >
        <input
          type="checkbox"
          className="mt-0.5 flex-shrink-0"
          checked={data.section_reviewed}
          onChange={(e) => onChange({ section_reviewed: e.target.checked })}
        />
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {t('applicant.form.sn_section_reviewed_label')}
        </span>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 7 — Activities & Permissions
// ---------------------------------------------------------------------------

type ActivityLevel = 'yes' | 'no' | 'restricted' | '';

interface ActivityDef {
  key: keyof FormState['s7'];
  label: string;
  description: string;
}

// Activities match the official CYSHCN application form (0717-ENG-DPH §9)
const ACTIVITIES: ActivityDef[] = [
  {
    key: 'sports_games',
    label: 'Sports & Games',
    description: 'Includes adapted sports, ball games, and cooperative group activities.',
  },
  {
    key: 'arts_crafts',
    label: 'Arts & Crafts',
    description: 'Includes painting, sculpture, sensory art, and creative workshops.',
  },
  {
    key: 'nature',
    label: 'Nature Activities',
    description: 'Includes outdoor exploration, nature walks, and environmental education.',
  },
  {
    key: 'fine_arts',
    label: 'Fine Arts',
    description: 'Includes music, drama, dance, and performing arts programs.',
  },
  {
    key: 'swimming',
    label: 'Swimming',
    description: 'Includes pool swimming and water-based recreational activities.',
  },
  {
    key: 'boating',
    label: 'Boating',
    description: 'Includes canoe, kayak, and supervised watercraft activities.',
  },
  {
    key: 'camp_out',
    label: 'Camp Out',
    description: 'Overnight outdoor camping with tents or shelters away from main facilities.',
  },
];

function ActivityRow({
  activity,
  data,
  onChange,
}: {
  activity: ActivityDef;
  data: { level: string; notes: string };
  onChange: (patch: { level?: string; notes?: string }) => void;
}) {
  const level = data.level as ActivityLevel;

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{
        background: 'var(--card)',
        borderColor: level === 'no' ? 'rgba(220,38,38,0.20)' : level === 'yes' ? 'rgba(22,163,74,0.15)' : 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{activity.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{activity.description}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(['yes', 'restricted', 'no'] as ActivityLevel[]).map((opt) => {
            if (!opt) return null;
            const active = level === opt;
            const colors: Record<string, { bg: string; border: string; text: string }> = {
              yes:        { bg: 'rgba(22,163,74,0.12)',  border: 'var(--ember-orange)', text: 'var(--ember-orange)' },
              restricted: { bg: 'rgba(251,191,36,0.12)', border: '#d97706',             text: '#d97706' },
              no:         { bg: 'rgba(220,38,38,0.08)',  border: 'var(--destructive)',  text: 'var(--destructive)' },
            };
            const c = colors[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange({ level: opt })}
                className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all capitalize"
                style={{
                  background: active ? c.bg : 'var(--input)',
                  borderColor: active ? c.border : 'var(--border)',
                  color: active ? c.text : 'var(--muted-foreground)',
                }}
                aria-pressed={active}
              >
                {opt === 'restricted' ? 'With limits' : opt === 'yes' ? 'Permitted' : 'Not permitted'}
              </button>
            );
          })}
        </div>
      </div>
      {(level === 'restricted' || level === 'no') && (
        <div>
          <FieldLabel>{level === 'restricted' ? 'Describe limitations or required accommodations' : 'Reason (optional)'}</FieldLabel>
          <TextArea
            value={data.notes}
            onChange={(v) => onChange({ notes: v })}
            placeholder={
              level === 'restricted'
                ? 'e.g. May swim in shallow end only with 1:1 ratio, must wear life vest at all times'
                : 'e.g. Medical contraindication due to seizure history'
            }
            rows={2}
          />
        </div>
      )}
    </div>
  );
}

function Section7({
  data,
  onChange,
}: {
  data: FormState['s7'];
  onChange: (patch: Partial<FormState['s7']>) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div
        className="flex items-start gap-2 rounded-lg p-3 text-xs"
        style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)', border: '1px solid rgba(22,163,74,0.20)' }}
      >
        <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        For each activity, select whether your camper may participate fully, with limitations, or not at all. "With limits" requires a description.
      </div>

      {ACTIVITIES.map((activity) => {
        const key = activity.key;
        return (
          <ActivityRow
            key={key}
            activity={activity}
            data={data[key] as { level: string; notes: string }}
            onChange={(patch) =>
              onChange({
                [key]: { ...(data[key] as object), ...patch },
              } as Partial<FormState['s7']>)
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 8 — Medications
// ---------------------------------------------------------------------------

// MEDICATION_ROUTES and MEDICATION_FREQUENCIES are English-only clinical terms;
// they are kept as-is since medical route/frequency labels are internationally standardized.

function newMedication(): MedicationEntry {
  return {
    id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '', dosage: '', frequency: '', route: '', reason: '',
    physician: '', self_admin: false, refrigeration: false, notes: '',
  };
}

function Section8({ data, onChange }: {
  data: FormState['s8'];
  onChange: (patch: Partial<FormState['s8']>) => void;
}) {
  const { t } = useTranslation();

  const MEDICATION_ROUTES = ['Oral', 'Injectable', 'Topical', 'Inhaled', 'Transdermal', 'Nasal', 'Optic', 'Otic', 'Rectal', 'Other'];
  const MEDICATION_FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'As needed (PRN)', 'Weekly', 'Other'];

  function addMed() {
    onChange({ medications: [...data.medications, newMedication()] });
  }

  function removeMed(id: string) {
    onChange({ medications: data.medications.filter((m) => m.id !== id) });
  }

  function updateMed(id: string, patch: Partial<MedicationEntry>) {
    onChange({
      medications: data.medications.map((m) => m.id === id ? { ...m, ...patch } : m),
    });
  }

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* No medications checkbox */}
      <label aria-label={t('applicant.form.s8_no_medications_label')} className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          className="w-4 h-4 rounded"
          checked={data.no_medications}
          onChange={(e) => onChange({ no_medications: e.target.checked, medications: e.target.checked ? [] : data.medications })}
        />
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s8_no_medications_label')}
          </span>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s8_no_medications_desc')}
          </p>
        </div>
      </label>

      {!data.no_medications && (
        <>
          {data.medications.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.form.s8_no_meds_added')}
            </p>
          )}

          {data.medications.map((med, idx) => (
            <div
              key={med.id}
              className="rounded-xl border p-4 flex flex-col gap-3"
              style={{ borderColor: 'var(--border)', background: 'var(--glass-light, #fafafa)' }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--ember-orange)' }}>
                  {t('applicant.form.s8_medication_label', { num: idx + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => removeMed(med.id)}
                  className="p-1 rounded hover:bg-red-50 transition-colors"
                  style={{ color: 'var(--destructive)' }}
                  title="Remove medication"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Row 1: name + dosage */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`med-name-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_med_name_label')}
                  </label>
                  <TextInput
                    id={`med-name-${med.id}`}
                    placeholder={t('applicant.form.s8_med_name_placeholder')}
                    value={med.name}
                    onChange={(v) => updateMed(med.id, { name: v })}
                  />
                </div>
                <div>
                  <label htmlFor={`med-dosage-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_dosage_label')}
                  </label>
                  <TextInput
                    id={`med-dosage-${med.id}`}
                    placeholder={t('applicant.form.s8_dosage_placeholder')}
                    value={med.dosage}
                    onChange={(v) => updateMed(med.id, { dosage: v })}
                  />
                </div>
              </div>

              {/* Row 2: frequency + route */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`med-frequency-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_frequency_label')}
                  </label>
                  <SelectInput id={`med-frequency-${med.id}`} value={med.frequency} onChange={(v) => updateMed(med.id, { frequency: v })}>
                    <option value="">{t('applicant.form.s8_select_frequency')}</option>
                    {MEDICATION_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </SelectInput>
                </div>
                <div>
                  <label htmlFor={`med-route-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_route_label')}
                  </label>
                  <SelectInput id={`med-route-${med.id}`} value={med.route} onChange={(v) => updateMed(med.id, { route: v })}>
                    <option value="">{t('applicant.form.s8_select_route')}</option>
                    {MEDICATION_ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </SelectInput>
                </div>
              </div>

              {/* Row 3: reason + prescribing physician */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`med-reason-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_reason_label')}
                  </label>
                  <TextInput
                    id={`med-reason-${med.id}`}
                    placeholder={t('applicant.form.s8_reason_placeholder')}
                    value={med.reason}
                    onChange={(v) => updateMed(med.id, { reason: v })}
                  />
                </div>
                <div>
                  <label htmlFor={`med-physician-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                    {t('applicant.form.s8_physician_label')}
                  </label>
                  <TextInput
                    id={`med-physician-${med.id}`}
                    placeholder={t('applicant.form.s8_physician_placeholder')}
                    value={med.physician}
                    onChange={(v) => updateMed(med.id, { physician: v })}
                  />
                </div>
              </div>

              {/* Flags */}
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded"
                    checked={med.self_admin}
                    onChange={(e) => updateMed(med.id, { self_admin: e.target.checked })}
                  />
                  <span className="text-xs" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s8_self_admin_label')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded"
                    checked={med.refrigeration}
                    onChange={(e) => updateMed(med.id, { refrigeration: e.target.checked })}
                  />
                  <span className="text-xs" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s8_refrigeration_label')}</span>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor={`med-notes-${med.id}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  {t('applicant.form.s8_admin_notes_label')}
                </label>
                <TextArea
                  id={`med-notes-${med.id}`}
                  placeholder={t('applicant.form.s8_admin_notes_placeholder')}
                  value={med.notes}
                  onChange={(v) => updateMed(med.id, { notes: v })}
                  rows={2}
                />
              </div>
            </div>
          ))}

          <Button variant="secondary" size="sm" onClick={addMed} className="self-start">
            <Plus className="h-3.5 w-3.5" />
            {t('applicant.form.s8_add_medication')}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 9 — Required Documents
// ---------------------------------------------------------------------------

// DOC_DEFS is built inside Section9 with t() so labels/descriptions translate on language change.

function DocumentUploader({
  docKey,
  label,
  description,
  required,
  accept,
  slot,
  onSelect,
  onRemove,
}: {
  docKey: string;
  label: string;
  description: string;
  required: boolean;
  accept: string;
  slot: DocSlot;
  onSelect: (key: string, file: File, slot: DocSlot) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        borderColor: slot ? 'rgba(22,163,74,0.35)' : 'var(--border)',
        background: slot ? 'rgba(22,163,74,0.03)' : 'var(--glass-light, #fafafa)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</span>
            {required ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}>{t('applicant.form.s9_required_badge')}</span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass-medium, #f3f4f6)', color: 'var(--muted-foreground)' }}>{t('applicant.form.s9_conditional_badge')}</span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{description}</p>
        </div>
        {slot && (
          <button
            type="button"
            onClick={() => onRemove(docKey)}
            className="p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
            style={{ color: 'var(--destructive)' }}
            title="Remove document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {slot ? (
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
          <span className="text-xs truncate" style={{ color: 'var(--foreground)' }}>{slot.file_name}</span>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
            ({(slot.size / 1024).toFixed(0)} KB)
          </span>
        </div>
      ) : (
        /* relative + overflow-hidden keep the opacity-0 file input pinned inside
           the label bounds — avoids the scroll-to-element bleed caused by sr-only's
           position:absolute escaping to <main> when the file picker is triggered. */
        <label
          className="relative flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed transition-colors hover:bg-[var(--dash-nav-hover-bg)] self-start overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          <Upload className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{t('applicant.form.s9_choose_file')}</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('applicant.form.s9_accepted_formats')}</span>
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              onSelect(docKey, file, { file_name: file.name, size: file.size, mime: file.type });
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}

function Section9({
  data,
  hasCpap,
  hasSeizures,
  hasGtube,
  onChange,
  onFileSelect,
}: {
  data: FormState['s9'];
  hasCpap: boolean;
  hasSeizures: boolean;
  hasGtube: boolean;
  onChange: (patch: Partial<FormState['s9']>) => void;
  onFileSelect: (key: string, file: File, slot: DocSlot) => void;
}) {
  const { t } = useTranslation();

  const DOC_DEFS: {
    key: keyof FormState['s9'];
    label: string;
    description: string;
    required: boolean;
    accept: string;
  }[] = [
    { key: 'immunization',   label: t('applicant.form.s9_doc_immunization_label'),   description: t('applicant.form.s9_doc_immunization_desc'),   required: true,  accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'medical_exam',   label: t('applicant.form.s9_doc_medical_exam_label'),   description: t('applicant.form.s9_doc_medical_exam_desc'),   required: true,  accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'insurance_card', label: t('applicant.form.s9_doc_insurance_card_label'), description: t('applicant.form.s9_doc_insurance_card_desc'), required: true,  accept: '.pdf,.jpg,.jpeg,.png' },
    { key: 'cpap_waiver',    label: t('applicant.form.s9_doc_cpap_waiver_label'),    description: t('applicant.form.s9_doc_cpap_waiver_desc'),    required: false, accept: '.pdf' },
    { key: 'seizure_plan',   label: t('applicant.form.s9_doc_seizure_plan_label'),   description: t('applicant.form.s9_doc_seizure_plan_desc'),   required: false, accept: '.pdf' },
    { key: 'gtube_plan',     label: t('applicant.form.s9_doc_gtube_plan_label'),     description: t('applicant.form.s9_doc_gtube_plan_desc'),     required: false, accept: '.pdf' },
  ];

  const conditionalFlags: Record<string, boolean> = {
    cpap_waiver: hasCpap,
    seizure_plan: hasSeizures,
    gtube_plan: hasGtube,
  };

  const visibleDocs = DOC_DEFS.filter((d) =>
    d.required || conditionalFlags[d.key]
  );

  function handleRemove(key: string) {
    onChange({ [key]: null } as Partial<FormState['s9']>);
  }

  function handleSelect(key: string, file: File, slot: DocSlot) {
    onFileSelect(key, file, slot);
    onChange({ [key]: slot } as Partial<FormState['s9']>);
  }

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Info banner */}
      <div
        className="rounded-xl px-4 py-3 flex gap-3"
        style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)' }}
      >
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s9_docs_required_title')}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {t('applicant.form.s9_docs_required_desc')}
          </p>
        </div>
      </div>

      {visibleDocs.map((doc) => (
        <DocumentUploader
          key={doc.key}
          docKey={doc.key}
          label={doc.label}
          description={doc.description}
          required={doc.required}
          accept={doc.accept}
          slot={data[doc.key]}
          onSelect={handleSelect}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 10 — Consents & Signatures
// ---------------------------------------------------------------------------

const CONSENT_DEFS: { key: keyof Pick<FormState['s10'], 'consent_general'|'consent_medical'|'consent_photo'|'consent_liability'|'consent_permission_activities'|'consent_medication'|'consent_hipaa'>; title: string; body: string }[] = [
  {
    key: 'consent_general',
    title: 'General Consent',
    body: 'I hereby give consent for my child to participate in the Camp Burnt Gin program. I certify that all information provided in this application is accurate and complete to the best of my knowledge. I understand that incomplete or inaccurate information may affect my child\'s ability to attend camp.',
  },
  {
    key: 'consent_medical',
    title: 'Medical Treatment Authorization',
    body: 'I authorize Camp Burnt Gin and its staff to seek and consent to emergency medical, dental, surgical, or hospital care for my child if I cannot be reached in time. I understand that every effort will be made to contact me before medical treatment is administered.',
  },
  {
    key: 'consent_photo',
    title: 'Photo & Media Release',
    body: 'I grant Camp Burnt Gin permission to photograph and/or record my child during camp activities. These images may be used in camp publications, website, social media, and promotional materials. No personally identifying information will be shared without additional consent.',
  },
  {
    key: 'consent_liability',
    title: 'Liability Waiver & Release',
    body: 'I acknowledge that participation in camp activities involves inherent risks. I voluntarily assume these risks and release Camp Burnt Gin, its directors, staff, and volunteers from liability for any injury, illness, or loss arising from my child\'s participation, except in cases of gross negligence.',
  },
  {
    key: 'consent_permission_activities',
    title: 'Permission to Participate in Camp Activities',
    body: 'I give permission for my child to participate in all standard camp activities, including but not limited to swimming, boating, sports, nature exploration, and overnight camping (if applicable), subject to the activity permissions specified in Section 7 of this application.',
  },
  {
    key: 'consent_medication',
    title: 'Medication Administration Consent',
    body: 'I authorize Camp Burnt Gin nursing staff to administer medications listed in Section 8 of this application according to the instructions provided. I certify that all medications are in their original labeled containers and that the information provided is accurate.',
  },
  {
    key: 'consent_hipaa',
    title: 'HIPAA Privacy Acknowledgment',
    body: 'I acknowledge receipt of Camp Burnt Gin\'s Notice of Privacy Practices. I understand that protected health information about my child may be used and disclosed as described in that notice for treatment, payment, and health care operations.',
  },
];

function SignaturePad({
  onCapture,
  onClear,
}: {
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing  = useRef(false);
  const hasStrokes = useRef(false);

  function getPos(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  function startDraw(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = 'var(--foreground)';
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
  }

  function endDraw(e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (hasStrokes.current && canvasRef.current) {
      onCapture(canvasRef.current.toDataURL('image/png'));
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onClear();
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={480}
        height={120}
        className="w-full rounded-lg border touch-none"
        style={{ borderColor: 'var(--border)', background: '#fafafa', cursor: 'crosshair' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <button
        type="button"
        onClick={clearCanvas}
        className="text-xs self-end hover:underline"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {t('applicant.form.s10_clear_signature')}
      </button>
    </div>
  );
}

function Section10({
  data,
  onChange,
}: {
  data: FormState['s10'];
  onChange: (patch: Partial<FormState['s10']>) => void;
}) {
  const { t } = useTranslation();
  const today = new Date().toISOString().split('T')[0];

  // Pre-populate today's date in state so the section can mark as complete
  // without the user needing to manually interact with the date picker.
  useEffect(() => {
    if (!data.signed_date) {
      onChange({ signed_date: today });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allConsents = data.consent_general && data.consent_medical && data.consent_photo
    && data.consent_liability && data.consent_permission_activities
    && data.consent_medication && data.consent_hipaa;

  return (
    <div className="p-5 flex flex-col gap-6">
      {/* Consent blocks */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.form.s10_read_acknowledge')}
        </p>
        {CONSENT_DEFS.map((c) => (
          <label
            key={c.key}
            aria-label={c.title}
            className="flex gap-3 cursor-pointer rounded-xl border p-4 transition-colors"
            style={{
              borderColor: data[c.key] ? 'rgba(22,163,74,0.35)' : 'var(--border)',
              background:  data[c.key] ? 'rgba(22,163,74,0.03)' : 'var(--glass-light, #fafafa)',
            }}
          >
            <input
              type="checkbox"
              className="w-4 h-4 mt-0.5 flex-shrink-0 rounded"
              checked={data[c.key]}
              onChange={(e) => onChange({ [c.key]: e.target.checked } as Partial<FormState['s10']>)}
            />
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{c.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{c.body}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Signature section — only show once all consents are checked */}
      {allConsents && (
        <div
          className="rounded-xl border p-5 flex flex-col gap-4"
          style={{ borderColor: 'var(--border)', background: 'var(--glass-light, #fafafa)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('applicant.form.s10_guardian_signature_label')}
          </p>

          {/* Signature type toggle */}
          <div className="flex gap-2">
            {(['drawn', 'typed'] as const).map((sigType) => (
              <button
                key={sigType}
                type="button"
                onClick={() => onChange({ signature_type: sigType, signature_data: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  borderColor: data.signature_type === sigType ? 'var(--ember-orange)' : 'var(--border)',
                  background:  data.signature_type === sigType ? 'rgba(22,163,74,0.08)' : 'transparent',
                  color:       data.signature_type === sigType ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                }}
              >
                {sigType === 'drawn' ? t('applicant.form.s10_draw_signature') : t('applicant.form.s10_type_name_instead')}
              </button>
            ))}
          </div>

          {data.signature_type === 'drawn' ? (
            <SignaturePad
              onCapture={(d) => onChange({ signature_data: d })}
              onClear={() => onChange({ signature_data: '' })}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <TextInput
                placeholder={t('applicant.form.s10_type_name_placeholder')}
                value={data.signed_name}
                onChange={(v) => onChange({ signed_name: v })}
              />
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('applicant.form.s10_electronic_signature_note')}
              </p>
            </div>
          )}

          {/* Printed name + date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sig-name" className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                {t('applicant.form.s10_printed_name_label')}
              </label>
              <TextInput
                id="sig-name"
                placeholder={t('applicant.form.s10_guardian_name_placeholder')}
                value={data.signed_name}
                onChange={(v) => onChange({ signed_name: v })}
              />
            </div>
            <div>
              <label htmlFor="sig-date" className="block text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                {t('applicant.form.s10_date_label')}
              </label>
              <TextInput
                id="sig-date"
                type="date"
                value={data.signed_date || today}
                onChange={(v) => onChange({ signed_date: v })}
              />
            </div>
          </div>

          {data.signed_name.trim() && data.signed_date && (
            <div
              className="rounded-lg px-3 py-2 flex items-center gap-2"
              style={{ background: 'rgba(22,163,74,0.08)' }}
            >
              <Check className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
              <p className="text-xs" style={{ color: 'var(--ember-orange)' }}>
                {t('applicant.form.s10_signed_by_prefix')} <strong>{data.signed_name}</strong> {t('applicant.form.s10_signed_on')} {data.signed_date}
              </p>
            </div>
          )}
        </div>
      )}

      {!allConsents && (
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.form.s10_acknowledge_first')}
        </p>
      )}
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  form,
  onJump,
  sections,
}: {
  currentStep: number;
  form: FormState;
  onJump: (step: number) => void;
  sections: SectionDef[];
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="navigation" aria-label="Application steps">
      {sections.map((section, i) => {
        const status = getSectionStatus(i, form);
        const isActive = i === currentStep;
        const isComplete = status === 'complete';
        return (
          <Fragment key={section.id}>
            {i > 0 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--border)' }} />
            )}
            <button
              type="button"
              onClick={() => onJump(i)}
              className="flex items-center gap-1 text-xs transition-colors rounded px-1 py-0.5 hover:bg-[var(--dash-nav-hover-bg)]"
              style={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--ember-orange)' : isComplete ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              }}
            >
              {isComplete && !isActive && <Check className="h-3 w-3 flex-shrink-0" />}
              {section.shortLabel}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function ApplicationFormPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const draftKey = `${DRAFT_KEY_BASE}_${userId ?? 'anon'}`;

  // Recompute section labels when language changes
  const sections = useMemo(() => getSections(t), [t]);

  // ── State ─────────────────────────────────────────────────────────────────

  // Read navigation state set by ApplicationStartPage
  const navState = location.state as {
    language?: string;
    prefill?: Partial<Record<string, string>>;
    draftId?: number;
    // Pre-selected session ID — used with prefill to skip session selection in s1.
    sessionId?: number;
    // When the user clicked "Apply for a New Session" from a terminal application,
    // this holds the source application ID so it can be stored as reapplied_from_id
    // on the newly-created application for audit trail purposes.
    reappliedFromId?: number;
  } | null;
  const stateLanguage = navState?.language;
  // Server draft ID — present when user clicked "Start New" or "Continue" on the start page
  const serverDraftId = navState?.draftId;
  // Reapplication source ID — carried through to createApplication() as reapplied_from_id.
  const reappliedFromId = navState?.reappliedFromId;

  const [form, setForm] = useState<FormState>(() => {
    // Reapplication / prefill flow: when navigated here from the "Apply for a New Session"
    // modal (or any other prefill source), start a fresh form with the camper's stable
    // info pre-populated. The chosen session is also pre-selected. Any existing
    // sessionStorage draft is intentionally ignored — this is a brand-new application.
    if (navState?.prefill) {
      const prefill = navState.prefill;
      return {
        ...INITIAL_STATE,
        s1: {
          ...INITIAL_STATE.s1,
          camper_first_name: prefill.first_name    ?? '',
          camper_last_name:  prefill.last_name     ?? '',
          camper_dob:        prefill.date_of_birth ?? '',
          camper_gender:     prefill.gender        ?? '',
          tshirt_size:       prefill.tshirt_size   ?? '',
          // Pre-select the session chosen in the modal, if provided.
          ...(navState.sessionId ? { session_id: navState.sessionId } : {}),
        },
      };
    }

    // Server-draft continue flow: when draftId is present the server copy is
    // authoritative. Always start from INITIAL_STATE here — DO NOT use the
    // sessionStorage fast-path. sessionStorage is user-scoped (not draft-scoped),
    // so it always holds the LAST-EDITED draft regardless of which draft the user
    // clicked "Continue" on. Loading a different draft's sessionStorage data would
    // flash wrong content on screen until the async fetch completes, and any edits
    // the user made in that window would be silently overwritten. Starting from
    // INITIAL_STATE + a loading gate (isHydrating) is the safe approach.
    if (navState?.draftId) {
      return INITIAL_STATE;
    }

    // Fresh form (no prefill, no server draft): restore from sessionStorage if the
    // user was mid-edit and refreshed the page, otherwise start blank.
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as FormState;
        return mergeDraft(parsed);
      }
    } catch {
      /* ignore */
    }
    return INITIAL_STATE;
  });

  // Apply language selected on the start page (only on initial mount)
  useEffect(() => {
    if (stateLanguage === 'spanish' && i18n.language !== 'es') {
      i18n.changeLanguage('es');
    } else if (stateLanguage === 'english' && i18n.language !== 'en') {
      i18n.changeLanguage('en');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [sessions, setSessions]         = useState<Session[]>([]);
  const [currentStep, setCurrentStep]   = useState<number>(form.meta.activeSection);
  const [isSaving, setIsSaving]         = useState(false);
  const [lastSavedAt, setLastSavedAt]   = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * True while the server draft is being fetched on initial mount.
   * Blocks auto-save (prevents persisting blank INITIAL_STATE) and renders a
   * loading skeleton in place of the form so the user cannot edit stale content
   * before the authoritative server copy arrives.
   */
  const [isHydrating, setIsHydrating]   = useState(!!serverDraftId);
  /**
   * True while an async server draft deletion is in flight (Clear Draft action).
   * Used to disable Save/Clear buttons during the operation.
   */
  const [isClearing, setIsClearing]     = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Separate timer for debounced server-side draft saves (30 s cadence). */
  const serverSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Tracks the server's last-known updated_at for the draft row.
   * Sent with every PUT /application-drafts/{id} so the backend can detect
   * lost-update races when the same draft is open in two browser tabs.
   * Stored as a ref (not state) to avoid triggering re-renders on each save.
   */
  const serverDraftUpdatedAt = useRef<string | undefined>(undefined);
  /** Holds actual File objects for document uploads — not serialized to sessionStorage */
  const docFilesRef = useRef<Record<string, File | null>>({});
  /**
   * Tracks the camper ID created in step 1 of handleSubmit.
   * If submission fails and the user retries, we reuse the same camper record
   * instead of creating a new orphan entry.
   *
   * Persisted to sessionStorage so page reloads between retry attempts don't
   * lose the reference and cause duplicate camper records to be created.
   */
  const pendingCamperKey = `cbg_pending_camper_${userId ?? 'anon'}`;
  const pendingCamperIdRef = useRef<number | null>(
    (() => {
      try {
        const stored = sessionStorage.getItem(pendingCamperKey);
        return stored ? (JSON.parse(stored) as number) : null;
      } catch {
        return null;
      }
    })()
  );

  // ── Load sessions ──────────────────────────────────────────────────────────

  useEffect(() => {
    getSessions().then(setSessions).catch((err) => { console.error('[ApplicationForm] Sessions load failed:', err); });
  }, []);

  // ── Hydrate from server draft (async, runs once on mount) ─────────────────
  // When the user clicks "Continue" on a server draft, the draftId is passed
  // via navigation state. We fetch the full draft_data and overwrite the form.
  // This runs after the sync initializer so the page renders immediately.

  useEffect(() => {
    if (!serverDraftId) return;
    getDraft(serverDraftId)
      .then((draft) => {
        // Capture the server's updated_at so subsequent saves can detect concurrent edits.
        serverDraftUpdatedAt.current = draft.updated_at;
        if (draft.draft_data) {
          const saved = draft.draft_data as unknown as FormState;
          setForm((prev) => ({
            ...mergeDraft(saved),
            meta: { ...INITIAL_STATE.meta, ...(saved.meta ?? {}), activeSection: prev.meta.activeSection },
          }));
        }
      })
      .catch(() => {
        // Fetch failed — fall back to sessionStorage if present, otherwise stay on INITIAL_STATE.
        // The user will see an empty form and can start over, or they can navigate back and retry.
        try {
          const raw = sessionStorage.getItem(draftKey);
          if (raw) {
            const parsed = JSON.parse(raw) as FormState;
            setForm(mergeDraft(parsed));
          }
        } catch {
          /* ignore — INITIAL_STATE remains */
        }
      })
      .finally(() => {
        // Hydration is complete (success or failure). Unblock the form and auto-save.
        setIsHydrating(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save to sessionStorage (PHI must not persist across browser sessions) ──

  const persistDraft = useCallback((state: FormState) => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(state));
      setLastSavedAt(new Date());
    } catch {
      /* quota exceeded — silently ignore */
    }
  }, [draftKey]);

  useEffect(() => {
    // Skip auto-save while the server draft is being fetched. Without this guard,
    // the blank INITIAL_STATE that the form starts in (for the serverDraftId flow)
    // would be persisted to sessionStorage — overwriting any older local draft data
    // and then being overwritten again by the server fetch — creating needless churn.
    if (isHydrating) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setIsSaving(true);
      persistDraft(form);
      setIsSaving(false);
    }, AUTOSAVE_DELAY);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [form, persistDraft, isHydrating]);

  // ── Auto-save to server (debounced 30 s, only when serverDraftId is set) ──

  useEffect(() => {
    if (!serverDraftId) return;
    if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    serverSaveTimer.current = setTimeout(() => {
      const label = [form.s1.camper_first_name, form.s1.camper_last_name].filter(Boolean).join(' ') || 'New Application';
      apiSaveDraft(serverDraftId, label, form as unknown as Record<string, unknown>, serverDraftUpdatedAt.current)
        .then((newUpdatedAt) => { serverDraftUpdatedAt.current = newUpdatedAt; })
        .catch((err: { response?: { status?: number } }) => {
          if (err?.response?.status === 409) {
            // Another tab saved more recently — warn the user non-disruptively.
            toast.error(t('applicant.form.draft_conflict'));
          } else {
            console.error('[ApplicationForm] Server draft auto-save failed:', err);
          }
        });
    }, 30_000);
    return () => {
      if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
    };
  }, [form, serverDraftId, t]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateSection<K extends keyof FormState>(key: K, patch: Partial<FormState[K]>) {
    setForm((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as object), ...(patch as object) },
    }));
  }

  function goToStep(step: number) {
    setCurrentStep(step);
    setForm((prev) => ({ ...prev, meta: { ...prev.meta, activeSection: step } }));
  }

  async function handleClearDraft() {
    // Step 1: Clear local state immediately — HIPAA requires PHI is removed from
    // the browser as soon as the user requests it, regardless of server outcome.
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(pendingCamperKey);
    pendingCamperIdRef.current = null;
    setForm(INITIAL_STATE);
    setCurrentStep(0);

    // Step 2: Delete the server draft (if one exists) and wait for confirmation
    // before showing the success toast. This prevents a misleading "Draft cleared"
    // message when the server copy still exists and would reload on next visit.
    if (serverDraftId) {
      setIsClearing(true);
      try {
        await apiDeleteDraft(serverDraftId);
        toast.success(t('applicant.form.draft_cleared'));
      } catch {
        // Local state is already cleared (PHI safe). The server copy could not be
        // deleted — notify the user so they can delete it manually from the draft list.
        toast.error(t('applicant.form.draft_cleared_server_error'));
      } finally {
        setIsClearing(false);
      }
    } else {
      toast.success(t('applicant.form.draft_cleared'));
    }
  }

  function handleSaveDraft() {
    persistDraft(form);
    if (serverDraftId) {
      const label = [form.s1.camper_first_name, form.s1.camper_last_name].filter(Boolean).join(' ') || 'New Application';
      apiSaveDraft(serverDraftId, label, form as unknown as Record<string, unknown>, serverDraftUpdatedAt.current)
        .then((newUpdatedAt) => { serverDraftUpdatedAt.current = newUpdatedAt; })
        .catch((err: { response?: { status?: number } }) => {
          if (err?.response?.status === 409) {
            toast.error(t('applicant.form.draft_conflict'));
          }
        });
    }
    toast.success(t('applicant.form.draft_saved'));
  }

  async function handleSubmit() {
    if (countMissing(form) > 0) {
      // Navigate to the first incomplete section so the user can see what needs attention.
      const firstIncomplete = sections.findIndex((_, i) => getSectionStatus(i, form) !== 'complete');
      if (firstIncomplete !== -1) {
        goToStep(firstIncomplete);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.error(
          `Section ${firstIncomplete + 1} — ${sections[firstIncomplete].shortLabel} is incomplete. Please finish it before submitting.`,
        );
      }
      return;
    }
    if (!form.s1.session_id) {
      goToStep(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.error('Please select a camp session in Section 1 before submitting.');
      return;
    }

    setIsSubmitting(true);
    const tid = toast.loading('Submitting application…');

    try {
      // ── Step 1: Create camper (reuse if already created on a prior failed attempt) ──
      let camperId: number;
      if (pendingCamperIdRef.current !== null) {
        camperId = pendingCamperIdRef.current;
      } else {
        const camper = await createCamper({
          first_name:         form.s1.camper_first_name,
          last_name:          form.s1.camper_last_name,
          date_of_birth:      form.s1.camper_dob,
          gender:             form.s1.camper_gender,
          tshirt_size:        form.s1.tshirt_size || undefined,
          preferred_name:     form.s1.camper_preferred_name || undefined,
          county:             form.s1.county || undefined,
          needs_interpreter:  form.s1.needs_interpreter || undefined,
          preferred_language: form.s1.preferred_language || undefined,
          applicant_address:  form.s1.camper_address || undefined,
          applicant_city:     form.s1.camper_city || undefined,
          applicant_state:    form.s1.camper_state || undefined,
          applicant_zip:      form.s1.camper_zip || undefined,
        });
        camperId = camper.id;
        pendingCamperIdRef.current = camperId;
        try { sessionStorage.setItem(pendingCamperKey, JSON.stringify(camperId)); } catch { /* quota */ }
      }

      // ── Step 2a: Guardian 1 (stored as emergency contact with is_guardian=true, is_primary=true) ──
      if (form.s1.g1_name.trim()) {
        await createEmergencyContact({
          camper_id:            camperId,
          name:                 form.s1.g1_name,
          relationship:         form.s1.g1_relationship || 'Guardian',
          phone_primary:        form.s1.g1_phone_cell || form.s1.g1_phone_home,
          phone_secondary:      form.s1.g1_phone_home && form.s1.g1_phone_cell ? form.s1.g1_phone_home : undefined,
          phone_work:           form.s1.g1_phone_work || undefined,
          is_primary:           true,
          is_authorized_pickup: true,
          is_guardian:          true,
          address:              form.s1.g1_address || undefined,
          city:                 form.s1.g1_city || undefined,
          state:                form.s1.g1_state || undefined,
          zip:                  form.s1.g1_zip || undefined,
        });
      }

      // ── Step 2b: Guardian 2 (is_guardian=true, is_primary=false) ─────────
      if (form.s1.g2_name.trim()) {
        await createEmergencyContact({
          camper_id:            camperId,
          name:                 form.s1.g2_name,
          relationship:         form.s1.g2_relationship || 'Guardian',
          phone_primary:        form.s1.g2_phone_cell || form.s1.g2_phone_home,
          phone_secondary:      form.s1.g2_phone_home && form.s1.g2_phone_cell ? form.s1.g2_phone_home : undefined,
          phone_work:           form.s1.g2_phone_work || undefined,
          is_primary:           false,
          is_authorized_pickup: true,
          is_guardian:          true,
          address:              form.s1.g2_address || undefined,
          city:                 form.s1.g2_city || undefined,
          state:                form.s1.g2_state || undefined,
          zip:                  form.s1.g2_zip || undefined,
          primary_language:     form.s1.g2_primary_language || undefined,
          interpreter_needed:   form.s1.g2_interpreter || undefined,
        });
      }

      // ── Step 2c: Additional emergency contact (non-guardian) ─────────────
      if (form.s1.ec_name.trim()) {
        await createEmergencyContact({
          camper_id:            camperId,
          name:                 form.s1.ec_name,
          relationship:         form.s1.ec_relationship || 'Emergency Contact',
          phone_primary:        form.s1.ec_phone,
          phone_secondary:      form.s1.ec_phone_home || undefined,
          phone_work:           form.s1.ec_phone_work || undefined,
          is_primary:           false,
          is_authorized_pickup: false,
          is_guardian:          false,
          address:              form.s1.ec_address || undefined,
          city:                 form.s1.ec_city || undefined,
          state:                form.s1.ec_state || undefined,
          zip:                  form.s1.ec_zip || undefined,
          primary_language:     form.s1.ec_primary_language || undefined,
          interpreter_needed:   form.s1.ec_interpreter || undefined,
        });
      }

      // ── Step 3: Diagnoses ─────────────────────────────────────────────────
      for (const dx of form.s2.diagnoses) {
        if (!dx.condition.trim()) continue;
        await createDiagnosis({
          camper_id:      camperId,
          name:           dx.condition,
          severity_level: 'moderate',
          notes:          dx.notes || undefined,
        });
      }

      // ── Step 4: Allergies ─────────────────────────────────────────────────
      for (const al of form.s2.allergies) {
        if (!al.allergen.trim()) continue;
        await createAllergy({
          camper_id: camperId,
          allergen:  al.allergen,
          severity:  al.severity || 'moderate',
          reaction:  al.reaction || undefined,
          treatment: al.epi_pen ? 'Epi-pen available' : undefined,
        });
      }

      // ── Step 5: Behavioral profile ────────────────────────────────────────
      await createBehavioralProfile({
        camper_id:                          camperId,
        aggression:                         form.s3.aggression === true,
        aggression_description:             form.s3.aggression_description || undefined,
        self_abuse:                         form.s3.self_abuse  === true,
        self_abuse_description:             form.s3.self_abuse_description || undefined,
        wandering_risk:                     form.s3.wandering   === true,
        wandering_description:              form.s3.wandering_description || undefined,
        one_to_one_supervision:             form.s3.one_to_one  === true,
        one_to_one_description:             form.s3.one_to_one_description || undefined,
        developmental_delay:                form.s3.developmental_delay === true,
        functional_reading:                 form.s3.functional_reading,
        functional_writing:                 form.s3.functional_writing,
        independent_mobility:               form.s3.independent_mobility,
        verbal_communication:               form.s3.verbal_communication,
        social_skills:                      form.s3.social_skills,
        behavior_plan:                      form.s3.behavior_plan,
        functioning_age_level:              form.s3.functional_age_level || undefined,
        sexual_behaviors:                   form.s3.sexual_behaviors,
        sexual_behaviors_description:       form.s3.sexual_behaviors_description || undefined,
        interpersonal_behavior:             form.s3.interpersonal_behavior,
        interpersonal_behavior_description: form.s3.interpersonal_behavior_description || undefined,
        social_emotional:                   form.s3.social_emotional,
        social_emotional_description:       form.s3.social_emotional_description || undefined,
        follows_instructions:               form.s3.follows_instructions,
        follows_instructions_description:   form.s3.follows_instructions_description || undefined,
        group_participation:                form.s3.group_participation,
        group_participation_description:    form.s3.group_participation_description || undefined,
        attends_school:                     form.s3.attends_school !== '' ? form.s3.attends_school as boolean : undefined,
        classroom_type:                     form.s3.classroom_type || undefined,
        communication_methods:              form.s3.communication_methods.length
                                              ? form.s3.communication_methods : undefined,
        notes: form.s3.behavior_notes || undefined,
      });

      // ── Step 6: Assistive devices ─────────────────────────────────────────
      for (const dev of form.s4.devices) {
        if (!dev.device_type.trim()) continue;
        await createAssistiveDevice({
          camper_id:                    camperId,
          device_type:                  dev.device_type,
          requires_transfer_assistance: dev.requires_transfer,
          notes:                        dev.notes || undefined,
        });
      }

      // ── Step 7: Feeding plan ──────────────────────────────────────────────
      if (form.s5.special_diet || form.s5.g_tube || form.s5.texture_modified || form.s5.fluid_restriction) {
        await createFeedingPlan({
          camper_id:          camperId,
          special_diet:       form.s5.special_diet,
          diet_description:   form.s5.diet_description || undefined,
          texture_modified:   form.s5.texture_modified || undefined,
          texture_level:      form.s5.texture_level || undefined,
          fluid_restriction:  form.s5.fluid_restriction || undefined,
          fluid_details:      form.s5.fluid_details || undefined,
          g_tube:             form.s5.g_tube,
          formula:            form.s5.formula || undefined,
          amount_per_feeding: form.s5.amount_per_feeding || undefined,
          feedings_per_day:   form.s5.feedings_per_day
                                ? parseInt(form.s5.feedings_per_day, 10) : undefined,
          feeding_times:      form.s5.feeding_times
                                ? form.s5.feeding_times.split(',').map((t) => t.trim()).filter(Boolean)
                                : undefined,
          bolus_only:         form.s5.bolus_only || undefined,
          notes:              form.s5.feeding_notes || undefined,
        });
      }

      // ── Step 7b: Health profile (full Section 2 medical fields) ──────────
      await storeHealthProfile(camperId, {
        // Physician
        physician_name:                     form.s2.physician_name || undefined,
        physician_phone:                    form.s2.physician_phone || undefined,
        physician_address:                  form.s2.physician_address || undefined,
        // Insurance
        insurance_provider:                 form.s2.insurance_provider || undefined,
        insurance_policy:                   form.s2.insurance_policy || undefined,
        insurance_group:                    form.s2.insurance_group || undefined,
        medicaid_number:                    form.s2.medicaid_number || undefined,
        // Immunization & exam
        immunizations_current:              form.s2.immunizations_current !== '' ? form.s2.immunizations_current as boolean : undefined,
        tetanus_date:                       form.s2.tetanus_date || undefined,
        date_of_medical_exam:               form.s2.date_of_medical_exam || undefined,
        // Seizure history
        has_seizures:                       form.s2.has_seizures !== '' ? form.s2.has_seizures as boolean : undefined,
        last_seizure_date:                  form.s2.last_seizure_date || undefined,
        seizure_description:                form.s2.seizure_description || undefined,
        // Other health flags
        has_neurostimulator:                form.s2.has_neurostimulator !== '' ? form.s2.has_neurostimulator as boolean : undefined,
        // Mobility (from Section 4)
        mobility_notes:                     form.s4.mobility_notes || undefined,
        // Other
        tubes_in_ears:                      form.s2.tubes_in_ears !== '' ? form.s2.tubes_in_ears as boolean : undefined,
        has_contagious_illness:             form.s2.has_contagious_illness !== '' ? form.s2.has_contagious_illness as boolean : undefined,
        contagious_illness_description:     form.s2.contagious_illness_description || undefined,
        has_recent_illness:                 form.s2.has_recent_illness !== '' ? form.s2.has_recent_illness as boolean : undefined,
        recent_illness_description:         form.s2.recent_illness_description || undefined,
      });

      // ── Step 7c: Personal care plan (Section 6 — ADL fields) ─────────────
      await createPersonalCarePlan(camperId, {
        bathing_level:        form.s6.bathing_level || undefined,
        bathing_notes:        form.s6.bathing_notes || undefined,
        toileting_level:      form.s6.toileting_level || undefined,
        toileting_notes:      form.s6.toileting_notes || undefined,
        nighttime_toileting:  form.s6.nighttime_toileting || undefined,
        nighttime_notes:      form.s6.nighttime_notes || undefined,
        dressing_level:       form.s6.dressing_level || undefined,
        dressing_notes:       form.s6.dressing_notes || undefined,
        oral_hygiene_level:   form.s6.oral_hygiene_level || undefined,
        oral_hygiene_notes:   form.s6.oral_hygiene_notes || undefined,
        positioning_notes:    form.s6.positioning_notes || undefined,
        sleep_notes:          form.s6.sleep_notes || undefined,
        falling_asleep_issues:form.s6.falling_asleep_issues || undefined,
        sleep_walking:        form.s6.sleep_walking || undefined,
        night_wandering:      form.s6.night_wandering || undefined,
        bowel_control_notes:  form.s6.bowel_control_notes || undefined,
        irregular_bowel:      form.s6.irregular_bowel || undefined,
        irregular_bowel_notes:form.s6.irregular_bowel_notes || undefined,
        urinary_catheter:     form.s6.urinary_catheter || undefined,
        menstruation_support: form.s6.menstruation_support || undefined,
      });

      // ── Step 8: Medications ───────────────────────────────────────────────
      if (!form.s8.no_medications) {
        for (const med of form.s8.medications) {
          if (!med.name.trim()) continue;
          await createMedication({
            camper_id:             camperId,
            name:                  med.name,
            dosage:                med.dosage,
            frequency:             med.frequency,
            purpose:               med.reason || undefined,
            prescribing_physician: med.physician || undefined,
            notes: [
              med.route         ? `Route: ${med.route}` : '',
              med.self_admin    ? 'Self-administers' : '',
              med.refrigeration ? 'Requires refrigeration' : '',
              med.notes,
            ].filter(Boolean).join('; ') || undefined,
          });
        }
      }

      // ── Step 9: Activity permissions ──────────────────────────────────────
      // The form stores levels already in backend format: 'yes' | 'restricted' | 'no'.
      // No mapping is needed — pass the level directly.
      const activityMap: Record<keyof typeof form.s7, string> = {
        sports_games: 'Sports & Games',
        arts_crafts:  'Arts & Crafts',
        nature:       'Nature Activities',
        fine_arts:    'Fine Arts',
        swimming:     'Swimming',
        boating:      'Boating',
        camp_out:     'Camp Out',
      };
      for (const [key, activityName] of Object.entries(activityMap)) {
        const entry = form.s7[key as keyof typeof form.s7];
        if (!entry.level) continue;
        await createActivityPermission({
          camper_id:         camperId,
          activity_name:     activityName,
          permission_level:  entry.level,
          restriction_notes: entry.notes || undefined,
        });
      }

      // ── Step 10: Create application ───────────────────────────────────────
      const application = await createApplication({
        camper_id:                        camperId,
        session_id:                       Number(form.s1.session_id),
        first_application:                form.s1.first_application || undefined,
        attended_before:                  form.s1.attended_before || undefined,
        session_id_second:                form.s1.session_id_2nd !== '' ? Number(form.s1.session_id_2nd) : undefined,
        narrative_rustic_environment:     form.sn.narrative_rustic_environment || undefined,
        narrative_staff_suggestions:      form.sn.narrative_staff_suggestions || undefined,
        narrative_participation_concerns: form.sn.narrative_participation_concerns || undefined,
        narrative_camp_benefit:           form.sn.narrative_camp_benefit || undefined,
        narrative_heat_tolerance:         form.sn.narrative_heat_tolerance || undefined,
        narrative_transportation:         form.sn.narrative_transportation || undefined,
        narrative_additional_info:        form.sn.narrative_additional_info || undefined,
        narrative_emergency_protocols:    form.sn.narrative_emergency_protocols || undefined,
        // Preserve the audit trail when this is a reapplication.
        ...(reappliedFromId ? { reapplied_from_id: reappliedFromId } : {}),
      });
      const applicationId = application.id;

      // ── Step 11: Upload documents ─────────────────────────────────────────
      // document_type slugs must match RequiredDocumentRuleSeeder values so
      // DocumentEnforcementService can match uploaded docs against required rules.
      // documentable_type is Application so both ApplicationController::show() and
      // DocumentEnforcementService resolve them correctly when the admin reviews.
      const docTypeSlugs: Record<string, string> = {
        immunization:   'immunization_record',
        medical_exam:   'official_medical_form', // must match RequiredDocumentRuleSeeder + ApplicantOfficialFormsPage
        insurance_card: 'insurance_card',
        cpap_waiver:    'cpap_waiver',
        seizure_plan:   'seizure_action_plan',
        gtube_plan:     'feeding_action_plan',
      };
      // Determine which conditional documents are actually applicable for this camper.
      // If a condition was toggled off after a document was uploaded, the slot may
      // still be non-null — this guard ensures we never submit documents for inactive
      // conditions regardless of what remains in form state.
      const activeConditionalDocs: Record<string, boolean> = {
        cpap_waiver:  form.s4.devices.some((d) => d.device_type.includes('CPAP')),
        seizure_plan: form.s2.has_seizures === true,
        gtube_plan:   form.s5.g_tube === true,
      };
      for (const [key, slot] of Object.entries(form.s9)) {
        if (!slot) continue;
        if (key in activeConditionalDocs && !activeConditionalDocs[key]) continue;
        const file = docFilesRef.current[key];
        if (!file) continue;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('documentable_type', 'App\\Models\\Application');
        fd.append('documentable_id', String(applicationId));
        fd.append('document_type', docTypeSlugs[key] ?? key);
        // pass exam date for official_medical_form so backend can set expiration_date
        if (key === 'medical_exam' && form.s2.date_of_medical_exam) {
          fd.append('exam_date', form.s2.date_of_medical_exam);
        }
        // Upload and immediately submit so the document is visible to staff.
        // Applicant uploads start as drafts (submitted_at = null); without this call
        // the admin's submitted_at IS NOT NULL filter removes every document from
        // the review page, making the application appear to have no required docs.
        const uploaded = await uploadDocument(fd);
        await submitDocument(uploaded.id);
      }

      // ── Step 12: Sign application ─────────────────────────────────────────
      // For typed signatures the signature_data is the typed name itself.
      // For drawn signatures it is the base64-encoded PNG captured from the canvas.
      const signatureData = form.s10.signature_type === 'drawn' && form.s10.signature_data
        ? form.s10.signature_data
        : form.s10.signed_name;
      await signApplication(applicationId, form.s10.signed_name, signatureData);

      // ── Step 13: Store consent records ────────────────────────────────────
      // All 7 CYSHCN consent types are persisted as separate signed records with
      // the guardian's name, relationship, and signature. storeConsents uses
      // updateOrCreate on the backend so this step is safe to retry.
      const guardianSignature = signatureData;
      const guardianName = form.s10.signed_name;
      const guardianRelationship = form.s1.g1_relationship || 'Guardian';
      const signedAt = form.s10.signed_date
        ? new Date(form.s10.signed_date).toISOString()
        : new Date().toISOString();

      await storeConsents(applicationId, [
        { consent_type: 'general',       guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'photos',        guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'liability',     guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'activity',      guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'authorization', guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'medication',    guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
        { consent_type: 'hipaa',         guardian_name: guardianName, guardian_relationship: guardianRelationship, guardian_signature: guardianSignature, signed_at: signedAt },
      ]);

      // ── Success ───────────────────────────────────────────────────────────
      pendingCamperIdRef.current = null;
      sessionStorage.removeItem(pendingCamperKey);
      toast.dismiss(tid);
      toast.success(t('applicant.form.submit_success'));
      sessionStorage.removeItem(draftKey);
      // Delete the server draft now that the real application record exists
      if (serverDraftId) await apiDeleteDraft(serverDraftId).catch(() => {});
      navigate(ROUTES.PARENT_APPLICATIONS);

    } catch (err: unknown) {
      toast.dismiss(tid);
      // Axios interceptor normalizes errors to plain { message, errors } objects —
      // there is no `.response.data` wrapper after the interceptor runs.
      const apiErr = err as { message?: string; errors?: Record<string, string[]> };
      const firstFieldError = apiErr.errors
        ? Object.values(apiErr.errors).flat()[0]
        : undefined;
      const msg = firstFieldError ?? apiErr.message ?? 'Submission failed. Please check your entries and try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const missing = countMissing(form);
  const canSubmit = missing === 0;
  // True when all content sections are done but the documents section (s9) is still empty.
  // Used to surface a more actionable status message than the generic "1 section remaining".
  const docsOnlyPending = missing === 1 && getSectionStatus(9, form) === 'empty';

  const hasCpap = form.s4.devices.some((d) => d.device_type.includes('CPAP'));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full" style={{ background: 'var(--dash-bg)' }}>
      <div className="max-w-4xl mx-auto px-6 py-16">

        {/* ── Page header ───────────────────────────────── */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-headline text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>
                {t('applicant.form.title')}
              </h1>
              {/* Language badge — shown when a specific language was chosen */}
              {stateLanguage && (
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: stateLanguage === 'spanish' ? 'rgba(96,165,250,0.12)' : 'rgba(22,163,74,0.10)',
                    color: stateLanguage === 'spanish' ? 'var(--night-sky-blue)' : 'var(--ember-orange)',
                  }}
                >
                  {stateLanguage === 'spanish' ? 'Español' : 'English'}
                </span>
              )}
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.form.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <RefreshCw className="h-3 w-3 animate-spin" /> {t('applicant.form.saving')}
              </span>
            )}
            {!isSaving && lastSavedAt && (
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Save className="h-3 w-3" />
                {t('applicant.form.saved_at', { time: lastSavedAt.toLocaleTimeString(i18n.language === 'es' ? 'es-ES' : 'en-US', { hour: 'numeric', minute: '2-digit' }) })}
              </span>
            )}
            <Button
              onClick={handleSaveDraft}
              variant="secondary"
              size="sm"
              disabled={isSubmitting || isClearing || isHydrating}
              className="flex items-center gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {t('applicant.form.save_draft')}
            </Button>
            <button
              type="button"
              onClick={() => { void handleClearDraft(); }}
              disabled={isSubmitting || isClearing || isHydrating}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
            >
              {isClearing && <RefreshCw className="h-3 w-3 animate-spin" />}
              {t('applicant.form.clear_draft')}
            </button>
            <Button
              onClick={() => navigate(ROUTES.PARENT_APPLICATIONS)}
              variant="ghost"
              size="sm"
            >
              {t('applicant.form.cancel')}
            </Button>
          </div>
        </div>

        {/* ── Reapplication notice ─────────────────────── */}
        {reappliedFromId && (
          <div
            className="rounded-xl px-5 py-4 mb-8 text-sm"
            style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.20)', color: 'var(--foreground)' }}
          >
            <p className="font-semibold mb-0.5" style={{ color: 'var(--ember-orange)' }}>
              {t('applicant.form.reapplication_notice_title')}
            </p>
            <p style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.form.reapplication_notice_body')}
            </p>
          </div>
        )}

        {/* ── Progress summary ──────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.form.sections_complete', { done: sections.length - missing, total: sections.length })}
            </span>
            <span className="text-sm" style={{ color: missing === 0 ? 'var(--ember-orange)' : 'var(--muted-foreground)' }}>
              {missing === 0
                ? t('applicant.form.submit')
                : docsOnlyPending
                ? t('applicant.form.docs_only_pending')
                : t(missing === 1 ? 'applicant.form.sections_remaining' : 'applicant.form.sections_remaining_plural', { count: missing })}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(5, Math.round(((sections.length - missing) / sections.length) * 100))}%`,
                background: 'var(--ember-orange)',
              }}
            />
          </div>
        </div>

        {/* ── Hydration loading state ───────────────────── */}
        {isHydrating ? (
          <div className="mt-4 animate-pulse" aria-busy="true" aria-label={t('applicant.form.loading_draft')}>
            {/* Fake step indicator pills */}
            <div className="flex gap-2 flex-wrap mb-12">
              {Array.from({ length: 11 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded-full"
                  style={{ width: i === 0 ? '6rem' : '2.5rem', background: 'var(--border)' }}
                />
              ))}
            </div>
            {/* Fake section header */}
            <div className="mb-8 space-y-3">
              <div className="h-3 w-24 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-7 w-56 rounded" style={{ background: 'var(--border)' }} />
            </div>
            {/* Fake form fields */}
            <div className="space-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-32 rounded" style={{ background: 'var(--border)' }} />
                  <div className="h-10 rounded-lg" style={{ background: 'var(--border)' }} />
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-center" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.form.loading_draft')}
            </p>
          </div>
        ) : (
        <>

        {/* ── Step indicator ────────────────────────────── */}
        <StepIndicator currentStep={currentStep} form={form} onJump={goToStep} sections={sections} />

        {/* ── Section content ─────────────────────────── */}
        <div className="mt-12">
          <div>
              <div className="mb-8">
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {t('applicant.form.step_of', { current: currentStep + 1, total: sections.length })}
                </p>
                <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {sections[currentStep].label}
                </h2>
              </div>

              {currentStep === 0 && (
                <Section1
                  data={form.s1}
                  sessions={sessions}
                  onChange={(patch) => updateSection('s1', patch)}
                />
              )}
              {currentStep === 1 && (
                <Section2
                  data={form.s2}
                  onChange={(patch) => {
                    // When has_seizures is answered anything other than true, the
                    // seizure action plan document is no longer applicable — clear it
                    // from both state and the file ref so it is not accidentally submitted.
                    if ('has_seizures' in patch && patch.has_seizures !== true) {
                      setForm((prev) => ({
                        ...prev,
                        s2: { ...(prev.s2 as object), ...(patch as object) } as FormState['s2'],
                        s9: { ...prev.s9, seizure_plan: null },
                      }));
                      docFilesRef.current['seizure_plan'] = null;
                    } else {
                      updateSection('s2', patch);
                    }
                  }}
                />
              )}
              {currentStep === 2 && (
                <Section3
                  data={form.s3}
                  onChange={(patch) => updateSection('s3', patch)}
                />
              )}
              {currentStep === 3 && (
                <Section4
                  data={form.s4}
                  onChange={(patch) => {
                    // Mirror the seizure/g-tube drift fix: when the devices list changes
                    // and CPAP is no longer present, clear the cpap_waiver document so
                    // the slot never shows "uploaded" after the requirement is dropped.
                    if ('devices' in patch) {
                      const newDevices = (patch as { devices: FormState['s4']['devices'] }).devices;
                      const hadCpap = form.s4.devices.some((d) => d.device_type.includes('CPAP'));
                      const hasCpapNow = newDevices.some((d) => d.device_type.includes('CPAP'));
                      if (hadCpap && !hasCpapNow) {
                        setForm((prev) => ({
                          ...prev,
                          s4: { ...(prev.s4 as object), ...(patch as object) } as FormState['s4'],
                          s9: { ...prev.s9, cpap_waiver: null },
                        }));
                        docFilesRef.current['cpap_waiver'] = null;
                        return;
                      }
                    }
                    updateSection('s4', patch);
                  }}
                />
              )}
              {currentStep === 4 && (
                <Section5
                  data={form.s5}
                  onChange={(patch) => {
                    // When g_tube is unchecked, the G-tube feeding plan document is no
                    // longer applicable — clear it from state and the file ref.
                    if ('g_tube' in patch && patch.g_tube === false) {
                      setForm((prev) => ({
                        ...prev,
                        s5: { ...(prev.s5 as object), ...(patch as object) } as FormState['s5'],
                        s9: { ...prev.s9, gtube_plan: null },
                      }));
                      docFilesRef.current['gtube_plan'] = null;
                    } else {
                      updateSection('s5', patch);
                    }
                  }}
                />
              )}
              {currentStep === 5 && (
                <Section6
                  data={form.s6}
                  onChange={(patch) => updateSection('s6', patch)}
                />
              )}
              {currentStep === 6 && (
                <Section7
                  data={form.s7}
                  onChange={(patch) => updateSection('s7', patch)}
                />
              )}
              {currentStep === 7 && (
                <Section8
                  data={form.s8}
                  onChange={(patch) => updateSection('s8', patch)}
                />
              )}
              {currentStep === 8 && (
                <SectionNarratives
                  data={form.sn}
                  onChange={(patch) => updateSection('sn', patch)}
                />
              )}
              {currentStep === 9 && (
                <Section9
                  data={form.s9}
                  hasCpap={form.s4.devices.some((d) => d.device_type.includes('CPAP'))}
                  hasSeizures={form.s2.has_seizures === true}
                  hasGtube={form.s5.g_tube === true}
                  onChange={(patch) => updateSection('s9', patch)}
                  onFileSelect={(key, file) => { docFilesRef.current[key] = file; }}
                />
              )}
              {currentStep === 10 && (
                <Section10
                  data={form.s10}
                  onChange={(patch) => updateSection('s10', patch)}
                />
              )}

              {/* Document warnings — shown on Documents step */}
              {currentStep === 9 && (hasCpap || form.s2.has_seizures === true || form.s5.g_tube) && (
                <div
                  className="mt-6 rounded-2xl border p-4 flex flex-col gap-2"
                  style={{ background: 'rgba(251,191,36,0.06)', borderColor: 'rgba(251,191,36,0.25)' }}
                >
                  <p className="text-xs font-semibold flex items-center gap-2" style={{ color: '#92400e' }}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t('applicant.form.s9_additional_docs_required')}
                  </p>
                  <ul className="text-xs space-y-1 ml-5" style={{ color: '#92400e', listStyleType: 'disc' }}>
                    {form.s2.has_seizures === true && <li>{t('applicant.form.s9_seizure_action_plan')}</li>}
                    {form.s5.g_tube && <li>{t('applicant.form.s9_gtube_action_plan')}</li>}
                    {hasCpap && <li>{t('applicant.form.s9_cpap_waiver')}</li>}
                  </ul>
                </div>
              )}
          </div>
        </div>

        {/* ── Step navigation ──────────────────────────── */}
        <div
          className="flex items-center justify-between mt-16 pt-8 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 0}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--foreground)' }}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('applicant.form.prev')}
          </button>

          {currentStep < sections.length - 1 ? (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              className="flex items-center gap-2 px-6"
            >
              {t('applicant.form.save_continue')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit || isSubmitting}
              className="flex items-center gap-2 px-6"
            >
              {t('applicant.form.submit')}
            </Button>
          )}
        </div>

        {/* Submit shortcut — visible on non-final steps when all sections complete */}
        {canSubmit && currentStep < sections.length - 1 && (
          <div className="flex justify-center mt-6">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              {t('applicant.form.all_complete_submit')}
            </button>
          </div>
        )}

        </>
        )}

        <p className="text-xs text-center mt-10 pb-4" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.form.hipaa_footer')}
        </p>
      </div>
    </div>
  );
}
