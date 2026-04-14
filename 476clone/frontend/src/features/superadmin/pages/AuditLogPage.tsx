/**
 * AuditLogPage.tsx
 *
 * Phase 9 — Audit Log Redesign.
 * Upgraded — Audit Intelligence Center.
 *
 * Purpose: System audit intelligence center for super admins — a chronological
 *          record of every significant action taken in the application.
 *
 * Responsibilities:
 *   - Fetch paginated audit log entries with search + category/event_type/entity_type/user/date filters
 *   - Render each entry as a timeline card with severity indicator and expandable detail panel
 *   - Translate technical field names, HTTP methods, and status codes into plain English
 *   - Classify logs by type (message, application, document, user, permission, medical, system)
 *   - Score entries by severity (info → success → warning → critical)
 *   - Show type-specific context in expanded panels (actor, resource, source, diffs, quick actions)
 *   - Surface a daily intelligence summary strip to orient the super admin at a glance
 *   - Parse the user-agent string into a "Browser on OS" label
 *   - Show before/after diff blocks when an entry has old_values or new_values
 *   - Support CSV and JSON export of the currently filtered result set
 *
 * Plain-English: This is the security camera footage and investigation panel for
 * the whole system. Every login, record change, message sent, or permission
 * modification appears here so super admins can understand what happened, who
 * did it, and navigate directly to affected records.
 *
 * Route: /super-admin/audit
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Download, Filter, X, User, Globe, Monitor,
  Shield, MessageSquare, FileText, Bell, Stethoscope,
  Settings, FolderOpen, LogIn, RefreshCw,
  AlertTriangle, AlertCircle, CheckCircle, Info,
  ExternalLink, Calendar, Activity, Clock,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import type { ElementType } from 'react';

import { getAuditLog, exportAuditLog } from '@/features/admin/api/admin.api';
import { Skeletons } from '@/ui/components/Skeletons';
import type { AuditLogEntry } from '@/features/admin/types/admin.types';
import type { PaginatedResponse } from '@/shared/types/api.types';
import { ROUTES } from '@/shared/constants/routes';

// ─── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  label:  string;
  icon:   ElementType;
  color:  string;
  bg:     string;
}

// Maps server-side category strings to visual badge definitions
const CATEGORIES: Record<string, CategoryDef> = {
  Authentication: { label: 'Authentication', icon: LogIn,          color: '#2563eb', bg: 'rgba(37,99,235,0.10)'  },
  Messaging:      { label: 'Messaging',      icon: MessageSquare,  color: '#16a34a', bg: 'rgba(22,163,74,0.10)'  },
  Applications:   { label: 'Applications',   icon: FileText,       color: '#d97706', bg: 'rgba(217,119,6,0.10)'  },
  Notifications:  { label: 'Notifications',  icon: Bell,           color: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },
  Security:       { label: 'Security',       icon: Shield,         color: '#dc2626', bg: 'rgba(220,38,38,0.10)'  },
  Medical:        { label: 'Medical',        icon: Stethoscope,    color: '#0891b2', bg: 'rgba(8,145,178,0.10)'  },
  Administrative: { label: 'Administrative', icon: Settings,       color: '#6b7280', bg: 'rgba(107,114,128,0.10)'},
  Documents:      { label: 'Documents',      icon: FolderOpen,     color: '#0369a1', bg: 'rgba(3,105,161,0.10)'  },
  System:         { label: 'System',         icon: Settings,       color: '#6b7280', bg: 'rgba(107,114,128,0.10)'},
};

// Maps CATEGORIES keys to audit_extra translation keys
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  Authentication: 'audit_extra.category_auth',
  Messaging:      'audit_extra.category_messaging',
  Applications:   'audit_extra.category_applications',
  Notifications:  'audit_extra.category_system',
  Security:       'audit_extra.category_security',
  Medical:        'audit_extra.category_medical',
  Administrative: 'audit_extra.category_system',
  Documents:      'audit_extra.category_documents',
  System:         'audit_extra.category_system',
};

// ─── Base Helpers ─────────────────────────────────────────────────────────────

function getCategoryDef(category?: string): CategoryDef {
  return CATEGORIES[category ?? ''] ?? CATEGORIES.System;
}

function fieldLabel(key: string): string {
  return key
    .replace(/_id$/, ' ID')
    .replace(/_at$/, ' at')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(_key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  // Strip HTML tags if string contains markup (avoids showing <p>Hi there</p>)
  if (/<[a-z][\s\S]*>/i.test(str)) return stripHtml(str);
  return str;
}

function formatDiffEntries(obj: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  return Object.entries(obj).map(([k, v]) => ({
    key: k,
    label: fieldLabel(k),
    value: formatFieldValue(k, v),
  }));
}

function httpStatusLabel(status: number): { text: string; ok: boolean } {
  if (status >= 200 && status < 300) return { text: 'Success',           ok: true  };
  if (status === 400)                return { text: 'Bad request',        ok: false };
  if (status === 401)                return { text: 'Not authenticated',  ok: false };
  if (status === 403)                return { text: 'Access denied',      ok: false };
  if (status === 404)                return { text: 'Record not found',   ok: false };
  if (status === 422)                return { text: 'Validation failed',  ok: false };
  if (status >= 500)                 return { text: 'Server error',       ok: false };
  return { text: `Code ${status}`, ok: false };
}

const ROUTE_LABELS: Record<string, string> = {
  'campers.show':            'Viewed a camper profile',
  'campers.index':           'Browsed the camper list',
  'campers.store':           'Created a camper record',
  'campers.update':          'Updated a camper record',
  'campers.destroy':         'Deleted a camper record',
  'applications.show':       'Viewed an application',
  'applications.index':      'Browsed applications',
  'applications.store':      'Submitted an application',
  'applications.update':     'Updated an application',
  'applications.destroy':    'Deleted an application',
  'medical-records.show':    'Viewed a medical record',
  'medical-records.index':   'Browsed medical records',
  'medical-records.update':  'Updated a medical record',
  'sessions.show':           'Viewed a camp session',
  'sessions.index':          'Browsed camp sessions',
  'sessions.store':          'Created a camp session',
  'sessions.update':         'Updated a camp session',
  'sessions.destroy':        'Deleted a camp session',
  'users.show':              'Viewed a user profile',
  'users.index':             'Browsed the user list',
  'users.update':            'Updated a user record',
  'conversations.show':      'Opened a conversation',
  'conversations.store':     'Started a new conversation',
  'messages.store':          'Sent a message',
  'audit-log.index':         'Browsed the audit log',
  'documents.show':          'Viewed a document',
  'documents.store':         'Uploaded a document',
  'documents.destroy':       'Deleted a document',
};

function routeLabel(route: string): string {
  return ROUTE_LABELS[route] ?? route.replace(/\./g, ' › ').replace(/-/g, ' ');
}

// ── Endpoint humanization ─────────────────────────────────────────────────────
// Maps short API path segments (after "api/") to plain-English resource names.
// Used to translate raw "GET api/assistive-devices" action strings.

const ENDPOINT_LABELS: Record<string, string> = {
  'assistive-devices':     'assistive devices',
  'feeding-plans':         'feeding plans',
  'behavioral-profiles':   'behavioral profiles',
  'medical-records':       'medical records',
  'medical-incidents':     'medical incidents',
  'medical-visits':        'medical visits',
  'medical-follow-ups':    'medical follow-ups',
  'medical-restrictions':  'medical restrictions',
  'treatment-logs':        'treatment logs',
  'allergies':             'allergies',
  'medications':           'medications',
  'diagnoses':             'diagnoses',
  'documents':             'documents',
  'document-requests':     'document requests',
  'applications':          'applications',
  'messages':              'messages',
  'conversations':         'conversations',
  'users':                 'users',
  'campers':               'campers',
  'sessions':              'sessions',
  'families':              'families',
  'reports':               'reports',
  'announcements':         'announcements',
  'notifications':         'notifications',
  'form-definitions':      'form templates',
  'form-sections':         'form sections',
  'form-fields':           'form fields',
  'audit-log':             'audit log',
  'auth':                  'authentication',
  'login':                 'authentication',
  'logout':                'session',
  'profile':               'profile',
  'settings':              'settings',
  'camps':                 'camps',
  'calendar':              'calendar',
};

function humanizePath(path: string): string {
  // Strip leading "api/" if present
  const clean = path.replace(/^api\//i, '');
  // Remove numeric IDs from the path (e.g. "campers/5/allergies" → "campers allergies")
  const noIds = clean.replace(/\/\d+/g, '');
  // Use first path segment as the primary resource label
  const segment = noIds.split('/')[0];
  return ENDPOINT_LABELS[segment] ?? segment.replace(/-/g, ' ');
}

/**
 * Sanitizes a raw action string that might contain HTTP verb prefixes or
 * "api/" paths. Returns a plain-English phrase. Called as a last resort when
 * human_description, description, and metadata.route are all absent.
 *
 * Examples:
 *   "GET api/assistive-devices"  →  "Viewed assistive devices"
 *   "assistive-devices:index"   →  "Viewed assistive devices"
 *   "POST api/messages"          →  "Sent a message"
 */
