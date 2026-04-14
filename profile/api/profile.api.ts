/**
 * profile.api.ts
 *
 * User profile: personal info, avatar, address, emergency contacts,
 * MFA setup/disable, notification preferences, and account controls.
 */

import { axiosInstance } from '@/api/axios.config';
import type { ApiResponse } from '@/shared/types/api.types';
import type { User, UserEmergencyContact } from '@/shared/types/user.types';

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface ProfileUpdatePayload {
  name?: string;
  preferred_name?: string | null;
  email?: string;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export async function getProfile(): Promise<User> {
  const { data } = await axiosInstance.get<ApiResponse<User>>('/profile');
  return data.data;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
  const { data } = await axiosInstance.put<ApiResponse<User>>('/profile', payload);
  return data.data;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const fd = new FormData();
  fd.append('avatar', file);
  const { data } = await axiosInstance.post<{ avatar_url: string }>(
    '/profile/avatar',
    fd,
    { headers: { 'Content-Type': undefined } }
  );
  return data;
}

export async function removeAvatar(): Promise<void> {
  await axiosInstance.delete('/profile/avatar');
}

// ---------------------------------------------------------------------------
// Emergency contacts
// ---------------------------------------------------------------------------

export interface EmergencyContactPayload {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  is_primary?: boolean;
}

export async function getEmergencyContacts(): Promise<UserEmergencyContact[]> {
  const { data } = await axiosInstance.get<ApiResponse<UserEmergencyContact[]>>(
    '/profile/emergency-contacts'
  );
  return data.data;
}

export async function createEmergencyContact(
  payload: EmergencyContactPayload
): Promise<UserEmergencyContact> {
  const { data } = await axiosInstance.post<ApiResponse<UserEmergencyContact>>(
    '/profile/emergency-contacts',
    payload
  );
  return data.data;
}

export async function updateEmergencyContact(
  id: number,
  payload: Partial<EmergencyContactPayload>
): Promise<UserEmergencyContact> {
  const { data } = await axiosInstance.put<ApiResponse<UserEmergencyContact>>(
    `/profile/emergency-contacts/${id}`,
    payload
  );
  return data.data;
}

export async function deleteEmergencyContact(id: number): Promise<void> {
  await axiosInstance.delete(`/profile/emergency-contacts/${id}`);
}

// ---------------------------------------------------------------------------
// MFA
// ---------------------------------------------------------------------------

export interface MfaSetupResponse {
  secret: string;
  qr_code_url: string;
}

export interface DisableMfaPayload {
  code: string;
  password: string;
}

export async function setupMfa(): Promise<MfaSetupResponse> {
  const { data } = await axiosInstance.post<ApiResponse<MfaSetupResponse>>('/mfa/setup');
  return data.data;
}

export async function verifyMfaSetup(code: string): Promise<void> {
  await axiosInstance.post('/mfa/verify', { code });
}

export async function disableMfa(payload: DisableMfaPayload): Promise<void> {
  await axiosInstance.post('/mfa/disable', payload);
}

// ---------------------------------------------------------------------------
// Pre-fill
// ---------------------------------------------------------------------------

export interface PreFillData {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
}

export async function getPreFillData(): Promise<PreFillData> {
  const { data } = await axiosInstance.get<ApiResponse<PreFillData>>('/profile/prefill');
  return data.data;
}

// ---------------------------------------------------------------------------
// Data & account controls
// ---------------------------------------------------------------------------

export async function deleteAccount(password: string): Promise<{ message: string }> {
  const { data } = await axiosInstance.delete<{ message: string }>('/profile/account', {
    data: { password },
  });
  return data;
}
