/**
 * ApplicantDashboardPage.tsx
 *
 * Redesigned (Phase 12) for better information hierarchy:
 *  - Welcome header
 *  - Quick Actions moved near the top (after stats)
 *  - Announcements
 *  - Stat cards
 *  - Camper cards as primary operational section
 *  - Recent updates as compact, scannable list below
 *
 * Quick Actions moved up per UX review — parents should see what they can do
 * immediately without scrolling past the full content area.
 */

import { useEffect, useState, type ComponentType } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, FileText, Plus, ArrowRight, Calendar, Megaphone, Pin,
  Bell, MessageSquare, CheckCircle, Clock, AlertCircle, Upload, XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';

import { getCampers, getApplications, getDrafts, getRequiredDocuments, getDocumentRequests, type ApplicationDraft, type RequiredDocument, type DocumentRequestRecord } from '@/features/parent/api/applicant.api';
import { getConversations, type Conversation } from '@/features/messaging/api/messaging.api';
import { getAnnouncements, type Announcement } from '@/features/admin/api/announcements.api';
import type { Camper, Application } from '@/shared/types';
import { NewSessionModal, findBestSourceApp } from '@/features/parent/components/NewSessionModal';
import { useAppSelector } from '@/store/hooks';
import { ROUTES } from '@/shared/constants/routes';
import { StatCard } from '@/ui/components/StatCard';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { EmptyState } from '@/ui/components/EmptyState';
import { ErrorState } from '@/ui/components/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/ui/components/Skeletons';
import { Button } from '@/ui/components/Button';
import { PersonalGreeting } from '@/ui/components/PersonalGreeting';
import { HeroSlideshow } from '@/ui/components/HeroSlideshow';
import { Avatar } from '@/ui/components/Avatar';