function sanitizeActionText(raw: string, actor?: string): string {
  if (!raw) return 'System event';

  const HTTP_VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const parts = raw.trim().split(/\s+/);
  const verb  = parts[0].toUpperCase();

  // Pattern 1: "GET api/assistive-devices/5" — HTTP verb + URL path
  if (HTTP_VERBS.includes(verb) && parts[1]) {
    const path     = parts[1];
    const resource = humanizePath(path);
    const verbMap: Record<string, string> = {
      GET:    'Viewed',
      POST:   resource.includes('message') ? 'Sent a message —' : 'Created',
      PUT:    'Updated',
      PATCH:  'Updated',
      DELETE: 'Deleted',
    };
    const action = verbMap[verb] ?? 'Accessed';
    if (action.endsWith('—')) {
      // Special case: "Sent a message — messages"
      return actor ? `${actor} sent a message` : 'Message sent';
    }
    return actor ? `${actor} ${action.toLowerCase()} ${resource}` : `${action} ${resource}`;
  }

  // Pattern 2: "resource:action" like "assistive-devices:index"
  const colonMatch = raw.match(/^([\w-]+):(index|show|store|update|destroy)$/);
  if (colonMatch) {
    const resource = humanizePath(colonMatch[1]);
    const actMap: Record<string, string> = {
      index:   'viewed',
      show:    'viewed',
      store:   'created',
      update:  'updated',
      destroy: 'deleted',
    };
    const a = actMap[colonMatch[2]] ?? colonMatch[2];
    return actor ? `${actor} ${a} ${resource}` : `${a.charAt(0).toUpperCase() + a.slice(1)} ${resource}`;
  }

  // If raw still starts with an HTTP verb but no path (edge case), drop the verb
  if (HTTP_VERBS.includes(verb) && parts.length === 1) {
    return 'System event';
  }

  // Return as-is if it already looks human
  return raw;
}

// Strips all HTML tags from a string, returning plain text.
// Used to sanitize message content that may contain HTML markup.
function stripHtml(html: string): string {
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent ?? html;
    } catch {
      // Fallback to regex if DOMParser throws
    }
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatRouteParams(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  return Object.entries(params as Record<string, unknown>)
    .map(([entity, id]) => `${entity.charAt(0).toUpperCase() + entity.slice(1)} #${id}`)
    .join(', ');
}

