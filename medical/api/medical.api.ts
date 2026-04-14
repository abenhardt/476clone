/**
 * medical.api.ts
 *
 * Medical portal API calls: records, sub-resources (read + write), treatment logs, documents.
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type {
  Camper,
  MedicalRecord,
  Allergy,
  Medication,
  Diagnosis,
  BehavioralProfile,
  FeedingPlan,
  AssistiveDevice,
  ActivityPermission,
  EmergencyContact,
  Document,
  PersonalCarePlan,
} from '@/features/admin/types/admin.types';

// ─── Camper list ──────────────────────────────────────────────────────────────

export async function getMedicalCampers(params?: { search?: string; page?: number }): Promise<PaginatedResponse<Camper>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Camper>>('/campers', { params });
  return data;
}

// ─── Medical record ───────────────────────────────────────────────────────────

export async function getMedicalRecords(params?: { page?: number; camper_id?: number }): Promise<PaginatedResponse<MedicalRecord>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalRecord>>('/medical-records', { params });
  return data;
}

export async function getMedicalRecord(id: number): Promise<MedicalRecord> {
  const { data } = await axiosInstance.get<ApiResponse<MedicalRecord>>(`/medical-records/${id}`);
  return data.data;
}

export async function getMedicalRecordByCamper(camperId: number): Promise<MedicalRecord | undefined> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalRecord>>('/medical-records', {
    params: { camper_id: camperId },
  });
  return data.data[0];
}

export async function updateMedicalRecord(id: number, payload: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalRecord>>(`/medical-records/${id}`, payload);
  return data.data;
}

// ─── Allergies ────────────────────────────────────────────────────────────────

export async function getAllergies(medicalRecordId: number): Promise<Allergy[]> {
  const { data } = await axiosInstance.get<ApiResponse<Allergy[]>>(`/allergies`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getAllergiesByCamper(camperId: number): Promise<Allergy[]> {
  const { data } = await axiosInstance.get<ApiResponse<Allergy[]>>(`/allergies`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createAllergy(payload: { camper_id: number; allergen: string; severity: string; reaction?: string; treatment?: string }): Promise<Allergy> {
  const { data } = await axiosInstance.post<ApiResponse<Allergy>>('/allergies', payload);
  return data.data;
}

export async function updateAllergy(id: number, payload: Partial<{ allergen: string; severity: string; reaction: string; treatment: string }>): Promise<Allergy> {
  const { data } = await axiosInstance.put<ApiResponse<Allergy>>(`/allergies/${id}`, payload);
  return data.data;
}

// ─── Medications ──────────────────────────────────────────────────────────────

export async function getMedications(medicalRecordId: number): Promise<Medication[]> {
  const { data } = await axiosInstance.get<ApiResponse<Medication[]>>(`/medications`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getMedicationsByCamper(camperId: number): Promise<Medication[]> {
  const { data } = await axiosInstance.get<ApiResponse<Medication[]>>(`/medications`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createMedication(payload: { camper_id: number; name: string; dosage: string; frequency: string; purpose?: string; notes?: string }): Promise<Medication> {
  const { data } = await axiosInstance.post<ApiResponse<Medication>>('/medications', payload);
  return data.data;
}

export async function updateMedication(id: number, payload: Partial<{ name: string; dosage: string; frequency: string; purpose: string; notes: string }>): Promise<Medication> {
  const { data } = await axiosInstance.put<ApiResponse<Medication>>(`/medications/${id}`, payload);
  return data.data;
}

// ─── Diagnoses ────────────────────────────────────────────────────────────────

export async function getDiagnoses(medicalRecordId: number): Promise<Diagnosis[]> {
  const { data } = await axiosInstance.get<ApiResponse<Diagnosis[]>>(`/diagnoses`, {
    params: { medical_record_id: medicalRecordId },
  });
  return data.data;
}

export async function getDiagnosesByCamper(camperId: number): Promise<Diagnosis[]> {
  const { data } = await axiosInstance.get<ApiResponse<Diagnosis[]>>(`/diagnoses`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createDiagnosis(payload: { camper_id: number; name: string; icd_code?: string; notes?: string }): Promise<Diagnosis> {
  const { data } = await axiosInstance.post<ApiResponse<Diagnosis>>('/diagnoses', payload);
  return data.data;
}

export async function updateDiagnosis(id: number, payload: Partial<{ name: string; icd_code: string; notes: string }>): Promise<Diagnosis> {
  const { data } = await axiosInstance.put<ApiResponse<Diagnosis>>(`/diagnoses/${id}`, payload);
  return data.data;
}

// ─── Emergency contacts ───────────────────────────────────────────────────────

export async function getEmergencyContacts(camperId: number): Promise<EmergencyContact[]> {
  const { data } = await axiosInstance.get<ApiResponse<EmergencyContact[]>>(`/emergency-contacts`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

// ─── Activity permissions ─────────────────────────────────────────────────────

export async function getActivityPermissions(camperId: number): Promise<ActivityPermission[]> {
  const { data } = await axiosInstance.get<ApiResponse<ActivityPermission[]>>(`/activity-permissions`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateActivityPermission(id: number, payload: Partial<{ activity_name: string; permission_level: 'yes' | 'no' | 'restricted'; restriction_notes: string }>): Promise<ActivityPermission> {
  const { data } = await axiosInstance.put<ApiResponse<ActivityPermission>>(`/activity-permissions/${id}`, payload);
  return data.data;
}

// ─── Behavioral profile ───────────────────────────────────────────────────────

export async function getBehavioralProfile(camperId: number): Promise<BehavioralProfile | null> {
  const { data } = await axiosInstance.get<ApiResponse<BehavioralProfile | null>>(`/behavioral-profiles`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateBehavioralProfile(id: number, payload: Partial<BehavioralProfile>): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.put<ApiResponse<BehavioralProfile>>(`/behavioral-profiles/${id}`, payload);
  return data.data;
}

export async function createBehavioralProfile(payload: { camper_id: number } & Partial<BehavioralProfile>): Promise<BehavioralProfile> {
  const { data } = await axiosInstance.post<ApiResponse<BehavioralProfile>>('/behavioral-profiles', payload);
  return data.data;
}

// ─── Feeding plan ─────────────────────────────────────────────────────────────

export async function getFeedingPlan(camperId: number): Promise<FeedingPlan | null> {
  const { data } = await axiosInstance.get<ApiResponse<FeedingPlan | null>>(`/feeding-plans`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function updateFeedingPlan(id: number, payload: Partial<FeedingPlan>): Promise<FeedingPlan> {
  const { data } = await axiosInstance.put<ApiResponse<FeedingPlan>>(`/feeding-plans/${id}`, payload);
  return data.data;
}

export async function createFeedingPlan(payload: { camper_id: number } & Partial<FeedingPlan>): Promise<FeedingPlan> {
  const { data } = await axiosInstance.post<ApiResponse<FeedingPlan>>('/feeding-plans', payload);
  return data.data;
}

// ─── Assistive devices ────────────────────────────────────────────────────────

export async function getAssistiveDevices(camperId: number): Promise<AssistiveDevice[]> {
  const { data } = await axiosInstance.get<ApiResponse<AssistiveDevice[]>>(`/assistive-devices`, {
    params: { camper_id: camperId },
  });
  return data.data;
}

export async function createAssistiveDevice(payload: { camper_id: number; type: string; description?: string }): Promise<AssistiveDevice> {
  const { data } = await axiosInstance.post<ApiResponse<AssistiveDevice>>('/assistive-devices', payload);
  return data.data;
}

export async function updateAssistiveDevice(id: number, payload: Partial<{ device_type: string; notes: string; requires_transfer_assistance: boolean }>): Promise<AssistiveDevice> {
  const { data } = await axiosInstance.put<ApiResponse<AssistiveDevice>>(`/assistive-devices/${id}`, payload);
  return data.data;
}

// ─── Treatment logs ───────────────────────────────────────────────────────────

export interface TreatmentLog {
  id: number;
  camper_id: number;
  medical_visit_id?: number | null;
  recorded_by: number;
  recorder?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  treatment_date: string;
  treatment_time?: string;
  type: TreatmentType;
  title: string;
  description: string;
  outcome?: string;
  medication_given?: string;
  dosage_given?: string;
  follow_up_required: boolean;
  follow_up_notes?: string;
  created_at: string;
  updated_at: string;
}

export type TreatmentType =
  | 'medication_administered'
  | 'first_aid'
  | 'observation'
  | 'emergency'
  | 'other';

export interface StoreTreatmentLogPayload {
  camper_id: number;
  medical_visit_id?: number | null;
  treatment_date: string;
  treatment_time?: string;
  type: TreatmentType;
  title: string;
  description: string;
  outcome?: string;
  medication_given?: string;
  dosage_given?: string;
  follow_up_required?: boolean;
  follow_up_notes?: string;
}

export async function getTreatmentLogs(params?: {
  camper_id?: number;
  from?: string;
  to?: string;
  type?: TreatmentType;
  page?: number;
}): Promise<PaginatedResponse<TreatmentLog>> {
  const { data } = await axiosInstance.get<PaginatedResponse<TreatmentLog>>('/treatment-logs', { params });
  return data;
}

export interface AllergyConflict {
  allergen: string;
  severity: string;
  reaction: string | null;
  treatment: string | null;
}

export interface CreateTreatmentLogResult {
  log: TreatmentLog;
  allergyWarnings: AllergyConflict[];
}

export async function createTreatmentLog(payload: StoreTreatmentLogPayload): Promise<CreateTreatmentLogResult> {
  const { data } = await axiosInstance.post<ApiResponse<TreatmentLog> & { allergy_warnings?: AllergyConflict[] }>('/treatment-logs', payload);
  return {
    log: data.data,
    allergyWarnings: data.allergy_warnings ?? [],
  };
}

export async function updateTreatmentLog(id: number, payload: Partial<StoreTreatmentLogPayload>): Promise<TreatmentLog> {
  const { data } = await axiosInstance.put<ApiResponse<TreatmentLog>>(`/treatment-logs/${id}`, payload);
  return data.data;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export interface UploadDocumentPayload {
  file: File;
  documentable_type: 'App\\Models\\Camper' | 'App\\Models\\MedicalRecord';
  documentable_id: number;
  document_type?: string;
}

export async function getCamperDocuments(camperId: number): Promise<PaginatedResponse<Document>> {
  const { data } = await axiosInstance.get<PaginatedResponse<Document>>('/documents', {
    params: { documentable_type: 'App\\Models\\Camper', documentable_id: camperId },
  });
  return data;
}

export async function uploadDocument(payload: UploadDocumentPayload): Promise<Document> {
  const form = new FormData();
  form.append('file', payload.file);
  form.append('documentable_type', payload.documentable_type);
  form.append('documentable_id', String(payload.documentable_id));
  if (payload.document_type) {
    form.append('document_type', payload.document_type);
  }

  const { data } = await axiosInstance.post<ApiResponse<Document>>('/documents', form, {
    headers: { 'Content-Type': undefined },
  });
  return data.data;
}

export async function downloadDocument(id: number): Promise<Blob> {
  const { data } = await axiosInstance.get(`/documents/${id}/download`, { responseType: 'blob' });
  return data;
}

// ─── Delete operations ────────────────────────────────────────────────────────

export async function deleteAllergy(id: number): Promise<void> {
  await axiosInstance.delete(`/allergies/${id}`);
}

export async function deleteMedication(id: number): Promise<void> {
  await axiosInstance.delete(`/medications/${id}`);
}

export async function deleteDiagnosis(id: number): Promise<void> {
  await axiosInstance.delete(`/diagnoses/${id}`);
}

export async function deleteAssistiveDevice(id: number): Promise<void> {
  await axiosInstance.delete(`/assistive-devices/${id}`);
}

export async function deleteTreatmentLog(id: number): Promise<void> {
  await axiosInstance.delete(`/treatment-logs/${id}`);
}

export async function deleteDocument(id: number): Promise<void> {
  await axiosInstance.delete(`/documents/${id}`);
}

// ─── Medical Stats ────────────────────────────────────────────────────────────

export interface MedicalStats {
  campers: {
    total: number;
    with_severe_allergies: number;
    on_medications: number;
    with_active_restrictions: number;
    missing_medical_record: number;
  };
  follow_ups: {
    due_today: number;
    overdue: number;
    open: number;
  };
  recent_activity: {
    treatments: TreatmentLog[];
    incidents: MedicalIncident[];
    visits: MedicalVisit[];
  };
  treatment_type_counts: Record<string, number>;
}

export async function getMedicalStats(): Promise<MedicalStats> {
  const { data } = await axiosInstance.get<{ data: MedicalStats }>('/medical/stats');
  return data.data;
}

// ─── Medical Incidents ────────────────────────────────────────────────────────

export type IncidentType =
  | 'behavioral'
  | 'medical'
  | 'injury'
  | 'environmental'
  | 'emergency'
  | 'other';

export type IncidentSeverity = 'minor' | 'moderate' | 'severe' | 'critical';

export interface MedicalIncident {
  id: number;
  camper_id: number;
  recorded_by: number;
  treatment_log_id?: number;
  recorder?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  type: IncidentType;
  severity: IncidentSeverity;
  location?: string;
  title: string;
  description: string;
  witnesses?: string;
  escalation_required: boolean;
  escalation_notes?: string;
  incident_date: string;
  incident_time?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreMedicalIncidentPayload {
  camper_id: number;
  treatment_log_id?: number;
  type: IncidentType;
  severity: IncidentSeverity;
  location?: string;
  title: string;
  description: string;
  witnesses?: string;
  escalation_required?: boolean;
  escalation_notes?: string;
  incident_date: string;
  incident_time?: string;
}

export async function getMedicalIncidents(params?: {
  camper_id?: number;
  type?: IncidentType;
  severity?: IncidentSeverity;
  from?: string;
  to?: string;
  page?: number;
}): Promise<PaginatedResponse<MedicalIncident>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalIncident>>('/medical-incidents', { params });
  return data;
}

export async function createMedicalIncident(payload: StoreMedicalIncidentPayload): Promise<MedicalIncident> {
  const { data } = await axiosInstance.post<ApiResponse<MedicalIncident>>('/medical-incidents', payload);
  return data.data;
}

export async function updateMedicalIncident(id: number, payload: Partial<StoreMedicalIncidentPayload>): Promise<MedicalIncident> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalIncident>>(`/medical-incidents/${id}`, payload);
  return data.data;
}

export async function deleteMedicalIncident(id: number): Promise<void> {
  await axiosInstance.delete(`/medical-incidents/${id}`);
}

// ─── Medical Follow-Ups ───────────────────────────────────────────────────────

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type FollowUpPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface MedicalFollowUp {
  id: number;
  camper_id: number;
  created_by: number;
  assigned_to?: number;
  treatment_log_id?: number;
  creator?: { id: number; name: string };
  assignee?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  title: string;
  notes?: string;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  due_date: string;
  completed_at?: string;
  completed_by?: number;
  created_at: string;
  updated_at: string;
}

export interface StoreMedicalFollowUpPayload {
  camper_id: number;
  assigned_to?: number;
  treatment_log_id?: number;
  title: string;
  notes?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  due_date: string;
}

export async function getMedicalFollowUps(params?: {
  camper_id?: number;
  status?: FollowUpStatus;
  assigned_to?: number;
  overdue?: boolean;
  page?: number;
}): Promise<PaginatedResponse<MedicalFollowUp>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalFollowUp>>('/medical-follow-ups', { params });
  return data;
}

export async function createMedicalFollowUp(payload: StoreMedicalFollowUpPayload): Promise<MedicalFollowUp> {
  const { data } = await axiosInstance.post<ApiResponse<MedicalFollowUp>>('/medical-follow-ups', payload);
  return data.data;
}

export async function updateMedicalFollowUp(id: number, payload: Partial<StoreMedicalFollowUpPayload & { status: FollowUpStatus }>): Promise<MedicalFollowUp> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalFollowUp>>(`/medical-follow-ups/${id}`, payload);
  return data.data;
}

export async function deleteMedicalFollowUp(id: number): Promise<void> {
  await axiosInstance.delete(`/medical-follow-ups/${id}`);
}

// ─── Medical Visits ───────────────────────────────────────────────────────────

export type VisitDisposition =
  | 'returned_to_activity'
  | 'monitoring'
  | 'sent_home'
  | 'emergency_transfer'
  | 'other';

export interface MedicalVisitVitals {
  temp?: number;
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  weight?: number;
  spo2?: number;
}

export interface MedicalVisit {
  id: number;
  camper_id: number;
  recorded_by: number;
  recorder?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  visit_date: string;
  visit_time?: string;
  chief_complaint: string;
  symptoms: string;
  vitals?: MedicalVisitVitals;
  treatment_provided?: string;
  medications_administered?: string;
  disposition: VisitDisposition;
  disposition_notes?: string;
  follow_up_required: boolean;
  follow_up_notes?: string;
  /** Treatment logs performed during this visit — populated on show() only. */
  treatment_logs?: TreatmentLog[];
  created_at: string;
  updated_at: string;
}