export function ApplicantDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);

  const [localDraftName, setLocalDraftName]     = useState<string | null | undefined>(undefined); // undefined = not yet checked
  const [serverDrafts, setServerDrafts]         = useState<ApplicationDraft[]>([]);
  const [campers, setCampers]                   = useState<Camper[]>([]);
  const [applications, setApplications]         = useState<Application[]>([]);
  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [announcements, setAnnouncements]       = useState<Announcement[]>([]);
  const [requiredDocs, setRequiredDocs]         = useState<RequiredDocument[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequestRecord[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(false);
  const [retryKey, setRetryKey]                 = useState(0);

  // "Apply for a New Session" modal — camper-centric entry point.
  // Stores the target camper and (when available) the best prior application
  // ID for audit-trail linking. Set to null to close the modal.
  const [newSessionTarget, setNewSessionTarget] = useState<{
    camper: Camper;
    reappliedFromId?: number;
  } | null>(null);

  // Re-fetch conversations whenever a realtime message arrives so the
  // activity feed reflects new messages without a full page reload.
  useEffect(() => {
    function refreshConversations() {
      getConversations({ page: 1 })
        .then((res) => setConversations(res.data ?? []))
        .catch(() => { /* keep stale data on error */ });
    }
    window.addEventListener('realtime:message-arrived', refreshConversations);
    return () => window.removeEventListener('realtime:message-arrived', refreshConversations);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(false);
    Promise.allSettled([
      getCampers(),
      getApplications(),
      getConversations({ page: 1 }),
      getAnnouncements(5),
      getRequiredDocuments(),
      getDocumentRequests(),
    ]).then(([cResult, aResult, convResult, annResult, reqResult, docReqResult]) => {
        if (cResult.status === 'rejected' && aResult.status === 'rejected') {
          setError(true);
          return;
        }
        setCampers(cResult.status === 'fulfilled' ? cResult.value : []);
        setApplications(aResult.status === 'fulfilled' ? aResult.value : []);
        if (convResult.status === 'fulfilled') {
          setConversations(convResult.value.data ?? []);
        }
        if (annResult.status === 'fulfilled') {
          setAnnouncements(annResult.value.data ?? []);
        }
        if (reqResult.status === 'fulfilled') {
          setRequiredDocs(reqResult.value);
        }
        if (docReqResult.status === 'fulfilled') {
          setDocumentRequests(docReqResult.value);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [retryKey]);

  // Load server drafts to surface a "Continue" prompt on the dashboard.
  useEffect(() => {
    if (!user?.id) return;
    getDrafts()
      .then((drafts) => {
        setServerDrafts(drafts);
        setLocalDraftName(drafts.length > 0 ? (drafts[0].label ?? null) : null);
      })
      .catch(() => {
        // Fallback: try sessionStorage so the banner still shows if API fails
        try {
          const raw = sessionStorage.getItem(`cbg_app_draft_${user.id}`);
          if (!raw) { setLocalDraftName(null); return; }
          const parsed = JSON.parse(raw) as { s1?: { camper_first_name?: string; camper_last_name?: string } };
          const first = (parsed.s1?.camper_first_name ?? '').trim();
          const last  = (parsed.s1?.camper_last_name  ?? '').trim();
          setLocalDraftName(first || last ? `${first} ${last}`.trim() : null);
        } catch { setLocalDraftName(null); }
      });
  }, [user?.id]);

  const pendingCount = applications.filter((a) => a.status === 'submitted' || a.status === 'under_review').length;
  const pendingDocsCount = (Array.isArray(requiredDocs) ? requiredDocs : []).filter((d) => d.status === 'pending').length;

  const activityFeed = buildActivityFeed(conversations, applications, campers, documentRequests, user?.id);

  if (error) return <ErrorState onRetry={() => setRetryKey((k) => k + 1)} />;

  return (
    <>
    <div className="flex flex-col gap-6 max-w-5xl">

      {/* ── Liquid glass hero ────────────────────────────────── */}
      <div
        className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
        style={{ minHeight: '340px' }}
      >
        <HeroSlideshow initialIndex={1} />
        <div className="relative z-10 p-6 lg:p-8">
          <PersonalGreeting
            user={user}
            // eslint-disable-next-line jsx-a11y/aria-role
            role="applicant"
            stats={{ camperCount: campers.length }}
          />
        </div>
      </div>

      {/* ── Document action alert ────────────────────────────── */}
      {!loading && pendingDocsCount > 0 && (
        <Link
          to={ROUTES.PARENT_DOCUMENTS}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ background: 'rgba(245,158,11,0.07)', borderColor: 'rgba(245,158,11,0.30)' }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#b45309' }} />
          <span className="text-sm font-medium" style={{ color: '#b45309' }}>
            {t('required_documents.dashboard_alert', { count: pendingDocsCount })}
          </span>
          <ArrowRight className="h-4 w-4 ml-auto flex-shrink-0" style={{ color: '#b45309' }} />
        </Link>
      )}

      {/* ── Stat cards ───────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={1} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label={t('applicant.dashboard.stat_campers')} value={campers.length} icon={Users} delay={0} />
          <StatCard label={t('applicant.dashboard.stat_applications')} value={applications.length} icon={FileText} color="var(--night-sky-blue)" delay={0.1} />
          <StatCard label={t('applicant.dashboard.stat_pending')} value={pendingCount} icon={Calendar} color="var(--warm-amber)" delay={0.2} />
        </div>
      )}

      {/* ── In-progress draft banner ─────────────────────────── */}
      {localDraftName !== undefined && localDraftName !== null && (
        <button
          type="button"
          onClick={() => {
            if (serverDrafts.length > 1) {
              // Multiple drafts — go to the applications list so the user can choose
              navigate(ROUTES.PARENT_APPLICATIONS);
            } else if (serverDrafts.length === 1) {
              // Single draft — open it directly in the form
              navigate(ROUTES.PARENT_APPLICATION_NEW, { state: { draftId: serverDrafts[0].id } });
            } else {
              navigate(ROUTES.PARENT_APPLICATION_NEW);
            }
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ background: 'rgba(22,101,52,0.05)', borderColor: 'var(--ember-orange)' }}
        >
          <FileText className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              {serverDrafts.length > 1
                ? `${serverDrafts.length} draft applications in progress`
                : `Draft – ${localDraftName || 'Not Submitted'}`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {serverDrafts.length > 1 ? 'Click to view all drafts' : 'Not yet submitted · Saved to your account'}
            </p>
          </div>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {serverDrafts.length > 1 ? 'View all' : 'Continue'}
          </span>
        </button>
      )}

      {/* ── Quick Actions — moved near top ───────────────────── */}
      <div>
        <h3 className="font-headline font-semibold text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
          {t('applicant.dashboard.quick_actions')}
        </h3>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={ROUTES.PARENT_APPLICATION_START} variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            {t('applicant.dashboard.new_application')}
          </Button>
          <Button as={Link} to={ROUTES.PARENT_APPLICATIONS} variant="secondary" size="sm">
            {t('applicant.dashboard.view_all_applications')}
          </Button>
          <Button as={Link} to="/applicant/inbox" variant="secondary" size="sm">
            {t('applicant.dashboard.open_inbox')}
          </Button>
        </div>
      </div>

      {/* ── Announcements strip ──────────────────────────────── */}
      {!loading && announcements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-4 w-4" style={{ color: 'var(--ember-orange)' }} />
            <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
              {t('applicant.dashboard.announcements')}
            </h3>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`rounded-xl px-4 py-3 ${ann.is_urgent ? 'border' : 'glass-card'}`}
                style={ann.is_urgent ? {
                  background: 'rgba(220,38,38,0.05)',
                  borderColor: 'rgba(220,38,38,0.25)',
                } : undefined}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {ann.is_pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ember-orange)' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{ann.title}</p>
                      {ann.is_urgent && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.10)', color: 'var(--destructive)' }}>
                          {t('applicant.dashboard.urgent')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                      {ann.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Campers — primary content ─────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.my_campers')}
          </h3>
          <Link
            to={ROUTES.PARENT_APPLICATION_START}
            className="flex items-center gap-1.5 text-sm font-medium hover:underline"
            style={{ color: 'var(--ember-orange)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('applicant.dashboard.new_application')}
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        ) : campers.length === 0 ? (
          <div className="glass-panel rounded-2xl p-6">
            <EmptyState
              title={t('applicant.dashboard.no_campers_title')}
              description={t('applicant.dashboard.no_campers_desc')}
              action={{ label: t('applicant.dashboard.start_application'), onClick: () => navigate(ROUTES.PARENT_APPLICATION_START) }}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {campers.map((camper) => {
              const camperApps = applications.filter((a) => a.camper_id === camper.id);
              const latestApp  = camperApps[0];
              // Find the session name from the most recent application
              const sessionName = latestApp?.session?.name ?? null;
              // Best prior application to use as reapplication audit source
              const sourceApp = findBestSourceApp(applications, camper.id);

              function openNewSessionModal() {
                setNewSessionTarget({
                  camper,
                  reappliedFromId: sourceApp?.id,
                });
              }

              return (
                <li key={camper.id}>
                  <div
                    className="glass-card rounded-2xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={camper.full_name} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                          {camper.full_name}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {camper.age ? `Age ${camper.age}` : ''}
                          {camper.age && sessionName ? ' · ' : ''}
                          {sessionName ?? ''}
                          {!camper.age && !sessionName ? (
                            t(camperApps.length === 1 ? 'applicant.dashboard.camper_age_apps_one' : 'applicant.dashboard.camper_age_apps_other', { age: camper.age, count: camperApps.length })
                          ) : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {latestApp && <StatusBadge status={latestApp.status} />}

                      {/* ── Primary reapplication entry point ──────────────────
                          Visible on every registered camper card. The modal
                          handles the case where no prior application exists
                          (reappliedFromId will be undefined → blank new app
                          with just camper info prefilled).
                          ──────────────────────────────────────────────────── */}
                      <button
                        type="button"
                        onClick={openNewSessionModal}
                        className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)] whitespace-nowrap"
                        style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
                        aria-label={`Apply for a new session for ${camper.full_name}`}
                      >
                        <Plus className="h-3 w-3" />
                        New Session
                      </button>
                      {/* Mobile: icon-only variant */}
                      <button
                        type="button"
                        onClick={openNewSessionModal}
                        className="sm:hidden p-1.5 rounded-lg border transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ borderColor: 'var(--ember-orange)', color: 'var(--ember-orange)' }}
                        aria-label={`Apply for a new session for ${camper.full_name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      <Link
                        to={ROUTES.PARENT_APPLICATIONS}
                        className="p-1.5 rounded-lg hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                        aria-label={`View applications for ${camper.full_name}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Recent Activity — interactive, navigable feed ─────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-headline font-semibold text-base" style={{ color: 'var(--foreground)' }}>
            {t('applicant.dashboard.recent_updates')}
          </h3>
          <Link
            to="/applicant/inbox"
            className="text-xs hover:underline flex items-center gap-1"
            style={{ color: 'var(--ember-orange)' }}
          >
            {t('applicant.dashboard.open_inbox')}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTable rows={3} />
        ) : activityFeed.length === 0 ? (
          <div className="glass-panel rounded-xl p-5 text-center">
            <Bell className="h-5 w-5 mx-auto mb-2" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('applicant.dashboard.no_updates')}
            </p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden divide-y">
            <ul>
              {activityFeed.map((item) => {
                const Icon = getActivityIcon(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(item.route)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-all duration-150 hover:bg-[var(--dash-nav-hover-bg)] hover:-translate-y-px"
                      style={{ background: item.accent ? 'rgba(22,163,74,0.04)' : 'transparent' }}
                    >
                      {/* Icon badge */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: item.accent ? 'rgba(22,163,74,0.12)' : 'rgba(0,0,0,0.05)',
                          color: item.accent ? 'var(--ember-orange)' : 'var(--muted-foreground)',
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${item.accent ? 'font-semibold' : 'font-medium'}`} style={{ color: 'var(--foreground)' }}>
                          {item.title}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {item.subtitle}
                        </p>
                      </div>

                      {/* Timestamp + arrow */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

    </div>

    {/* ── "Apply for a New Session" modal — camper-centric primary entry ── */}
    {newSessionTarget && (
      <NewSessionModal
        camper={newSessionTarget.camper}
        reappliedFromId={newSessionTarget.reappliedFromId}
        existingApplications={applications}
        onClose={() => setNewSessionTarget(null)}
      />
    )}
  </>
  );
}

// ─── Activity feed ────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  type: 'message' | 'application' | 'document';
  iconKey: 'message' | 'file' | 'check' | 'x-circle' | 'clock' | 'upload' | 'alert';
  title: string;
  subtitle: string;
  timestamp: string;
  route: string;
  accent: boolean;
}

function buildActivityFeed(
  conversations: Conversation[],
  applications: Application[],
  campers: Camper[],
  documentRequests: DocumentRequestRecord[],
  currentUserId: number | undefined,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  // Messages: group unread non-system conversations by sender
  const unreadConvs = conversations.filter((c) => !c.is_system_generated && c.unread_count > 0);
  const grouped = new Map<string, Conversation[]>();
  for (const conv of unreadConvs) {
    const senderName = getConvSenderName(conv, currentUserId);
    if (!grouped.has(senderName)) grouped.set(senderName, []);
    grouped.get(senderName)!.push(conv);
  }
  for (const [senderName, convs] of grouped) {
    const latest = [...convs].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )[0];
    const count = convs.length;
    items.push({
      id: `msg-${latest.id}`,
      type: 'message',
      iconKey: 'message',
      title: count > 1
        ? `${count} new messages from ${senderName}`
        : `New message from ${senderName}`,
      subtitle: latest.last_message?.body
        ? truncateText(stripHtml(latest.last_message.body), 60)
        : latest.subject ?? 'Open conversation',
      timestamp: latest.updated_at,
      route: '/applicant/inbox',
      accent: true,
    });
  }

  // Applications: most recently updated
  for (const app of applications) {
    const camper = campers.find((c) => c.id === app.camper_id);
    const camperName = camper ? `${camper.first_name} ${camper.last_name}` : 'Camper';
    const sessionName = app.session?.name ?? null;
    const iconKey: ActivityItem['iconKey'] =
      app.status === 'approved'     ? 'check' :
      app.status === 'rejected'     ? 'x-circle' :
      app.status === 'under_review' ? 'clock' : 'file';
    items.push({
      id: `app-${app.id}`,
      type: 'application',
      iconKey,
      title: getApplicationTitle(app.status, camperName),
      subtitle: sessionName
        ? `${sessionName} · ${getStatusLabel(app.status)}`
        : getStatusLabel(app.status),
      timestamp: app.updated_at ?? app.created_at,
      route: ROUTES.PARENT_APPLICATION_DETAIL(app.id),
      accent: app.status === 'approved' || app.status === 'rejected',
    });
  }

  // Document requests
  for (const doc of documentRequests) {
    items.push({
      id: `doc-${doc.id}`,
      type: 'document',
      iconKey: doc.status === 'rejected' ? 'alert' : 'upload',
      title: getDocumentTitle(doc),
      subtitle: doc.instructions ?? `Requested by ${doc.requested_by_name}`,
      timestamp: doc.uploaded_at ?? doc.created_at,
      route: ROUTES.PARENT_DOCUMENTS,
      accent: doc.status === 'awaiting_upload' || doc.status === 'rejected',
    });
  }

  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
}

function getConvSenderName(conv: Conversation, currentUserId: number | undefined): string {
  if (conv.last_message?.sender && conv.last_message.sender.id !== currentUserId) {
    return conv.last_message.sender.name;
  }
  const other = conv.participants.find((p) => p.id !== currentUserId);
  return other?.name ?? 'Staff';
}

function getApplicationTitle(status: string, camperName: string): string {
  switch (status) {
    case 'approved':     return `Application approved — ${camperName}`;
    case 'rejected':     return `Application not approved — ${camperName}`;
    case 'under_review': return `Application under review — ${camperName}`;
    case 'waitlisted':   return `Application waitlisted — ${camperName}`;
    case 'submitted':    return `Application submitted — ${camperName}`;
    default:             return `Application updated — ${camperName}`;
  }
}

function getDocumentTitle(doc: DocumentRequestRecord): string {
  const type = doc.document_type;
  switch (doc.status) {
    case 'awaiting_upload': return `Document required: ${type}`;
    case 'uploaded':        return `Document received: ${type}`;
    case 'under_review':    return `Document under review: ${type}`;
    case 'approved':        return `Document approved: ${type}`;
    case 'rejected':        return `Document rejected: ${type}`;
    case 'overdue':         return `Document overdue: ${type}`;
    default:                return `Document request: ${type}`;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'submitted':    return 'Pending review';
    case 'under_review': return 'Under review';
    case 'approved':     return 'Approved';
    case 'rejected':     return 'Not approved';
    case 'waitlisted':   return 'Waitlisted';
    case 'cancelled':    return 'Cancelled';
    case 'draft':        return 'Draft';
    default:             return status;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function truncateText(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max).trimEnd()}…` : str;
}

function getActivityIcon(item: ActivityItem): ComponentType<{ className?: string }> {
  switch (item.iconKey) {
    case 'message':  return MessageSquare;
    case 'check':    return CheckCircle;
    case 'x-circle': return XCircle;
    case 'clock':    return Clock;
    case 'upload':   return Upload;
    case 'alert':    return AlertCircle;
    default:         return FileText;
  }
}
