/**
 * AdminFamilyWorkspacePage.tsx
 *
 * Level 2 of the family-first admin IA.
 * Route: /admin/families/:userId (also /super-admin/families/:userId)
 *
 * Purpose:
 *   Command centre for a single family. Shows the guardian's account details,
 *   all their registered campers, and each camper's complete application history.
 *
 * Navigation:
 *   ← Families  (Level 1)
 *   → View Application  (Level 3 — ApplicationReviewPage)
 *   → View Full Record  (Level 3 — CamperDetailPage)
 *
 * Design principles:
 *   - Family header is calm and informational, not overwhelming.
 *   - Each child gets its own card with all their applications inside.
 *   - Application rows show just enough: session name, status, submitted date, one CTA.
 *   - No PHI — this page intentionally omits medical data.
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, Mail, Phone, MapPin, Calendar,
  FileText, ExternalLink, AlertCircle, ClipboardList,
} from 'lucide-react';
import { format, parseISO, differenceInYears } from 'date-fns';

import { getFamily } from '@/features/admin/api/admin.api';
import { Avatar } from '@/ui/components/Avatar';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type { FamilyWorkspace, FamilyWorkspaceCamper, FamilyWorkspaceApplication } from '@/features/admin/types/admin.types';

// ─── Status badge ────────────────────────────────────────────────────────────

type AppStatus = FamilyWorkspaceApplication['status'];

const STATUS_STYLE: Record<AppStatus, { bg: string; color: string }> = {
  submitted:    { bg: 'rgba(37,99,235,0.10)',   color: '#1d4ed8' },
  under_review: { bg: 'rgba(37,99,235,0.12)',   color: '#2563eb' },
  approved:     { bg: 'rgba(22,163,74,0.12)',   color: '#16a34a' },
  rejected:     { bg: 'rgba(220,38,38,0.12)',   color: '#dc2626' },
  waitlisted:   { bg: 'rgba(234,88,12,0.12)',   color: '#ea580c' },
  cancelled:    { bg: 'rgba(107,114,128,0.10)', color: '#9ca3af' },
  withdrawn:    { bg: 'rgba(107,114,128,0.10)', color: '#9ca3af' },
};

function StatusBadge({ status }: { status: AppStatus }) {
  const { t } = useTranslation();
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.submitted;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {t(`status_labels.${status}`)}
    </span>
  );
}

// ─── Age helper ──────────────────────────────────────────────────────────────

function computeAge(dob: string): number {
  return differenceInYears(new Date(), parseISO(dob));
}

// ─── Application row ─────────────────────────────────────────────────────────

function ApplicationRow({
  application,
  applicationBase,
}: {
  application: FamilyWorkspaceApplication;
  applicationBase: string;
}) {
  const { t } = useTranslation();
  const isDraft     = application.is_draft === true;
  const isTerminal  = ['cancelled', 'withdrawn'].includes(application.status);

  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border"
      style={{
        background: isDraft || isTerminal ? 'transparent' : 'var(--card)',
        borderColor: 'var(--border)',
        opacity: isTerminal ? 0.6 : 1,
      }}
    >
      {/* Session + date */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
          {application.session?.name ?? `Session #${application.camp_session_id}`}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          {application.submitted_at
            ? `Submitted ${format(parseISO(application.submitted_at), 'MMM d, yyyy')}`
            : isDraft
            ? 'Draft — not yet submitted'
            : `Created ${format(parseISO(application.created_at), 'MMM d, yyyy')}`}
        </p>
      </div>

      {/* Status + action */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusBadge status={application.status} />
        {!isDraft && (
          <Link
            to={`${applicationBase}/${application.id}`}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--night-sky-blue)' }}
          >
            <span>{t('admin_extra.review_btn')}</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Camper card ─────────────────────────────────────────────────────────────

function CamperCard({
  camper,
  camperBase,
  applicationBase,
}: {
  camper: FamilyWorkspaceCamper;
  camperBase: string;
  applicationBase: string;
}) {
  const age    = computeAge(camper.date_of_birth);
  const gender = camper.gender
    ? camper.gender.charAt(0).toUpperCase() + camper.gender.slice(1)
    : null;

  // Sort: active/review first, then approved, then terminal (cancelled/withdrawn/draft).
  const SORT_ORDER: Record<AppStatus, number> = {
    under_review: 0, submitted: 1, waitlisted: 2, approved: 3,
    rejected: 4, cancelled: 5, withdrawn: 6,
  };
  const sortedApps = [...camper.applications].sort(
    (a, b) => (SORT_ORDER[a.status] ?? 9) - (SORT_ORDER[b.status] ?? 9)
  );

  return (
    <div
      className="glass-panel rounded-xl overflow-hidden"
    >
      {/* Camper identity header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ background: 'var(--glass-medium)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <Avatar name={camper.full_name} size="md" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {camper.full_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Age {age}
              {gender ? ` · ${gender}` : ''}
              {' · '}
              DOB {format(parseISO(camper.date_of_birth), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <Link
          to={`${camperBase}/${camper.id}`}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Full Record
        </Link>
      </div>

      {/* Applications section */}
      <div className="px-5 py-4">
        {sortedApps.length === 0 ? (
          <div
            className="flex items-center gap-2 text-sm py-2"
            style={{ color: 'var(--muted-foreground)' }}
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            No applications submitted yet.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Applications ({sortedApps.length})
            </p>
            {sortedApps.map((app) => (
              <ApplicationRow
                key={app.id}
                application={app}
                applicationBase={applicationBase}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Guardian account panel ───────────────────────────────────────────────────

function GuardianPanel({ family }: { family: FamilyWorkspace }) {
  const address = [
    family.address_line_1,
    family.address_line_2,
    [family.city, family.state].filter(Boolean).join(', '),
    family.postal_code,
  ].filter(Boolean).join(', ');

  return (
    <div
      className="glass-panel rounded-xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      {/* Email */}
      <div className="flex items-start gap-2">
        <Mail className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Email
          </p>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>{family.email}</p>
        </div>
      </div>

      {/* Phone */}
      {family.phone && (
        <div className="flex items-start gap-2">
          <Phone className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Phone
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{family.phone}</p>
          </div>
        </div>
      )}

      {/* Address */}
      {address && (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
              Address
            </p>
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>{address}</p>
          </div>
        </div>
      )}

      {/* Member since */}
      <div className="flex items-start gap-2">
        <Calendar className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Member Since
          </p>
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>
            {format(parseISO(family.created_at), 'MMMM yyyy')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function AdminFamilyWorkspacePage() {
  const { userId } = useParams<{ userId: string }>();
  const location   = useLocation();
  const isSuperAdmin    = location.pathname.startsWith('/super-admin');
  const familiesBase    = isSuperAdmin ? '/super-admin/families'    : '/admin/families';
  const camperBase      = isSuperAdmin ? '/super-admin/campers'     : '/admin/campers';
  const applicationBase = isSuperAdmin ? '/super-admin/applications': '/admin/applications';

  // ── State ──────────────────────────────────────────────────────────────────
  const [family, setFamily]   = useState<FamilyWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const run = async () => {
      if (!cancelled) { setLoading(true); setError(null); }
      try {
        const data = await getFamily(Number(userId));
        if (!cancelled) setFamily(data);
      } catch (err: unknown) {
        if (!cancelled) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          setError(status === 404 ? 'Family not found.' : 'Failed to load family data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [userId, retryKey]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl">
      {/* Back navigation */}
      <Link
        to={familiesBase}
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors hover:opacity-80"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ChevronLeft className="h-4 w-4" />
        Families
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeletons.Row />
          <Skeletons.Row />
          <Skeletons.Row />
        </div>
      ) : error ? (
        <EmptyState
          title={error}
          description={error === 'Family not found.'
            ? 'This family account may have been removed.'
            : 'Check your connection and try again.'}
          action={error !== 'Family not found.'
            ? { label: 'Retry', onClick: () => setRetryKey((k) => k + 1) }
            : undefined}
        />
      ) : family ? (
        <>
          {/* Family header */}
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={family.name} size="lg" />
            <div>
              <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                {family.name}
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {family.campers.length} {family.campers.length === 1 ? 'camper' : 'campers'} registered
              </p>
            </div>
          </div>

          {/* Guardian account panel */}
          <GuardianPanel family={family} />

          {/* Children section */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Children
            </h2>

            {family.campers.length === 0 ? (
              <div
                className="glass-card rounded-xl p-6 flex items-center gap-3"
              >
                <AlertCircle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  No campers registered under this account yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {family.campers.map((camper) => (
                  <CamperCard
                    key={camper.id}
                    camper={camper}
                    camperBase={camperBase}
                    applicationBase={applicationBase}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
