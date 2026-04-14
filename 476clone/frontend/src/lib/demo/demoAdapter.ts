/**
 * demoAdapter.ts — Custom Axios adapter for demo mode.
 *
 * Replaces the default XHR/HTTP adapter when VITE_DEMO_MODE=true.
 * ALL network calls are intercepted here and resolved locally with mock data.
 * No actual HTTP requests are made — the app works completely offline.
 *
 * URL matching uses the relative path (config.url) since Axios strips the baseURL.
 * e.g. axiosInstance.get('/campers') → config.url === '/campers'
 *
 * Pattern:
 *  1. Extract URL + method from config
 *  2. Match against known route patterns
 *  3. Return a resolved AxiosResponse with the correct shape
 *  4. Unknown routes → return empty success (never reject)
 */

import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  CAMPS,
  SESSIONS,
  CAMPERS,
  APPLICATIONS,
  ADMIN_USERS,
  CONVERSATIONS,
  MESSAGES,
  ANNOUNCEMENTS,
  CALENDAR_EVENTS,
  NOTIFICATIONS,
  NOTIFICATION_PREFERENCES,
  DOCUMENT_REQUESTS,
  DOCUMENT_REQUEST_STATS,
  REPORTS_SUMMARY,
  AUDIT_LOG_ENTRIES,
  PROVIDER_LINKS,
  MEDICAL_RECORDS,
  CAMPER_RISK_SUMMARIES,
  SESSION_DASHBOARDS,
  MEDICAL_INCIDENTS,
  MEDICAL_FOLLOW_UPS,
  MEDICAL_VISITS,
  TREATMENT_LOGS,
  FORM_DEFINITIONS,
  APPLICANT_APPLICATIONS,
  APPLICANT_DOCUMENT_REQUESTS,
} from './mockData';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a resolved AxiosResponse so the response interceptor sees a 200. */
function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): Promise<AxiosResponse<T>> {
  return Promise.resolve({
    data,
    status,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config,
    request: {},
  });
}

/** Wrap data in Laravel's standard ApiResponse envelope. */
function apiEnvelope<T>(data: T, message = 'OK') {
  return { message, data };
}

/** Build a standard paginated response. */
function paginated<T>(items: T[], page = 1, perPage = 15) {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? null : (page - 1) * perPage + 1;
  const to = total === 0 ? null : Math.min(page * perPage, total);
  const sliced = items.slice((page - 1) * perPage, page * perPage);
  return {
    data: sliced,
    links: { first: '', last: '', prev: null, next: null },
    meta: { current_page: page, last_page: lastPage, per_page: perPage, total, from, to },
  };
}

/** Extract a numeric ID from a URL segment after a prefix. Returns null if not found. */
function extractId(url: string, prefix: string): number | null {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = url.match(new RegExp(`${escaped}/(\\d+)`));
  return match ? parseInt(match[1], 10) : null;
}