function parseUserAgent(ua: string): string {
  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) {
    const v = ua.match(/Edg\/([\d]+)/)?.[1] ?? '';
    browser = `Edge ${v}`;
  } else if (ua.includes('Chrome/')) {
    const v = ua.match(/Chrome\/([\d]+)/)?.[1] ?? '';
    browser = `Chrome ${v}`;
  } else if (ua.includes('Firefox/')) {
    const v = ua.match(/Firefox\/([\d]+)/)?.[1] ?? '';
    browser = `Firefox ${v}`;
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const v = ua.match(/Version\/([\d]+)/)?.[1] ?? '';
    browser = `Safari ${v}`;
  }

  let os = '';
  if (ua.includes('Windows NT'))      os = 'Windows';
  else if (ua.includes('Mac OS X'))   os = 'macOS';
  else if (ua.includes('Android'))    os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux'))      os = 'Linux';

  return os ? `${browser.trim()} on ${os}` : browser.trim();
}

// Interprets a source IP into a human-readable label
function parseSource(ip?: string | null, ua?: string | null): string {
  if (!ip && !ua) return 'Unknown source';
  if (ip === '127.0.0.1' || ip === '::1') return 'Internal system';
  if (ua) {
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('Android')) {
      return 'Mobile device';
    }
    return 'Web browser';
  }
  return ip ?? 'Unknown source';
}

// ─── Log Intelligence Layer ───────────────────────────────────────────────────
//
// These helpers classify every audit entry by type and severity, produce richer
// human-readable summaries as a fallback, and enumerate relevant quick actions.
// They operate entirely on the data already in AuditLogEntry — no extra API calls.

export type LogType =
  | 'message'
  | 'application'
  | 'document'
  | 'user'
  | 'permission'
  | 'medical'
  | 'system'
  | 'generic';

export type LogSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface LogAction {
  label: string;
  href:  string;
  icon:  ElementType;
}

/** Classifies an audit entry into a semantic log type. */
// eslint-disable-next-line react-refresh/only-export-components
export function getLogType(entry: AuditLogEntry): LogType {
  const cat  = (entry.category ?? '').toLowerCase();
  const evt  = (entry.event_type ?? '').toLowerCase();
  const atype = (entry.auditable_type ?? '').toLowerCase();
  const act  = (entry.action ?? '').toLowerCase();

  if (cat === 'messaging' || evt.includes('message') || evt.includes('conversation') || atype.includes('message') || atype.includes('conversation')) {
    return 'message';
  }
  if (cat === 'applications' || evt.includes('application') || atype.includes('application')) {
    return 'application';
  }
  if (cat === 'documents' || evt.includes('document') || atype.includes('document')) {
    return 'document';
  }
  if (cat === 'medical' || evt === 'phi_access' || atype.includes('medical')) {
    return 'medical';
  }
  // Permission changes are a sub-type of security events
  if (evt === 'security' && (act.includes('permission') || act.includes('role') || act.includes('assign'))) {
    return 'permission';
  }
  if (cat === 'security' && (act.includes('permission') || act.includes('role'))) {
    return 'permission';
  }
  if (cat === 'authentication' || evt === 'authentication' || evt === 'auth' || atype.includes('user')) {
    return 'user';
  }
  if (cat === 'system' || evt === 'system') {
    return 'system';
  }
  return 'generic';
}

/**
 * Scores an audit entry with a four-level severity.
 *
 * critical  — destructive or security-impacting actions (deletes, permission changes,
 *             failed logins, server errors, access denials)
 * warning   — rejected records, overdue items, client-side errors
 * success   — approvals, completions, creations
 * info      — view/retrieve, notifications, system events
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getLogSeverity(entry: AuditLogEntry): LogSeverity {
  const act  = (entry.action ?? '').toLowerCase();
  const evt  = (entry.event_type ?? '').toLowerCase();
  const meta = entry.metadata ?? {};
  const method = String(meta.method ?? '').toUpperCase();
  const status = Number(meta.status ?? 0);

  // Critical: deletes, security failures, server errors, permission changes
  if (method === 'DELETE') return 'critical';
  if (status === 401 || status === 403) return 'critical';
  if (status >= 500) return 'critical';
  if (evt === 'security') return 'critical';
  if (act.includes('delete') || act.includes('destroy')) return 'critical';
  if (act.includes('permission') || act.includes('role assign') || act.includes('role removed')) return 'critical';
  if (act.includes('login failed') || act.includes('login_failed') || act.includes('failed login')) return 'critical';

  // Warning: rejections, overdue, validation failures, 4xx errors
  if (act.includes('reject') || act.includes('rejected')) return 'warning';
  if (act.includes('overdue') || act.includes('failed') || act.includes('error')) return 'warning';
  if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 404) return 'warning';

  // Success: approvals, creations, completions
  if (act.includes('approved') || act.includes('approve')) return 'success';
  if (act.includes('created') || act.includes('uploaded') || act.includes('sent')) return 'success';
  if (act.includes('completed') || act.includes('registered') || act.includes('login')) return 'success';
  if (method === 'POST' && status >= 200 && status < 300) return 'success';

  return 'info';
}

/**
 * Builds a plain-English summary from available entry data.
 * Fallback priority:
 *   1. human_description (server-generated authoritative text)
 *   2. metadata.route translated via ROUTE_LABELS
 *   3. HTTP method + entity label + ID
 *   4. sanitizeActionText() to clean up raw "GET api/..." strings
 *   5. Generic fallback
 *
 * This function NEVER returns raw HTTP verbs or "api/" path strings.
 */