export interface StoreMedicalVisitPayload {
  camper_id: number;
  visit_date: string;
  visit_time?: string;
  chief_complaint: string;
  symptoms: string;
  vitals?: MedicalVisitVitals;
  treatment_provided?: string;
  medications_administered?: string;
  disposition: VisitDisposition;
  disposition_notes?: string;
  follow_up_required?: boolean;
  follow_up_notes?: string;
}

export async function getMedicalVisit(id: number): Promise<MedicalVisit> {
  const { data } = await axiosInstance.get<ApiResponse<MedicalVisit>>(`/medical-visits/${id}`);
  return data.data;
}

export async function getMedicalVisits(params?: {
  camper_id?: number;
  disposition?: VisitDisposition;
  from?: string;
  to?: string;
  page?: number;
}): Promise<PaginatedResponse<MedicalVisit>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalVisit>>('/medical-visits', { params });
  return data;
}

export async function createMedicalVisit(payload: StoreMedicalVisitPayload): Promise<MedicalVisit> {
  const { data } = await axiosInstance.post<ApiResponse<MedicalVisit>>('/medical-visits', payload);
  return data.data;
}

export async function updateMedicalVisit(id: number, payload: Partial<StoreMedicalVisitPayload>): Promise<MedicalVisit> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalVisit>>(`/medical-visits/${id}`, payload);
  return data.data;
}

