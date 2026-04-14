/**
 * admin.types.ts
 * Type definitions scoped to the admin feature.
 */

import type { ApplicationStatus } from '@/shared/types';

export interface ApplicationReviewPayload {
  // Valid admin review statuses. 'submitted' and 'withdrawn' are excluded:
  // — 'submitted' is the initial post-submission state, never set by admin review action.
  // — 'withdrawn' is parent-initiated only, via the separate /withdraw endpoint.
  status: 'approved' | 'rejected' | 'under_review' | 'waitlisted' | 'cancelled';
  notes?: string;
  // Set when the admin explicitly chose "Approve Anyway" after seeing the missing-data modal.
  override_incomplete?: boolean;
  // Snapshot of what was missing, sent back to the backend so it can be audit-logged.
  missing_summary?: {
    missing_fields: CompletenessItem[];
    missing_documents: CompletenessItem[];
    unverified_documents: CompletenessItem[];
    missing_consents: CompletenessItem[];
  };
}

export interface CompletenessItem {
  key: string;
  label: string;
  severity: 'high' | 'medium';
}

export interface ApplicationCompleteness {
  is_complete: boolean;
  missing_fields: CompletenessItem[];
  /** Documents that have not been uploaded at all, or have expired. */
  missing_documents: CompletenessItem[];
  /** Documents that have been uploaded but not yet verified by an admin. Distinct from missing. */
  unverified_documents: CompletenessItem[];
  missing_consents: CompletenessItem[];
}

export interface Camp {
  id: number;
  name: string;
  location: string;
  description?: string;
  sessions?: CampSession[];
  created_at?: string;
  updated_at?: string;
}

export interface CampSession {
  id: number;
  camp_id: number;
  camp?: Camp;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count?: number;
  remaining_capacity?: number;
  is_active?: boolean;
  /** Admin-controlled: true when the session is open for applications in the parent portal. */
  portal_open?: boolean;
  /** Status computed by the backend — combines camp schedule with admin-controlled application window. */
  status?: 'upcoming' | 'open' | 'in_session' | 'closed' | 'completed';
  registration_opens_at?: string;
  registration_closes_at?: string;
  min_age?: number;
  max_age?: number;
  created_at?: string;
}

export interface Application {
  id: number;
  camper_id: number;
  camp_session_id: number;
  // 'draft' is not a status value — it is represented by the is_draft boolean.
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'cancelled' | 'waitlisted' | 'withdrawn';
  is_draft?: boolean;
  // True when an admin overrode the completeness warning and approved with known gaps.
  is_incomplete_at_approval?: boolean;
  // Set when this application was created by cloning a prior one (reapplication flow).
  reapplied_from_id?: number | null;
  /** Human-readable public identifier (e.g. "CBG-2026-042"). Use this in all UI display instead of id. */
  application_number?: string;
  /** Queue position within the session — only populated on single-record detail fetches. */
  queue_position?: { position: number; total: number } | null;
  /** FIFO queue rank within the current list view — injected by the list endpoint, null for drafts. */
  queue_rank?: number | null;
  notes?: string;
  // Application meta fields (set at submission time)
  first_application?: boolean;
  attended_before?: boolean;
  camp_session_id_second?: number | null;
  // Narrative fields — completed by applicant, editable by admins at any time.
  narrative_rustic_environment?: string | null;
  narrative_staff_suggestions?: string | null;
  narrative_participation_concerns?: string | null;
  narrative_camp_benefit?: string | null;
  narrative_heat_tolerance?: string | null;
  narrative_transportation?: string | null;
  narrative_additional_info?: string | null;
  narrative_emergency_protocols?: string | null;
  submitted_at?: string;
  reviewed_at?: string;
  reviewer_id?: number;
  signed_at?: string;
  signature_name?: string;
  created_at: string;
  updated_at?: string;
  camper?: Camper;
  session?: CampSession;
  /** Second-choice session, loaded by the show() endpoint (from secondSession relationship → snake_case: second_session). Null when no second choice was given. */
  second_session?: CampSession | null;
  documents?: Document[];
  consents?: ApplicationConsent[];
}