// Returns true if a string looks like a raw API call that should never be shown
// to users (e.g. "GET api/assistive-devices", "POST /api/messages").
function isRawApiText(text: string): boolean {
  const t = text.trim();
  return (
    /^(GET|POST|PUT|PATCH|DELETE)\s/i.test(t) ||
    /\bapi\//i.test(t)
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatActivitySummary(entry: AuditLogEntry): string {
  const actor  = entry.user?.name ?? 'System';
  const meta   = entry.metadata ?? {};
  const method = String(meta.method ?? '').toUpperCase();
  const label  = entry.entity_label ?? '';
  const id     = entry.auditable_id;

  // 1. Server-generated human_description — but ONLY if it's actually human.
  //    The backend sometimes generates "GET api/assistive-devices" as the description.
  //    Detect and skip those so the fallback chain produces something readable.
  if (entry.human_description && !isRawApiText(entry.human_description)) {
    return entry.human_description;
  }

  // 2. Route label from metadata — the named Laravel route is the most reliable
  //    non-technical source ("messages.store" → "Sent a message").
  if (meta.route) {
    const rl = routeLabel(String(meta.route));
    return actor !== 'System' ? `${actor} — ${rl}` : rl;
  }

  // 3. HTTP method + entity label + optional ID
  const verbMap: Record<string, string> = {
    GET:    'viewed',
    POST:   'created',
    PUT:    'updated',
    PATCH:  'updated',
    DELETE: 'deleted',
  };
  const verb = verbMap[method];

  if (verb && label && id) {
    return `${actor} ${verb} ${label.toLowerCase()} #${id}`;
  }
  if (verb && label) {
    return `${actor} ${verb} ${label.toLowerCase()}`;
  }

  // 4. Sanitize the raw action string (handles "GET api/..." and "resource:action")
  const raw = entry.action ?? '';
  if (raw) {
    const sanitized = sanitizeActionText(raw, actor !== 'System' ? actor : undefined);
    if (sanitized && sanitized !== raw) return sanitized;
    // If sanitization didn't transform it, only use it if it looks human
    if (!raw.match(/^(GET|POST|PUT|PATCH|DELETE)\s/i) && !raw.includes('api/')) {
      return raw;
    }
  }

  // 5. Generic fallback
  return 'System event';
}

/**
 * Returns relevant navigation actions for a log entry.
 * Only returns actions when a valid target ID exists — never fabricates links.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getLogActions(entry: AuditLogEntry): LogAction[] {
  const actions: LogAction[] = [];
  const atype = (entry.auditable_type ?? '').toLowerCase();
  const id    = entry.auditable_id;

  if (!id) return actions;

  if (atype.includes('application')) {
    actions.push({
      label: 'View application',
      href:  ROUTES.ADMIN_APPLICATION_DETAIL(id),
      icon:  FileText,
    });
  }
  if (atype.includes('camper')) {
    actions.push({
      label: 'View camper',
      href:  ROUTES.ADMIN_CAMPER_DETAIL(id),
      icon:  User,
    });
  }
  if (atype.includes('message') || atype.includes('conversation')) {
    actions.push({
      label: 'View inbox',
      href:  ROUTES.SUPER_ADMIN_INBOX,
      icon:  MessageSquare,
    });
  }
  if (atype.includes('user')) {
    actions.push({
      label: 'View users',
      href:  ROUTES.SUPER_ADMIN_USERS,
      icon:  User,
    });
  }
  if (atype.includes('session')) {
    actions.push({
      label: 'View session',
      href:  ROUTES.ADMIN_SESSION_DETAIL(id),
      icon:  Calendar,
    });
  }

  return actions;
}

// ─── Severity visual system ───────────────────────────────────────────────────

interface SeverityDef {
  color:      string;        // text / icon color
  bg:         string;        // badge background
  border:     string;        // left-border color on the row card
  icon:       ElementType;
  label:      string;
}

const SEVERITY_DEFS: Record<LogSeverity, SeverityDef> = {
  info:     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'transparent',    icon: Info,          label: 'audit_extra.severity_info'      },
  success:  { color: '#166534', bg: 'rgba(22,163,74,0.10)',   border: '#16a34a',        icon: CheckCircle,   label: 'audit_extra.severity_low'       },
  warning:  { color: '#92400e', bg: 'rgba(217,119,6,0.10)',   border: '#d97706',        icon: AlertTriangle, label: 'audit_extra.severity_medium'    },
  critical: { color: '#991b1b', bg: 'rgba(220,38,38,0.10)',   border: '#dc2626',        icon: AlertCircle,   label: 'audit_extra.severity_critical'  },
};

// Small severity badge shown inside the expanded panel header
function SeverityBadge({ severity }: { severity: LogSeverity }) {
  const { t } = useTranslation();
  const def  = SEVERITY_DEFS[severity];
  const Icon = def.icon;
  if (severity === 'info') return null; // don't clutter info entries
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: def.bg, color: def.color }}
    >
      <Icon className="h-3 w-3" />
      {t(def.label)}
    </span>
  );
}

// ─── Filters state ────────────────────────────────────────────────────────────

interface Filters {
  search:      string;
  event_type:  string;
  entity_type: string;
  user_id:     string;
  from:        string;
  to:          string;
  page:        number;
}

const DEFAULT_FILTERS: Filters = {
  search: '', event_type: '', entity_type: '', user_id: '', from: '', to: '', page: 1,
};

// ─── CategoryBadge ────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category?: string }) {
  const { t } = useTranslation();
  const def  = getCategoryDef(category);
  const Icon = def.icon;
  const labelKey = category ? CATEGORY_LABEL_KEYS[category] : undefined;
  const label    = labelKey ? t(labelKey) : def.label;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
      style={{ background: def.bg, color: def.color }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ─── Intelligence Summary Strip ───────────────────────────────────────────────
//
// A compact informational bar at the top of the page. It reads the current
// page's entries and the pagination meta to give the super admin an instant
// orientation of what's happening.

interface IntelligenceSummaryProps {
  entries:    AuditLogEntry[];
  totalEvents?: number;
  isFiltered:   boolean;
  onShowToday:  () => void;
  isTodayActive: boolean;
}

function IntelligenceSummaryStrip({
  entries,
  totalEvents,
  isFiltered,
  onShowToday,
  isTodayActive,
}: IntelligenceSummaryProps) {
  const { t } = useTranslation();
  // Compute page-level severity counts for orientation
  const criticalCount = entries.filter(e => getLogSeverity(e) === 'critical').length;
  const warningCount  = entries.filter(e => getLogSeverity(e) === 'warning').length;
  const messageCount  = entries.filter(e => getLogType(e) === 'message').length;
  const applicationCount = entries.filter(e => getLogType(e) === 'application').length;

  const needsAttention = criticalCount + warningCount;

  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 border"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      {/* Total events count */}
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 flex-shrink-0" style={{ color: '#6b7280' }} />
        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--foreground)' }}>
          {totalEvents != null ? totalEvents.toLocaleString() : '—'}
        </span>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {isFiltered ? 'matching events' : 'total events'}
        </span>
      </div>

      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {/* Needs attention pill — only shown when there are critical/warning items on this page */}
      {needsAttention > 0 ? (
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#d97706' }} />
          <span className="text-xs font-medium" style={{ color: '#92400e' }}>
            {needsAttention} item{needsAttention !== 1 ? 's' : ''} need attention
          </span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(this page)</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t('audit_extra.no_critical')}</span>
        </div>
      )}

      {/* Message count if relevant */}
      {messageCount > 0 && (
        <>
          <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" style={{ color: '#16a34a' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
          </div>
        </>
      )}

      {/* Application count if relevant */}
      {applicationCount > 0 && (
        <>
          <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" style={{ color: '#d97706' }} />
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {applicationCount} application event{applicationCount !== 1 ? 's' : ''}
            </span>
          </div>
        </>
      )}

      {/* Spacer + Today quick filter */}
      <div className="ml-auto">
        <button
          type="button"
          onClick={onShowToday}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{
            borderColor: isTodayActive ? '#2563eb' : 'var(--border)',
            color: isTodayActive ? '#2563eb' : 'var(--muted-foreground)',
            background: isTodayActive ? 'rgba(37,99,235,0.08)' : undefined,
          }}
        >
          <Clock className="h-3 w-3" />
          Today only
        </button>
      </div>
    </div>
  );
}