export async function deleteMedicalVisit(id: number): Promise<void> {
  await axiosInstance.delete(`/medical-visits/${id}`);
}

// ─── Medical Restrictions ──────────────────────────────────────────────────────

export type RestrictionType = 'activity' | 'dietary' | 'environmental' | 'medication' | 'other';

export interface MedicalRestriction {
  id: number;
  camper_id: number;
  created_by: number;
  creator?: { id: number; name: string };
  camper?: { id: number; full_name: string };
  restriction_type: RestrictionType;
  description: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StoreMedicalRestrictionPayload {
  camper_id: number;
  restriction_type: RestrictionType;
  description: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

export async function getMedicalRestrictions(params?: {
  camper_id?: number;
  restriction_type?: RestrictionType;
  is_active?: boolean;
  page?: number;
}): Promise<PaginatedResponse<MedicalRestriction>> {
  const { data } = await axiosInstance.get<PaginatedResponse<MedicalRestriction>>('/medical-restrictions', { params });
  return data;
}

export async function createMedicalRestriction(payload: StoreMedicalRestrictionPayload): Promise<MedicalRestriction> {
  const { data } = await axiosInstance.post<ApiResponse<MedicalRestriction>>('/medical-restrictions', payload);
  return data.data;
}

export async function updateMedicalRestriction(id: number, payload: Partial<StoreMedicalRestrictionPayload>): Promise<MedicalRestriction> {
  const { data } = await axiosInstance.put<ApiResponse<MedicalRestriction>>(`/medical-restrictions/${id}`, payload);
  return data.data;
}

export async function deleteMedicalRestriction(id: number): Promise<void> {
  await axiosInstance.delete(`/medical-restrictions/${id}`);
}

// ─── Medical Alerts ────────────────────────────────────────────────────────────

export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertCategory = 'allergy' | 'seizure' | 'device' | 'diagnosis' | 'medication';

export interface MedicalAlert {
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  detail: string | null;
}

export async function getCamperMedicalAlerts(camperId: number): Promise<MedicalAlert[]> {
  const { data } = await axiosInstance.get<ApiResponse<MedicalAlert[]>>(`/campers/${camperId}/medical-alerts`);
  return data.data;
}

// ─── Personal Care Plan ───────────────────────────────────────────────────────

export async function getPersonalCarePlan(camperId: number): Promise<PersonalCarePlan | null> {
  const { data } = await axiosInstance.get<ApiResponse<PersonalCarePlan | null>>(`/campers/${camperId}/personal-care-plan`);
  return data.data;
}
