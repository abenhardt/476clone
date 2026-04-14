/**
 * applicant.api.ts
 * API calls for applicant-role users: sessions, campers, applications, documents.
 */

import axiosInstance from '@/api/axios.config';
import type {
  ApiResponse,
  PaginatedResponse,
  Camper,
  Application,
  Session,
} from '@/shared/types';

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export async function getCampers(): Promise<Camper[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers');
  return data.data ?? [];
}

export async function getCamper(id: number): Promise<Camper> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}

export interface CreateCamperPayload {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  tshirt_size?: string;
  preferred_name?: string;
  county?: string;
  needs_interpreter?: boolean;
  preferred_language?: string;
  // Form parity — applicant mailing address (may differ from guardian)
  applicant_address?: string;
  applicant_city?: string;
  applicant_state?: string;
  applicant_zip?: string;
}

export async function createCamper(
  payload: CreateCamperPayload
): Promise<Camper> {
  const { data } = await axiosInstance.post<ApiResponse<Camper>>(
    '/campers',
    payload
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export async function getApplications(): Promise<Application[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<Application>>(
    '/applications'
  );
  return data.data ?? [];
}

export async function getApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.get<ApiResponse<Application>>(
    `/applications/${id}`
  );
  return data.data;
}

export interface CreateApplicationPayload {
  camper_id: number;
  session_id: number;
  narrative_rustic_environment?: string;
  narrative_staff_suggestions?: string;
  narrative_participation_concerns?: string;
  narrative_camp_benefit?: string;
  narrative_heat_tolerance?: string;
  narrative_transportation?: string;
  narrative_additional_info?: string;
  narrative_emergency_protocols?: string;
  // Form parity meta fields
  first_application?: boolean;
  attended_before?: boolean;
  session_id_second?: number;
  // Reapplication audit trail — set when this application originates from a
  // previous one. Links the new record to the original for admin visibility.
  reapplied_from_id?: number;
}

export async function createApplication(
  payload: CreateApplicationPayload
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    '/applications',
    payload
  );
  return data.data;
}

export async function signApplication(
  id: number,
  signatureName: string,
  signatureData: string
): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/sign`,
    { signature_name: signatureName, signature_data: signatureData }
  );
  return data.data;
}

/**
 * Withdraw an application. Parent-initiated only.
 * Valid from: pending, under_review, approved, waitlisted.
 * If the application was approved, the backend deactivates the camper
 * and medical record if no other approved enrollment exists.
 */
export async function withdrawApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/withdraw`
  );
  return data.data;
}

export type ConsentType = 'general' | 'photos' | 'liability' | 'activity' | 'authorization' | 'medication' | 'hipaa';

export interface ConsentPayload {
  consent_type: ConsentType;
  guardian_name: string;
  guardian_relationship: string;
  guardian_signature: string;
  applicant_signature?: string;
  signed_at: string;
}

/**
 * Store the 5 signed consent records for an application.
 * Called after signApplication() during the final submission step.
 * Each consent_type must be unique per application (backend upserts).
 */
export async function storeConsents(
  applicationId: number,
  consents: ConsentPayload[]
): Promise<void> {
  await axiosInstance.post(`/applications/${applicationId}/consents`, { consents });
}

/**
 * Clone an existing terminal application into a new draft.
 * The clone shares the same camper_id, is_draft=true, and reapplied_from_id
 * pointing to the source application. Only terminal applications can be cloned.
 * NOTE: This endpoint is kept for administrative use. The applicant-facing
 * "Apply for a New Session" flow does not call this — it passes reapplied_from_id
 * through the standard createApplication() call instead.
 */