// ─── Expanded Panel sub-components ───────────────────────────────────────────

// Actor section: shows who performed the action with their email as secondary info
function ActorSection({ entry }: { entry: AuditLogEntry }) {
  if (!entry.user) return null;
  return (
    <div className="flex items-start gap-2">
      <div
        className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(37,99,235,0.10)' }}
      >
        <User className="h-3 w-3" style={{ color: '#2563eb' }} />
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
          {entry.user.name}
        </p>
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {entry.user.email}
        </p>
      </div>
    </div>
  );
}

// Resource section: shows what entity was affected
function ResourceSection({ entry }: { entry: AuditLogEntry }) {
  if (!entry.entity_label && !entry.auditable_type) return null;

  // Strip the Laravel model namespace to get just the model name
  const rawType = entry.auditable_type ?? '';
  const shortType = rawType.includes('\\')
    ? rawType.split('\\').pop() ?? rawType
    : rawType;

  // Convert PascalCase to "Title Case"
  const typeLabel = shortType.replace(/([a-z])([A-Z])/g, '$1 $2');
  const display   = entry.entity_label ?? typeLabel;

  return (
    <div className="flex items-center gap-2">
      <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
      <span className="text-xs" style={{ color: 'var(--foreground)' }}>
        {display}
        {entry.auditable_id ? (
          <span style={{ color: 'var(--muted-foreground)' }}> #{entry.auditable_id}</span>
        ) : null}
      </span>
    </div>
  );
}

// Full timestamp section: shows exact time alongside relative time
function TimestampSection({ createdAt }: { createdAt: string }) {
  const date = new Date(createdAt);
  const isTodayEntry = isToday(parseISO(createdAt));
  return (
    <div className="flex items-center gap-2">
      <Clock className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
      <span className="text-xs" style={{ color: 'var(--foreground)' }}>
        {format(date, isTodayEntry ? "'Today at' HH:mm:ss" : 'MMM d, yyyy \'at\' HH:mm:ss')}
      </span>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        ({formatDistanceToNow(date, { addSuffix: true })})
      </span>
    </div>
  );
}

// Source section: shows origin of the request in human-readable form
function SourceSection({ entry }: { entry: AuditLogEntry }) {
  const source = parseSource(entry.ip_address, entry.user_agent);
  const device = entry.user_agent ? parseUserAgent(entry.user_agent) : null;
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
      <span className="text-xs" style={{ color: 'var(--foreground)' }}>
        {source}
      </span>
      {device && (
        <>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>·</span>
          <Monitor className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{device}</span>
        </>
      )}
    </div>
  );
}

