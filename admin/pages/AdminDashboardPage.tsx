/**
 * AdminDashboardPage.tsx
 *
 * Dashboard v2 — structural + intelligence redesign:
 *  - System Overview: backend-driven global stats (ReportsSummary)
 *  - Sessions: full-width capacity banner with color-coded fill
 *  - Needs Attention: priority engine — oldest pending first, urgency-scored
 *  - Recent Activity: application-based activity feed (most recently updated apps)
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, CheckCircle, Clock,
  ArrowRight, MessageSquare, AlertTriangle,
  Activity, ChevronRight, Info, UserCheck,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

import {
  getAdminApplications,
  getCamps,
  getReportsSummary,
  getSessionDashboard,
  getFamilies,
  type ReportsSummary,
} from '@/features/admin/api/admin.api';
import type { SessionDashboardStats, FamiliesSummary } from '@/features/admin/types/admin.types';
import { getConversations, type Conversation } from '@/features/messaging/api/messaging.api';
import { useUnreadMessageCount } from '@/ui/context/MessagingCountContext';
import type { Application, Camp } from '@/features/admin/types/admin.types';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { ErrorState } from '@/ui/components/EmptyState';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { SessionsCarousel, type SessionCardData } from '@/ui/components/SessionsCarousel';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';
import { ActivityFeed, type ActivityItem } from '@/ui/components/ActivityFeed';

// ─── Urgency scoring ──────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'high' | 'normal';

function getUrgency(submittedAt: string | undefined): UrgencyLevel {
  if (!submittedAt) return 'normal';
  const days = differenceInDays(new Date(), new Date(submittedAt));
  if (days >= 5) return 'critical';
  if (days >= 2) return 'high';
  return 'normal';
}

const URGENCY_STYLES: Record<UrgencyLevel, { dot: string; label: string; labelStyle: React.CSSProperties }> = {
  critical: {
    dot: 'var(--destructive)',
    label: 'Needs review',
    labelStyle: { color: '#6d28d9', background: 'rgba(109,40,217,0.08)' },
  },
  high: {
    dot: '#d97706',
    label: 'Needs review',
    labelStyle: { color: '#6d28d9', background: 'rgba(109,40,217,0.08)' },
  },
  normal: {
    dot: 'var(--muted-foreground)',
    label: '',
    labelStyle: {},
  },
};

// ─── Inline tooltip ───────────────────────────────────────────────────────────

function MetricTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1">
      <Info className="h-3 w-3 cursor-help" style={{ color: 'var(--muted-foreground)', opacity: 0.55 }} />
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 rounded-lg px-2.5 py-2 text-xs leading-snug opacity-0 group-hover/tip:opacity-100 transition-opacity z-50"
        style={{ background: 'var(--foreground)', color: 'var(--background)', whiteSpace: 'normal' }}
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: 'var(--foreground)' }} />
      </span>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const user = useAppSelector((state) => state.auth.user);

  const [summary,             setSummary]             = useState<ReportsSummary | null>(null);
  const [pendingApps,         setPendingApps]         = useState<Application[]>([]);
  const [camps,               setCamps]               = useState<Camp[]>([]);
  const [activity,            setActivity]            = useState<Application[]>([]);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  // Unread message count from shared context — no extra API call.
  const { unreadMessageCount: unread } = useUnreadMessageCount();
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(false);
  const [retryKey,        setRetryKey]        = useState(0);
  const [selectedSessionId,   setSelectedSessionId]   = useState<number | null>(null);
  const [sessionDash,         setSessionDash]         = useState<SessionDashboardStats | null>(null);
  const [sessionLoading,      setSessionLoading]      = useState(false);
  const [globalFamilySummary, setGlobalFamilySummary] = useState<FamiliesSummary | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    // Fetch dashboard data in three targeted calls so each panel always shows
    // correct data regardless of total application volume:
    //   1. Global stats + session list + family summary — aggregate counts (no pagination gap)
    //   2. Needs Attention — oldest pending apps, status-filtered so we never miss one
    //      beyond a paginated boundary
    //   3. Recent Activity — most recently updated apps system-wide, sorted updated_at DESC
    Promise.all([
      getReportsSummary(),
      getCamps().catch(() => [] as Camp[]),
      getFamilies({ page: 1 }).then((res) => res.summary).catch(() => null),
      // Needs Attention: fetch oldest submitted + oldest under_review independently.
      // Status filter + submitted_at ASC guarantees the longest-waiting apps surface first,
      // even if they were submitted before a large batch of already-reviewed applications.
      Promise.all([
        getAdminApplications({ status: 'submitted',    sort: 'submitted_at', direction: 'asc', per_page: 8 }).then((r) => r.data).catch(() => [] as Application[]),
        getAdminApplications({ status: 'under_review', sort: 'submitted_at', direction: 'asc', per_page: 8 }).then((r) => r.data).catch(() => [] as Application[]),
      ]),
      // Recent Activity: most recently changed apps regardless of status.
      // updated_at DESC surfaces newly submitted applications AND recent admin decisions.
      getAdminApplications({ sort: 'updated_at', direction: 'desc', per_page: 10 })
        .then((r) => r.data)
        .catch(() => [] as Application[]),
    ])
      .then(([rptSummary, campsData, familySummary, [submittedApps, underReviewApps], recentAppsData]) => {
        setSummary(rptSummary);
        setGlobalFamilySummary(familySummary);
        setCamps(campsData);

        // Auto-select the first active session for session-scoped metrics
        const firstActive = campsData.flatMap((c) => c.sessions ?? []).find((s) => s.is_active);
        if (firstActive) {
          setSelectedSessionId(firstActive.id);
        }

        // Merge submitted + under_review, de-duplicate by id (shouldn't overlap but
        // defensive), sort oldest-first, take top 5 for the Needs Attention panel.
        const seen = new Set<number>();
        const actionable = [...submittedApps, ...underReviewApps]
          .filter((a) => { if (seen.has(a.id)) return false; seen.add(a.id); return true; })
          .sort((a, b) => {
            const da = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const db = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return da - db;
          })
          .slice(0, 5);
        setPendingApps(actionable);

        // Recent Activity: already sorted updated_at DESC by the backend — just take top 6.
        const recentActivity = recentAppsData
          .filter((a) => !['draft', 'cancelled'].includes(a.status))
          .slice(0, 6);
        setActivity(recentActivity);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  // Secondary non-blocking fetch — recent inbox conversations for the activity feed.
  // Runs independently so it never delays the primary dashboard render.
  // Also re-runs whenever a new message arrives (realtime:message-arrived event).
  useEffect(() => {
    function refreshConversations() {
      getConversations({ folder: 'inbox' })
        .then((res) => {
          const recentConvs = [...res.data]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, 4);
          setRecentConversations(recentConvs);
        })
        .catch((err) => { console.error('[AdminDashboard] Recent conversations load failed:', err); });
    }

    refreshConversations();
    window.addEventListener('realtime:message-arrived', refreshConversations);
    return () => window.removeEventListener('realtime:message-arrived', refreshConversations);
  }, [retryKey]);

  // ── Session-scoped metrics ───────────────────────────────────────────────────
  useEffect(() => {
    if (selectedSessionId === null) return;
    const controller = new AbortController();
    setSessionLoading(true);
    getSessionDashboard(selectedSessionId, controller.signal)
      .then(setSessionDash)
      .catch((err) => { console.error('[AdminDashboard] Session metrics unavailable:', err); })
      .finally(() => setSessionLoading(false));
    return () => controller.abort();
  }, [selectedSessionId]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const stats = {
    total:      summary?.total_applications ?? 0,
    pending:    summary?.pending_applications ?? 0,
    accepted:   summary?.accepted_applications ?? 0,
    rejected:   summary?.rejected_applications ?? 0,
    waitlisted: summary?.applications_by_status?.['waitlisted'] ?? 0,
  };

  // Session-scoped family stats when a session is active; fall back to cross-session summary otherwise.
  const isSessionScoped = selectedSessionId !== null && sessionDash !== null;
  const familyStats = isSessionScoped
    ? sessionDash!.family_stats
    : globalFamilySummary
      ? {
          registered_families:   globalFamilySummary.total_families,
          registered_campers:    globalFamilySummary.total_campers,
          active_applications:   globalFamilySummary.active_applications,
          multi_camper_families: globalFamilySummary.multi_camper_families,
        }
      : null;
  const tooltipScope = isSessionScoped ? 'this session' : 'all sessions';

  // Only explicitly active sessions — no past/archived/inactive
  const sessionCards: SessionCardData[] = camps.flatMap((c) =>
    (c.sessions ?? [])
      .filter((s) => s.is_active === true)
      .map((s) => ({
        id:          s.id,
        campName:    c.name,
        sessionName: s.name ?? `Session ${s.id}`,
        enrolled:    s.enrolled_count ?? 0,
        capacity:    s.capacity ?? 0,
      }))
  );

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <div className="max-w-6xl space-y-8">

      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={0} />
        {/* Quick actions float top-right */}
        <div className="absolute top-4 right-0 z-10 flex gap-2">
          <Link
            to={ROUTES.ADMIN_APPLICATIONS}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            <FileText className="h-4 w-4" />
            {t('admin.dashboard.all_applications')}
          </Link>
          <Link
            to="/admin/inbox"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative"
            style={{
              background: 'rgba(255,255,255,0.14)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#fff',
              textShadow: '0 1px 3px rgba(0,0,0,0.35)',
            }}
          >
            <MessageSquare className="h-4 w-4" />
            {t('portal_nav.inbox')}
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-semibold"
                style={{ background: 'var(--destructive)', color: '#fff', fontSize: '10px' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
        </div>
        <div className="relative z-10 p-6 lg:p-8">
          <PersonalGreeting
            user={user}
            // eslint-disable-next-line jsx-a11y/aria-role
            role="admin"
            stats={{ pendingCount: stats.pending, unreadCount: unread }}
          />
        </div>
      </div>

      {/* ── 1. Session Overview ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
            {selectedSessionId !== null ? 'Session Overview' : 'Overview — All Sessions'}
          </h2>
          <div className="flex items-center gap-3">
            {/* Session selector */}
            {!loading && sessionCards.length > 0 && (
              <select
                value={selectedSessionId ?? ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="text-xs rounded-lg px-2.5 py-1.5 border font-medium focus:outline-none"
                style={{
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)',
                }}
              >
                {sessionCards.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.campName} — {s.sessionName}
                  </option>
                ))}
              </select>
            )}
            <Link
              to={ROUTES.ADMIN_REPORTS}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              Full report <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {loading || sessionLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} lines={1} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Registered Families */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,0,0,0.05)' }}>
                <Users className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {familyStats?.registered_families ?? '—'}
                </p>
                <p className="text-xs mt-1.5 leading-snug flex items-center" style={{ color: 'var(--muted-foreground)' }}>
                  Registered Families
                  <MetricTooltip text={`Total number of family accounts across ${tooltipScope}.`} />
                </p>
              </div>
            </div>

            {/* Registered Campers */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(22,163,74,0.10)' }}>
                <UserCheck className="h-4 w-4" style={{ color: 'var(--forest-green)' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {familyStats?.registered_campers ?? '—'}
                </p>
                <p className="text-xs mt-1.5 leading-snug flex items-center" style={{ color: 'var(--muted-foreground)' }}>
                  Registered Campers
                  <MetricTooltip text={`Total campers with submitted applications across ${tooltipScope}.`} />
                </p>
              </div>
            </div>

            {/* Active Applications */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
                <Clock className="h-4 w-4" style={{ color: '#d97706' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: (familyStats?.active_applications ?? 0) > 0 ? '#b45309' : 'var(--foreground)' }}>
                  {familyStats?.active_applications ?? '—'}
                </p>
                <p className="text-xs mt-1.5 leading-snug flex items-center" style={{ color: 'var(--muted-foreground)' }}>
                  Active Applications
                  <MetricTooltip text={`Applications currently being reviewed or processed across ${tooltipScope}.`} />
                </p>
              </div>
            </div>

            {/* Multi-Camper Families */}
            <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.10)' }}>
                <CheckCircle className="h-4 w-4" style={{ color: '#2563eb' }} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-headline font-semibold leading-none" style={{ color: 'var(--foreground)' }}>
                  {familyStats?.multi_camper_families ?? '—'}
                </p>
                <p className="text-xs mt-1.5 leading-snug flex items-center" style={{ color: 'var(--muted-foreground)' }}>
                  Multi-Camper Families
                  <MetricTooltip text={`Families with more than one registered camper across ${tooltipScope}.`} />
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Sessions ──────────────────────────────────────── */}
      <SessionsCarousel
        sessions={sessionCards}
        sessionDetailRoute={ROUTES.ADMIN_SESSION_DETAIL}
        manageRoute={ROUTES.ADMIN_SESSIONS}
        loading={loading}
      />

      {/* ── 3 + 4. Two-column grid: Needs Attention + Recent Activity ── */}
      <div className="grid lg:grid-cols-5 gap-6">

        {/* ── 3. Needs Attention (3/5 width) ────────────────── */}
        <section className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#d97706' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Needs Attention
              </h2>
            </div>
            <Link
              to={ROUTES.ADMIN_APPLICATIONS}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--ember-orange)' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-6"><SkeletonTable rows={4} /></div>
            ) : pendingApps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.10)' }}>
                  <CheckCircle className="h-5 w-5" style={{ color: 'var(--forest-green)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>All caught up</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>No applications awaiting review</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {pendingApps.map((app) => {
                  const urgency = getUrgency(app.submitted_at);
                  const style   = URGENCY_STYLES[urgency];
                  const days    = app.submitted_at
                    ? differenceInDays(new Date(), new Date(app.submitted_at))
                    : null;

                  const name    = app.camper?.full_name ?? `Camper #${app.camper_id}`;
                  const session = app.session?.name ?? null;

                  const timeRef = days === null
                    ? ''
                    : days === 0
                    ? 'today'
                    : days === 1
                    ? '1 day ago'
                    : `${days} days ago`;

                  const eventSentence = app.status === 'under_review'
                    ? timeRef
                      ? `submitted an application ${timeRef} — now under review`
                      : 'submitted an application — now under review'
                    : timeRef
                    ? `submitted an application ${timeRef}`
                    : 'submitted an application';

                  return (
                    <li key={app.id}>
                      <Link
                        to={ROUTES.ADMIN_APPLICATION_DETAIL(app.id)}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--dash-nav-hover-bg)] transition-colors group"
                      >
                        {/* Urgency dot */}
                        <div
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-0.5"
                          style={{ background: style.dot }}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {name}
                          </p>
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--muted-foreground)' }}>
                            {session ? `${session} · ` : ''}{eventSentence}
                          </p>
                        </div>

                        {/* Right side — urgency label only for high/critical */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {urgency !== 'normal' && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={style.labelStyle}
                            >
                              {style.label}
                            </span>
                          )}
                          <ChevronRight className="h-4 w-4 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--foreground)' }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── 4. Recent Activity (2/5 width) ────────────────── */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                Recent Activity
              </h2>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-5"><SkeletonTable rows={5} /></div>
            ) : (
              <ActivityFeed items={(() => {
                const appItems: ActivityItem[] = activity.map((app) => ({
                  kind: 'application',
                  app,
                  ts: new Date(app.updated_at ?? app.created_at).getTime(),
                }));
                const msgItems: ActivityItem[] = recentConversations.map((conv) => ({
                  kind: 'message',
                  conv,
                  ts: new Date(conv.updated_at).getTime(),
                }));
                return [...appItems, ...msgItems]
                  .sort((a, b) => b.ts - a.ts)
                  .slice(0, 6);
              })()} />
            )}
          </div>
        </section>
      </div>

    </div>
  );
}
