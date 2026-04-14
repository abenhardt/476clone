/**
 * permissionMap.ts — Role-to-permission mapping table
 *
 * This is the frontend's RBAC (Role-Based Access Control) truth table.
 * It answers: "Given a role, what specific actions is that user allowed to perform?"
 *
 * Each role maps to an array of Permission strings (defined in permissions.ts).
 * The usePermission() hook reads this map to determine what UI elements to show
 * and what AuthorityGuard gates to open.
 *
 * Note: super_admin receives ALL permissions via `...Object.values(PERMISSIONS)`.
 * The `medical` role is intentionally narrow — read-only access to medical records.
 */

import { PERMISSIONS, Permission } from '@/shared/constants/permissions';
import { RoleName } from '@/shared/constants/roles';

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  super_admin: [
    // Super admin gets every permission — governance + operational + self-service
    ...Object.values(PERMISSIONS),
  ],
  admin: [
    // Operational permissions — can manage day-to-day camp data but NOT governance tools
    PERMISSIONS.VIEW_ALL_CAMPERS,
    PERMISSIONS.VIEW_ALL_APPLICATIONS,
    PERMISSIONS.REVIEW_APPLICATION,
    PERMISSIONS.VIEW_ALL_MEDICAL_RECORDS,
    PERMISSIONS.MANAGE_CAMPS,
    PERMISSIONS.MANAGE_SESSIONS,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.CREATE_CONVERSATION,
    PERMISSIONS.SEND_MESSAGE,
    PERMISSIONS.MODERATE_MESSAGES,
    PERMISSIONS.DELETE_ANY_CAMPER,
    PERMISSIONS.DELETE_APPLICATION,
    PERMISSIONS.DELETE_MEDICAL_RECORD,
  ],
  applicant: [
    // Self-service permissions — parents/guardians can only access their own data
    PERMISSIONS.VIEW_OWN_CAMPERS,
    PERMISSIONS.CREATE_CAMPER,
    PERMISSIONS.UPDATE_OWN_CAMPER,
    PERMISSIONS.DELETE_OWN_CAMPER,
    PERMISSIONS.VIEW_OWN_APPLICATIONS,
    PERMISSIONS.CREATE_APPLICATION,
    PERMISSIONS.UPDATE_OWN_APPLICATION,
    PERMISSIONS.SIGN_APPLICATION,
    PERMISSIONS.VIEW_OWN_MEDICAL_RECORDS,
    PERMISSIONS.CREATE_MEDICAL_RECORD,
    PERMISSIONS.UPDATE_MEDICAL_RECORD,
    PERMISSIONS.UPLOAD_DOCUMENT,
    PERMISSIONS.DOWNLOAD_DOCUMENT,
    PERMISSIONS.DELETE_DOCUMENT,
    PERMISSIONS.CREATE_CONVERSATION,
    PERMISSIONS.SEND_MESSAGE,
  ],
  medical: [
    // Read-only medical permissions — medical staff can view records but not modify them
    PERMISSIONS.VIEW_ALL_MEDICAL_RECORDS,
  ],
};

// Re-export Permission type so consumers can import it from this file
export type { Permission };