export async function cloneApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(
    `/applications/${id}/clone`
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Application Drafts (server-side save slots)
// ---------------------------------------------------------------------------

/**
 * A server-side save slot for an in-progress application form.
 * draft_data is the full FormState JSON — present only in the `show` response.
 */
export interface ApplicationDraft {
  id: number;
  label: string;
  draft_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** List all drafts for the authenticated user (no draft_data in list response). */
export async function getDrafts(): Promise<ApplicationDraft[]> {
  const { data } = await axiosInstance.get<{ data: ApplicationDraft[] }>('/application-drafts');
  return data.data ?? [];
}

/** Create a new empty draft save slot. Returns the created draft with its id. */
export async function createDraft(label?: string): Promise<ApplicationDraft> {
  const { data } = await axiosInstance.post<{ data: ApplicationDraft }>('/application-drafts', {
    label: label ?? 'New Application',
  });
  return data.data;
}

/** Fetch a single draft including its full draft_data. */
export async function getDraft(id: number): Promise<ApplicationDraft> {
  const { data } = await axiosInstance.get<{ data: ApplicationDraft }>(`/application-drafts/${id}`);
  return data.data;
}

/**
 * Auto-save the full form state to a draft slot.
 *
 * Pass `lastKnownUpdatedAt` (the `updated_at` from the last successful save or
 * fetch) to enable the server-side optimistic concurrency guard. The server
 * returns 409 if another tab has already overwritten the draft since that
 * timestamp. Returns the server's new `updated_at` value on success so the
 * caller can keep their local copy in sync.
 */
export async function saveDraft(
  id: number,
  label: string,
  draftData: Record<string, unknown>,
  lastKnownUpdatedAt?: string,
): Promise<string | undefined> {
  const { data } = await axiosInstance.put<{ data: { id: number; label: string; updated_at: string } }>(
    `/application-drafts/${id}`,
    {
      label,
      draft_data: draftData,
      ...(lastKnownUpdatedAt ? { last_known_updated_at: lastKnownUpdatedAt } : {}),
    },
  );
  return data.data?.updated_at;
}

/** Permanently delete a draft. No confirmation on the server — confirm in the UI. */
export async function deleteDraft(id: number): Promise<void> {
  await axiosInstance.delete(`/application-drafts/${id}`);
}

/**
 * Delete an Application record that is still in draft state (is_draft = true).
 * The backend enforces this constraint via ApplicationPolicy — submitting a
 * request to delete a non-draft application will return 403.
 */
export async function deleteApplication(id: number): Promise<void> {
  await axiosInstance.delete(`/applications/${id}`);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  const { data } = await axiosInstance.get<{ data: Session[] }>('/sessions');
  return data.data ?? [];
}

// ---------------------------------------------------------------------------
// Application submission resources
// ---------------------------------------------------------------------------

export interface CreateEmergencyContactPayload {
  camper_id: number;
  name: string;
  relationship: string;
  phone_primary: string;
  phone_secondary?: string;
  phone_work?: string;
  is_primary: boolean;
  is_authorized_pickup: boolean;
  is_guardian?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  primary_language?: string;
  interpreter_needed?: boolean;
}

export async function createEmergencyContact(
  payload: CreateEmergencyContactPayload
): Promise<void> {
  await axiosInstance.post('/emergency-contacts', payload);
}


export interface CreateDiagnosisPayload {
  camper_id: number;
  name: string;
  severity_level: string;
  notes?: string;
}

export async function createDiagnosis(
  payload: CreateDiagnosisPayload
): Promise<void> {
  await axiosInstance.post('/diagnoses', payload);
}

export interface CreateAllergyPayload {
  camper_id: number;
  allergen: string;
  severity: string;
  reaction?: string;
  treatment?: string;
}

export async function createAllergy(
  payload: CreateAllergyPayload
): Promise<void> {
  await axiosInstance.post('/allergies', payload);
}

export interface CreateBehavioralProfilePayload {
  camper_id: number;
  aggression: boolean;
  self_abuse: boolean;
  wandering_risk: boolean;
  one_to_one_supervision: boolean;
  developmental_delay: boolean;
  functional_reading?: boolean;
  functional_writing?: boolean;
  independent_mobility?: boolean;
  verbal_communication?: boolean;
  social_skills?: boolean;
  behavior_plan?: boolean;
  functioning_age_level?: string;
  communication_methods?: string[];
  notes?: string;
  // Form parity fields (2026_03_26_000001)
  sexual_behaviors?: boolean;
  interpersonal_behavior?: boolean;
  social_emotional?: boolean;
  follows_instructions?: boolean;
  group_participation?: boolean;
  attends_school?: boolean;
  classroom_type?: string;
  aggression_description?: string;
  self_abuse_description?: string;
  one_to_one_description?: string;
  wandering_description?: string;
  sexual_behaviors_description?: string;
  interpersonal_behavior_description?: string;
  social_emotional_description?: string;
  follows_instructions_description?: string;
  group_participation_description?: string;
}

export async function createBehavioralProfile(
  payload: CreateBehavioralProfilePayload
): Promise<void> {
  await axiosInstance.post('/behavioral-profiles', payload);
}

export interface CreateAssistiveDevicePayload {
  camper_id: number;
  device_type: string;
  requires_transfer_assistance: boolean;
  notes?: string;
}

export async function createAssistiveDevice(
  payload: CreateAssistiveDevicePayload
): Promise<void> {
  await axiosInstance.post('/assistive-devices', payload);
}

export interface CreateFeedingPlanPayload {
  camper_id: number;
  special_diet: boolean;
  diet_description?: string;
  texture_modified?: boolean;
  texture_level?: string;
  fluid_restriction?: boolean;
  fluid_details?: string;
  g_tube: boolean;
  formula?: string;
  amount_per_feeding?: string;
  feedings_per_day?: number;
  feeding_times?: string[];
  bolus_only?: boolean;
  notes?: string;
}

export interface StoreHealthProfilePayload {
  // Physician
  physician_name?: string;
  physician_phone?: string;
  physician_address?: string;
  // Insurance
  insurance_provider?: string;
  insurance_policy?: string;      // mapped to insurance_policy_number by backend
  insurance_group?: string;
  medicaid_number?: string;
  // Immunization
  immunizations_current?: boolean;
  tetanus_date?: string;
  date_of_medical_exam?: string;
  // Seizure history
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  // Other health flags
  has_neurostimulator?: boolean;
  // Mobility
  mobility_notes?: string;
  // Other
  has_contagious_illness?: boolean;
  contagious_illness_description?: string;
  tubes_in_ears?: boolean;
  has_recent_illness?: boolean;
  recent_illness_description?: string;
}

export async function storeHealthProfile(
  camperId: number,
  payload: StoreHealthProfilePayload
): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/health-profile`, payload);
}

export interface CreatePersonalCarePlanPayload {
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
  urinary_catheter?: boolean;
  // Form parity (2026_03_26_000005)
  irregular_bowel?: boolean;
  irregular_bowel_notes?: string;
  menstruation_support?: boolean;
}

export async function createPersonalCarePlan(
  camperId: number,
  payload: CreatePersonalCarePlanPayload
): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/personal-care-plan`, payload);
}

