/**
 * permissions.ts — Application permission string constants
 *
 * Every discrete action a user can perform is defined here as a colon-separated
 * string in the format: "resource:verb:scope".
 *
 * Examples:
 *   'campers:view:all'   — view every camper in the system
 *   'campers:view:own'   — view only your own campers
 *   'applications:sign'  — digitally sign an application
 *
 * These strings are assigned to roles in permissionMap.ts and checked at runtime
 * by the usePermission() hook and AuthorityGuard component.
 *
 * Using constants instead of raw strings means a typo is a compile-time error,
 * not a silent permission bypass at runtime.
 */
export const PERMISSIONS = {
  // ─── Camper permissions ─────────────────────────────────────────────────────
  // Admin can see all campers; applicants can only see their own
  VIEW_ALL_CAMPERS: 'campers:view:all',
  VIEW_OWN_CAMPERS: 'campers:view:own',
  CREATE_CAMPER: 'campers:create',
  UPDATE_OWN_CAMPER: 'campers:update:own',
  DELETE_OWN_CAMPER: 'campers:delete:own',
  DELETE_ANY_CAMPER: 'campers:delete:any',

  // ─── Application permissions ────────────────────────────────────────────────
  VIEW_ALL_APPLICATIONS: 'applications:view:all',
  VIEW_OWN_APPLICATIONS: 'applications:view:own',
  CREATE_APPLICATION: 'applications:create',
  UPDATE_OWN_APPLICATION: 'applications:update:own',
  // Signing locks the application and triggers the review workflow
  SIGN_APPLICATION: 'applications:sign',
  // Reviewing is an admin-only action (approve / reject / request changes)
  REVIEW_APPLICATION: 'applications:review',
  DELETE_APPLICATION: 'applications:delete',

  // ─── Medical record permissions ─────────────────────────────────────────────
  // 'view:all' is granted to admin + medical roles for health and safety purposes
  VIEW_ALL_MEDICAL_RECORDS: 'medical:view:all',
  // 'view:own' allows applicants to see their own camper's health data
  VIEW_OWN_MEDICAL_RECORDS: 'medical:view:own',
  UPDATE_MEDICAL_RECORD: 'medical:update',
  CREATE_MEDICAL_RECORD: 'medical:create',
  DELETE_MEDICAL_RECORD: 'medical:delete',

  // ─── Document permissions ────────────────────────────────────────────────────
  UPLOAD_DOCUMENT: 'documents:upload',
  DOWNLOAD_DOCUMENT: 'documents:download',
  DELETE_DOCUMENT: 'documents:delete',

  // ─── Admin operational permissions ──────────────────────────────────────────
  MANAGE_CAMPS: 'camps:manage',
  MANAGE_SESSIONS: 'sessions:manage',
  GENERATE_REPORTS: 'reports:generate',

  // ─── Super Admin governance permissions ─────────────────────────────────────
  // These are ONLY assigned to super_admin — not to regular admin
  MANAGE_USERS: 'users:manage',
  ASSIGN_ROLES: 'roles:assign',
  VIEW_AUDIT_LOGS: 'audit:view',
  MANAGE_SYSTEM_CONFIG: 'system:config',

  // ─── Inbox / messaging permissions ──────────────────────────────────────────
  CREATE_CONVERSATION: 'inbox:create:conversation',
  SEND_MESSAGE: 'inbox:send:message',
  // Moderating allows admins to delete or hide any message
  MODERATE_MESSAGES: 'inbox:moderate',
} as const;

// TypeScript union type of every valid permission string
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
