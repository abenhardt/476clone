/**
 * routes.ts — Application route path constants
 *
 * Every URL in the app lives here as a named constant.
 * Importing from this file instead of typing "/admin/campers" by hand
 * means a typo only needs to be fixed in one place.
 *
 * Functions (e.g. ADMIN_CAMPER_DETAIL) accept an ID and return the full path string.
 * Plain strings are static paths with no dynamic segments.
 *
 * Usage example:
 *   navigate(ROUTES.ADMIN_CAMPER_DETAIL(camperId))
 *   <Link to={ROUTES.LOGIN}>
 */
export const ROUTES = {
  // ─── Public / marketing pages ───────────────────────────────────────────────
  HOME: '/',
  ABOUT: '/about',
  PROGRAMS: '/programs',
  CAMPERS: '/campers',
  APPLY: '/apply',
  STORIES: '/testimonials',
  GET_INVOLVED: '/get-involved',
  VIRTUAL_PROGRAM: '/virtual-program',

  // ─── Auth pages (unauthenticated) ───────────────────────────────────────────
  LOGIN: '/login',
  REGISTER: '/register',
  MFA_VERIFY: '/mfa-verify',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',

  // ─── Applicant portal (parent/guardian role) ────────────────────────────────
  // Note: the role is called "applicant" in code, but users are parents/guardians
  PARENT_DASHBOARD: '/applicant/dashboard',
  PARENT_APPLICATIONS: '/applicant/applications',
  PARENT_APPLICATION_START: '/applicant/applications/start',
  PARENT_APPLICATION_NEW: '/applicant/applications/new',
  // Function that takes an application ID and returns the detail URL
  PARENT_APPLICATION_DETAIL: (id: number | string) =>
    `/applicant/applications/${id}`,
  PARENT_DOCUMENTS: '/applicant/documents',
  PARENT_FORMS: '/applicant/forms',
  PARENT_CALENDAR: '/applicant/calendar',
  PARENT_ANNOUNCEMENTS: '/applicant/announcements',

  // ─── Admin portal ───────────────────────────────────────────────────────────
  ADMIN_DASHBOARD: '/admin/dashboard',
  // Family management — 3-level IA: Families index → Family workspace → Camper/Application detail
  ADMIN_FAMILIES: '/admin/families',
  ADMIN_FAMILY_DETAIL: (userId: number | string) => `/admin/families/${userId}`,
  ADMIN_CAMPERS: '/admin/campers',
  // Function: returns /admin/campers/123 when called with id=123
  ADMIN_CAMPER_DETAIL: (id: number | string) => `/admin/campers/${id}`,
  // Full risk assessment page for a camper
  ADMIN_CAMPER_RISK: (id: number | string) => `/admin/campers/${id}/risk`,
  ADMIN_APPLICATIONS: '/admin/applications',
  ADMIN_APPLICATION_DETAIL: (id: number | string) =>
    `/admin/applications/${id}`,
  ADMIN_APPLICATION_EDIT: (id: number | string) =>
    `/admin/applications/${id}/edit`,
  ADMIN_SESSIONS: '/admin/sessions',
  ADMIN_ARCHIVED_SESSIONS: '/admin/sessions/archived',
  ADMIN_SESSION_DETAIL: (id: number | string) => `/admin/sessions/${id}`,
  ADMIN_CAMPS: '/admin/camps',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_CALENDAR: '/admin/calendar',
  ADMIN_DOCUMENTS: '/admin/documents',
  ADMIN_DEADLINES: '/admin/deadlines',

  // ─── Medical portal ─────────────────────────────────────────────────────────
  MEDICAL_DASHBOARD: '/medical/dashboard',
  // List of all campers with medical records
  MEDICAL_RECORDS: '/medical/records',
  // A specific camper's full medical record
  MEDICAL_RECORD_DETAIL: (id: number | string) => `/medical/records/${id}`,
  MEDICAL_TREATMENT_LOGS: '/medical/treatments',
  MEDICAL_ANNOUNCEMENTS: '/medical/announcements',
  // Sub-pages scoped to a specific camper's record
  MEDICAL_RECORD_TREATMENTS: (id: number | string) => `/medical/records/${id}/treatments`,
  MEDICAL_RECORD_DOCUMENTS: (id: number | string) => `/medical/records/${id}/documents`,
  // Phase 11 additions — incidents, follow-ups, visits, emergency view
  MEDICAL_INCIDENTS: '/medical/incidents',
  MEDICAL_FOLLOW_UPS: '/medical/follow-ups',
  MEDICAL_VISITS: '/medical/visits',
  MEDICAL_RECORD_EMERGENCY: (id: number | string) => `/medical/records/${id}/emergency`,
  MEDICAL_RECORD_INCIDENTS: (id: number | string) => `/medical/records/${id}/incidents`,
  MEDICAL_RECORD_VISITS: (id: number | string) => `/medical/records/${id}/visits`,
  MEDICAL_RECORD_TREATMENT: '/medical/record-treatment',
  // Phase 12: Camp Medical Directory (dedicated page)
  MEDICAL_DIRECTORY: '/medical/directory',
  // Risk assessment view in the medical portal
  MEDICAL_CAMPER_RISK: (id: number | string) => `/medical/records/${id}/risk`,

  // ─── Super Admin portal ─────────────────────────────────────────────────────
  SUPER_ADMIN_APPLICATION_EDIT: (id: number | string) =>
    `/super-admin/applications/${id}/edit`,
  SUPER_ADMIN_DASHBOARD: '/super-admin/dashboard',
  SUPER_ADMIN_USERS: '/super-admin/users',
  // Audit log shows every action taken in the system (HIPAA requirement)
  SUPER_ADMIN_AUDIT: '/super-admin/audit',
  // Dynamic application form management — edit sections and fields without code deploys
  ADMIN_FORM_BUILDER: '/admin/form-builder',
  ADMIN_FORM_STRUCTURE: (formId: number | string) =>
    `/admin/form-builder/${formId}`,
  ADMIN_SECTION_EDITOR: (formId: number | string, sectionId: number | string) =>
    `/admin/form-builder/${formId}/sections/${sectionId}`,
  SUPER_ADMIN_FORM_BUILDER: '/super-admin/form-builder',
  // Form structure editor for a specific form definition
  SUPER_ADMIN_FORM_STRUCTURE: (formId: number | string) =>
    `/super-admin/form-builder/${formId}`,
  // Section field editor — manage fields within one section
  SUPER_ADMIN_SECTION_EDITOR: (formId: number | string, sectionId: number | string) =>
    `/super-admin/form-builder/${formId}/sections/${sectionId}`,

  // ─── Shared authenticated pages ─────────────────────────────────────────────
  // Each portal mounts these under its own prefix (e.g. /admin/inbox, /medical/inbox)
  INBOX: '/inbox',
  SUPER_ADMIN_INBOX: '/super-admin/inbox',
  ADMIN_INBOX: '/admin/inbox',
  MEDICAL_INBOX: '/medical/inbox',
  APPLICANT_INBOX: '/applicant/inbox',
  PROFILE: '/profile',

  // ─── Error pages ────────────────────────────────────────────────────────────
  FORBIDDEN: '/forbidden',
  // '*' matches any URL that didn't match a defined route (404 catch-all)
  NOT_FOUND: '*',
} as const;
