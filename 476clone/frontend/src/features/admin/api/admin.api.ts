/**
 * admin.api.ts — All admin-scoped API calls
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type {
  Application, ApplicationCompleteness, ApplicationReviewPayload, AuditLogEntry,
  BehavioralProfile, Camp, Camper, CampSession, Document, EmergencyContact,
  FamilyWorkspace, ProviderLink, RiskAssessment, User,
} from '@/features/admin/types/admin.types';

export async function getApplications(params?: { page?: number; per_page?: number; status?: string; search?: string; camp_session_id?: number; drafts_only?: boolean; sort?: string; direction?: 'asc' | 'desc' }): Promise<PaginatedResponse<Application>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Application>>('/applications', { params });
  return data;
}
export async function getApplication(id: number): Promise<Application> {
  const { data } = await axiosInstance.get<ApiResponse<Application>>(`/applications/${id}`);
  return data.data;
}
export async function reviewApplication(id: number, payload: ApplicationReviewPayload): Promise<Application> {
  const { data } = await axiosInstance.post<ApiResponse<Application>>(`/applications/${id}/review`, payload);
  return data.data;
}

/** Pre-approval completeness check. Returns structured missing-data report for the warning modal. */
export async function checkApplicationCompleteness(id: number): Promise<ApplicationCompleteness> {
  const { data } = await axiosInstance.get<ApiResponse<ApplicationCompleteness>>(`/applications/${id}/completeness`);
  return data.data;
}

/** One required-document entry as returned by the backend compliance service. */
export interface ComplianceRequiredDoc {
  document_type: string;
  description: string;
  is_mandatory: boolean;
}

/**
 * Backend-computed compliance status for a camper.
 *
 * The `required_documents` array is the authoritative list of which document types
 * are required for this specific camper based on their medical profile and risk
 * assessment. Use this in the admin Application Review to drive the Required Documents
 * section instead of recomputing conditions client-side.
 *
 * Route: GET /api/campers/{camperId}/compliance-status
 */
export interface CamperComplianceStatus {
  is_compliant: boolean;
  required_documents: ComplianceRequiredDoc[];
  missing_documents: { document_type: string; description: string }[];
  expired_documents: { document_id: number; document_type: string; expiration_date: string }[];
  unverified_documents: { document_id: number; document_type: string; verification_status: string }[];
}

/**
 * Fetch the backend-computed compliance status for a camper.
 * Returns the full list of required document types for this camper's medical profile,
 * plus compliance gaps (missing, expired, unverified).
 *
 * This is the canonical source of truth for which documents are required —
 * it runs the same SpecialNeedsRiskAssessmentService + DocumentEnforcementService
 * logic that gates application approval on the backend.
 */
export async function getCamperComplianceStatus(camperId: number): Promise<CamperComplianceStatus> {
  const { data } = await axiosInstance.get<ApiResponse<CamperComplianceStatus>>(`/campers/${camperId}/compliance-status`);
  return data.data;
}

/** Update application content fields (narratives, notes). Admin/super_admin only after submission. */
export interface UpdateApplicationPayload {
  notes?: string;
  narrative_rustic_environment?: string;
  narrative_staff_suggestions?: string;
  narrative_participation_concerns?: string;
  narrative_camp_benefit?: string;
  narrative_heat_tolerance?: string;
  narrative_transportation?: string;
  narrative_additional_info?: string;
  narrative_emergency_protocols?: string;
}
export async function updateApplication(id: number, payload: UpdateApplicationPayload): Promise<Application> {
  const { data } = await axiosInstance.put<ApiResponse<Application>>(`/applications/${id}`, payload);
  return data.data;
}

export async function deleteApplication(id: number): Promise<void> { await axiosInstance.delete(`/applications/${id}`); }

// ─── Admin application field editing ──────────────────────────────────────
// These complement updateApplication (narratives) — they edit the underlying
// camper profile, emergency contacts, and behavioral profile directly.

export interface UpdateCamperPayload {
  first_name?: string;
  last_name?: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  tshirt_size?: string;
  county?: string;
  needs_interpreter?: boolean;
  preferred_language?: string;
}
export async function updateCamper(id: number, payload: UpdateCamperPayload): Promise<Camper> {
  const { data } = await axiosInstance.put<ApiResponse<Camper>>(`/campers/${id}`, payload);
  return data.data;
}

