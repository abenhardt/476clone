/**
 * MedicalDashboardPage.tsx
 *
 * The medical staff's operational command center. Redesigned in Phase 12 to
 * be a true operational dashboard — no camper directory (moved to its own page).
 *
 * Priority flow:
 *   1. Header with role context
 *   2. Stats bar
 *   3. Quick Actions
 *   4. Critical / overdue alert banners
 *   5. Pending follow-ups + Recent activity
 *
 * Route: /medical/dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  Users,
  AlertTriangle,
  Pill,
  Shield,
  FileX,
  ClipboardList,
  AlertOctagon,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Zap,
  BookOpen,
  PlusCircle,
  ClipboardCheck,
} from 'lucide-react';

import {
  getMedicalStats,
  getMedicalFollowUps,
  updateMedicalFollowUp,
} from '@/features/medical/api/medical.api';
import type {
  MedicalStats,
  MedicalFollowUp,
  TreatmentLog,
  MedicalIncident,
  MedicalVisit,
} from '@/features/medical/api/medical.api';
import { StatCard } from '@/ui/components/StatCard';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import { ROUTES } from '@/shared/constants/routes';
import { useAppSelector } from '@/store/hooks';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diff < 172800) return 'yesterday';
  const d = Math.floor(diff / 86400);
  return `${d} days ago`;
}

function isOverdue(dueDateStr: string): boolean {
  return new Date(dueDateStr).setHours(23, 59, 59, 999) < Date.now();
}

function formatDueDate(dueDateStr: string): string {
  return new Date(dueDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Activity types ────────────────────────────────────────────────────────────

type ActivityKind = 'treatment' | 'incident' | 'visit';

interface ActivityItem {
  id: number;
  kind: ActivityKind;
  camperId: number;
  camperName: string;
  title: string;
  timestamp: string;
  severity?: string;
}

function buildActivity(stats: MedicalStats): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const t of (stats.recent_activity?.treatments ?? []) as TreatmentLog[]) {
    items.push({ id: t.id, kind: 'treatment', camperId: t.camper_id, camperName: t.camper?.full_name ?? 'Unknown camper', title: `Treatment recorded: ${t.title}`, timestamp: t.created_at });
  }
  for (const inc of (stats.recent_activity?.incidents ?? []) as MedicalIncident[]) {
    items.push({ id: inc.id, kind: 'incident', camperId: inc.camper_id, camperName: inc.camper?.full_name ?? 'Unknown camper', title: `Incident reported: ${inc.title}`, timestamp: inc.created_at, severity: inc.severity });
  }
  for (const v of (stats.recent_activity?.visits ?? []) as MedicalVisit[]) {
    items.push({ id: v.id, kind: 'visit', camperId: v.camper_id, camperName: v.camper?.full_name ?? 'Unknown camper', title: `Clinic visit — ${v.chief_complaint}`, timestamp: v.created_at });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  if (kind === 'incident') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
        <AlertOctagon className="h-4 w-4" style={{ color: 'var(--destructive)' }} />
      </div>
    );
  }
  if (kind === 'visit') {
    return (
      <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'rgba(37,99,235,0.08)' }}>
        <Stethoscope className="h-4 w-4" style={{ color: 'var(--night-sky-blue)' }} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ background: 'rgba(22,163,74,0.10)' }}>
      <ClipboardList className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
    </div>
  );
}

function ActivityTypeBadge({ kind, severity }: { kind: ActivityKind; severity?: string }) {
  const { t } = useTranslation();

  if (kind === 'incident') {
    const isHighSeverity = severity === 'severe' || severity === 'critical';
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: isHighSeverity ? 'rgba(220,38,38,0.12)' : 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}>
        {t('medical.dashboard.activity.type_incident')}
        {isHighSeverity && ' · High'}
      </span>
    );
  }
  if (kind === 'visit') {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(37,99,235,0.08)', color: 'var(--night-sky-blue)' }}>
        {t('medical.dashboard.activity.type_visit')}
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}>
      {t('medical.dashboard.activity.type_treatment')}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: MedicalFollowUp['priority'] }) {
  const { t } = useTranslation();
  const configs: Record<MedicalFollowUp['priority'], { bg: string; color: string }> = {
    urgent: { bg: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' },
    high:   { bg: 'rgba(234,88,12,0.10)',  color: '#ea580c' },
    medium: { bg: 'rgba(217,119,6,0.10)',  color: '#d97706' },
    low:    { bg: 'rgba(22,163,74,0.10)',  color: 'var(--ember-orange)' },
  };
  const cfg = configs[priority];
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize" style={{ background: cfg.bg, color: cfg.color }}>
      {t(`medical.dashboard.followup.priority_${priority}`)}
    </span>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => <Skeletons.Card key={i} />)}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--muted)' }} />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MedicalDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const [stats, setStats]               = useState<MedicalStats | null>(null);
  const [followUps, setFollowUps]       = useState<MedicalFollowUp[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError]     = useState(false);
  const [statsRetryKey, setStatsRetryKey] = useState(0);
  const [completingId, setCompletingId] = useState<number | null>(null);

  // ── Fetch stats + follow-ups ──────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      const [statsData, followUpData] = await Promise.all([
        getMedicalStats(),
        getMedicalFollowUps({ status: 'pending', page: 1 }),
      ]);
      setStats(statsData);
      const inProgressData = await getMedicalFollowUps({ status: 'in_progress', page: 1 });
      const merged = [...followUpData.data, ...inProgressData.data].sort((a, b) => {
        const order: Record<MedicalFollowUp['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const pd = order[a.priority] - order[b.priority];
        if (pd !== 0) return pd;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      setFollowUps(merged);
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats, statsRetryKey]);

  // Refresh stats automatically when a new notification arrives (e.g., a treatment
  // was logged by another staff member, or a follow-up was updated elsewhere).
  // This mirrors the real-time pattern used by the admin dashboard for messages.
  useEffect(() => {
    function onNotificationRefresh() {
      setStatsRetryKey((k) => k + 1);
    }
    window.addEventListener('notification:refresh', onNotificationRefresh);
    return () => window.removeEventListener('notification:refresh', onNotificationRefresh);
  }, []);

  const handleMarkComplete = useCallback(async (id: number) => {
    setCompletingId(id);
    try {
      await updateMedicalFollowUp(id, { status: 'completed' });
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
      setStatsRetryKey((k) => k + 1);
    } finally {
      setCompletingId(null);
    }
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const activityItems = stats ? buildActivity(stats) : [];
  const overdueCount  = stats?.follow_ups?.overdue ?? 0;
  const dueTodayCount = stats?.follow_ups?.due_today ?? 0;
  const urgentFollowUps = followUps.filter((f) => f.priority === 'urgent' || f.priority === 'high');

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl space-y-6">

      {/* ── SECTION 1: Liquid glass hero ──────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={2} />
        {!statsLoading && stats && (overdueCount > 0 || dueTodayCount > 0) && (
          <div
            className="absolute top-4 right-0 z-10 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${overdueCount > 0 ? 'rgba(248,113,113,0.55)' : 'rgba(251,191,36,0.55)'}`,
              color: overdueCount > 0 ? '#fca5a5' : '#fde68a',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            <AlertOctagon className="h-4 w-4" />
            {overdueCount > 0 ? `${overdueCount} overdue` : `${dueTodayCount} due today`}
          </div>
        )}
        <div className="relative z-10 p-6 lg:p-8">
          {/* eslint-disable-next-line jsx-a11y/aria-role */}
          <PersonalGreeting user={user} role="medical" stats={{ overdueCount }} />
        </div>
      </div>

      {/* ── SECTION 2: Stats Bar ─────────────────────────────────────────────── */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : statsError ? (
        <div className="rounded-xl border p-4 flex items-center justify-between" style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.2)' }}>
          <p className="text-sm" style={{ color: 'var(--destructive)' }}>{t('common.error_loading')}</p>
          <button onClick={() => setStatsRetryKey((k) => k + 1)} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--muted)]" style={{ color: 'var(--foreground)' }}>
            <RefreshCw className="h-3.5 w-3.5" />{t('common.retry')}
          </button>
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <StatCard label={t('medical.dashboard.stats.total_campers')} value={stats.campers.total} icon={Users} color="var(--ember-orange)" delay={0} />
          </div>
          <div>
            <StatCard label={t('medical.dashboard.stats.severe_allergies')} value={stats.campers.with_severe_allergies} icon={AlertTriangle} color="var(--destructive)" delay={0.05} />
          </div>
          <div>
            <StatCard label={t('medical.dashboard.stats.on_medications')} value={stats.campers.on_medications} icon={Pill} color="var(--night-sky-blue)" delay={0.1} />
          </div>
          <div>
            <StatCard label={t('medical.dashboard.stats.active_restrictions')} value={stats.campers.with_active_restrictions} icon={Shield} color="#d97706" delay={0.15} />
          </div>
          <div>
            <StatCard label={t('medical.dashboard.stats.missing_forms')} value={stats.campers.missing_medical_record} icon={FileX} color="var(--destructive)" delay={0.2} />
          </div>
        </div>
      ) : null}

      {/* ── SECTION 3: Quick Actions ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <Link
          to={ROUTES.MEDICAL_DIRECTORY}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
          style={{ background: 'var(--ember-orange)', color: '#fff' }}
        >
          <Users className="h-4 w-4" />
          {t('medical.directory.nav_label')}
        </Link>
        <Link
          to={ROUTES.MEDICAL_RECORD_TREATMENT}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)]"
          style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <PlusCircle className="h-4 w-4" />
          {t('medical.dashboard.quick_action.new_treatment')}
        </Link>
        <Link
          to={ROUTES.MEDICAL_INCIDENTS}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)]"
          style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <AlertOctagon className="h-4 w-4" />
          {t('portal_nav.incidents')}
        </Link>
        <Link
          to={ROUTES.MEDICAL_FOLLOW_UPS}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)]"
          style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <ClipboardCheck className="h-4 w-4" />
          {t('portal_nav.follow_ups')}
        </Link>
        <Link
          to={ROUTES.MEDICAL_VISITS}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:bg-[var(--muted)]"
          style={{ color: 'var(--foreground)', borderColor: 'var(--border)' }}
        >
          <Stethoscope className="h-4 w-4" />
          {t('portal_nav.visits')}
        </Link>
      </div>

      {/* ── SECTION 4: Critical Alerts ───────────────────────────────────────── */}
      {/* Overdue alert — prominent red banner */}
      {overdueCount > 0 && !statsLoading && (
        <div
          className="rounded-xl border p-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.25)', borderLeftWidth: '4px', borderLeftColor: 'var(--destructive)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(220,38,38,0.12)' }}>
              <AlertOctagon className="h-5 w-5" style={{ color: 'var(--destructive)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
                {t('medical.dashboard.alert.overdue', { count: overdueCount })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.dashboard.alert.overdue_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(ROUTES.MEDICAL_FOLLOW_UPS)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--destructive)' }}
          >
            {t('common.view_all')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Due-today alert — amber */}
      {dueTodayCount > 0 && !statsLoading && (
        <div
          className="rounded-xl border p-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(217,119,6,0.06)', borderColor: 'rgba(217,119,6,0.25)', borderLeftWidth: '4px', borderLeftColor: '#d97706' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: 'rgba(217,119,6,0.12)' }}>
              <Zap className="h-5 w-5" style={{ color: '#d97706' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#d97706' }}>
                {t('medical.dashboard.alert.due_today', { count: dueTodayCount })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.dashboard.alert.due_today_desc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(ROUTES.MEDICAL_FOLLOW_UPS)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: 'rgba(217,119,6,0.12)', color: '#d97706' }}
          >
            {t('common.view_all')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Urgent follow-ups inline notice */}
      {urgentFollowUps.length > 0 && !statsLoading && !statsError && (
        <div
          className="rounded-xl border px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(234,88,12,0.05)', borderColor: 'rgba(234,88,12,0.20)' }}
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#ea580c' }} />
          <p className="text-sm" style={{ color: '#ea580c' }}>
            <span className="font-semibold">{urgentFollowUps.length}</span> urgent or high-priority follow-up{urgentFollowUps.length !== 1 ? 's' : ''} require immediate attention.
          </p>
          <Link to={ROUTES.MEDICAL_FOLLOW_UPS} className="ml-auto flex-shrink-0 text-xs font-medium hover:underline" style={{ color: '#ea580c' }}>
            Review
          </Link>
        </div>
      )}

      {/* ── SECTION 5: Two-column operational view ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: Follow-up Tasks (priority) — 40% */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.dashboard.followup.title')}
            </h2>
            <Link to={ROUTES.MEDICAL_FOLLOW_UPS} className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--ember-orange)' }}>
              {t('common.view_all')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {statsLoading ? (
              <div className="p-4"><ActivitySkeleton /></div>
            ) : statsError ? (
              <div className="p-6">
                <EmptyState title={t('common.error_loading')} description={t('common.try_again')} action={{ label: t('common.retry'), onClick: () => setStatsRetryKey((k) => k + 1) }} />
              </div>
            ) : followUps.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t('medical.dashboard.followup.empty_title')} description={t('medical.dashboard.followup.empty_desc')} />
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {followUps.slice(0, 6).map((fu) => {
                  const overdue = isOverdue(fu.due_date);
                  const isCompleting = completingId === fu.id;
                  return (
                    <li key={fu.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <PriorityBadge priority={fu.priority} />
                        <button
                          onClick={() => void handleMarkComplete(fu.id)}
                          disabled={isCompleting}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors hover:bg-[var(--muted)] disabled:opacity-50"
                          style={{ color: 'var(--ember-orange)' }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isCompleting ? t('common.saving') : t('medical.dashboard.followup.complete')}
                        </button>
                      </div>
                      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
                        {fu.title}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <Link to={ROUTES.MEDICAL_RECORD_DETAIL(fu.camper_id)} className="text-xs hover:underline truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {fu.camper?.full_name ?? t('common.unknown')}
                        </Link>
                        <span className="text-xs flex-shrink-0 font-medium" style={{ color: overdue ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                          {overdue ? `Overdue · ${formatDueDate(fu.due_date)}` : formatDueDate(fu.due_date)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Recent Activity (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              {t('medical.dashboard.activity.title')}
            </h2>
            <div className="flex gap-3">
              <Link to={ROUTES.MEDICAL_INCIDENTS} className="text-xs hover:underline" style={{ color: 'var(--muted-foreground)' }}>
                Incidents
              </Link>
              <Link to={ROUTES.MEDICAL_VISITS} className="text-xs hover:underline" style={{ color: 'var(--muted-foreground)' }}>
                Visits
              </Link>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {statsLoading ? (
              <div className="p-4"><ActivitySkeleton /></div>
            ) : statsError ? (
              <div className="p-6">
                <EmptyState title={t('common.error_loading')} description={t('common.try_again')} action={{ label: t('common.retry'), onClick: () => setStatsRetryKey((k) => k + 1) }} />
              </div>
            ) : activityItems.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t('medical.dashboard.activity.empty_title')} description={t('medical.dashboard.activity.empty_desc')} />
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {activityItems.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3 p-4 hover:bg-[var(--muted)] transition-colors">
                    <ActivityIcon kind={item.kind} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={ROUTES.MEDICAL_RECORD_DETAIL(item.camperId)} className="text-sm font-medium hover:underline truncate" style={{ color: 'var(--foreground)' }}>
                          {item.camperName}
                        </Link>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                          {relativeTime(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                        {item.title}
                      </p>
                      <div className="mt-1.5">
                        <ActivityTypeBadge kind={item.kind} severity={item.severity} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick link to treatment logs */}
          <Link
            to="/medical/treatments"
            className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm transition-colors hover:bg-[var(--muted)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>{t('portal_nav.treatment_logs')}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
