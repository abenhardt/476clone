/**
 * CamperRiskPage.tsx
 *
 * Full risk assessment page for admin and super-admin portals.
 *
 * This is the primary decision-support interface for understanding a camper's
 * risk profile. It shows:
 *   1. Risk gauge + headline metrics (score, supervision, complexity)
 *   2. Factor-by-factor breakdown showing what drove the score
 *   3. Actionable recommendations for staff preparation
 *   4. Medical review panel (validate/override, for authorised roles)
 *   5. Audit timeline of historical assessments
 *
 * Role behaviour:
 *   super_admin  — view + review + override
 *   admin        — view + review (no override)
 *   medical      — view + review + override (medical portal uses MedicalCamperRiskPage)
 *
 * Both /admin/campers/:id/risk and /super-admin/campers/:id/risk use this component.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, ShieldCheck, Activity, BookOpen, History,
  HelpCircle, RefreshCw,
} from 'lucide-react';

import { getCamper, getRiskAssessment, submitMedicalReview, overrideRiskSupervision, getRiskAssessmentHistory } from '@/features/admin/api/admin.api';
import type { Camper, RiskAssessment } from '@/features/admin/types/admin.types';
import { useAppSelector } from '@/store/hooks';

import { RiskGauge } from '@/features/admin/components/risk/RiskGauge';
import { RiskFactorBreakdown } from '@/features/admin/components/risk/RiskFactorBreakdown';
import { RiskRecommendations } from '@/features/admin/components/risk/RiskRecommendations';
import { MedicalReviewPanel } from '@/features/admin/components/risk/MedicalReviewPanel';
import { RiskAuditTimeline, type HistoryEntry } from '@/features/admin/components/risk/RiskAuditTimeline';
import { Tooltip } from '@/ui/components/Tooltip';

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

interface SectionCardProps { title: string; icon: ReactNode; subtitle?: string; children: ReactNode }

function SectionCard({ title, icon, subtitle, children }: SectionCardProps) {
  return (
    <div
      className="rounded-2xl border"
      style={{
        background: 'var(--glass-panel-bg, white)',
        borderColor: 'var(--border, #e5e7eb)',
        boxShadow: 'var(--shadow-card, 0 1px 3px rgba(0,0,0,.08))',
      }}
    >
      <div className="flex items-start gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--border, #e5e7eb)' }}>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(22,101,52,0.10)', color: 'var(--ember-orange,#16a34a)' }}
        >
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card (small stat in the hero strip)
// ---------------------------------------------------------------------------

interface MetricProps { label: string; value: string; sub?: string; tooltip: string; color?: string }

function MetricCard({ label, value, sub, tooltip, color }: MetricProps) {
  return (
    <div
      className="rounded-2xl border p-4 flex flex-col gap-1 flex-1 min-w-0"
      style={{ background: 'white', borderColor: 'var(--border,#e5e7eb)' }}
    >
      <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground,#6b7280)]">
        {label}
        <Tooltip content={tooltip} placement="top">
          <span className="cursor-help inline-flex">
            <HelpCircle className="w-3 h-3" />
          </span>
        </Tooltip>
      </div>
      <p className="text-base font-bold leading-tight" style={{ color: color ?? 'var(--foreground)' }}>{value}</p>
      {sub && <p className="text-xs text-[var(--muted-foreground,#6b7280)]">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review status badge
// ---------------------------------------------------------------------------

const REVIEW_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  system_calculated: { bg: 'rgba(107,114,128,0.1)',  color: '#6b7280', label: 'System Calculated' },
  reviewed:          { bg: 'rgba(22,101,52,0.1)',    color: '#16a34a', label: 'Clinically Reviewed' },
  overridden:        { bg: 'rgba(234,88,12,0.1)',    color: '#ea580c', label: 'Clinician Override' },
};

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'factors' | 'recommendations' | 'review' | 'history';

const TABS: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
  { id: 'overview',        label: 'Overview',        icon: TrendingUp },
  { id: 'factors',         label: 'Factor Analysis', icon: BookOpen },
  { id: 'recommendations', label: 'Recommendations', icon: ShieldCheck },
  { id: 'review',          label: 'Medical Review',  icon: Activity },
  { id: 'history',         label: 'History',         icon: History },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function CamperRiskPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const camperId = Number(id);

  const currentUser = useAppSelector(state => state.auth.user);
  const role        = currentUser?.role ?? '';

  // Who can do what
  const canReview   = role === 'admin' || role === 'super_admin' || role === 'medical';
  const canOverride = role === 'super_admin' || role === 'medical';

  const [camper, setCamper]         = useState<Camper | null>(null);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab]   = useState<Tab>('overview');

  // Fetch camper + assessment together
  useEffect(() => {
    if (!camperId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getCamper(camperId),
      getRiskAssessment(camperId),
    ])
      .then(([c, a]) => {
        setCamper(c);
        setAssessment(a);
      })
      .catch(() => setError('Unable to load risk assessment. Please try again.'))
      .finally(() => setLoading(false));
  }, [camperId, refreshKey]);

  // Fetch history when the history tab is opened
  useEffect(() => {
    if (activeTab !== 'history' || !camperId) return;
    setHistLoading(true);
    getRiskAssessmentHistory(camperId)
      .then(h => setHistory(h as HistoryEntry[]))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  }, [activeTab, camperId]);

  const handleReview = async (notes: string) => {
    const updated = await submitMedicalReview(camperId, { clinical_notes: notes || undefined });
    setAssessment(updated);
  };

  const handleOverride = async (level: string, reason: string, notes?: string) => {
    const updated = await overrideRiskSupervision(camperId, {
      override_supervision_level: level,
      override_reason: reason,
      ...(notes ? { clinical_notes: notes } : {}),
    });
    setAssessment(updated);
  };

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-6 w-48 rounded animate-pulse bg-[var(--border,#e5e7eb)]" />
        <div className="h-48 rounded-2xl animate-pulse bg-[var(--border,#e5e7eb)]" />
        <div className="h-80 rounded-2xl animate-pulse bg-[var(--border,#e5e7eb)]" />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (error || !assessment) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground,#6b7280)] mb-6 hover:text-[var(--foreground)]">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: 'rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.05)' }}
        >
          <p className="text-sm font-medium text-[#dc2626]">{error ?? 'Assessment not found.'}</p>
          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#dc2626', color: 'white' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const reviewBadge   = REVIEW_BADGE[assessment.review_status] ?? REVIEW_BADGE.system_calculated;
  const scoreColor    = assessment.risk_score >= 67 ? '#dc2626' : assessment.risk_score >= 34 ? '#d97706' : '#16a34a';
  const activeFactors = (assessment.factor_breakdown ?? []).filter((f) => f.present && f.points > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground,#6b7280)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {camper ? `${camper.first_name} ${camper.last_name}` : 'Back'}
          </button>
          <span className="text-[var(--muted-foreground,#9ca3af)]">/</span>
          <span className="text-sm font-medium">Risk Assessment</span>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey(k => k + 1)}
          className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground,#6b7280)] hover:text-[var(--foreground)] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* ── Hero section ────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'var(--glass-panel-bg,white)',
          borderColor: 'var(--border,#e5e7eb)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Camper name strip */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3"
          style={{ borderColor: 'var(--border,#e5e7eb)' }}
        >
          <div>
            <h1 className="text-lg font-bold">
              {camper ? `${camper.first_name} ${camper.last_name}` : '—'}
              <span className="ml-2 text-sm font-normal text-[var(--muted-foreground,#6b7280)]">
                Risk Assessment
              </span>
            </h1>
            {camper && (
              <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-0.5">
                {activeFactors.length} active risk {activeFactors.length === 1 ? 'factor' : 'factors'} · {(assessment.flags ?? []).length} total {(assessment.flags ?? []).length === 1 ? 'flag' : 'flags'}
              </p>
            )}
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: reviewBadge.bg, color: reviewBadge.color }}
          >
            {reviewBadge.label}
          </span>
        </div>

        {/* Gauge + metric strip */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Gauge */}
            <div className="shrink-0">
              <RiskGauge score={assessment.risk_score} size={220} />
            </div>

            {/* Metrics */}
            <div className="flex-1 w-full grid grid-cols-2 gap-3">
              <MetricCard
                label="Supervision Level"
                value={assessment.effective_supervision_label}
                sub={`Staff ratio: ${assessment.effective_staffing_ratio}`}
                tooltip="The supervision level staff must use when planning groups and activities. Standard = up to 6 campers per staff; Enhanced = up to 3; One-to-One = a dedicated staff member with no other camper responsibilities. If a clinician override is active, that level supersedes the system calculation and is shown here."
                color={assessment.is_overridden ? '#ea580c' : undefined}
              />
              <MetricCard
                label="Medical Complexity"
                value={assessment.complexity_label}
                tooltip="Overall medical complexity tier derived from the risk score. Low (0–25 pts) = standard planning. Moderate (26–50 pts) = additional resources and pre-session briefing required. High (51–100 pts) = intensive oversight; review all critical recommendations before the camper's session begins."
              />
              <MetricCard
                label="Active Risk Factors"
                value={String(activeFactors.length)}
                sub={`${assessment.flags?.length ?? 0} flags total`}
                tooltip="Count of scored conditions currently present for this camper. Each factor contributes a set number of points to the total risk score. Open the Factor Analysis tab to see exactly which conditions are present, their point values, and what they mean for staff planning."
                color={activeFactors.length > 0 ? scoreColor : undefined}
              />
              <MetricCard
                label="Last Assessed"
                value={new Date(assessment.calculated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                sub={new Date(assessment.calculated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                tooltip="When the risk score was most recently calculated. The system automatically recalculates whenever any contributing data changes — medical record, allergies, diagnoses, behavioral profile, feeding plan, or assistive devices. If data was recently updated, click Refresh to get the latest score."
              />
            </div>
          </div>

          {/* Score explanation bar */}
          <div
            className="mt-5 rounded-xl px-4 py-3 text-sm flex items-start gap-3"
            style={{ background: `${scoreColor}08`, border: `1px solid ${scoreColor}25` }}
          >
            <span className="font-bold shrink-0 mt-px" style={{ color: scoreColor }}>
              {assessment.risk_score} / 100 pts
            </span>
            <span className="text-[var(--foreground,#111827)] leading-relaxed">
              {assessment.risk_score <= 10
                ? <>Minimal needs. Standard planning applies — no elevated preparation required.</>
                : assessment.risk_score <= 33
                ? <>Low risk. {activeFactors.length > 0 ? 'Some conditions present — review the Factor Analysis tab for staff briefing notes.' : 'No scored risk factors active.'}</>
                : assessment.risk_score <= 50
                ? <>Moderate needs. Pre-session staff briefing required. Review the Recommendations tab and ensure supervision ratio is in place.</>
                : assessment.risk_score <= 66
                ? <>Elevated complexity. All recommendations should be actioned before session. Ensure clinical notes have been reviewed by medical staff.</>
                : <>High complexity — review all critical recommendations before this camper's session begins. Medical director sign-off recommended.</>
              }
            </span>
          </div>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border,#e5e7eb)' }}>
        {TABS.map(tab => {
          const Icon    = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderBottomColor: isActive ? 'var(--ember-orange,#16a34a)' : 'transparent',
                color: isActive ? 'var(--ember-orange,#16a34a)' : 'var(--muted-foreground,#6b7280)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'review' && assessment.review_status === 'system_calculated' && canReview && (
                <span
                  className="ml-0.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: '#d97706' }}
                  title="Awaiting review"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ──────────────────────────────────────────────────── */}

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Active flags */}
          {(assessment.flags ?? []).length > 0 ? (
            <SectionCard
              title="Active Risk Flags"
              icon={<ShieldCheck className="h-4 w-4" />}
              subtitle="Conditions present for this camper that require staff awareness or preparation"
            >
              <div className="flex flex-wrap gap-2 mb-3">
                {(assessment.flags ?? []).map(flag => (
                  <span
                    key={flag}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium capitalize"
                    style={{
                      borderColor: 'rgba(220,38,38,0.3)',
                      color: '#dc2626',
                      background: 'rgba(220,38,38,0.07)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#dc2626' }} />
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[var(--muted-foreground,#6b7280)]">
                Open the <button type="button" className="underline hover:text-[var(--foreground)] transition-colors" onClick={() => setActiveTab('factors')}>Factor Analysis</button> tab for a full breakdown of each condition, its point contribution, and staff preparation notes.
              </p>
            </SectionCard>
          ) : (
            <SectionCard
              title="Active Risk Flags"
              icon={<ShieldCheck className="h-4 w-4" />}
              subtitle="Conditions present for this camper that require staff awareness"
            >
              <div className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(22,101,52,0.1)' }}>
                  <ShieldCheck className="w-4 h-4" style={{ color: '#16a34a' }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#166534' }}>No active risk flags</p>
                  <p className="text-xs text-[var(--muted-foreground,#6b7280)] mt-0.5">No conditions from the medical record, behavioral profile, or feeding plan are currently flagged for this camper.</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Top recommendations preview */}
          {assessment.recommendations && assessment.recommendations.length > 0 && (
            <SectionCard
              title="Top Recommendations"
              icon={<Activity className="h-4 w-4" />}
              subtitle="Most critical action items — click 'Recommendations' tab for the full list"
            >
              <RiskRecommendations recommendations={(assessment.recommendations ?? []).slice(0, 3)} />
              {(assessment.recommendations ?? []).length > 3 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('recommendations')}
                  className="mt-3 text-xs text-[var(--ember-orange,#16a34a)] hover:underline"
                >
                  View all {assessment.recommendations!.length} recommendations →
                </button>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* Factor Analysis */}
      {activeTab === 'factors' && (
        <SectionCard
          title="Factor Analysis"
          icon={<BookOpen className="h-4 w-4" />}
          subtitle="Each condition evaluated and its point contribution to the total risk score"
        >
          {(assessment.factor_breakdown ?? []).length > 0 ? (
            <RiskFactorBreakdown
              factors={assessment.factor_breakdown}
              totalScore={assessment.risk_score}
            />
          ) : (
            <p className="text-sm text-[var(--muted-foreground,#6b7280)]">Factor breakdown unavailable. Please refresh.</p>
          )}
        </SectionCard>
      )}

      {/* Recommendations */}
      {activeTab === 'recommendations' && (
        <SectionCard
          title="Staff Recommendations"
          icon={<ShieldCheck className="h-4 w-4" />}
          subtitle="Actionable preparation items derived from this camper's active risk flags"
        >
          <RiskRecommendations recommendations={assessment.recommendations ?? []} />
        </SectionCard>
      )}

      {/* Medical Review */}
      {activeTab === 'review' && (
        <SectionCard
          title="Medical Review"
          icon={<Activity className="h-4 w-4" />}
          subtitle="Clinical validation and supervision level management"
        >
          <MedicalReviewPanel
            assessment={assessment}
            canReview={canReview}
            canOverride={canOverride}
            onReview={handleReview}
            onOverride={handleOverride}
          />
        </SectionCard>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <SectionCard
          title="Assessment History"
          icon={<History className="h-4 w-4" />}
          subtitle="Chronological record of all risk evaluations for audit and traceability"
        >
          <RiskAuditTimeline history={history} loading={histLoading} />
        </SectionCard>
      )}

      {/* Data source note */}
      <p className="text-xs text-[var(--muted-foreground,#9ca3af)] text-center pb-4">
        Risk score is calculated from medical record, diagnoses, behavioral profile, feeding plan, and assistive device data.
        Scores update automatically when underlying data changes.
      </p>
    </div>
  );
}