export interface UpdateEmergencyContactPayload {
  name?: string;
  relationship?: string;
  phone_primary?: string;
  phone_secondary?: string;
  phone_work?: string;
  email?: string;
  is_authorized_pickup?: boolean;
  is_primary?: boolean;
  is_guardian?: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  primary_language?: string;
  interpreter_needed?: boolean;
}
export async function updateEmergencyContact(id: number, payload: UpdateEmergencyContactPayload): Promise<EmergencyContact> {
  const { data } = await axiosInstance.put<ApiResponse<EmergencyContact>>(`/emergency-contacts/${id}`, payload);
  return data.data;
}
export interface CreateEmergencyContactPayload extends UpdateEmergencyContactPayload {
  camper_id: number;
  name: string;
  relationship: string;
  phone_primary: string;
}
export async function createEmergencyContact(payload: CreateEmergencyContactPayload): Promise<EmergencyContact> {
  const { data } = await axiosInstance.post<ApiResponse<EmergencyContact>>('/emergency-contacts', payload);
  return data.data;
}
export async function deleteEmergencyContact(id: number): Promise<void> {
  await axiosInstance.delete(`/emergency-contacts/${id}`);
}

export interface UpdateBehavioralProfilePayload {
  triggers?: string;
  de_escalation_strategies?: string;
  communication_style?: string;
  notes?: string;
  // Functional ability flags + optional descriptions
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
  // Phase 2 behavioral flags
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
export async function updateBehavioralProfile(id: number, payload: UpdateBehavioralProfilePayload): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.put<ApiResponse<BehavioralProfile>>(`/behavioral-profiles/${id}`, payload);
  return data.data;
}

/**
 * Upload a file on behalf of an applicant, attached to the camper's document record.
 *
 * Documents must be attached to the Camper (documentable_type = Camper) so that
 * DocumentEnforcementService can locate them during compliance checks at approval time.
 * The show() endpoint merges camper-level documents into application.documents for the UI,
 * so callers should add the returned document to application.documents locally.
 */
export async function uploadDocumentOnBehalf(
  camperId: number,
  file: File,
  documentType?: string,
): Promise<Document> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('documentable_type', 'App\\Models\\Camper');
  fd.append('documentable_id', String(camperId));
  if (documentType) fd.append('document_type', documentType);
  const { data } = await axiosInstance.post('/documents', fd, {
    headers: { 'Content-Type': undefined },
  });
  return data.data;
}

/** Fetch all emergency contacts for a specific camper. */
export async function getEmergencyContacts(camperId: number): Promise<EmergencyContact[]> {
  const { data } = await axiosInstance.get<PaginatedResponse<EmergencyContact>>('/emergency-contacts', {
    params: { camper_id: camperId, per_page: 50 },
  });
  return data.data;
}

// ─── Family endpoints ──────────────────────────────────────────────────────

/** Fetch paginated family summary cards for the Families index page. */
export async function getFamilies(params?: {
  page?: number;
  search?: string;
  session_id?: number;
  status?: string;
  multi_camper?: boolean;
}): Promise<import('@/features/admin/types/admin.types').FamiliesResponse> {
  const { data } = await axiosInstance.get<import('@/features/admin/types/admin.types').FamiliesResponse>('/families', { params });
  return data;
}

/** Fetch the full family workspace for a single guardian (by their user ID). */
export async function getFamily(userId: number): Promise<FamilyWorkspace> {
  const { data } = await axiosInstance.get<ApiResponse<FamilyWorkspace>>(`/families/${userId}`);
  return data.data;
}

// ─── Camper endpoints ──────────────────────────────────────────────────────

export async function getCampers(params?: { page?: number; search?: string; session_id?: number; id?: number }): Promise<PaginatedResponse<Camper>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers', { params });
  return data;
}
export async function getCamper(id: number): Promise<Camper> {
  const { data } = await axiosInstance.get<ApiResponse<Camper>>(`/campers/${id}`);
  return data.data;
}
export async function getCamperRiskSummary(id: number): Promise<unknown> {
  const { data } = await axiosInstance.get(`/campers/${id}/risk-summary`); return data.data;
}

// ── Full risk assessment (Phase 16) ─────────────────────────────────────────

export async function getRiskAssessment(camperId: number): Promise<RiskAssessment> {
  const { data } = await axiosInstance.get<ApiResponse<RiskAssessment>>(`/campers/${camperId}/risk-assessment`);
  return data.data;
}

