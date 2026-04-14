/**
 * camp.types.ts
 * Domain types for camps, sessions, campers, applications, and medical data.
 */

// ---------------------------------------------------------------------------
// Camps & Sessions
// ---------------------------------------------------------------------------

export interface Camp {
  id: number;
  name: string;
  description: string;
  location: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  camp_id: number;
  camp?: Camp;
  name: string;
  start_date: string;
  end_date: string;
  capacity: number;
  enrolled_count: number;
  available_spots: number;
  status: 'open' | 'closed' | 'waitlist' | 'cancelled' | 'upcoming' | 'active' | 'completed';
  age_min?: number;
  age_max?: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Campers
// ---------------------------------------------------------------------------

export interface Camper {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other';
  tshirt_size: 'YS' | 'YM' | 'YL' | 'AS' | 'AM' | 'AL' | 'AXL' | 'A2XL';
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface RiskSummary {
  camper_id: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  flags: string[];
  last_updated: string;
}

export interface ComplianceStatus {
  camper_id: number;
  medical_record_complete: boolean;
  documents_complete: boolean;
  application_signed: boolean;
  missing_items: string[];
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'waitlisted'
  | 'withdrawn';

// ---------------------------------------------------------------------------
// Official Form Templates
// ---------------------------------------------------------------------------

/** The four official form types served from storage/app/forms. */
export type OfficialFormTypeKey =
  | 'english_application'
  | 'spanish_application'
  | 'medical_form'
  | 'cyshcn_form';

/**
 * Metadata for a downloadable official form template.
 * Returned by GET /api/form-templates (authenticated) and GET /api/forms (public).
 */
export interface OfficialFormTemplate {
  id: OfficialFormTypeKey;
  label: string;
  description: string;
  download_filename: string;
  /** document_type value stored in documents table when this form is uploaded */
  document_type: string;
  requires_medical_signature: boolean;
  available: boolean;
  /** Reserved for future CDN/signed-URL delivery. Not returned by current API. */
  url?: string;
}

export interface Application {
  id: number;
  camper_id: number;
  camper?: Camper;
  session_id: number;
  session?: Session;
  status: ApplicationStatus;
  is_draft?: boolean;
  reapplied_from_id?: number | null;
  notes?: string;
  review_notes?: string;
  reviewed_by?: number;
  reviewed_at?: string;
  signed_at?: string;
  signature_name?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Medical Records (CYSHCN sub-resources)
// ---------------------------------------------------------------------------

export interface MedicalRecord {
  id: number;
  camper_id: number;
  is_active?: boolean;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  physician_name?: string;
  physician_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Allergy {
  id: number;
  camper_id: number;
  allergen: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  treatment: string;
  epi_pen_required: boolean;
}

export interface Medication {
  id: number;
  camper_id: number;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  prescribing_physician: string;
  purpose: string;
  requires_refrigeration: boolean;
  self_administered: boolean;
}

export interface Diagnosis {
  id: number;
  camper_id: number;
  condition: string;
  icd_code?: string;
  diagnosed_date?: string;
  notes?: string;
}

export interface BehavioralProfile {
  id: number;
  camper_id: number;
  triggers?: string;
  calming_strategies?: string;
  behavioral_supports?: string;
  communication_style?: string;
  sensory_considerations?: string;
}

export interface FeedingPlan {
  id: number;
  camper_id: number;
  diet_type?: string;
  texture_modification?: string;
  fluid_consistency?: string;
  allergies_restrictions?: string;
  feeding_method?: string;
  notes?: string;
}

export interface AssistiveDevice {
  id: number;
  camper_id: number;
  device_type: string;
  description: string;
  required_for_mobility: boolean;
  notes?: string;
}

export interface ActivityPermission {
  id: number;
  camper_id: number;
  activity: string;
  permitted: boolean;
  modifications?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export interface Document {
  id: number;
  camper_id?: number;
  user_id: number;
  filename: string;
  original_filename: string;
  name?: string;
  mime_type: string;
  size: number;
  document_type?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider Links
// ---------------------------------------------------------------------------

export interface ProviderLink {
  id: number;
  camper_id: number;
  camper?: Camper;
  token: string;
  provider_name?: string;
  provider_email?: string;
  expires_at: string;
  used_at?: string;
  revoked_at?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notification {
  /** UUID string — Laravel database notifications use UUID primary keys. */
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export interface Conversation {
  id: number;
  subject: string;
  participants: ConversationParticipant[];
  last_message?: Message;
  unread_count: number;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: number;
  name: string;
  email: string;
  roles: string[];
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: ConversationParticipant;
  body: string;
  attachments?: Document[];
  read_by: number[];
  created_at: string;
  updated_at: string;
}
