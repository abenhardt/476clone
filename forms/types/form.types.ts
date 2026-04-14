/**
 * form.types.ts — TypeScript types for the dynamic application form schema.
 *
 * These types match the JSON shape returned by:
 *   GET /api/form/active          → FormSchema
 *   GET /api/form/definitions/{id} → FormDefinitionDetail
 *
 * The applicant-facing renderer uses FormSchema to render the form.
 * The admin Form Builder uses FormDefinitionDetail (includes inactive items).
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkbox_group'
  | 'file'
  | 'email'
  | 'phone'
  | 'yesno'
  | 'repeater'
  | 'signature'
  | 'address'
  | 'divider'
  | 'section_header';

export type FieldWidth = 'full' | 'half' | 'third';
export type FormDefinitionStatus = 'draft' | 'active' | 'archived';

// ─── Option types ─────────────────────────────────────────────────────────────

export interface FormFieldOption {
  id: number;
  label: string;
  value: string;
  sort_order: number;
  is_active?: boolean;
}

// ─── Field types ──────────────────────────────────────────────────────────────

/** Schema shape returned by the public active-form endpoint (applicant-facing). */
export interface FormFieldSchema {
  id: number;
  field_key: string;
  label: string;
  placeholder: string | null;
  help_text: string | null;
  field_type: FieldType;
  is_required: boolean;
  sort_order: number;
  validation_rules: Record<string, unknown> | null;
  conditional_logic: { show_if: { field_key: string; equals: unknown } } | null;
  default_value: string | null;
  width: FieldWidth;
  options: FormFieldOption[];
}

/** Extended schema for admin Form Builder (includes is_active). */
export interface FormFieldAdmin extends FormFieldSchema {
  is_active: boolean;
}

// ─── Section types ────────────────────────────────────────────────────────────

export interface FormSectionSchema {
  id: number;
  title: string;
  short_title: string;
  description: string | null;
  icon_name: string | null;
  sort_order: number;
  fields: FormFieldSchema[];
}

export interface FormSectionAdmin extends Omit<FormSectionSchema, 'fields'> {
  is_active: boolean;
  field_count: number;
  fields: FormFieldAdmin[];
}

// ─── Definition types ─────────────────────────────────────────────────────────

/** Lightweight list item returned by GET /api/form/definitions */
export interface FormDefinitionListItem {
  id: number;
  name: string;
  version: number;
  status: FormDefinitionStatus;
  description: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  section_count: number;
}

/** Full definition returned by GET /api/form/definitions/{id} (admin use) */
export interface FormDefinitionDetail {
  id: number;
  name: string;
  slug: string;
  version: number;
  status: FormDefinitionStatus;
  description: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  is_editable: boolean;
  sections: FormSectionAdmin[];
}

/** Active schema returned by GET /api/form/active (applicant use) */
export interface FormSchema {
  id: number;
  name: string;
  version: number;
  status: FormDefinitionStatus;
  sections: FormSectionSchema[];
}

// ─── Mutation payload types ───────────────────────────────────────────────────

export interface CreateFormDefinitionPayload {
  name: string;
  description?: string | null;
}

export interface UpdateFormDefinitionPayload {
  name?: string;
  description?: string | null;
}

export interface CreateSectionPayload {
  title: string;
  short_title: string;
  description?: string | null;
  icon_name?: string | null;
  sort_order?: number;
}

export interface UpdateSectionPayload extends Partial<CreateSectionPayload> {
  is_active?: boolean;
}

export interface CreateFieldPayload {
  field_key: string;
  label: string;
  placeholder?: string | null;
  help_text?: string | null;
  field_type: FieldType;
  is_required?: boolean;
  sort_order?: number;
  validation_rules?: Record<string, unknown> | null;
  conditional_logic?: { show_if: { field_key: string; equals: unknown } } | null;
  default_value?: string | null;
  width?: FieldWidth;
}

export interface UpdateFieldPayload extends Partial<CreateFieldPayload> {
  is_active?: boolean;
}

export interface CreateOptionPayload {
  label: string;
  value: string;
  sort_order?: number;
}

export interface UpdateOptionPayload extends Partial<CreateOptionPayload> {
  is_active?: boolean;
}