export async function submitMedicalReview(camperId: number, payload: { clinical_notes?: string }): Promise<RiskAssessment> {
  const { data } = await axiosInstance.post<ApiResponse<RiskAssessment>>(
    `/campers/${camperId}/risk-assessment/review`,
    payload
  );
  return data.data;
}

export async function overrideRiskSupervision(
  camperId: number,
  payload: { override_supervision_level: string; override_reason: string; clinical_notes?: string }
): Promise<RiskAssessment> {
  const { data } = await axiosInstance.post<ApiResponse<RiskAssessment>>(
    `/campers/${camperId}/risk-assessment/override`,
    payload
  );
  return data.data;
}

export async function getRiskAssessmentHistory(camperId: number): Promise<RiskAssessment[]> {
  const { data } = await axiosInstance.get<ApiResponse<RiskAssessment[]>>(
    `/campers/${camperId}/risk-assessment/history`
  );
  return data.data;
}
export async function getCamps(): Promise<Camp[]> {
  const { data } = await axiosInstance.get<ApiResponse<Camp[]>>('/camps'); return data.data;
}
export async function createCamp(payload: Omit<Camp, 'id' | 'created_at' | 'updated_at'>): Promise<Camp> {
  const { data } = await axiosInstance.post<ApiResponse<Camp>>('/camps', payload); return data.data;
}
export async function updateCamp(id: number, payload: Partial<Omit<Camp, 'id'>>): Promise<Camp> {
  const { data } = await axiosInstance.put<ApiResponse<Camp>>(`/camps/${id}`, payload); return data.data;
}
export async function deleteCamp(id: number): Promise<void> { await axiosInstance.delete(`/camps/${id}`); }

export async function getSessions(params?: { camp_id?: number; per_page?: number }): Promise<CampSession[]> {
  const { data } = await axiosInstance.get<ApiResponse<CampSession[]>>('/sessions', { params }); return data.data;
}
export async function createSession(payload: Omit<CampSession, 'id' | 'created_at' | 'camp'>): Promise<CampSession> {
  const { data } = await axiosInstance.post<ApiResponse<CampSession>>('/sessions', payload); return data.data;
}
export async function updateSession(id: number, payload: Partial<Omit<CampSession, 'id'>>): Promise<CampSession> {
  const { data } = await axiosInstance.put<ApiResponse<CampSession>>(`/sessions/${id}`, payload); return data.data;
}
export async function deleteSession(id: number): Promise<void> { await axiosInstance.delete(`/sessions/${id}`); }

export interface ReportsSummary {
  total_campers: number;
  total_applications: number;
  accepted_applications: number;
  pending_applications: number;
  rejected_applications: number;
  applications_by_status: Record<string, number>;
  sessions: { id: number; name: string; capacity: number; enrolled: number }[];
  applications_over_time: { month: string; count: number }[];
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  const { data } = await axiosInstance.get<ApiResponse<ReportsSummary>>('/reports/summary');
  return data.data;
}

type ReportType = 'applications' | 'accepted' | 'rejected' | 'mailing-labels' | 'id-labels';
export async function downloadReport(type: ReportType): Promise<void> {
  const response = await axiosInstance.get(`/reports/${type}`, {
    responseType: 'blob',
    headers: { Accept: 'text/csv, application/octet-stream, */*' },
  });
  const blob = response.data as Blob;
  // Guard: if server returned JSON error instead of CSV, throw rather than download garbage
  if (blob.type && blob.type.includes('application/json')) {
    throw new Error('Server returned an error response instead of CSV.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getProviderLinks(): Promise<ProviderLink[]> {
  const { data } = await axiosInstance.get<ApiResponse<ProviderLink[]>>('/provider-links'); return data.data;
}
export async function createProviderLink(payload: { camper_id: number }): Promise<ProviderLink> {
  const { data } = await axiosInstance.post<ApiResponse<ProviderLink>>('/provider-links', payload); return data.data;
}
export async function revokeProviderLink(id: number): Promise<void> { await axiosInstance.post(`/provider-links/${id}/revoke`); }
export async function resendProviderLink(id: number): Promise<void> { await axiosInstance.post(`/provider-links/${id}/resend`); }

export async function getUsers(params?: { page?: number; search?: string; role?: string }): Promise<PaginatedResponse<User>> {
  const { data } = await axiosInstance.get<PaginatedResponse<User>>('/users', { params }); return data;
}

/** Create a new staff user account (admin/medical/super_admin roles). Super admin only. */
export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: 'admin' | 'medical' | 'super_admin';
}
export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await axiosInstance.post<ApiResponse<User>>('/users', payload);
  return data.data;
}