/** Apply a simple search filter to an array of objects by checking string fields. */
function applySearch<T extends Record<string, unknown>>(items: T[], search: string): T[] {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((item) =>
    Object.values(item).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export function demoAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const url = config.url ?? '';
  const method = (config.method ?? 'get').toLowerCase();
  const params = (config.params ?? {}) as Record<string, unknown>;
  const page = typeof params.page === 'number' ? params.page : 1;

  // ── GET /user — authenticated user ────────────────────────────────────────
  if (url === '/user' && method === 'get') {
    return ok(config, apiEnvelope(ADMIN_USERS[0]));
  }

  // ── GET /logout ────────────────────────────────────────────────────────────
  if (url === '/logout') {
    return ok(config, { message: 'Logged out' });
  }

  // ── Applications ─────────────────────────────────────────────────────────

  if (url === '/applications' && method === 'get') {
    let apps = [...APPLICATIONS];
    if (params.status) apps = apps.filter((a) => a.status === params.status);
    if (params.camp_session_id) apps = apps.filter((a) => a.camp_session_id === params.camp_session_id);
    if (params.search) apps = applySearch(apps, String(params.search));
    return ok(config, paginated(apps, page));
  }

  if (url.match(/^\/applications\/\d+$/) && method === 'get') {
    const id = extractId(url, '/applications');
    const app = APPLICATIONS.find((a) => a.id === id) ?? APPLICATIONS[0];
    return ok(config, apiEnvelope(app));
  }

  if (url.match(/^\/applications\/\d+\/review$/) && method === 'post') {
    const id = extractId(url, '/applications');
    const app = APPLICATIONS.find((a) => a.id === id) ?? APPLICATIONS[0];
    return ok(config, apiEnvelope({ ...app, ...(config.data ? JSON.parse(String(config.data)) : {}) }));
  }

  if (url.match(/^\/applications\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Application deleted' });
  }

  // ── Campers ───────────────────────────────────────────────────────────────

  if (url === '/campers' && method === 'get') {
    let items = [...CAMPERS];
    if (params.search) items = applySearch(items, String(params.search));
    if (params.session_id) {
      items = items.filter((c) =>
        c.applications?.some((a: Record<string, unknown>) => a.camp_session_id === params.session_id)
      );
    }
    return ok(config, paginated(items, page));
  }

  if (url.match(/^\/campers\/\d+\/risk-summary$/)) {
    const id = extractId(url, '/campers');
    const summary = id !== null && CAMPER_RISK_SUMMARIES[id]
      ? CAMPER_RISK_SUMMARIES[id]
      : { risk_level: 'low', flags: [], allergies_count: 0, medications_count: 0, has_severe_allergy: false, requires_mobility_assistance: false };
    return ok(config, apiEnvelope(summary));
  }

  if (url.match(/^\/campers\/\d+$/) && method === 'get') {
    const id = extractId(url, '/campers');
    const camper = CAMPERS.find((c) => c.id === id) ?? CAMPERS[0];
    const medicalRecord = id !== null && MEDICAL_RECORDS[id] ? MEDICAL_RECORDS[id] : null;
    return ok(config, apiEnvelope({ ...camper, medical_record: medicalRecord }));
  }

  // ── Camps ─────────────────────────────────────────────────────────────────

  if (url === '/camps' && method === 'get') {
    return ok(config, apiEnvelope(CAMPS));
  }

  if (url.match(/^\/camps\/\d+$/) && method === 'put') {
    const id = extractId(url, '/camps');
    const camp = CAMPS.find((c) => c.id === id) ?? CAMPS[0];
    return ok(config, apiEnvelope(camp));
  }

  if (url === '/camps' && method === 'post') {
    return ok(config, apiEnvelope({ ...CAMPS[0], id: 99 }), 201);
  }

  // ── Sessions ──────────────────────────────────────────────────────────────

  if (url === '/sessions' && method === 'get') {
    let items = [...SESSIONS];
    if (params.camp_id) items = items.filter((s) => s.camp_id === params.camp_id);
    return ok(config, apiEnvelope(items));
  }

  if (url.match(/^\/sessions\/\d+\/dashboard$/)) {
    const id = extractId(url, '/sessions');
    const dashboard = id !== null && SESSION_DASHBOARDS[id]
      ? SESSION_DASHBOARDS[id]
      : SESSION_DASHBOARDS[1];
    // Returns raw data (no ApiResponse wrapper) — matches getSessionDashboard which does: return data
    return ok(config, dashboard);
  }

  if (url.match(/^\/sessions\/\d+\/applications$/)) {
    const id = extractId(url, '/sessions');
    const apps = APPLICATIONS.filter((a) => a.camp_session_id === id);
    return ok(config, paginated(apps, page));
  }

  if (url.match(/^\/sessions\/\d+\/archive$/) && method === 'post') {
    return ok(config, { message: 'Session archived' });
  }

  if (url.match(/^\/sessions\/\d+\/restore$/) && method === 'post') {
    const id = extractId(url, '/sessions');
    const session = SESSIONS.find((s) => s.id === id) ?? SESSIONS[0];
    return ok(config, { message: 'Session restored', session });
  }

  if (url.match(/^\/sessions\/\d+$/) && method === 'put') {
    const id = extractId(url, '/sessions');
    const session = SESSIONS.find((s) => s.id === id) ?? SESSIONS[0];
    return ok(config, apiEnvelope(session));
  }

  if (url === '/sessions' && method === 'post') {
    return ok(config, apiEnvelope({ ...SESSIONS[0], id: 99 }), 201);
  }

  if (url.match(/^\/sessions\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Session deleted' });
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  if (url === '/reports/summary') {
    return ok(config, apiEnvelope(REPORTS_SUMMARY));
  }

  if (url.match(/^\/reports\//)) {
    // downloadReport — return an empty blob
    return ok(config, new Blob(['demo,export\n'], { type: 'text/csv' }));
  }

  // ── Provider links ────────────────────────────────────────────────────────

  if (url === '/provider-links' && method === 'get') {
    return ok(config, apiEnvelope(PROVIDER_LINKS));
  }

  if (url === '/provider-links' && method === 'post') {
    return ok(config, apiEnvelope({ ...PROVIDER_LINKS[0], id: 99 }), 201);
  }

  if (url.match(/^\/provider-links\/\d+\/(revoke|resend)$/)) {
    return ok(config, { message: 'OK' });
  }

  // ── Users (admin) ────────────────────────────────────────────────────────

  if (url === '/users' && method === 'get') {
    let items = [...ADMIN_USERS];
    if (params.search) items = applySearch(items, String(params.search));
    if (params.role) items = items.filter((u) => u.role === params.role);
    return ok(config, paginated(items, page));
  }

  if (url.match(/^\/users\/\d+\/role$/) && method === 'put') {
    const id = extractId(url, '/users');
    const user = ADMIN_USERS.find((u) => u.id === id) ?? ADMIN_USERS[0];
    return ok(config, apiEnvelope(user));
  }

  if (url.match(/^\/users\/\d+\/(deactivate|reactivate)$/)) {
    return ok(config, { message: 'OK' });
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  if (url === '/audit-log' && method === 'get') {
    let items = [...AUDIT_LOG_ENTRIES];
    if (params.search) items = applySearch(items, String(params.search));
    return ok(config, paginated(items, page, 20));
  }

  if (url === '/audit-log/export') {
    return ok(config, new Blob(['id,action,user\n'], { type: 'text/csv' }));
  }

  // ── Inbox / Conversations ─────────────────────────────────────────────────

  if (url === '/inbox/conversations' && method === 'get') {
    let items = [...CONVERSATIONS];
    const folder = params.folder as string | undefined;
    if (folder === 'starred') items = items.filter((c) => c.is_starred);
    else if (folder === 'important') items = items.filter((c) => c.is_important);
    else if (folder === 'system') items = items.filter((c) => c.is_system_generated);
    else if (folder === 'trash') items = items.filter((c) => c.is_trashed);
    else if (params.system_only) items = items.filter((c) => c.is_system_generated);
    return ok(config, paginated(items, page));
  }

  if (url.match(/^\/inbox\/conversations\/\d+$/) && method === 'get') {
    const id = extractId(url, '/inbox/conversations');
    const conv = CONVERSATIONS.find((c) => c.id === id) ?? CONVERSATIONS[0];
    return ok(config, apiEnvelope(conv));
  }

  if (url === '/inbox/conversations' && method === 'post') {
    return ok(config, apiEnvelope(CONVERSATIONS[0]), 201);
  }

  if (url.match(/^\/inbox\/conversations\/\d+\/(archive|unarchive|leave|star|important|trash|restore-trash)$/)) {
    const action = url.split('/').pop();
    if (action === 'star') return ok(config, { is_starred: true });
    if (action === 'important') return ok(config, { is_important: true });
    return ok(config, { message: 'OK' });
  }

  if (url.match(/^\/inbox\/conversations\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Deleted' });
  }

  if (url.match(/^\/inbox\/conversations\/\d+\/messages$/) && method === 'get') {
    const id = extractId(url, '/inbox/conversations');
    const msgs = id !== null && MESSAGES[id] ? MESSAGES[id] : [];
    return ok(config, paginated(msgs as object[], page));
  }

  if (url.match(/^\/inbox\/conversations\/\d+\/messages$/) && method === 'post') {
    const id = extractId(url, '/inbox/conversations') ?? 1;
    return ok(config, apiEnvelope({
      id: 999,
      conversation_id: id,
      sender_id: 9999,
      sender: { id: 9999, name: 'Demo Admin', email: 'demo@campburntgin.dev', role: 'admin' },
      body: config.data ? (JSON.parse(String(config.data)) as { body?: string }).body ?? '' : '',
      read_at: null,
      created_at: new Date().toISOString(),
    }), 201);
  }

  if (url === '/inbox/messages/unread-count') {
    return ok(config, apiEnvelope({ count: 2 }));
  }

  if (url === '/inbox/users') {
    const q = String(params.search ?? '').toLowerCase();
    const users = ADMIN_USERS.filter((u) =>
      !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    return ok(config, apiEnvelope(users));
  }

  // ── Notifications ─────────────────────────────────────────────────────────

  if (url === '/notifications' && method === 'get') {
    const unreadOnly = params.unread_only;
    const items = unreadOnly
      ? NOTIFICATIONS.filter((n) => !n.read_at)
      : NOTIFICATIONS;
    return ok(config, {
      data: items,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: items.length,
        unread_count: NOTIFICATIONS.filter((n) => !n.read_at).length,
      },
    });
  }

  if (url.match(/^\/notifications\/[^/]+\/read$/) && method === 'put') {
    return ok(config, apiEnvelope(null));
  }

  if (url === '/notifications/read-all' && method === 'put') {
    return ok(config, apiEnvelope(null));
  }

  if (url === '/notifications/clear-all' && method === 'delete') {
    return ok(config, apiEnvelope(null));
  }

  // ── Announcements ─────────────────────────────────────────────────────────

  if (url === '/announcements' && method === 'get') {
    return ok(config, paginated(ANNOUNCEMENTS, page));
  }

  if (url.match(/^\/announcements\/\d+\/pin$/) && method === 'post') {
    return ok(config, { is_pinned: true });
  }

  if (url === '/announcements' && method === 'post') {
    return ok(config, apiEnvelope({ ...ANNOUNCEMENTS[0], id: 99 }), 201);
  }

  if (url.match(/^\/announcements\/\d+$/) && method === 'put') {
    const id = extractId(url, '/announcements');
    const ann = ANNOUNCEMENTS.find((a) => a.id === id) ?? ANNOUNCEMENTS[0];
    return ok(config, apiEnvelope(ann));
  }

  if (url.match(/^\/announcements\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Deleted' });
  }

  // ── Calendar ─────────────────────────────────────────────────────────────

  if (url === '/calendar' && method === 'get') {
    return ok(config, apiEnvelope(CALENDAR_EVENTS));
  }

  if (url === '/calendar' && method === 'post') {
    return ok(config, apiEnvelope({ ...CALENDAR_EVENTS[0], id: 99 }), 201);
  }

  if (url.match(/^\/calendar\/\d+$/) && method === 'put') {
    const id = extractId(url, '/calendar');
    const event = CALENDAR_EVENTS.find((e) => e.id === id) ?? CALENDAR_EVENTS[0];
    return ok(config, apiEnvelope(event));
  }

  if (url.match(/^\/calendar\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Deleted' });
  }

  // ── Documents ────────────────────────────────────────────────────────────

  if (url === '/documents' && method === 'get') {
    return ok(config, paginated([], page));
  }

  if (url.match(/^\/documents\/\d+\/verify$/)) {
    return ok(config, { data: { id: 1, verification_status: 'approved' } });
  }

  if (url.match(/^\/documents\/\d+\/download$/)) {
    return ok(config, new Blob(['demo'], { type: 'application/pdf' }));
  }

  // ── Document requests ────────────────────────────────────────────────────

  if (url === '/document-requests/stats') {
    return ok(config, DOCUMENT_REQUEST_STATS);
  }

  if (url === '/document-requests' && method === 'get') {
    let items = [...DOCUMENT_REQUESTS];
    if (params.status) items = items.filter((d) => d.status === params.status);
    if (params.applicant_id) items = items.filter((d) => d.applicant_id === params.applicant_id);
    return ok(config, { data: items, meta: { current_page: 1, last_page: 1, per_page: 15, total: items.length, from: 1, to: items.length } });
  }

  if (url === '/document-requests' && method === 'post') {
    return ok(config, DOCUMENT_REQUESTS[0], 201);
  }

  if (url.match(/^\/document-requests\/\d+$/) && method === 'get') {
    const id = extractId(url, '/document-requests');
    return ok(config, DOCUMENT_REQUESTS.find((d) => d.id === id) ?? DOCUMENT_REQUESTS[0]);
  }

  if (url.match(/^\/document-requests\/\d+\/(approve|reject|extend|reupload|remind)$/)) {
    const id = extractId(url, '/document-requests');
    return ok(config, DOCUMENT_REQUESTS.find((d) => d.id === id) ?? DOCUMENT_REQUESTS[0]);
  }

  if (url.match(/^\/document-requests\/\d+\/download$/)) {
    return ok(config, new Blob(['demo'], { type: 'application/pdf' }));
  }

  if (url.match(/^\/document-requests\/\d+$/) && method === 'delete') {
    return ok(config, { message: 'Cancelled' });
  }

  // ── Admin documents (applicant docs) ─────────────────────────────────────

  if (url === '/admin/documents' && method === 'get') {
    return ok(config, { data: APPLICANT_DOCUMENT_REQUESTS, meta: { current_page: 1, last_page: 1, per_page: 15, total: APPLICANT_DOCUMENT_REQUESTS.length } });
  }

  if (url === '/admin/documents/send' && method === 'post') {
    return ok(config, APPLICANT_DOCUMENT_REQUESTS[0] ?? {}, 201);
  }

  if (url.match(/^\/admin\/documents\/\d+$/) && method === 'get') {
    return ok(config, APPLICANT_DOCUMENT_REQUESTS);
  }

  if (url.match(/^\/admin\/applicant-documents\/\d+\/(review|replace)$/)) {
    return ok(config, APPLICANT_DOCUMENT_REQUESTS[0] ?? {});
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  if (url === '/profile' && method === 'get') {
    return ok(config, apiEnvelope(ADMIN_USERS[0]));
  }

  if (url === '/profile' && method === 'put') {
    return ok(config, apiEnvelope(ADMIN_USERS[0]));
  }

  if (url === '/profile/notification-preferences' && method === 'get') {
    return ok(config, apiEnvelope(NOTIFICATION_PREFERENCES));
  }

  if (url === '/profile/notification-preferences' && method === 'put') {
    return ok(config, apiEnvelope(NOTIFICATION_PREFERENCES));
  }

  if (url.match(/^\/profile\/(avatar|password)/) && method === 'post') {
    return ok(config, apiEnvelope(ADMIN_USERS[0]));
  }

  // ── MFA endpoints ─────────────────────────────────────────────────────────

  if (url.match(/^\/mfa\//)) {
    return ok(config, { message: 'OK', data: null });
  }

  // ── Medical portal ────────────────────────────────────────────────────────

  if (url === '/medical/stats') {
    // Shape must match the MedicalStats interface exactly (nested structure).
    // Previous flat object caused TypeError: Cannot read properties of undefined (reading 'treatments')
    return ok(config, apiEnvelope({
      campers: {
        total: 12,
        with_severe_allergies: 2,
        on_medications: 8,
        with_active_restrictions: 3,
        missing_medical_record: 4,
      },
      follow_ups: {
        due_today: 1,
        overdue: 0,
        open: 1,
      },
      recent_activity: {
        treatments: [],
        incidents: MEDICAL_INCIDENTS.slice(0, 3),
        visits: MEDICAL_VISITS.slice(0, 3),
      },
      treatment_type_counts: {},
    }));
  }

  // ── Medical incidents ─────────────────────────────────────────────────────
  // getMedicalIncidents() calls GET /medical-incidents (hyphenated)
  if (url === '/medical-incidents' && method === 'get') {
    return ok(config, paginated(MEDICAL_INCIDENTS, page));
  }
  if (url.match(/^\/medical-incidents\/\d+$/)) {
    return ok(config, apiEnvelope(MEDICAL_INCIDENTS[0]));
  }
  // camper-scoped
  if (url.match(/^\/campers\/\d+\/incidents$/)) {
    return ok(config, paginated(MEDICAL_INCIDENTS, page));
  }

  // ── Medical follow-ups ────────────────────────────────────────────────────
  // getMedicalFollowUps() calls GET /medical-follow-ups (hyphenated)
  if (url === '/medical-follow-ups' && method === 'get') {
    return ok(config, paginated(MEDICAL_FOLLOW_UPS, page));
  }
  if (url.match(/^\/medical-follow-ups\/\d+$/)) {
    return ok(config, apiEnvelope(MEDICAL_FOLLOW_UPS[0]));
  }

  // ── Medical visits ────────────────────────────────────────────────────────
  // getMedicalVisits() calls GET /medical-visits (hyphenated)
  if (url === '/medical-visits' && method === 'get') {
    return ok(config, paginated(MEDICAL_VISITS, page));
  }
  if (url.match(/^\/medical-visits\/\d+$/)) {
    return ok(config, apiEnvelope(MEDICAL_VISITS[0]));
  }
  // camper-scoped
  if (url.match(/^\/campers\/\d+\/visits$/)) {
    return ok(config, paginated(MEDICAL_VISITS, page));
  }

  // ── Medical restrictions ──────────────────────────────────────────────────
  if (url === '/medical-restrictions' && method === 'get') {
    return ok(config, paginated([], page));
  }
  if (url.match(/^\/medical-restrictions\/\d+$/)) {
    return ok(config, apiEnvelope(null));
  }

  // ── Treatment logs ────────────────────────────────────────────────────────
  // getTreatmentLogs() calls GET /treatment-logs
  if (url === '/treatment-logs' && method === 'get') {
    return ok(config, paginated(TREATMENT_LOGS, page));
  }
  if (url.match(/^\/treatment-logs\/\d+$/)) {
    return ok(config, apiEnvelope(TREATMENT_LOGS[0]));
  }

  // ── Medical record sub-resources (called with query params, not path params) ──
  // e.g. GET /allergies?camper_id=1 — must return array wrapped in ApiResponse
  if (url === '/allergies' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  if (url === '/medications' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  if (url === '/diagnoses' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  if (url === '/emergency-contacts' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  if (url === '/activity-permissions' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  if (url === '/assistive-devices' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }
  // behavioral-profiles and feeding-plans return a single nullable object
  if (url === '/behavioral-profiles' && method === 'get') {
    return ok(config, apiEnvelope(null));
  }
  if (url === '/feeding-plans' && method === 'get') {
    return ok(config, apiEnvelope(null));
  }

  // ── Profile emergency contacts ────────────────────────────────────────────
  // getEmergencyContacts() in profile.api.ts calls /profile/emergency-contacts
  if (url === '/profile/emergency-contacts' && method === 'get') {
    return ok(config, apiEnvelope([]));
  }

  // ── Camper medical record + camper-scoped path sub-resources ─────────────
  if (url.match(/^\/campers\/\d+\/medical-record$/)) {
    const id = extractId(url, '/campers');
    const record = id !== null && MEDICAL_RECORDS[id] ? MEDICAL_RECORDS[id] : MEDICAL_RECORDS[1];
    return ok(config, apiEnvelope(record));
  }

  // Camper-scoped sub-resources via path (legacy paths — return safe empty values)
  if (url.match(/^\/campers\/\d+\/(allergies|medications|diagnoses|assistive-devices|emergency-contacts|behavioral-profile|feeding-plan|treatment-logs|documents|activity-permissions)/)) {
    const isListEndpoint = url.match(/(allergies|medications|diagnoses|assistive-devices|emergency-contacts|treatment-logs|documents|activity-permissions)$/);
    return ok(config, apiEnvelope(isListEndpoint ? [] : null), method === 'post' || method === 'put' ? 201 : 200);
  }

  // ── Forms (super-admin form builder) ─────────────────────────────────────

  // listFormDefinitions() calls GET /form/definitions and unwraps data.data
  if (url === '/form/definitions' && method === 'get') {
    return ok(config, apiEnvelope(FORM_DEFINITIONS));
  }

  if (url.match(/^\/form\/definitions\/\d+$/)) {
    return ok(config, apiEnvelope({ ...FORM_DEFINITIONS[0], sections: [] }));
  }

  if (url === '/forms' && method === 'get') {
    return ok(config, paginated(FORM_DEFINITIONS, page));
  }

  if (url === '/forms' && method === 'post') {
    return ok(config, apiEnvelope({ ...FORM_DEFINITIONS[0], id: 99 }), 201);
  }

  if (url.match(/^\/forms\/\d+$/)) {
    return ok(config, apiEnvelope(FORM_DEFINITIONS[0]));
  }

  if (url === '/form/active') {
    return ok(config, apiEnvelope({ ...FORM_DEFINITIONS[0], sections: [] }));
  }

  if (url.match(/^\/form\/active\//)) {
    return ok(config, apiEnvelope({ ...FORM_DEFINITIONS[0], sections: [] }));
  }

  // ── Applicant portal ─────────────────────────────────────────────────────

  if (url === '/applicant/applications' && method === 'get') {
    return ok(config, paginated(APPLICANT_APPLICATIONS, page));
  }

  if (url.match(/^\/applicant\/applications\/\d+$/)) {
    return ok(config, apiEnvelope(APPLICANT_APPLICATIONS[0] ?? APPLICATIONS[0]));
  }

  if (url === '/applicant/campers' && method === 'get') {
    return ok(config, apiEnvelope([CAMPERS[0]]));
  }

  // getDocumentRequests() returns `data` raw (no .data unwrap), so the body must be the array.
  if (url === '/applicant/document-requests' && method === 'get') {
    return ok(config, APPLICANT_DOCUMENT_REQUESTS);
  }

  // getRequiredDocuments() calls GET /applicant/documents and returns data directly (no envelope).
  // Without this handler the catch-all returns a plain object, causing .filter() to crash.
  if (url === '/applicant/documents' && method === 'get') {
    return ok(config, []);
  }

  if (url.match(/^\/applicant\/document-requests\/\d+\/(upload|download)$/)) {
    return ok(config, APPLICANT_DOCUMENT_REQUESTS[0] ?? {});
  }

  // ── Catch-all — return empty success so nothing breaks ────────────────────

  return ok(config, { message: 'Demo mode — no data', data: null });
}
