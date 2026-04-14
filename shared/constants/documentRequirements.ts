/**
 * documentRequirements.ts — Single source of truth for document requirement definitions.
 *
 * Every surface that displays document types (applicant pages, admin review, admin documents
 * management) derives labels and metadata from this module. Role-specific label variants
 * (applicantLabel / adminLabel) are defined here intentionally — never via per-page drift.
 *
 * Canonical naming decisions (2026-04-11 audit):
 *  - 'immunization_record': both roles show "Immunization Record" (removed admin-only "SC"
 *    prefix — it was internally familiar but externally confusing and inconsistent).
 *  - 'official_medical_form': both roles show "Medical Examination Form".
 *  - All other multi-word types: identical applicant / admin labels (no role divergence).
 *
 * Adding a new document type:
 *  1. Add an entry to DOCUMENT_REQUIREMENTS below.
 *  2. If required (not supplementary), add the key to REQUIRED_DOC_TYPE_SET.
 *  3. If universally required, add to UNIVERSAL_REQUIRED_DOC_TYPES.
 *  4. Add a matching required_document_rules seed row in RequiredDocumentRuleSeeder.php.
 *  5. Keep applicantLabel and adminLabel identical unless a true business reason exists.
 *
 * Usage:
 *   import { getDocumentLabel, getDocumentNote, isRequiredDocumentType, UNIVERSAL_REQUIRED_DOC_TYPES }
 *     from '@/shared/constants/documentRequirements';
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentRequirement {
  /** Snake_case key matching the document_type value stored in the database */
  type: string;
  /** Label shown to applicants / parents */
  applicantLabel: string;
  /** Label shown to admin / super-admin staff */
  adminLabel: string;
  /** Parenthetical note shown alongside the label in requirement checklist rows */
  note: string;
}

// ─── Universal required documents ────────────────────────────────────────────
// Every applicant must submit these three documents.
//
// NOTE: 'official_medical_form' is the document_type stored when applicants upload
// Form 4523-ENG-DPH through the Official Forms page.  The admin Application Review
// renders it as a dedicated hardcoded row (with inline Verify/Reject) rather than
// through the generic allDocs map, so it is intentionally NOT in this array.
//
// 'physical_examination' is a LEGACY key — old required_document_rules DB rows used
// this type before the 000005 migration renamed the rule to 'official_medical_form'.
// No uploaded documents actually use this type; it is kept in DOCUMENT_REQUIREMENTS
// for label-lookup only and must NOT appear in UNIVERSAL_REQUIRED_DOC_TYPES or
// REQUIRED_DOC_TYPE_SET (it would cause phantom rows in the admin review).

export const UNIVERSAL_REQUIRED_DOC_TYPES = [
  'immunization_record',
  'insurance_card',
] as const;

export type UniversalRequiredDocType = (typeof UNIVERSAL_REQUIRED_DOC_TYPES)[number];

// ─── Canonical document definitions ──────────────────────────────────────────