// Type-specific context panel: renders relevant details based on log type
function TypeContextPanel({
  entry,
  logType,
}: {
  entry:   AuditLogEntry;
  logType: LogType;
}) {
  const meta      = entry.metadata ?? {};
  const oldValues = entry.old_values ?? {};
  const newValues = entry.new_values ?? {};

  // Helper to convert unknown record value to string | undefined
  const toStr = (v: unknown): string | undefined =>
    v != null ? String(v) : undefined;

  // Application: highlight the status transition if available
  if (logType === 'application') {
    const oldStatus = toStr(oldValues['status'] ?? oldValues['application_status']);
    const newStatus = toStr(newValues['status'] ?? newValues['application_status']);

    if (oldStatus || newStatus) {
      return (
        <div
          className="rounded-lg px-3 py-2 border"
          style={{ borderColor: 'rgba(217,119,6,0.25)', background: 'rgba(217,119,6,0.04)' }}
        >
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#92400e' }}>
            Application status change
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {oldStatus && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(107,114,128,0.12)', color: '#374151' }}
              >
                {oldStatus}
              </span>
            )}
            {oldStatus && newStatus && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>→</span>
            )}
            {newStatus && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'rgba(22,163,74,0.12)', color: '#166534' }}
              >
                {newStatus}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  // Message: show conversation context with HTML-stripped content
  if (logType === 'message') {
    const routeParams = meta['route_parameters'];
    const conversationId = toStr(
      meta['conversation_id'] ??
      (routeParams && typeof routeParams === 'object'
        ? (routeParams as Record<string, unknown>)['conversation']
        : undefined)
    );
    // Strip HTML tags from subject/title in case rich content was stored
    const rawSubject = toStr(meta['subject'] ?? meta['title']);
    const subject = rawSubject ? stripHtml(rawSubject) : undefined;

    // Also check for message body in old_values/new_values and strip HTML
    const rawBody = toStr(
      newValues['body'] ?? newValues['content'] ?? newValues['message'] ??
      oldValues['body'] ?? oldValues['content'] ?? oldValues['message']
    );
    const bodyPreview = rawBody
      ? stripHtml(rawBody).slice(0, 120) + (rawBody.length > 120 ? '…' : '')
      : undefined;

    if (conversationId || subject || bodyPreview) {
      return (
        <div
          className="rounded-lg px-3 py-2 border"
          style={{ borderColor: 'rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.04)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#166534' }}>
            Message details
          </p>
          {subject && (
            <p className="text-xs" style={{ color: 'var(--foreground)' }}>
              Subject: {subject}
            </p>
          )}
          {bodyPreview && (
            <p className="text-xs mt-0.5 italic" style={{ color: 'var(--muted-foreground)' }}>
              "{bodyPreview}"
            </p>
          )}
          {conversationId && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Conversation #{conversationId}
            </p>
          )}
        </div>
      );
    }
  }

  // Document: highlight document name and status
  if (logType === 'document') {
    const docName   = toStr(newValues['file_name'] ?? newValues['name'] ?? oldValues['file_name'] ?? oldValues['name']);
    const docStatus = toStr(newValues['status'] ?? oldValues['status']);

    if (docName || docStatus) {
      return (
        <div
          className="rounded-lg px-3 py-2 border"
          style={{ borderColor: 'rgba(3,105,161,0.25)', background: 'rgba(3,105,161,0.04)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: '#0369a1' }}>
            Document details
          </p>
          {docName && (
            <p className="text-xs" style={{ color: 'var(--foreground)' }}>
              File: {docName}
            </p>
          )}
          {docStatus && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Status: {docStatus}
            </p>
          )}
        </div>
      );
    }
  }

  // Permission: surface what changed
  if (logType === 'permission') {
    const oldRole = toStr(oldValues['role'] ?? oldValues['permissions']);
    const newRole = toStr(newValues['role'] ?? newValues['permissions']);

    if (oldRole || newRole) {
      return (
        <div
          className="rounded-lg px-3 py-2 border"
          style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.04)' }}
        >
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#991b1b' }}>
            Permission / role change
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {oldRole && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.10)', color: '#991b1b' }}>
                {oldRole}
              </span>
            )}
            {oldRole && newRole && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>→</span>
            )}
            {newRole && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(22,163,74,0.12)', color: '#166534' }}>
                {newRole}
              </span>
            )}
          </div>
        </div>
      );
    }
  }

  return null;
}

// Quick action links for the expanded panel
function QuickActionsBar({ actions }: { actions: LogAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href + action.label}
            to={action.href}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Icon className="h-3 w-3" />
            {action.label}
            <ExternalLink className="h-3 w-3" style={{ color: 'var(--muted-foreground)' }} />
          </Link>
        );
      })}
    </div>
  );
}

// ─── AuditEntry row ───────────────────────────────────────────────────────────

function AuditEntryRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const logType    = getLogType(entry);
  const severity   = getLogSeverity(entry);
  const severityDef = SEVERITY_DEFS[severity];
  const quickActions = getLogActions(entry);

  // Always allow expansion — there is always at least metadata (IP, user, timestamp details)
  // hasDetails controls whether the expand button is shown
  const hasDetails =
    (entry.old_values && Object.keys(entry.old_values).length > 0) ||
    (entry.new_values && Object.keys(entry.new_values).length > 0) ||
    (entry.metadata   && Object.keys(entry.metadata).length > 0)   ||
    entry.user_agent ||
    entry.user ||
    quickActions.length > 0;

  const displayText = formatActivitySummary(entry);

  return (
    <div
      className="glass-data rounded-xl overflow-hidden"
      style={{
        // Severity left border accent (critical/warning/success get a colored left edge)
        borderLeft: severity !== 'info'
          ? `3px solid ${severityDef.border}`
          : '3px solid transparent',
      }}
    >
      {/* Main row — clickable to expand */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => { if (hasDetails) setExpanded((v) => !v); }}
        role={hasDetails ? 'button' : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => { if (hasDetails && (e.key === 'Enter' || e.key === ' ')) setExpanded((v) => !v); }}
        aria-expanded={hasDetails ? expanded : undefined}
      >
        {/* Category icon */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 mt-0.5"
          style={{ background: getCategoryDef(entry.category).bg }}
        >
          {(() => {
            const Icon = getCategoryDef(entry.category).icon;
            return <Icon className="h-3.5 w-3.5" style={{ color: getCategoryDef(entry.category).color }} />;
          })()}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Human-readable description + badges */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium leading-snug flex-1" style={{ color: 'var(--foreground)' }}>
              {displayText}
            </p>
            <CategoryBadge category={entry.category} />
            <SeverityBadge severity={severity} />
          </div>

          {/* Secondary metadata: user name, entity label, IP */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {entry.user && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <User className="h-3 w-3" />
                {entry.user.name}
              </span>
            )}
            {entry.entity_label && entry.auditable_id && (
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {entry.entity_label} #{entry.auditable_id}
              </span>
            )}
            {entry.ip_address && (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <Globe className="h-3 w-3" />
                {entry.ip_address === '127.0.0.1' || entry.ip_address === '::1'
                  ? 'Internal'
                  : entry.ip_address}
              </span>
            )}
          </div>
        </div>

        {/* Right column: timestamp + chevron */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <time
            className="text-xs tabular-nums"
            style={{ color: 'var(--muted-foreground)' }}
            title={format(new Date(entry.created_at), 'PPpp')}
          >
            {format(new Date(entry.created_at), 'MMM d, HH:mm')}
          </time>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
          </span>
          {hasDetails && (
            <span className="mt-1 p-1 rounded" aria-hidden>
              {expanded
                ? <ChevronUp   className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                : <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
              }
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-2 border-t space-y-3"
          style={{ borderColor: 'var(--border)', background: 'rgba(248,249,250,0.6)' }}
          role="presentation"
          onClick={(e) => e.stopPropagation()} // prevent row-click collapsing from panel interactions
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* ── Section header with severity badge */}
          <div className="flex items-center gap-2 pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              Event details
            </span>
          </div>

          {/* ── Who: Actor */}
          <ActorSection entry={entry} />

          {/* ── What: Resource affected */}
          <ResourceSection entry={entry} />

          {/* ── When: Full timestamp */}
          <TimestampSection createdAt={entry.created_at} />

          {/* ── Where: Source / device */}
          <SourceSection entry={entry} />

          {/* ── Type-specific context (status transitions, doc details, etc.) */}
          <TypeContextPanel entry={entry} logType={logType} />

          {/* ── Before / After diff blocks */}
          {entry.old_values && Object.keys(entry.old_values).length > 0 && (
            <DiffBlock label="Before" rows={formatDiffEntries(entry.old_values)} variant="removed" />
          )}
          {entry.new_values && Object.keys(entry.new_values).length > 0 && (
            <DiffBlock label="After" rows={formatDiffEntries(entry.new_values)} variant="added" />
          )}

          {/* ── Technical metadata (route, method, status) */}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <MetadataPanel metadata={entry.metadata} />
          )}

          {/* ── Request ID */}
          {entry.request_id && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Reference ID: <span className="font-mono">{entry.request_id}</span>
            </p>
          )}

          {/* ── Quick actions */}
          <QuickActionsBar actions={quickActions} />
        </div>
      )}
    </div>
  );
}