export interface ApplicationConsent {
  id: number;
  application_id: number;
  consent_type: 'general' | 'photos' | 'liability' | 'activity' | 'authorization' | 'medication' | 'hipaa';
  guardian_name: string;
  guardian_relationship: string;
  signed_at: string;
  consent_given: boolean;
}

export interface Camper {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string;
  tshirt_size?: string;
  is_active?: boolean;
  // Phase 2 camper fields
  preferred_name?: string;
  county?: string;
  needs_interpreter?: boolean;
  preferred_language?: string;
  // Applicant mailing address (street address is hidden PHI; city/state/zip are returned by API)
  applicant_city?: string;
  applicant_state?: string;
  applicant_zip?: string;
  created_at: string;
  user?: { id: number; name: string; email: string };
  medical_record?: MedicalRecord;
  emergency_contacts?: EmergencyContact[];
  behavioral_profile?: BehavioralProfile;
  feeding_plan?: FeedingPlan;
  personal_care_plan?: PersonalCarePlan;
  assistive_devices?: AssistiveDevice[];
  activity_permissions?: ActivityPermission[];
  medications?: Medication[];
  diagnoses?: Diagnosis[];
  allergies?: Allergy[];
  applications?: Application[];
}

export interface MedicalRecord {
  id: number;
  camper_id: number;
  is_active?: boolean;
  primary_diagnosis?: string;
  physician_name?: string;
  physician_phone?: string;
  physician_address?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_group?: string;
  medicaid_number?: string;
  special_needs?: string;
  dietary_restrictions?: string;
  notes?: string;
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  has_neurostimulator?: boolean;
  date_of_medical_exam?: string;
  // Phase 2 extended health fields
  immunizations_current?: boolean;
  tetanus_date?: string;
  mobility_notes?: string;
  has_contagious_illness?: boolean;
  contagious_illness_description?: string;
  tubes_in_ears?: boolean;
  has_recent_illness?: boolean;
  recent_illness_description?: string;
  allergies?: Allergy[];
  medications?: Medication[];
  diagnoses?: Diagnosis[];
}

export interface PersonalCarePlan {
  id: number;
  camper_id: number;
  bathing_level?: string;
  bathing_notes?: string;
  toileting_level?: string;
  toileting_notes?: string;
  nighttime_toileting?: boolean;
  nighttime_notes?: string;
  dressing_level?: string;
  dressing_notes?: string;
  oral_hygiene_level?: string;
  oral_hygiene_notes?: string;
  positioning_notes?: string;
  sleep_notes?: string;
  falling_asleep_issues?: boolean;
  sleep_walking?: boolean;
  night_wandering?: boolean;
  bowel_control_notes?: string;
  irregular_bowel?: boolean;
  irregular_bowel_notes?: string;
  urinary_catheter?: boolean;
  menstruation_support?: boolean;
}

export interface Allergy {
  id: number;
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
  treatment?: string;
}

export interface Medication {
  id: number;
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}

export interface Diagnosis {
  id: number;
  name: string;
  icd_code?: string;
  notes?: string;
}

export interface BehavioralProfile {
  id: number;
  camper_id?: number;
  triggers?: string;
  de_escalation_strategies?: string;
  communication_style?: string;
  notes?: string;
  // Core functional ability flags
  aggression?: boolean;
  aggression_description?: string;
  self_abuse?: boolean;
  self_abuse_description?: string;
  wandering_risk?: boolean;
  wandering_description?: string;
  one_to_one_supervision?: boolean;
  one_to_one_description?: string;
  developmental_delay?: boolean;
  functioning_age_level?: string;
  functional_reading?: boolean;
  functional_writing?: boolean;
  independent_mobility?: boolean;
  verbal_communication?: boolean;
  social_skills?: boolean;
  behavior_plan?: boolean;
  communication_methods?: string[];
  // Phase 2 extended behavioral flags
  sexual_behaviors?: boolean;
  sexual_behaviors_description?: string;
  interpersonal_behavior?: boolean;
  interpersonal_behavior_description?: string;
  social_emotional?: boolean;
  social_emotional_description?: string;
  follows_instructions?: boolean;
  follows_instructions_description?: string;
  group_participation?: boolean;
  group_participation_description?: string;
  attends_school?: boolean;
  classroom_type?: string;
}