export const DOCUMENT_REQUIREMENTS: Record<string, DocumentRequirement> = {
  // Universal required --------------------------------------------------------
  // Legacy key — pre-000005 migration. No new uploads use this type; kept for
  // label-lookup so historical records display sensibly. Both roles show the
  // same label to prevent role-divergent display of any surviving old records.
  physical_examination: {
    type: 'physical_examination',
    applicantLabel: 'Medical Examination Form',
    adminLabel: 'Medical Examination Form',
    note: 'physician-completed, required within 12 months',
  },
  immunization_record: {
    type: 'immunization_record',
    applicantLabel: 'Immunization Record',
    adminLabel: 'Immunization Record', // canonical — removed former "SC Immunization Certificate" divergence (BUG-192)
    note: 'required',
  },
  insurance_card: {
    type: 'insurance_card',
    applicantLabel: 'Insurance Card',
    adminLabel: 'Insurance Card',
    note: 'or Medicaid / CHIP card — required',
  },

  // Conditional required — seizures ------------------------------------------
  seizure_action_plan: {
    type: 'seizure_action_plan',
    applicantLabel: 'Seizure Action Plan',
    adminLabel: 'Seizure Action Plan',
    note: 'required — seizure history indicated',
  },
  seizure_medication_authorization: {
    type: 'seizure_medication_authorization',
    applicantLabel: 'Seizure Medication Authorization',
    adminLabel: 'Seizure Medication Authorization',
    note: 'required — seizure history indicated',
  },

  // Conditional required — G-tube --------------------------------------------
  feeding_action_plan: {
    type: 'feeding_action_plan',
    applicantLabel: 'G-tube Feeding Plan',
    adminLabel: 'G-tube Feeding Plan',
    note: 'required — G-tube indicated',
  },
  feeding_equipment_list: {
    type: 'feeding_equipment_list',
    applicantLabel: 'Feeding Equipment List',
    adminLabel: 'Feeding Equipment List',
    note: 'required — G-tube indicated',
  },

  // Conditional required — supervision ---------------------------------------
  behavioral_support_plan: {
    type: 'behavioral_support_plan',
    applicantLabel: 'Behavioral Support Plan',
    adminLabel: 'Behavioral Support Plan',
    note: 'required — one-to-one supervision indicated',
  },
  staffing_accommodation_request: {
    type: 'staffing_accommodation_request',
    applicantLabel: 'Staffing Accommodation Request',
    adminLabel: 'Staffing Accommodation Request',
    note: 'required — one-to-one supervision indicated',
  },
  supervision_justification: {
    type: 'supervision_justification',
    applicantLabel: 'Supervision Justification',
    adminLabel: 'Supervision Justification',
    note: 'required — enhanced supervision indicated',
  },

  // Conditional required — wandering / aggression ----------------------------
  elopement_prevention_plan: {
    type: 'elopement_prevention_plan',
    applicantLabel: 'Elopement Prevention Plan',
    adminLabel: 'Elopement Prevention Plan',
    note: 'required — wandering risk indicated',
  },
  crisis_intervention_plan: {
    type: 'crisis_intervention_plan',
    applicantLabel: 'Crisis Intervention Plan',
    adminLabel: 'Crisis Intervention Plan',
    note: 'required — aggression history indicated',
  },

  // Conditional required — medical complexity --------------------------------
  medical_management_plan: {
    type: 'medical_management_plan',
    applicantLabel: 'Medical Management Plan',
    adminLabel: 'Medical Management Plan',
    note: 'required — medical complexity indicated',
  },
  physician_clearance: {
    type: 'physician_clearance',
    applicantLabel: 'Physician Clearance',
    adminLabel: 'Physician Clearance',
    note: 'required — high medical complexity indicated',
  },
  emergency_protocol: {
    type: 'emergency_protocol',
    applicantLabel: 'Emergency Protocol',
    adminLabel: 'Emergency Protocol',
    note: 'required — high medical complexity indicated',
  },

  // Conditional required — medical devices -----------------------------------
  cpap_waiver: {
    type: 'cpap_waiver',
    applicantLabel: 'CPAP Waiver',
    adminLabel: 'CPAP Waiver',
    note: 'required — CPAP device indicated',
  },
  device_management_plan: {
    type: 'device_management_plan',
    applicantLabel: 'Device Management Plan',
    adminLabel: 'Device Management Plan',
    note: 'required — neurostimulator device indicated',
  },

  // Official forms -----------------------------------------------------------
  official_medical_form: {
    type: 'official_medical_form',
    applicantLabel: 'Medical Examination Form',
    adminLabel: 'Medical Examination Form',
    note: 'physician-signed — Form 4523-ENG-DPH',
  },
  official_english_application: {
    type: 'official_english_application',
    applicantLabel: 'English Application',
    adminLabel: 'English Application (digital)',
    note: 'digital form',
  },
  official_spanish_application: {
    type: 'official_spanish_application',
    applicantLabel: 'Spanish Application',
    adminLabel: 'Spanish Application (digital)',
    note: 'digital form',
  },
  official_cyshcn_form: {
    type: 'official_cyshcn_form',
    applicantLabel: 'CYSHCN Form',
    adminLabel: 'CYSHCN Form (digital)',
    note: 'digital form',
  },
  paper_application_packet: {
    type: 'paper_application_packet',
    applicantLabel: 'Paper Application Packet',
    adminLabel: 'Paper Application Packet',
    note: 'paper submission',
  },

  // Supplementary / misc -----------------------------------------------------
  message_attachment: {
    type: 'message_attachment',
    applicantLabel: 'Message Attachment',
    adminLabel: 'Message Attachment',
    note: 'attached to message',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the display label for a document type, role-specific.
 * Unknown types fall back to title-cased snake_case so raw values never surface.
 */
export function getDocumentLabel(
  type: string | null | undefined,
  role: 'applicant' | 'admin' = 'applicant',
): string {
  if (!type) return '';
  const req = DOCUMENT_REQUIREMENTS[type];
  if (!req) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return role === 'admin' ? req.adminLabel : req.applicantLabel;
}

/**
 * Returns the parenthetical note for a document type requirement.
 * Returns an empty string for unknown types.
 */
export function getDocumentNote(type: string | null | undefined): string {
  if (!type) return '';
  return DOCUMENT_REQUIREMENTS[type]?.note ?? '';
}

// ─── Required-type set ───────────────────────────────────────────────────────
// All document types that belong to the required-document checklist.
// Documents NOT in this set are considered supplementary.

const REQUIRED_DOC_TYPE_SET = new Set<string>([
  // Universal
  'official_medical_form', // canonical key — replaced legacy 'physical_examination' (see 000005 migration)
  'immunization_record',
  'insurance_card',
  // Conditional — seizures
  'seizure_action_plan',
  'seizure_medication_authorization',
  // Conditional — G-tube
  'feeding_action_plan',
  'feeding_equipment_list',
  // Conditional — supervision
  'behavioral_support_plan',
  'staffing_accommodation_request',
  'supervision_justification',
  // Conditional — wandering / aggression
  'elopement_prevention_plan',
  'crisis_intervention_plan',
  // Conditional — medical complexity
  'medical_management_plan',
  'physician_clearance',
  'emergency_protocol',
  // Conditional — devices
  'cpap_waiver',
  'device_management_plan',
  // Official forms (always required, shown in separate form section)
  'paper_application_packet',
]);

/**
 * Returns true when the document type belongs to the required-document checklist.
 * Use this to separate required from supplementary in document list displays.
 */
export function isRequiredDocumentType(type: string | null | undefined): boolean {
  if (!type) return false;
  return REQUIRED_DOC_TYPE_SET.has(type);
}

// ─── Supplementary document type labels ───────────────────────────────────────
// These types are not required by compliance rules but appear as supplementary
// uploads (camper-level documents).  They are not in REQUIRED_DOC_TYPE_SET and
// will not trigger missing-document warnings — they are display-only labels for
// the generic document list.  getDocumentLabel() falls back to title-cased
// snake_case for any type NOT in this map, so this list is informational only.
//
// Canonical snake_case keys for supplementary types (used as document_type in DB):
//   photo_id, medical_waiver, allergy_action_plan, insulin_protocol,
//   emergency_contacts, medical_care_plan, message_attachment
