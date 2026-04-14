/**
 * CamperDetailPage.tsx — Camper Profile Hub
 *
 * Central hub for all camper-related information, organized into four tabs:
 *
 *   Profile     — Personal info, applications, and a summarized risk preview
 *   Medical     — Medical record, diagnoses, allergies, medications, behavioral profile, feeding plan
 *   Contacts    — Emergency contacts and activity permissions
 *   Devices     — Assistive devices on file
 *
 * The Risk Assessment is NOT embedded here in full. A preview card in the Profile
 * tab shows the headline metrics and links to the dedicated CamperRiskPage.
 *
 * Works under both /admin/campers/:id and /super-admin/campers/:id via portal
 * detection from the current URL pathname.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, User, Heart, Phone, FileText, Activity, Shield,
  AlertTriangle, TrendingUp, BookOpen, ExternalLink,
} from 'lucide-react';

import { getCamper, getCamperRiskSummary } from '@/features/admin/api/admin.api';
import {
  getMedicalRecordByCamper,
  getAllergies,
  getMedications,
  getDiagnoses,
  getEmergencyContacts,
  getActivityPermissions,
  getBehavioralProfile,
  getFeedingPlan,
  getAssistiveDevices,
} from '@/features/medical/api/medical.api';
import { StatusBadge } from '@/ui/components/StatusBadge';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';
import type {
  Camper, MedicalRecord, Allergy, Medication, Diagnosis,
  EmergencyContact, ActivityPermission, BehavioralProfile,
  FeedingPlan, AssistiveDevice,
} from '@/features/admin/types/admin.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'profile' | 'medical' | 'contacts' | 'devices';

interface MedData {
  record:              MedicalRecord | null;
  allergies:           Allergy[];
  medications:         Medication[];
  diagnoses:           Diagnosis[];
  behavioralProfile:   BehavioralProfile | null;
  feedingPlan:         FeedingPlan | null;
  assistiveDevices:    AssistiveDevice[];
  activityPermissions: ActivityPermission[];
  emergencyContacts:   EmergencyContact[];
}

// Lightweight shape returned by /campers/{id}/risk-summary
interface RiskSummary {
  risk_score:              number;
  supervision_label:       string;
  staffing_ratio:          string;
  complexity_label:        string;
  flags:                   string[];
  review_status:           string;
  review_status_label:     string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionCardProps { title: string; icon: ReactNode; children: ReactNode }

function SectionCard({ title, icon, children }: SectionCardProps) {
  return (
    <div className="glass-panel rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(22,163,74,0.12)' }}
        >
          <span style={{ color: 'var(--ember-orange)' }}>{icon}</span>
        </div>
        <h3 className="font-headline font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-sm" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
        {value ?? '—'}
      </p>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  mild: '#f59e0b',
  moderate: '#f97316',
  severe: '#dc2626',
  'life-threatening': '#7f1d1d',
};

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'medical',   label: 'Medical',   icon: Heart },
  { id: 'contacts',  label: 'Contacts',  icon: Phone },
  { id: 'devices',   label: 'Devices',   icon: Shield },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-0.5 border-b mb-5" style={{ borderColor: 'var(--border)' }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderBottomColor: isActive ? 'var(--ember-orange,#16a34a)' : 'transparent',
              color: isActive ? 'var(--ember-orange,#16a34a)' : 'var(--muted-foreground,#6b7280)',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk preview card (Profile tab)
// ---------------------------------------------------------------------------

function RiskPreviewCard({
  risk,
  riskLoading,
  riskPath,
}: {
  risk: RiskSummary | null;
  riskLoading: boolean;
  riskPath: string;
}) {
  if (riskLoading) {
    return (
      <SectionCard title="Risk Assessment" icon={<TrendingUp className="h-4 w-4" />}>
        <div className="space-y-2">
          <Skeletons.Row />
          <Skeletons.Row />
        </div>
      </SectionCard>
    );
  }

  if (!risk) {
    return (
      <SectionCard title="Risk Assessment" icon={<TrendingUp className="h-4 w-4" />}>
        <p className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
          Assessment pending — no medical data on file yet.
        </p>
        <Link
          to={riskPath}
          className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
          style={{ color: 'var(--ember-orange,#16a34a)' }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View Risk Assessment →
        </Link>
      </SectionCard>
    );
  }

  const score     = Math.min(100, Math.round(risk.risk_score));
  const scoreColor = score >= 67 ? '#dc2626' : score >= 34 ? '#d97706' : '#16a34a';
  const scoreLabel = score >= 67 ? 'High' : score >= 34 ? 'Moderate' : 'Low';
  const visibleFlags = (risk.flags ?? []).slice(0, 4);
  const extraFlags   = (risk.flags ?? []).length - visibleFlags.length;

  const REVIEW_BADGE: Record<string, { bg: string; color: string }> = {
    system_calculated: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
    reviewed:          { bg: 'rgba(22,101,52,0.1)',   color: '#16a34a' },
    overridden:        { bg: 'rgba(234,88,12,0.1)',   color: '#ea580c' },
  };
  const badge = REVIEW_BADGE[risk.review_status] ?? REVIEW_BADGE.system_calculated;

  return (
    <SectionCard title="Risk Assessment" icon={<TrendingUp className="h-4 w-4" />}>
      {/* Score + metrics row */}
      <div className="flex flex-wrap items-start gap-4 mb-4">
        {/* Score pill */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Risk Score
          </p>
          <span
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full"
            style={{ background: `${scoreColor}18`, color: scoreColor }}
          >
            {score} pts — {scoreLabel}
          </span>
        </div>

        {/* Supervision */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Supervision
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {risk.supervision_label}
            <span
              className="ml-1.5 text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'var(--glass-strong)', color: 'var(--muted-foreground)' }}
            >
              {risk.staffing_ratio}
            </span>
          </p>
        </div>

        {/* Complexity */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>
            Complexity
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{risk.complexity_label}</p>
        </div>

        {/* Review status badge */}
        <div className="ml-auto self-start">
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: badge.bg, color: badge.color }}
          >
            {risk.review_status_label ?? risk.review_status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Active flags */}
      {visibleFlags.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>
            Active Flags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleFlags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border capitalize"
                style={{ borderColor: 'rgba(220,38,38,0.3)', color: '#dc2626', background: 'rgba(220,38,38,0.07)' }}
              >
                <AlertTriangle className="h-3 w-3" />
                {flag.replace(/_/g, ' ')}
              </span>
            ))}
            {extraFlags > 0 && (
              <span
                className="text-xs px-2.5 py-1 rounded-full border"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--glass-strong)' }}
              >
                +{extraFlags} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <Link
          to={riskPath}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:underline"
          style={{ color: 'var(--ember-orange,#16a34a)' }}
        >
          <BookOpen className="h-4 w-4" />
          View Full Risk Assessment →
        </Link>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function CamperDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const camperId = Number(id);

  // Portal detection — works for both /admin and /super-admin prefixes
  const isSuperAdmin     = window.location.pathname.startsWith('/super-admin');
  const portalBase       = isSuperAdmin ? '/super-admin' : '/admin';
  const reviewBasePath   = `${portalBase}/applications`;
  const riskPath         = `${portalBase}/campers/${camperId}/risk`;

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [camper, setCamper]       = useState<Camper | null>(null);
  const [med, setMed]             = useState<MedData | null>(null);
  const [risk, setRisk]           = useState<RiskSummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [medLoading, setMedLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(true);
  const [error, setError]         = useState(false);

  // ── Effect 1: core camper profile ─────────────────────────────────────────
  useEffect(() => {
    if (!camperId) return;
    let cancelled = false;
    setLoading(true);

    getCamper(camperId)
      .then(data => { if (!cancelled) setCamper(data); })
      .catch(() => { if (!cancelled) { setError(true); toast.error(t('common.error_loading')); } })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [camperId, t]);

  // ── Effect 2: risk summary (lightweight, loads alongside camper) ───────────
  useEffect(() => {
    if (!camperId) return;
    let cancelled = false;
    setRiskLoading(true);

    getCamperRiskSummary(camperId)
      .then(data => { if (!cancelled) setRisk(data as RiskSummary); })
      .catch(() => { if (!cancelled) setRisk(null); })
      .finally(() => { if (!cancelled) setRiskLoading(false); });

    return () => { cancelled = true; };
  }, [camperId]);

  // ── Effect 3: all medical sub-resources in parallel ────────────────────────
  useEffect(() => {
    if (!camperId) return;
    let cancelled = false;
    setMedLoading(true);

    const run = async () => {
      try {
        const record = (await getMedicalRecordByCamper(camperId).catch(() => null)) ?? null;

        const [
          allergies, medications, diagnoses,
          emergencyContacts, activityPermissions,
          behavioralProfile, feedingPlan, assistiveDevices,
        ] = await Promise.all([
          record ? getAllergies(record.id).catch(() => [])        : Promise.resolve([]),
          record ? getMedications(record.id).catch(() => [])      : Promise.resolve([]),
          record ? getDiagnoses(record.id).catch(() => [])        : Promise.resolve([]),
          getEmergencyContacts(camperId).catch(() => []),
          getActivityPermissions(camperId).catch(() => []),
          getBehavioralProfile(camperId).catch(() => null),
          getFeedingPlan(camperId).catch(() => null),
          getAssistiveDevices(camperId).catch(() => []),
        ]);

        if (!cancelled) {
          setMed({ record, allergies, medications, diagnoses, emergencyContacts, activityPermissions, behavioralProfile, feedingPlan, assistiveDevices });
        }
      } catch {
        // individual failures already caught per-call above
      } finally {
        if (!cancelled) setMedLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [camperId]);

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-5xl space-y-4">
        <Skeletons.Row />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeletons.Card key={i} />)}
        </div>
      </div>
    );
  }

  if (error || !camper) {
    return (
      <div className="p-6 max-w-5xl">
        <EmptyState
          title={t('admin.campers.empty_title')}
          description={t('admin.review.not_found_desc')}
          action={{ label: t('admin.campers.title'), onClick: () => navigate(`${portalBase}/campers`) }}
        />
      </div>
    );
  }

  const age = camper.date_of_birth
    ? Math.floor((Date.now() - new Date(camper.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const applications = camper.applications ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm mb-4 transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('admin.campers.title')}
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            {/* Initials avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-headline font-bold flex-shrink-0"
              style={{ background: 'rgba(22,163,74,0.12)', color: 'var(--ember-orange)' }}
            >
              {camper.first_name[0]}{camper.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-headline text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {camper.full_name}
                </h1>
                {camper.is_active != null && (
                  <span
                    className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                    style={camper.is_active
                      ? { background: 'rgba(22,163,74,0.12)', color: 'var(--ember-orange)' }
                      : { background: 'var(--muted)', color: 'var(--muted-foreground)' }}
                  >
                    {camper.is_active ? t('status_labels.active') : t('status_labels.inactive')}
                  </span>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {age !== null ? t('admin_extra.age_years', { age }) : ''}
                {age !== null && camper.gender ? ' · ' : ''}
                {camper.gender ?? ''}
              </p>
            </div>
          </div>

          {/* Risk Assessment quick-access button in header */}
          <Link
            to={riskPath}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80 flex-shrink-0"
            style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
          >
            <TrendingUp className="h-4 w-4" />
            Risk Assessment
          </Link>
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── Profile tab ────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-4">

          {/* Personal Information */}
          <SectionCard title={t('profile.personal_title')} icon={<User className="h-4 w-4" />}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label={t('admin.review.field_dob')}    value={camper.date_of_birth ? format(new Date(camper.date_of_birth), 'MMM d, yyyy') : '—'} />
              <Field label={t('admin_extra.age_label')}     value={age !== null ? t('admin_extra.age_years_short', { age }) : undefined} />
              <Field label={t('admin.review.field_gender')} value={camper.gender} />
              <Field label={t('admin.review.field_shirt')}  value={camper.tshirt_size} />
            </div>
          </SectionCard>

          {/* Applications */}
          <SectionCard title={t('admin.applications.title')} icon={<FileText className="h-4 w-4" />}>
            {applications.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_applications')}</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {applications.map(app => (
                  <div key={app.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {app.session?.name ?? `Session #${app.camp_session_id}`}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {t('admin.review.submitted')} {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      <Link
                        to={`${reviewBasePath}/${app.id}`}
                        className="text-xs px-2.5 py-1 rounded border transition-colors hover:opacity-80"
                        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
                      >
                        {t('admin_extra.review_btn')}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Risk Assessment preview */}
          <RiskPreviewCard risk={risk} riskLoading={riskLoading} riskPath={riskPath} />
        </div>
      )}

      {/* ── Medical tab ────────────────────────────────────────────────────── */}
      {activeTab === 'medical' && (
        <div className="space-y-4">
          <SectionCard title={t('admin_extra.medical_record')} icon={<Heart className="h-4 w-4" />}>
            {medLoading ? (
              <div className="space-y-2">{[1, 2, 3].map(i => <Skeletons.Row key={i} />)}</div>
            ) : !med?.record ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_medical_record')}</p>
            ) : (
              <div className="space-y-5">

                {med.record.primary_diagnosis && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.primary_diagnosis')}</p>
                    <p className="text-sm" style={{ color: 'var(--foreground)' }}>{med.record.primary_diagnosis}</p>
                  </div>
                )}

                {med.diagnoses.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.diagnoses')}</p>
                    <div className="space-y-1.5">
                      {med.diagnoses.map(d => (
                        <div key={d.id} className="flex items-center gap-2 text-sm">
                          <span style={{ color: 'var(--foreground)' }}>{d.name}</span>
                          {d.icd_code && (
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--glass-strong)', color: 'var(--muted-foreground)' }}>
                              {d.icd_code}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {med.allergies.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.allergies')}</p>
                    <div className="flex flex-wrap gap-2">
                      {med.allergies.map(a => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border"
                          style={{
                            color: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            borderColor: SEVERITY_COLOR[a.severity] ?? '#6b7280',
                            background: `${SEVERITY_COLOR[a.severity] ?? '#6b7280'}14`,
                          }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {a.allergen} — {a.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {med.medications.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.medications')}</p>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {med.medications.map(m => (
                        <div key={m.id} className="py-2 first:pt-0 last:pb-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{m.name}</p>
                            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.dosage} · {m.frequency}</p>
                          </div>
                          {m.notes && <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {med.behavioralProfile && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.behavioral_profile')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {med.behavioralProfile.triggers && <Field label={t('medical.record.triggers')} value={med.behavioralProfile.triggers} />}
                      {med.behavioralProfile.de_escalation_strategies && <Field label={t('medical.record.de_escalation')} value={med.behavioralProfile.de_escalation_strategies} />}
                      {med.behavioralProfile.communication_style && <Field label={t('medical.record.communication')} value={med.behavioralProfile.communication_style} />}
                    </div>
                  </div>
                )}

                {med.feedingPlan && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.feeding_plan')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label={t('medical.record.method')} value={med.feedingPlan.method} />
                      {med.feedingPlan.restrictions && <Field label={t('medical.record.restrictions')} value={med.feedingPlan.restrictions} />}
                    </div>
                  </div>
                )}

                {!med.record.primary_diagnosis && med.diagnoses.length === 0 && med.allergies.length === 0 && med.medications.length === 0 && !med.behavioralProfile && !med.feedingPlan && (
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.medical_record_empty')}</p>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Contacts tab ───────────────────────────────────────────────────── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">

          {/* Emergency Contacts */}
          <SectionCard title={t('medical.record.emergency_contacts')} icon={<Phone className="h-4 w-4" />}>
            {medLoading ? (
              <Skeletons.Row />
            ) : (med?.emergencyContacts ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_emergency_contacts')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {med!.emergencyContacts.map(ec => (
                  <div
                    key={ec.id}
                    className="rounded-lg border p-3"
                    style={{ borderColor: 'var(--border)', background: 'var(--glass-strong)' }}
                  >
                    <p className="text-sm font-semibold mb-1.5" style={{ color: 'var(--foreground)' }}>{ec.name}</p>
                    <div className="space-y-0.5">
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{t('admin_extra.relation_label')}</span> {ec.relationship}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{t('admin_extra.phone_label')}</span> {ec.phone_primary}
                      </p>
                      {ec.phone_secondary && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{t('admin_extra.phone2_label')}</span> {ec.phone_secondary}
                        </p>
                      )}
                      {ec.email && (
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{t('admin_extra.email_label')}</span> {ec.email}
                        </p>
                      )}
                      {ec.is_authorized_pickup && (
                        <p className="text-xs mt-1" style={{ color: 'var(--forest-green)' }}>{t('admin_extra.authorized_pickup')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Activity Permissions */}
          <SectionCard title={t('medical.record.activity_permissions')} icon={<Activity className="h-4 w-4" />}>
            {medLoading ? (
              <Skeletons.Row />
            ) : (med?.activityPermissions ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{t('admin_extra.no_activity_permissions', 'No activity permissions on file.')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {med!.activityPermissions.map(ap => (
                  <div key={ap.id} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: ap.permission_level === 'yes'
                          ? 'rgba(22,163,74,0.15)'
                          : ap.permission_level === 'restricted'
                          ? 'rgba(234,179,8,0.15)'
                          : 'rgba(220,38,38,0.12)',
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{
                          background: ap.permission_level === 'yes' ? 'var(--forest-green)'
                            : ap.permission_level === 'restricted' ? '#ca8a04'
                            : '#dc2626',
                        }}
                      />
                    </span>
                    <div>
                      <span className="text-sm" style={{ color: 'var(--foreground)' }}>{ap.activity_name}</span>
                      <span
                        className="ml-2 text-xs capitalize px-1.5 py-0.5 rounded"
                        style={{
                          background: ap.permission_level === 'yes' ? 'rgba(22,163,74,0.1)'
                            : ap.permission_level === 'restricted' ? 'rgba(234,179,8,0.1)'
                            : 'rgba(220,38,38,0.08)',
                          color: ap.permission_level === 'yes' ? 'var(--forest-green)'
                            : ap.permission_level === 'restricted' ? '#ca8a04'
                            : '#dc2626',
                        }}
                      >
                        {ap.permission_level === 'yes' ? t('common.permitted') : ap.permission_level === 'no' ? t('common.not_permitted') : t('admin_extra.restricted')}
                      </span>
                      {ap.restriction_notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{ap.restriction_notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Devices tab ────────────────────────────────────────────────────── */}
      {activeTab === 'devices' && (
        <SectionCard title={t('medical.record.devices')} icon={<Shield className="h-4 w-4" />}>
          {medLoading ? (
            <Skeletons.Row />
          ) : (med?.assistiveDevices ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {t('admin_extra.no_devices', 'No assistive devices on file.')}
            </p>
          ) : (
            <div className="space-y-3">
              {med!.assistiveDevices.map(d => (
                <div
                  key={d.id}
                  className="rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)', background: 'var(--glass-strong)' }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                    {d.device_type}
                    {d.requires_transfer_assistance && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c' }}
                      >
                        {t('admin_extra.transfer_assist')}
                      </span>
                    )}
                  </p>
                  {d.notes && (
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{d.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

    </div>
  );
}
