/**
 * SessionDetailPage.tsx
 *
 * Operational dashboard for a single camp session.
 *
 * Staff use this page to monitor:
 *  - Capacity usage (enrolled vs available spots, fill %)
 *  - Application breakdown by status
 *  - Recent application activity feed
 *  - Age and gender distribution of enrolled campers
 *
 * Route: /admin/sessions/:id
 * API:   GET /api/sessions/{id}/dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Calendar, Users, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, BarChart3, UserCheck, ListFilter, Archive,
  Globe, GlobeLock,
} from 'lucide-react';

import { getSessionDashboard, archiveSession, activateSession, deactivateSession } from '@/features/admin/api/admin.api';
import { Button } from '@/ui/components/Button';
import { Skeletons } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import type { SessionDashboardStats } from '@/features/admin/types/admin.types';
import { ROUTES } from '@/shared/constants/routes';
import { toast } from 'sonner';
import { StatusBadge } from '@/ui/components/StatusBadge';

// ---------------------------------------------------------------------------
// StatusBadge is imported from the shared component above — using the
// project-standard colors and labels for consistency across all pages.

// ---------------------------------------------------------------------------
// Capacity bar — visual fill indicator with colour coding
// ---------------------------------------------------------------------------
function CapacityBar({ enrolled, capacity }: { enrolled: number; capacity: number }) {
  const pct   = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#166534';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {enrolled} / {capacity} enrolled
        </span>
        <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  valueColor?: string;
}

function StatCard({ icon, label, value, sub, valueColor }: StatCardProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="p-1.5 rounded-lg"
          style={{ background: 'rgba(22,101,52,0.08)' }}
        >
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold font-headline" style={{ color: valueColor ?? 'var(--foreground)' }}>
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini horizontal bar for distribution charts
// ---------------------------------------------------------------------------
function DistributionRow({ label, count, maxCount }: { label: string; count: number; maxCount: number }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>{count}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: 'var(--ember-orange)' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export function SessionDetailPage() {
  const { t }        = useTranslation();
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const location     = useLocation();
  // Detect portal prefix so back navigation works for both /admin and /super-admin.
  const sessionsBase = location.pathname.startsWith('/super-admin') ? '/super-admin/sessions' : ROUTES.ADMIN_SESSIONS;

  const [data, setData]           = useState<SessionDashboardStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [retryKey, setRetryKey]   = useState(0);
  const [archiving, setArchiving]         = useState(false);
  const [togglingPortal, setTogglingPortal] = useState(false);

  const load = useCallback(async (signal: AbortSignal) => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getSessionDashboard(Number(id), signal);
      setData(result);
    } catch (err) {
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return;
      setError(true);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [id, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  async function handlePortalToggle() {
    if (!id || !data) return;
    setTogglingPortal(true);
    try {
      if (data.session.portal_open) {
        await deactivateSession(Number(id));
        toast.success('Portal closed — session hidden from applicant portal.');
      } else {
        await activateSession(Number(id));
        toast.success('Portal opened — session is now accepting applications.');
      }
      setRetryKey((k) => k + 1);
    } catch {
      toast.error('Failed to update portal status. Please try again.');
    } finally {
      setTogglingPortal(false);
    }
  }

  async function handleArchive() {
    if (!id) return;
    if (!window.confirm('Archive this session? It will be hidden from the parent portal but all data is preserved.')) return;
    setArchiving(true);
    try {
      await archiveSession(Number(id));
      toast.success('Session archived successfully.');
      navigate(sessionsBase);
    } catch {
      toast.error('Failed to archive session. Please try again.');
    } finally {
      setArchiving(false);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-7xl space-y-6">
        <Skeletons.Card />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeletons.Card />
          <Skeletons.Card />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeletons.Card />
          <Skeletons.Card />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;
  }

  const { session, capacity_stats, application_stats, recent_applications, age_distribution, gender_distribution } = data;

  const formatDate = (d: string) => {
    try { return format(parseISO(d), 'MMM d, yyyy'); }
    catch { return d; }
  };

  // Build sorted age distribution entries (skip zero counts for cleanliness)
  const ageEntries = Object.entries(age_distribution).filter(([, v]) => v > 0);
  const maxAgeCount = Math.max(...ageEntries.map(([, v]) => v), 1);

  // Gender distribution — skip zero counts
  const genderEntries = Object.entries(gender_distribution).filter(([, v]) => v > 0);
  const maxGenderCount = Math.max(...genderEntries.map(([, v]) => v), 1);

  return (
    <div className="p-6 max-w-7xl space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={() => navigate(sessionsBase)}
          className="p-2 rounded-lg border transition-colors hover:bg-[var(--glass-medium)] flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
          title="Back to sessions"
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-headline font-bold text-2xl" style={{ color: 'var(--foreground)' }}>
              {session.name}
            </h1>
            {session.camp && (
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(22,101,52,0.10)', color: '#166534' }}
              >
                {session.camp}
              </span>
            )}
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={
                session.is_active
                  ? { background: 'rgba(22,163,74,0.12)', color: '#166534' }
                  : { background: 'rgba(107,114,128,0.12)', color: 'var(--muted-foreground)' }
              }
            >
              {session.is_active ? 'Active' : 'Archived'}
            </span>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={
                session.portal_open
                  ? { background: 'rgba(59,130,246,0.12)', color: '#1e40af' }
                  : { background: 'rgba(107,114,128,0.12)', color: 'var(--muted-foreground)' }
              }
            >
              {session.portal_open ? 'Portal Open' : 'Portal Closed'}
            </span>
          </div>
          <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            {formatDate(session.start_date)} — {formatDate(session.end_date)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`${location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : ROUTES.ADMIN_APPLICATIONS}?camp_session_id=${session.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition-colors hover:bg-[var(--glass-medium)]"
            style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Applications
          </Link>
          {session.is_active && (
            <Button
              variant="ghost"
              size="sm"
              icon={session.portal_open
                ? <GlobeLock className="h-3.5 w-3.5" />
                : <Globe className="h-3.5 w-3.5" />
              }
              loading={togglingPortal}
              onClick={handlePortalToggle}
              title={session.portal_open
                ? 'Close portal — hide this session from applicants'
                : 'Open portal — allow applicants to select this session'
              }
            >
              {session.portal_open ? 'Close Portal' : 'Open Portal'}
            </Button>
          )}
          {session.is_active && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Archive className="h-3.5 w-3.5" />}
              loading={archiving}
              onClick={handleArchive}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* ── At-capacity warning banner ───────────────────────────────────────── */}
      {capacity_stats.is_at_capacity && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl border"
          style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.3)' }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-sm font-medium" style={{ color: '#dc2626' }}>
            This session is at full capacity ({capacity_stats.enrolled}/{capacity_stats.capacity}).
            New approvals are blocked — waitlist applicants until a spot opens.
          </p>
        </div>
      )}

      {/* ── Key stats row ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<UserCheck className="h-4 w-4" style={{ color: '#166534' }} />}
          label={t('admin_extra.session_enrolled')}
          value={capacity_stats.enrolled}
          sub={`${capacity_stats.remaining} spot${capacity_stats.remaining !== 1 ? 's' : ''} remaining`}
          valueColor="#166534"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" style={{ color: '#d97706' }} />}
          label={t('admin_extra.session_pending_review')}
          value={application_stats.pending}
          sub="awaiting decision"
        />
        <StatCard
          icon={<Users className="h-4 w-4" style={{ color: '#7c3aed' }} />}
          label={t('admin_extra.session_waitlisted')}
          value={application_stats.waitlisted}
          sub="can be promoted"
          valueColor="#7c3aed"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" style={{ color: '#1e40af' }} />}
          label={t('admin_extra.acceptance_rate_label')}
          value={`${application_stats.acceptance_rate}%`}
          sub={`${application_stats.total_submitted} ${t('admin_extra.session_total_submitted')}`}
          valueColor="#1e40af"
        />
      </div>

      {/* ── Capacity + Application breakdown ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Capacity card */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>
            Capacity Overview
          </h2>
          <CapacityBar enrolled={capacity_stats.enrolled} capacity={capacity_stats.capacity} />
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            {[
              { label: t('admin_extra.session_total_capacity'), value: capacity_stats.capacity, color: undefined },
              { label: t('admin_extra.session_enrolled'),        value: capacity_stats.enrolled,  color: '#166534' },
              { label: t('admin_extra.session_available'),       value: capacity_stats.remaining, color: capacity_stats.remaining === 0 ? '#dc2626' : '#1e40af' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: 'var(--glass-medium)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
                <p className="text-xl font-bold" style={{ color: color ?? 'var(--foreground)' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Application breakdown card */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--foreground)' }}>
            Application Breakdown
          </h2>
          <div className="space-y-3">
            {[
              { label: t('admin_extra.session_approved_enrolled'), count: application_stats.approved,   bgColor: 'rgba(22,163,74,0.12)',    textColor: '#166534' },
              { label: t('admin_extra.session_pending_review'),   count: application_stats.pending,    bgColor: 'rgba(234,179,8,0.12)',    textColor: '#d97706' },
              { label: t('admin_extra.session_waitlisted'),       count: application_stats.waitlisted, bgColor: 'rgba(124,58,237,0.12)',   textColor: '#7c3aed' },
              { label: t('admin_extra.session_rejected'),         count: application_stats.rejected,   bgColor: 'rgba(220,38,38,0.12)',    textColor: '#dc2626' },
              { label: t('admin_extra.session_cancelled'),        count: application_stats.cancelled,  bgColor: 'rgba(107,114,128,0.12)', textColor: '#6b7280' },
            ].map(({ label, count, bgColor, textColor }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full min-w-[2rem] text-center"
                  style={{ background: bgColor, color: textColor }}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-4 pt-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.session_total_submitted')}</span>
            <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
              {application_stats.total_submitted}
            </span>
          </div>
        </div>
      </div>

      {/* ── Age distribution + Recent applications ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Age distribution */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <BarChart3 className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            Age Distribution — Enrolled Campers
          </h2>
          {ageEntries.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
              No enrolled campers yet
            </p>
          ) : (
            <div className="space-y-3">
              {ageEntries.map(([range, count]) => (
                <DistributionRow key={range} label={`${range} yrs`} count={count} maxCount={maxAgeCount} />
              ))}
            </div>
          )}

          {genderEntries.length > 0 && (
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <h3 className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
                Gender Distribution
              </h3>
              <div className="space-y-3">
                {genderEntries.map(([gender, count]) => (
                  <DistributionRow key={gender} label={gender} count={count} maxCount={maxGenderCount} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent applications activity feed */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            Recent Applications
          </h2>
          {recent_applications.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
              No applications yet
            </p>
          ) : (
            <div className="space-y-3">
              {recent_applications.map((app) => (
                <div key={app.id} className="flex items-center justify-between gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {app.camper_name || '—'}
                    </p>
                    {app.submitted_at && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {formatDate(app.submitted_at)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Link
              to={`${location.pathname.startsWith('/super-admin') ? '/super-admin/applications' : ROUTES.ADMIN_APPLICATIONS}?camp_session_id=${session.id}`}
              className="text-xs font-medium transition-colors hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              View all applications for this session →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