// ─── DiffBlock ─────────────────────────────────────────────────────────────────

function DiffBlock({
  label,
  rows,
  variant,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: string }>;
  variant: 'added' | 'removed';
}) {
  const colors = {
    added:   { border: 'rgba(22,163,74,0.30)',  bg: 'rgba(22,163,74,0.04)',  header: '#166534' },
    removed: { border: 'rgba(220,38,38,0.30)',  bg: 'rgba(220,38,38,0.04)', header: '#991b1b' },
  }[variant];

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: colors.border }}>
      <div className="px-3 py-1 text-xs font-semibold" style={{ background: colors.bg, color: colors.header }}>
        {label}
      </div>
      <div className="divide-y" style={{ borderColor: colors.border }}>
        {rows.map(({ key, label: lbl, value }) => (
          <div key={key} className="flex items-start gap-3 px-3 py-1.5">
            <span className="text-xs font-medium flex-shrink-0 w-36" style={{ color: 'var(--muted-foreground)' }}>
              {lbl}
            </span>
            <span className="text-xs break-all" style={{ color: 'var(--foreground)' }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MetadataPanel ─────────────────────────────────────────────────────────────

function MetadataPanel({ metadata }: { metadata: Record<string, unknown> }) {
  const rows: Array<{ label: string; value: string; ok?: boolean }> = [];

  // "What happened" row — route translated to human label
  if (metadata.route) {
    rows.push({ label: 'What happened', value: routeLabel(String(metadata.route)) });
  }
  // "Outcome" row — success or error
  if (metadata.status) {
    const { text, ok } = httpStatusLabel(Number(metadata.status));
    rows.push({ label: 'Outcome', value: text, ok });
  }
  // "Record" row — which specific record was touched
  if (metadata.route_parameters && typeof metadata.route_parameters === 'object') {
    const formatted = formatRouteParams(metadata.route_parameters);
    if (formatted) rows.push({ label: 'Record', value: formatted });
  }

  // Any remaining non-standard keys (exclude method — it's already reflected in summary)
  const knownKeys = new Set(['route', 'method', 'status', 'route_parameters']);
  for (const [k, v] of Object.entries(metadata)) {
    if (!knownKeys.has(k)) {
      rows.push({ label: fieldLabel(k), value: formatFieldValue(k, v) });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(107,114,128,0.25)' }}>
      <div
        className="px-3 py-1 text-xs font-semibold"
        style={{ background: 'rgba(107,114,128,0.06)', color: '#374151' }}
      >
        Details
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(107,114,128,0.12)' }}>
        {rows.map(({ label, value, ok }) => (
          <div key={label} className="flex items-start gap-3 px-3 py-1.5">
            <span className="text-xs font-medium flex-shrink-0 w-36" style={{ color: 'var(--muted-foreground)' }}>
              {label}
            </span>
            <span
              className="text-xs"
              style={{ color: ok === false ? '#dc2626' : ok === true ? '#166534' : 'var(--foreground)' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const { t } = useTranslation();

  // Event type filter options — moved inside component so labels use t()
  const EVENT_TYPES = [
    { value: '',               label: t('audit_extra.all_categories') },
    { value: 'authentication', label: t('audit_extra.category_auth')  },
    { value: 'auth',           label: t('audit_extra.category_auth')  },
    { value: 'message',        label: t('audit_extra.category_messaging') },
    { value: 'conversation',   label: t('audit_extra.category_messaging') },
    { value: 'application',    label: t('audit_extra.category_applications') },
    { value: 'notification',   label: t('audit_extra.category_system') },
    { value: 'security',       label: t('audit_extra.category_security') },
    { value: 'phi_access',     label: t('audit_extra.category_medical') },
    { value: 'admin_action',   label: t('audit_extra.category_system') },
    { value: 'document',       label: t('audit_extra.category_documents') },
    { value: 'user',           label: t('audit_extra.category_users') },
  ];

  // Entity type filter options — moved inside component so labels use t()
  const ENTITY_TYPES = [
    { value: '',              label: t('audit_extra.all_resources')    },
    { value: 'Camper',        label: t('audit_extra.category_campers') },
    { value: 'Application',   label: t('audit_extra.category_applications') },
    { value: 'Document',      label: t('audit_extra.category_documents') },
    { value: 'User',          label: t('audit_extra.category_users')   },
    { value: 'Message',       label: t('audit_extra.category_messaging') },
    { value: 'Conversation',  label: t('audit_extra.category_messaging') },
    { value: 'MedicalRecord', label: t('audit_extra.category_medical') },
    { value: 'CampSession',   label: t('audit_extra.category_sessions') },
  ];

  const [response, setResponse]       = useState<PaginatedResponse<AuditLogEntry> | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key !== 'page' ? 1 : (value as number) }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 300);
  }

  const hasActiveFilters = filters.event_type || filters.entity_type || filters.user_id || filters.from || filters.to;

  // Whether the user is currently viewing today's events only
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodayActive = filters.from === todayStr && filters.to === todayStr;

  function handleShowToday() {
    if (isTodayActive) {
      // Toggle off: remove date filters
      setFilters((f) => ({ ...f, from: '', to: '', page: 1 }));
    } else {
      setFilters((f) => ({ ...f, from: todayStr, to: todayStr, page: 1 }));
    }
  }

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = {
        page:        filters.page,
        per_page:    25,
        search:      filters.search      || undefined,
        event_type:  filters.event_type  || undefined,
        entity_type: filters.entity_type || undefined,
        user_id:     filters.user_id ? Number(filters.user_id) : undefined,
        from:        filters.from        || undefined,
        to:          filters.to          || undefined,
      };
      const data = await getAuditLog(params);
      setResponse(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void fetchLog(); }, [fetchLog]);

  async function handleExport(fmt: 'csv' | 'json') {
    setExporting(true);
    try {
      await exportAuditLog({
        format:      fmt,
        search:      filters.search      || undefined,
        event_type:  filters.event_type  || undefined,
        entity_type: filters.entity_type || undefined,
        user_id:     filters.user_id ? Number(filters.user_id) : undefined,
        from:        filters.from        || undefined,
        to:          filters.to          || undefined,
      });
    } catch {
      // exportAuditLog handles its own blob download; silently ignore here
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setFilters(DEFAULT_FILTERS);
  }

  const entries = response?.data ?? [];
  const meta    = response?.meta;

  return (
    <div className="p-6 max-w-6xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Audit Intelligence Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {meta?.total != null
              ? `${meta.total.toLocaleString()} events recorded`
              : 'Full record of system activity and security events'}
          </p>
        </div>

        {/* Export and filter toolbar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{
              borderColor: hasActiveFilters ? '#16a34a' : 'var(--border)',
              color: hasActiveFilters ? '#16a34a' : 'var(--foreground)',
              background: hasActiveFilters ? 'rgba(22,163,74,0.08)' : undefined,
            }}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#16a34a' }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => void fetchLog()}
            disabled={loading}
            className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] disabled:opacity-40"
            style={{ borderColor: 'var(--border)' }}
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>
      </div>

      {/* Intelligence Summary Strip — always visible once data loads */}
      {!loading && !error && (
        <IntelligenceSummaryStrip
          entries={entries}
          totalEvents={meta?.total}
          isFiltered={!!(filters.search || hasActiveFilters)}
          onShowToday={handleShowToday}
          isTodayActive={isTodayActive}
        />
      )}

      {/* Search bar */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2 border mb-3"
        style={{ background: 'var(--input)', borderColor: 'var(--border)' }}
      >
        <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <input
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search events, users, actions…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--foreground)' }}
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              if (debounceRef.current) clearTimeout(debounceRef.current);
              setFilters((f) => ({ ...f, search: '', page: 1 }));
            }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <div className="glass-panel grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3 p-4 rounded-xl">
          {/* Category / event type */}
          <div>
            <label htmlFor="alp-event-type" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Category
            </label>
            <select
              id="alp-event-type"
              value={filters.event_type}
              onChange={(e) => updateFilter('event_type', e.target.value)}
              className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Resource / entity type — NEW */}
          <div>
            <label htmlFor="alp-entity-type" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              Resource type
            </label>
            <select
              id="alp-entity-type"
              value={filters.entity_type}
              onChange={(e) => updateFilter('entity_type', e.target.value)}
              className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* User ID */}
          <div>
            <label htmlFor="alp-user-id" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              User ID
            </label>
            <input
              id="alp-user-id"
              type="number"
              value={filters.user_id}
              onChange={(e) => updateFilter('user_id', e.target.value)}
              placeholder="Any user"
              className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* From date */}
          <div>
            <label htmlFor="alp-from-date" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              From date
            </label>
            <input
              id="alp-from-date"
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter('from', e.target.value)}
              className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* To date */}
          <div>
            <label htmlFor="alp-to-date" className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              To date
            </label>
            <input
              id="alp-to-date"
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter('to', e.target.value)}
              className="w-full text-sm rounded-lg px-2 py-1.5 border outline-none"
              style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <div className="col-span-2 sm:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium hover:underline"
                style={{ color: '#dc2626' }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Event timeline */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 12 }).map((_, i) => <Skeletons.Row key={i} />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Could not load the activity log
          </p>
          <button
            onClick={() => void fetchLog()}
            className="text-sm font-medium px-4 py-1.5 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: '#16a34a' }}
          >
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            No events found
          </p>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {filters.search || hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Activity will appear here as the system is used.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {meta.from != null && meta.to != null
              ? `Showing ${meta.from.toLocaleString()}–${meta.to.toLocaleString()} of ${meta.total.toLocaleString()} events`
              : `Page ${filters.page} of ${meta.last_page}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilter('page', filters.page - 1)}
              disabled={filters.page === 1}
              className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronLeft className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
            </button>
            <span className="text-sm px-2 tabular-nums" style={{ color: 'var(--foreground)' }}>
              {filters.page} / {meta.last_page}
            </span>
            <button
              onClick={() => updateFilter('page', filters.page + 1)}
              disabled={filters.page === meta.last_page}
              className="p-1.5 rounded-lg border disabled:opacity-40 transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
              style={{ borderColor: 'var(--border)' }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: 'var(--foreground)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