export async function updateUserRole(id: number, role: string): Promise<User> {
  const { data } = await axiosInstance.put<ApiResponse<User>>(`/users/${id}/role`, { role }); return data.data;
}
export async function deactivateUser(id: number): Promise<void> { await axiosInstance.post(`/users/${id}/deactivate`); }
export async function reactivateUser(id: number): Promise<void> { await axiosInstance.post(`/users/${id}/reactivate`); }

export async function getAuditLog(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  user_id?: number;
  action?: string;
  event_type?: string;
  entity_type?: string;
  from?: string;
  to?: string;
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const { data } = await axiosInstance.get<PaginatedResponse<AuditLogEntry>>('/audit-log', { params });
  return data;
}

export async function exportAuditLog(params: {
  format: 'csv' | 'json';
  search?: string;
  user_id?: number;
  action?: string;
  event_type?: string;
  entity_type?: string;
  from?: string;
  to?: string;
}): Promise<void> {
  const response = await axiosInstance.get('/audit-log/export', { params, responseType: 'blob' });
  const ext      = params.format === 'json' ? 'json' : 'csv';
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.${ext}`;
  const url      = URL.createObjectURL(response.data as Blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Alias used by AdminDashboardPage */
export const getAdminApplications = getApplications;

// ─── Documents (admin inbox) ──────────────────────────────────────────────────

export interface AdminDocument {
  id: number;
  file_name: string;
  document_type: string | null;
  mime_type: string;
  size: number;
  scan_passed: boolean | null;
  verification_status: 'pending' | 'approved' | 'rejected';
  uploaded_by_name: string | null;
  documentable_name: string | null;
  created_at: string;
  archived_at: string | null;
  /** Null = draft (not yet submitted by applicant); set = submitted to staff. */
  submitted_at: string | null;
  url: string;
}

export async function getAdminDocuments(params?: {
  page?: number;
  search?: string;
  verification_status?: string;
  documentable_type?: string;
  include_archived?: boolean;
}): Promise<PaginatedResponse<AdminDocument>> {
  const { data } = await axiosInstance.get<PaginatedResponse<AdminDocument>>('/documents', { params });
  return data;
}

export async function archiveDocument(id: number): Promise<AdminDocument> {
  const { data } = await axiosInstance.patch<{ data: AdminDocument }>(`/documents/${id}/archive`);
  return data.data;
}

export async function restoreDocument(id: number): Promise<AdminDocument> {
  const { data } = await axiosInstance.patch<{ data: AdminDocument }>(`/documents/${id}/restore`);
  return data.data;
}

export async function verifyDocument(id: number, status: 'approved' | 'rejected'): Promise<AdminDocument> {
  const { data } = await axiosInstance.patch<{ data: AdminDocument }>(`/documents/${id}/verify`, { status });
  return data.data;
}

export async function downloadAdminDocument(id: number): Promise<Blob> {
  const { data } = await axiosInstance.get(`/documents/${id}/download`, { responseType: 'blob' });
  return data;
}

// ─── Applicant Documents ─────────────────────────────────────────────────────

export interface ApplicantDocumentRecord {
  id: number;
  applicant_id: number;
  applicant_name: string;
  uploaded_by_admin_id: number;
  admin_name: string;
  original_file_name: string;
  instructions: string | null;
  status: 'pending' | 'submitted' | 'reviewed';
  created_at: string;
  reviewed_at: string | null;
  download_original_url: string;
  download_submitted_url: string | null;
}

export const sendDocumentToApplicant = async (formData: FormData): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.post('/admin/documents/send', formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
};

export const getAdminApplicantDocuments = async (params?: {
  applicant_id?: number;
  status?: string;
  page?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<{ data: ApplicantDocumentRecord[]; meta: any }> => {
  const { data } = await axiosInstance.get('/admin/documents', { params });
  return data;
};

export const getAdminDocumentsForApplicant = async (applicantId: number): Promise<ApplicantDocumentRecord[]> => {
  const { data } = await axiosInstance.get(`/admin/documents/${applicantId}`);
  return data;
};

export const markApplicantDocumentReviewed = async (id: number): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.patch(`/admin/applicant-documents/${id}/review`);
  return data;
};

export const replaceApplicantDocument = async (id: number, formData: FormData): Promise<ApplicantDocumentRecord> => {
  const { data } = await axiosInstance.post(`/admin/applicant-documents/${id}/replace`, formData, {
    headers: { 'Content-Type': undefined },
  });
  return data;
};

// ─── Document Requests ────────────────────────────────────────────────────────

export type DocumentRequestStatus =
  | 'awaiting_upload'
  | 'uploaded'
  | 'scanning'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'overdue';

export interface DocumentRequest {
  id: number;
  applicant_id: number;
  applicant_name: string;
  application_id: number | null;
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
  reviewed_by_name: string | null;
  download_url: string | null;
  created_at: string;
}

export interface DocumentRequestStats {
  total: number;
  awaiting_upload: number;
  uploaded: number;
  under_review: number;
  approved: number;
  rejected: number;
  overdue: number;
}

export const getDocumentRequestStats = async (): Promise<DocumentRequestStats> => {
  const { data } = await axiosInstance.get('/document-requests/stats');
  return data;
};

export const getDocumentRequests = async (params?: {
  applicant_id?: number;
  camper_id?: number;
  status?: string;
  search?: string;
  page?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<{ data: DocumentRequest[]; meta: any }> => {
  const { data } = await axiosInstance.get('/document-requests', { params });
  return data;
};

export const getDocumentRequest = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.get(`/document-requests/${id}`);
  return data;
};

export const createDocumentRequest = async (payload: {
  applicant_id: number;
  application_id?: number | null;
  camper_id?: number | null;
  document_type: string;
  instructions?: string;
  due_date?: string;
}): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.post('/document-requests', payload);
  return data;
};

export const approveDocumentRequest = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/approve`);
  return data;
};