export async function createFeedingPlan(
  payload: CreateFeedingPlanPayload
): Promise<void> {
  await axiosInstance.post('/feeding-plans', payload);
}

export interface CreateMedicationPayload {
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}

export async function createMedication(
  payload: CreateMedicationPayload
): Promise<void> {
  await axiosInstance.post('/medications', payload);
}

export interface CreateActivityPermissionPayload {
  camper_id: number;
  activity_name: string;
  permission_level: string;
  restriction_notes?: string;
}

export async function createActivityPermission(
  payload: CreateActivityPermissionPayload
): Promise<void> {
  await axiosInstance.post('/activity-permissions', payload);
}

export async function uploadDocument(formData: FormData): Promise<Document> {
  const { data } = await axiosInstance.post<ApiResponse<Document>>('/documents', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data.data;
}

// ---------------------------------------------------------------------------
// Documents (applicant portal)
// ---------------------------------------------------------------------------

export interface Document {
  id: number;
  file_name: string;
  /** Raw model field name — present when document comes from eager-loaded relation (not API transform). */
  original_filename?: string;
  document_type: string;
  mime_type: string;
  size: number;
  created_at: string;
  url: string;
  /** Null = draft (not yet submitted to staff). Set = submitted and visible to admins. */
  submitted_at: string | null;
}

export async function getDocuments(): Promise<Document[]> {
  const { data } = await axiosInstance.get<{ data: Document[] }>('/documents');
  return data.data ?? [];
}

export async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}

