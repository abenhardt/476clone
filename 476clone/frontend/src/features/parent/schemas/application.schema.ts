/**
 * application.schema.ts
 * Zod schemas for each step of the multi-step camper application form.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Step 1: Camper Info
// ---------------------------------------------------------------------------

export const camperInfoSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  date_of_birth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
      return age >= 4 && age <= 25;
    }, 'Camper must be between 4 and 25 years old'),
  gender: z.enum(
    ['male', 'female', 'non_binary', 'prefer_not_to_say', 'other'],
    { errorMap: () => ({ message: 'Please select a gender' }) }
  ),
  tshirt_size: z.enum(
    ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'],
    { errorMap: () => ({ message: 'Please select a shirt size' }) }
  ),
});

export type CamperInfoValues = z.infer<typeof camperInfoSchema>;

// ---------------------------------------------------------------------------
// Step 2: Session Selection
// ---------------------------------------------------------------------------

export const sessionSelectionSchema = z.object({
  session_id: z
    .number({ invalid_type_error: 'Please select a session' })
    .min(1, 'Please select a session'),
});

export type SessionSelectionValues = z.infer<typeof sessionSelectionSchema>;

// ---------------------------------------------------------------------------
// Step 3: Medical Basics
// ---------------------------------------------------------------------------

const allergySchema = z.object({
  allergen: z.string().min(1, 'Allergen is required'),
  reaction: z.string().min(1, 'Reaction is required'),
  severity: z.enum(['mild', 'moderate', 'severe', 'life_threatening']),
  treatment: z.string().min(1, 'Treatment is required'),
  epi_pen_required: z.boolean(),
});

const medicationSchema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  route: z.string().min(1, 'Route is required'),
  prescribing_physician: z.string().min(1, 'Prescribing physician is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  requires_refrigeration: z.boolean(),
  self_administered: z.boolean(),
});

export const medicalBasicsSchema = z.object({
  primary_diagnosis: z.string().optional(),
  physician_name: z.string().optional(),
  physician_phone: z.string().optional(),
  allergies: z.array(allergySchema).default([]),
  medications: z.array(medicationSchema).default([]),
});

export type MedicalBasicsValues = z.infer<typeof medicalBasicsSchema>;

// ---------------------------------------------------------------------------
// Step 5: Signature
// ---------------------------------------------------------------------------

export const signatureSchema = z.object({
  signature_name: z
    .string()
    .min(2, 'Please enter your full name as signature'),
  confirmed: z
    .boolean()
    .refine((v) => v === true, 'You must confirm the information is accurate'),
});

export type SignatureValues = z.infer<typeof signatureSchema>;

// ---------------------------------------------------------------------------
// Combined form data (assembled across all steps)
// ---------------------------------------------------------------------------

export interface ApplicationFormData {
  camperInfo: CamperInfoValues;
  sessionSelection: SessionSelectionValues;
  medicalBasics: MedicalBasicsValues;
  uploadedDocumentIds: number[];
  signature: SignatureValues;
}