export interface FeedingPlan {
  id: number;
  camper_id?: number;
  method?: string;
  restrictions?: string;
  notes?: string;
  // Phase 2 feeding fields
  special_diet?: boolean;
  diet_description?: string;
  texture_modified?: boolean;
  texture_level?: string;
  fluid_restriction?: boolean;
  fluid_details?: string;
  g_tube?: boolean;
  formula?: string;
  amount_per_feeding?: string;
  feedings_per_day?: number;
  feeding_times?: string[];
  bolus_only?: boolean;
}

export interface AssistiveDevice {
  id: number;
  device_type: string;
  requires_transfer_assistance?: boolean;
  notes?: string;
}

export interface ActivityPermission {
  id: number;
  activity_name: string;
  permission_level: 'yes' | 'no' | 'restricted';
  restriction_notes?: string;
}

export interface EmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  is_authorized_pickup?: boolean;
  // Phase 2 guardian fields
  is_guardian?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone_work?: string;
  primary_language?: string;
  interpreter_needed?: boolean;
}

export interface Document {
  id: number;
  /** Returned by DocumentController.transformDocument() (document list / verify endpoints). */
  file_name: string;
  /** Raw model field name present when documents are eager-loaded inside an application response. */
  original_filename?: string;
  name?: string;
  document_type: string | null;
  mime_type: string;
  /** Mapped to "size" by DocumentController.transformDocument(); raw eager-loads return file_size. */
  size?: number;
  file_size?: number;
  /**
   * Admin verification state for this document.
   * 'pending'  — uploaded but not yet reviewed by staff (default for new uploads).
   * 'approved' — reviewed and verified by an admin; satisfies the requirement.
   * 'rejected' — reviewed and rejected; applicant must replace the file.
   */
  verification_status?: 'pending' | 'approved' | 'rejected';
  /** ISO date string after which the document is considered expired and must be re-submitted. */
  expiration_date?: string | null;
  created_at: string;
  /** Null = draft (not yet submitted to staff); set = submitted and visible to admins. */
  submitted_at?: string | null;
  /** Set when the document has been archived; null when active. */
  archived_at?: string | null;
  url: string;
}