/** Promote a draft document to submitted state, making it visible to admins. */
export async function submitDocument(id: number): Promise<Document> {
  const { data } = await axiosInstance.patch<{ data: Document }>(`/documents/${id}/submit`);
  return data.data;
}

// ─── Required Documents (sent by admin) ──────────────────────────────────────

export interface RequiredDocument {
  id: number;
  original_file_name: string;
  instructions: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  created_at: string;
  download_url: string;
  submitted_file_name: string | null;
  download_submitted_url: string | null;
}

export async function getRequiredDocuments(): Promise<RequiredDocument[]> {
  const { data } = await axiosInstance.get('/applicant/documents');
  return data;
}

export async function submitCompletedDocument(id: number, file: File): Promise<RequiredDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('applicant_document_id', String(id));
  const { data } = await axiosInstance.post('/applicant/documents/upload', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

// ─── Document Requests (new request lifecycle system) ─────────────────────────

export type DocumentRequestStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'scanning'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentRequestRecord {
  id: number;
  applicant_id: number;
  camper_id: number | null;
  camper_name: string | null;
  requested_by_admin_id: number;
  requested_by_name: string;
  document_type: string;
  instructions: string | null;
  status: DocumentRequestStatus;
  due_date: string | null;
  uploaded_file_name: string | null;
  uploaded_at: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  download_url: string | null;
  created_at: string;
}

export async function getDocumentRequests(): Promise<DocumentRequestRecord[]> {
  const { data } = await axiosInstance.get('/applicant/document-requests');
  return data;
}

export async function uploadDocumentRequest(id: number, file: File): Promise<DocumentRequestRecord> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(`/applicant/document-requests/${id}/upload`, formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Active Form Schema
// ---------------------------------------------------------------------------

import type { FormSchema } from '@/features/forms/types/form.types';

/**
 * Fetch the currently active application form schema.
 * Returns sections, fields, options, and conditional logic rules.
 * Used by ApplicationFormPage to optionally fetch schema for future schema-driven rendering.
 */
export async function getActiveFormSchema(): Promise<FormSchema> {
  const { data } = await axiosInstance.get<{ data: FormSchema }>('/form/active');
  return data.data;
}

// ---------------------------------------------------------------------------
// Official Form Templates
// ---------------------------------------------------------------------------

import type { OfficialFormTemplate } from '@/shared/types';

/**
 * Fetch metadata for all four official form templates.
 * Returns label, description, document_type, and availability for each form.
 * Authenticated — logs the fetch in the audit trail.
 */
export async function getFormTemplates(): Promise<OfficialFormTemplate[]> {
  const { data } = await axiosInstance.get<{ data: OfficialFormTemplate[] }>('/form-templates');
  return data.data;
}

/**
 * Download a blank official form template PDF.
 * Returns a Blob for browser download via URL.createObjectURL.
 *
 * @param type - one of: english_application | spanish_application | medical_form | cyshcn_form
 * @returns Blob with application/pdf content
 */
export async function downloadFormTemplate(type: string): Promise<Blob> {
  const response = await axiosInstance.get(`/form-templates/${type}/download`, {
    responseType: 'blob',
  });
  return response.data as Blob;
}