export const rejectDocumentRequest = async (id: number, reason?: string): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/reject`, { reason });
  return data;
};

export const downloadDocumentRequestFile = async (id: number): Promise<Blob> => {
  const { data } = await axiosInstance.get(`/document-requests/${id}/download`, { responseType: 'blob' });
  return data;
};

export const cancelDocumentRequest = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/document-requests/${id}`);
};

export const remindDocumentRequest = async (id: number): Promise<void> => {
  await axiosInstance.post(`/document-requests/${id}/remind`);
};

export const extendDocumentRequestDeadline = async (id: number, due_date: string): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/extend`, { due_date });
  return data;
};

export const requestDocumentReupload = async (id: number): Promise<DocumentRequest> => {
  const { data } = await axiosInstance.patch(`/document-requests/${id}/reupload`);
  return data;
};

export const getSessionDashboard = async (id: number, signal?: AbortSignal): Promise<import('@/features/admin/types/admin.types').SessionDashboardStats> => {
  const { data } = await axiosInstance.get(`/sessions/${id}/dashboard`, { signal });
  return data.data;
};

export const activateSession = async (id: number): Promise<CampSession> => {
  const { data } = await axiosInstance.post<ApiResponse<CampSession>>(`/sessions/${id}/activate`);
  return data.data;
};

export const deactivateSession = async (id: number): Promise<CampSession> => {
  const { data } = await axiosInstance.post<ApiResponse<CampSession>>(`/sessions/${id}/deactivate`);
  return data.data;
};

export const archiveSession = async (id: number): Promise<void> => {
  await axiosInstance.post(`/sessions/${id}/archive`);
};

export async function restoreSession(id: number): Promise<CampSession> {
  const res = await axiosInstance.post<{ message: string; session: CampSession }>(`/sessions/${id}/restore`);
  return res.data.session;
}

// ─── Admin Application Edit — full medical sub-record CRUD ────────────────────
// These endpoints mirror those used by the applicant form, but used by admins
// to edit existing records rather than create them fresh.

// Behavioral profile — create (POST) for campers that don't have one yet
export interface CreateBehavioralProfilePayload extends UpdateBehavioralProfilePayload {
  camper_id: number;
}
export async function createBehavioralProfile(payload: CreateBehavioralProfilePayload): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.post<ApiResponse<BehavioralProfile>>('/behavioral-profiles', payload);
  return data.data;
}

// Medical record — core clinical fields
export interface UpdateMedicalRecordPayload {
  physician_name?: string;
  physician_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  has_seizures?: boolean;
  last_seizure_date?: string;
  seizure_description?: string;
  has_neurostimulator?: boolean;
  date_of_medical_exam?: string;
  special_needs?: string;
  dietary_restrictions?: string;
}
export async function updateMedicalRecord(id: number, payload: UpdateMedicalRecordPayload): Promise<void> {
  await axiosInstance.put(`/medical-records/${id}`, payload);
}

// Health profile — extended fields added in Phase 2 form parity
export interface StoreHealthProfilePayload {
  physician_address?: string;
  insurance_group?: string;
  medicaid_number?: string;
  immunizations_current?: boolean;
  tetanus_date?: string;
  mobility_notes?: string;
  tubes_in_ears?: boolean;
  has_contagious_illness?: boolean;
  contagious_illness_description?: string;
  has_recent_illness?: boolean;
  recent_illness_description?: string;
}
export async function storeHealthProfile(camperId: number, payload: StoreHealthProfilePayload): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/health-profile`, payload);
}