export interface ProviderLink {
  id: number;
  camper_id: number;
  camper?: Camper;
  token: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read_at?: string;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface AuditLogEntry {
  id: number;
  request_id?: string;
  user_id: number | null;
  user?: { id: number; name: string; email: string } | null;
  event_type?: string;
  category?: string;
  action: string;
  description?: string | null;
  human_description?: string;
  auditable_type: string | null;
  auditable_id: number | null;
  entity_label?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  email_verified_at?: string;
  mfa_enabled?: boolean;
  created_at: string;
}

// ─── Family Management Types ────────────────────────────────────────────────
// These types power the 3-level family-first admin IA:
//   FamilyCamperSummary  → used in FamilyCard (Level 1 summary cards)
//   FamilyCard           → one item in the GET /families paginated list
//   FamilyWorkspaceCamperApplication → one application row in the workspace
//   FamilyWorkspaceCamper → one child card in the family workspace (Level 2)
//   FamilyWorkspace      → full family workspace data (Level 2)

export interface FamilyCamperSummary {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string;
  applications_count: number;
  latest_application?: {
    id: number;
    status: Application['status'];
    submitted_at?: string | null;
    session_name?: string | null;
    session_id?: number | null;
  } | null;
}

export interface FamilyCard {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
  campers_count: number;
  campers: FamilyCamperSummary[];
  active_applications_count: number;
  application_statuses: Application['status'][];
}

export interface FamiliesSummary {
  total_families: number;
  total_campers: number;
  active_applications: number;
  multi_camper_families: number;
}

export interface FamiliesResponse {
  data: FamilyCard[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  summary: FamiliesSummary;
}

export interface FamilyWorkspaceApplication {
  id: number;
  status: Application['status'];
  is_draft?: boolean;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  camp_session_id: number;
  session?: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active?: boolean;
  } | null;
}

export interface FamilyWorkspaceCamper {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender?: string | null;
  tshirt_size?: string | null;
  created_at: string;
  applications: FamilyWorkspaceApplication[];
}

export interface FamilyWorkspace {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  created_at: string;
  campers: FamilyWorkspaceCamper[];
}

export interface SessionDashboardStats {
  session: {
    id: number;
    name: string;
    camp: string | null;
    start_date: string;
    end_date: string;
    is_active: boolean;
    portal_open: boolean;
  };
  capacity_stats: {
    capacity: number;
    enrolled: number;
    remaining: number;
    fill_percentage: number;
    is_at_capacity: boolean;
  };
  application_stats: {
    total_submitted: number;
    pending: number;
    under_review: number;
    approved: number;
    rejected: number;
    waitlisted: number;
    cancelled: number;
    acceptance_rate: number;
  };
  family_stats: {
    registered_families: number;
    registered_campers: number;
    active_applications: number;
    multi_camper_families: number;
  };
  recent_applications: Array<{
    id: number;
    camper_name: string | null;
    status: ApplicationStatus;
    submitted_at: string | null;
  }>;
  age_distribution: Record<string, number>;
  gender_distribution: Record<string, number>;
}

// ── Risk Assessment (Phase 16) ───────────────────────────────────────────────

export type RiskLevelColor = 'low' | 'moderate' | 'high';
export type RiskReviewStatus = 'system_calculated' | 'reviewed' | 'overridden';
export type SupervisionLevelValue = 'standard' | 'enhanced' | 'one_to_one';

export interface RiskFactor {
  key: string;
  label: string;
  category: 'medical' | 'behavioral' | 'physical' | 'feeding' | 'allergy';
  points: number;
  present: boolean;
  count?: number;
  per_item?: boolean;
  source: string;
  tooltip: string;
}

export interface RiskRecommendation {
  flag: string;
  priority: 'critical' | 'high' | 'standard';
  text: string;
}

export interface RiskAssessmentReviewer {
  id: number;
  name: string;
}

export interface RiskAssessment {
  id: number;
  camper_id: number;
  calculated_at: string;

  // Score
  risk_score: number;
  risk_level: string;
  risk_level_color: RiskLevelColor;

  // System-calculated supervision
  supervision_level: SupervisionLevelValue;
  supervision_label: string;
  staffing_ratio: string;

  // Effective supervision (may differ if overridden)
  effective_supervision_level: SupervisionLevelValue;
  effective_supervision_label: string;
  effective_staffing_ratio: string;
  is_overridden: boolean;

  // Complexity tier
  medical_complexity_tier: 'low' | 'moderate' | 'high';
  complexity_label: string;

  // Factor breakdown and flags
  flags: string[];
  factor_breakdown: RiskFactor[];

  // Review state
  review_status: RiskReviewStatus;
  review_status_label: string;
  is_reviewed_by_staff: boolean;
  reviewed_by: RiskAssessmentReviewer | null;
  reviewed_at: string | null;
  clinical_notes: string | null;

  // Override
  override_supervision_level: SupervisionLevelValue | null;
  override_supervision_label: string | null;
  override_reason: string | null;
  overridden_by: RiskAssessmentReviewer | null;
  overridden_at: string | null;

  // Recommendations
  recommendations?: RiskRecommendation[];

  is_current: boolean;
}
