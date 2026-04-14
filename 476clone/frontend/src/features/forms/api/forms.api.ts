/**
 * forms.api.ts — Admin Form Builder API calls.
 *
 * Used by the super-admin Form Builder page to manage form definitions,
 * sections, fields, and options.
 *
 * Applicants use getActiveFormSchema() in applicant.api.ts instead.
 */

import axiosInstance from '@/api/axios.config';
import type {
  CreateFieldPayload,
  CreateFormDefinitionPayload,
  CreateOptionPayload,
  CreateSectionPayload,
  FormDefinitionDetail,
  FormDefinitionListItem,
  FormFieldAdmin,
  FormFieldOption,
  FormSchema,
  FormSectionAdmin,
  UpdateFieldPayload,
  UpdateFormDefinitionPayload,
  UpdateOptionPayload,
  UpdateSectionPayload,
} from '../types/form.types';

// ─── Helper type ──────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  data: T;
  message?: string;
}

// ─── Public schema endpoint ───────────────────────────────────────────────────

/** Fetch the active form schema — used by both applicants and the form preview panel. */
export async function getActiveFormSchema(): Promise<FormSchema> {
  const { data } = await axiosInstance.get<ApiResponse<FormSchema>>('/form/active');
  return data.data;
}

/** Fetch a specific form version by ID — used when reviewing historical applications. */
export async function getFormVersion(formId: number): Promise<FormSchema> {
  const { data } = await axiosInstance.get<ApiResponse<FormSchema>>(`/form/version/${formId}`);
  return data.data;
}

// ─── Form Definition CRUD ─────────────────────────────────────────────────────

export async function listFormDefinitions(): Promise<FormDefinitionListItem[]> {
  const { data } = await axiosInstance.get<ApiResponse<FormDefinitionListItem[]>>('/form/definitions');
  return data.data;
}

export async function getFormDefinition(id: number): Promise<FormDefinitionDetail> {
  const { data } = await axiosInstance.get<ApiResponse<FormDefinitionDetail>>(`/form/definitions/${id}`);
  return data.data;
}

export async function createFormDefinition(payload: CreateFormDefinitionPayload): Promise<{ id: number; version: number; status: string }> {
  const { data } = await axiosInstance.post<ApiResponse<{ id: number; version: number; status: string }>>('/form/definitions', payload);
  return data.data;
}

export async function updateFormDefinition(id: number, payload: UpdateFormDefinitionPayload): Promise<void> {
  await axiosInstance.put(`/form/definitions/${id}`, payload);
}

export async function deleteFormDefinition(id: number): Promise<void> {
  await axiosInstance.delete(`/form/definitions/${id}`);
}

export async function publishFormDefinition(id: number): Promise<void> {
  await axiosInstance.post(`/form/definitions/${id}/publish`);
}

export async function duplicateFormDefinition(id: number): Promise<{ id: number; version: number; status: string }> {
  const { data } = await axiosInstance.post<ApiResponse<{ id: number; version: number; status: string }>>(`/form/definitions/${id}/duplicate`);
  return data.data;
}

// ─── Section CRUD ─────────────────────────────────────────────────────────────

export async function listSections(formId: number): Promise<FormSectionAdmin[]> {
  const { data } = await axiosInstance.get<ApiResponse<FormSectionAdmin[]>>(`/form/definitions/${formId}/sections`);
  return data.data;
}

export async function createSection(formId: number, payload: CreateSectionPayload): Promise<FormSectionAdmin> {
  const { data } = await axiosInstance.post<ApiResponse<FormSectionAdmin>>(`/form/definitions/${formId}/sections`, payload);
  return data.data;
}

export async function updateSection(formId: number, sectionId: number, payload: UpdateSectionPayload): Promise<FormSectionAdmin> {
  const { data } = await axiosInstance.put<ApiResponse<FormSectionAdmin>>(`/form/definitions/${formId}/sections/${sectionId}`, payload);
  return data.data;
}

export async function deleteSection(formId: number, sectionId: number): Promise<void> {
  await axiosInstance.delete(`/form/definitions/${formId}/sections/${sectionId}`);
}

export async function reorderSections(formId: number, ids: number[]): Promise<void> {
  await axiosInstance.post(`/form/definitions/${formId}/sections/reorder`, { ids });
}

// ─── Field CRUD ───────────────────────────────────────────────────────────────

export async function listFields(sectionId: number): Promise<FormFieldAdmin[]> {
  const { data } = await axiosInstance.get<ApiResponse<FormFieldAdmin[]>>(`/form/sections/${sectionId}/fields`);
  return data.data;
}

export async function createField(sectionId: number, payload: CreateFieldPayload): Promise<FormFieldAdmin> {
  const { data } = await axiosInstance.post<ApiResponse<FormFieldAdmin>>(`/form/sections/${sectionId}/fields`, payload);
  return data.data;
}

export async function updateField(sectionId: number, fieldId: number, payload: UpdateFieldPayload): Promise<FormFieldAdmin> {
  const { data } = await axiosInstance.put<ApiResponse<FormFieldAdmin>>(`/form/sections/${sectionId}/fields/${fieldId}`, payload);
  return data.data;
}

export async function deleteField(sectionId: number, fieldId: number): Promise<void> {
  await axiosInstance.delete(`/form/sections/${sectionId}/fields/${fieldId}`);
}

export async function reorderFields(sectionId: number, ids: number[]): Promise<void> {
  await axiosInstance.post(`/form/sections/${sectionId}/fields/reorder`, { ids });
}

export async function activateField(fieldId: number): Promise<void> {
  await axiosInstance.post(`/form/fields/${fieldId}/activate`);
}

export async function deactivateField(fieldId: number): Promise<void> {
  await axiosInstance.post(`/form/fields/${fieldId}/deactivate`);
}

// ─── Option CRUD ──────────────────────────────────────────────────────────────

export async function listOptions(fieldId: number): Promise<FormFieldOption[]> {
  const { data } = await axiosInstance.get<ApiResponse<FormFieldOption[]>>(`/form/fields/${fieldId}/options`);
  return data.data;
}

export async function createOption(fieldId: number, payload: CreateOptionPayload): Promise<FormFieldOption> {
  const { data } = await axiosInstance.post<ApiResponse<FormFieldOption>>(`/form/fields/${fieldId}/options`, payload);
  return data.data;
}

export async function updateOption(fieldId: number, optionId: number, payload: UpdateOptionPayload): Promise<FormFieldOption> {
  const { data } = await axiosInstance.put<ApiResponse<FormFieldOption>>(`/form/fields/${fieldId}/options/${optionId}`, payload);
  return data.data;
}

export async function deleteOption(fieldId: number, optionId: number): Promise<void> {
  await axiosInstance.delete(`/form/fields/${fieldId}/options/${optionId}`);
}

export async function reorderOptions(fieldId: number, ids: number[]): Promise<void> {
  await axiosInstance.post(`/form/fields/${fieldId}/options/reorder`, { ids });
}