// Diagnoses
export interface DiagnosisPayload { name: string; notes?: string; }
export async function createDiagnosis(payload: DiagnosisPayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/diagnoses', payload);
}
export async function updateDiagnosis(id: number, payload: DiagnosisPayload): Promise<void> {
  await axiosInstance.put(`/diagnoses/${id}`, payload);
}
export async function deleteDiagnosis(id: number): Promise<void> {
  await axiosInstance.delete(`/diagnoses/${id}`);
}

// Allergies
export interface AllergyPayload {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  reaction?: string;
  treatment?: string;
}
export async function createAllergy(payload: AllergyPayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/allergies', payload);
}
export async function updateAllergy(id: number, payload: AllergyPayload): Promise<void> {
  await axiosInstance.put(`/allergies/${id}`, payload);
}
export async function deleteAllergy(id: number): Promise<void> {
  await axiosInstance.delete(`/allergies/${id}`);
}

// Assistive devices
export interface AssistiveDevicePayload {
  device_type: string;
  requires_transfer_assistance?: boolean;
  notes?: string;
}
export async function createAssistiveDevice(payload: AssistiveDevicePayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/assistive-devices', payload);
}
export async function updateAssistiveDevice(id: number, payload: AssistiveDevicePayload): Promise<void> {
  await axiosInstance.put(`/assistive-devices/${id}`, payload);
}
export async function deleteAssistiveDevice(id: number): Promise<void> {
  await axiosInstance.delete(`/assistive-devices/${id}`);
}

// Feeding plan
export interface FeedingPlanPayload {
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
  notes?: string;
}
export async function createFeedingPlan(payload: FeedingPlanPayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/feeding-plans', payload);
}
export async function updateFeedingPlan(id: number, payload: FeedingPlanPayload): Promise<void> {
  await axiosInstance.put(`/feeding-plans/${id}`, payload);
}

// Personal care plan — idempotent POST (backend uses updateOrCreate)
export interface PersonalCarePlanPayload {
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
export async function storePersonalCarePlan(camperId: number, payload: PersonalCarePlanPayload): Promise<void> {
  await axiosInstance.post(`/campers/${camperId}/personal-care-plan`, payload);
}

// Activity permissions
export interface ActivityPermissionPayload {
  activity_name: string;
  permission_level: 'yes' | 'no' | 'restricted';
  restriction_notes?: string;
}
export async function createActivityPermission(payload: ActivityPermissionPayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/activity-permissions', payload);
}
export async function updateActivityPermission(id: number, payload: ActivityPermissionPayload): Promise<void> {
  await axiosInstance.put(`/activity-permissions/${id}`, payload);
}

// Medications
export interface MedicationPayload {
  name: string;
  dosage: string;
  frequency: string;
  route?: string;
  purpose?: string;
  prescribing_physician?: string;
  notes?: string;
}
export async function createMedication(payload: MedicationPayload & { camper_id: number }): Promise<void> {
  await axiosInstance.post('/medications', payload);
}
export async function updateMedication(id: number, payload: MedicationPayload): Promise<void> {
  await axiosInstance.put(`/medications/${id}`, payload);
}
export async function deleteMedication(id: number): Promise<void> {
  await axiosInstance.delete(`/medications/${id}`);
}

// Document delete (admin)
export async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}
