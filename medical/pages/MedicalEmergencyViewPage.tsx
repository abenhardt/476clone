/**
 * MedicalEmergencyViewPage.tsx
 *
 * Emergency quick-view page for a single camper. Designed for speed in emergencies.
 * All data visible by default — no collapsing. Read-only.
 *
 * Route: /medical/records/:camperId/emergency
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, AlertTriangle, Phone, Shield, Pill, Heart,
  Activity, Ban, Clock, CheckCircle2, Loader2, User,
  Stethoscope, ClipboardList,
} from 'lucide-react';

import {
  getMedicalRecordByCamper,
  getAllergiesByCamper,
  getMedicationsByCamper,
  getDiagnosesByCamper,
  getEmergencyContacts,
  getMedicalRestrictions,
  getTreatmentLogs,
  getMedicalVisits,
  type TreatmentLog,
  type MedicalVisit,
  type MedicalRestriction,
} from '@/features/medical/api/medical.api';
import { getCamper, getCamperRiskSummary } from '@/features/admin/api/admin.api';

import { ROUTES } from '@/shared/constants/routes';
import type {
  Camper,
  MedicalRecord,
  Allergy,
  Medication,
  Diagnosis,
  EmergencyContact,
} from '@/features/admin/types/admin.types';

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  accentColor,
  accentBg,
  children,
}: {
  icon: ReactNode;
  title: string;
  accentColor: string;
  accentBg: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: accentBg, borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accentBg, color: accentColor }}
        >
          {icon}
        </div>
        <h2 className="font-headline text-base font-semibold" style={{ color: accentColor }}>
          {title}
        </h2>
      </div>
      <div className="p-5" style={{ background: 'var(--card)' }}>
        {children}
      </div>
    </section>
  );
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity, size = 'sm' }: { severity: string; size?: 'sm' | 'xs' }) {
  const lc = severity.toLowerCase();
  const isLife = lc === 'life-threatening' || lc === 'life_threatening';
  const isSevere = lc === 'severe';
  const isMod = lc === 'moderate';

  const color = isLife ? 'var(--destructive)' : isSevere ? '#c2410c' : isMod ? '#b45309' : 'var(--ember-orange)';
  const bg = isLife ? 'rgba(220,38,38,0.10)' : isSevere ? 'rgba(194,65,12,0.10)' : isMod ? 'rgba(180,83,9,0.10)' : 'rgba(22,163,74,0.10)';

  const label = severity.charAt(0).toUpperCase() + severity.slice(1).replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center ${size === 'xs' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5'} rounded-full font-medium`}
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// ─── Emergency alert banners ──────────────────────────────────────────────────

function CriticalAlertBanner({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl border"
      style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.30)' }}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--destructive)' }} />
      <div style={{ color: 'var(--destructive)' }}>{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalEmergencyViewPage() {
  const { t } = useTranslation();
  const { camperId } = useParams<{ camperId: string }>();

  const id = camperId ? parseInt(camperId, 10) : null;

  // Data state
  const [camper, setCamper] = useState<Camper | null>(null);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [restrictions, setRestrictions] = useState<MedicalRestriction[]>([]);
  const [recentTreatments, setRecentTreatments] = useState<TreatmentLog[]>([]);
  const [recentVisits, setRecentVisits] = useState<MedicalVisit[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || isNaN(id)) return;

    const fetch = async () => {
      setLoading(true);
      setError(false);
      try {
        const [
          camperData,
          recordData,
          allergyData,
          medData,
          diagData,
          contactData,
          restrictionData,
          treatmentData,
          visitData,
        ] = await Promise.all([
          getCamper(id),
          getMedicalRecordByCamper(id),
          getAllergiesByCamper(id),
          getMedicationsByCamper(id),
          getDiagnosesByCamper(id),
          getEmergencyContacts(id),
          getMedicalRestrictions({ camper_id: id, is_active: true }),
          getTreatmentLogs({ camper_id: id, page: 1 }),
          getMedicalVisits({ camper_id: id, page: 1 }),
        ]);

        setCamper(camperData);
        setRecord(recordData ?? null);
        // Fetch risk summary independently — failure is non-fatal
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getCamperRiskSummary(id).then((d) => setRiskData(d as any)).catch((err) => { console.error('[MedicalEmergencyView] Risk summary unavailable:', err); });
        setAllergies(allergyData);
        setMedications(medData);
        setDiagnoses(diagData);
        setContacts(contactData);
        setRestrictions(restrictionData.data);
        setRecentTreatments(treatmentData.data.slice(0, 3));
        setRecentVisits(visitData.data.slice(0, 3));
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    void fetch();
  }, [id]);

  // Derived critical alerts
  const lifeThreatAllergies = allergies.filter(
    (a) => a.severity.toLowerCase() === 'life-threatening' || a.severity.toLowerCase() === 'life_threatening'
  );
  const severeAllergies = allergies.filter(
    (a) => a.severity.toLowerCase() === 'severe'
  );
  const criticalAllergiesForBanners = [...lifeThreatAllergies, ...severeAllergies];
  const hasSeizures = record?.has_seizures === true;
  const hasCriticalAlerts = criticalAllergiesForBanners.length > 0 || hasSeizures;

  if (!id || isNaN(id)) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: 'var(--destructive)' }}>
          {t('medical.emergency.invalid_id') || 'Invalid camper ID.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-3">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--ember-orange)' }} />
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {t('medical.emergency.loading') || 'Loading emergency data…'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div
          className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ background: 'rgba(220,38,38,0.08)', borderColor: 'rgba(220,38,38,0.30)' }}
        >
          <AlertTriangle className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--destructive)' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--destructive)' }}>
              {t('medical.emergency.load_error') || 'Failed to load emergency data'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.emergency.load_error_desc') || 'Please refresh or contact IT support immediately.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">

      {/* Back link */}
      <Link
        to={ROUTES.MEDICAL_RECORD_DETAIL(id)}
        className="inline-flex items-center gap-2 text-sm mb-5 transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
      >
        <ArrowLeft className="h-4 w-4" />
        {t('medical.emergency.back_to_record') || 'Back to Medical Record'}
      </Link>

      {/* Page header */}
      <div className="rounded-2xl border p-5 mb-6 flex items-center justify-between gap-4" style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.25)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--destructive)' }}
          >
            <Shield className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-headline text-2xl font-bold truncate" style={{ color: 'var(--foreground)' }}>
              {camper?.full_name ?? `Camper #${id}`}
            </h1>
            {camper?.date_of_birth && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.dob') || 'DOB'}:{' '}
                {new Date(camper.date_of_birth).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
            {/* Risk level badge — shown once risk data loads */}
            {riskData && (() => {
              const pct   = Math.min(100, Math.round(riskData.risk_score ?? 0));
              const color = pct >= 67 ? '#dc2626' : pct >= 34 ? '#d97706' : '#166534';
              const label = pct >= 67 ? 'High Risk' : pct >= 34 ? 'Moderate Risk' : 'Low Risk';
              return (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold mt-1"
                  style={{ background: `${color}18`, color }}
                >
                  {label} · {riskData.supervision_label}
                </span>
              );
            })()}
          </div>
        </div>
        <div
          className="flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm tracking-wide uppercase"
          style={{ background: 'var(--destructive)', color: '#fff', letterSpacing: '0.08em' }}
        >
          {t('medical.emergency.badge') || 'EMERGENCY VIEW'}
        </div>
      </div>

      <div className="space-y-6">

        {/* 1. CRITICAL ALERTS */}
        <div>
          <Section
            icon={<AlertTriangle className="h-4 w-4" />}
            title={t('medical.emergency.critical_alerts') || 'CRITICAL ALERTS'}
            accentColor="var(--destructive)"
            accentBg="rgba(220,38,38,0.08)"
          >
            {!hasCriticalAlerts ? (
              <div
                className="flex items-center gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(22,163,74,0.08)', color: 'var(--ember-orange)' }}
              >
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <p className="text-sm font-medium">
                  {t('medical.emergency.no_critical_alerts') || 'No critical alerts on file'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {criticalAllergiesForBanners.map((allergy) => (
                  <CriticalAlertBanner key={allergy.id}>
                    <p className="text-sm font-bold">
                      {t('medical.emergency.allergy_alert') || 'ALLERGY ALERT'}: {allergy.allergen}
                    </p>
                    <p className="text-xs mt-0.5">
                      {t('medical.emergency.severity') || 'Severity'}: <strong>{allergy.severity}</strong>
                      {allergy.reaction && ` · ${t('medical.emergency.reaction') || 'Reaction'}: ${allergy.reaction}`}
                    </p>
                    {allergy.treatment && (
                      <p className="text-xs mt-0.5 font-medium">
                        {t('medical.emergency.treatment') || 'Treatment'}: {allergy.treatment}
                      </p>
                    )}
                  </CriticalAlertBanner>
                ))}
                {hasSeizures && (
                  <CriticalAlertBanner>
                    <p className="text-sm font-bold">
                      {t('medical.emergency.seizure_alert') || 'SEIZURE HISTORY ON FILE'}
                    </p>
                    <p className="text-xs mt-0.5">
                      {t('medical.emergency.seizure_desc') || 'This camper has a documented history of seizures. Follow seizure response protocol immediately.'}
                    </p>
                  </CriticalAlertBanner>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* 2. ALLERGIES */}
        <div>
          <Section
            icon={<AlertTriangle className="h-4 w-4" />}
            title={t('medical.emergency.allergies') || 'ALLERGIES'}
            accentColor="var(--destructive)"
            accentBg="rgba(220,38,38,0.06)"
          >
            {allergies.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_allergies') || 'No allergies on file.'}
              </p>
            ) : (
              <div className="space-y-2">
                {allergies.map((allergy) => {
                  const isLifeThreaten = allergy.severity.toLowerCase().includes('life');
                  return (
                    <div
                      key={allergy.id}
                      className="flex items-start gap-3 p-3 rounded-xl border"
                      style={{
                        background: isLifeThreaten ? 'rgba(220,38,38,0.06)' : 'var(--muted)',
                        borderColor: isLifeThreaten ? 'rgba(220,38,38,0.25)' : 'var(--border)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold" style={{ color: isLifeThreaten ? 'var(--destructive)' : 'var(--foreground)' }}>
                            {allergy.allergen}
                          </span>
                          <SeverityBadge severity={allergy.severity} />
                        </div>
                        {allergy.reaction && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {t('medical.emergency.reaction') || 'Reaction'}: {allergy.reaction}
                          </p>
                        )}
                        {allergy.treatment && (
                          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--foreground)' }}>
                            {t('medical.emergency.treatment') || 'Treatment'}: {allergy.treatment}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* 3. CURRENT MEDICATIONS */}
        <div>
          <Section
            icon={<Pill className="h-4 w-4" />}
            title={t('medical.emergency.medications') || 'CURRENT MEDICATIONS'}
            accentColor="var(--night-sky-blue)"
            accentBg="rgba(37,99,235,0.06)"
          >
            {medications.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_medications') || 'No current medications on file.'}
              </p>
            ) : (
              <div className="space-y-2">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(37,99,235,0.06)' }}
                  >
                    <Pill className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--night-sky-blue)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {med.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {med.dosage} · {med.frequency}
                        {med.purpose && ` · ${med.purpose}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* 4. ACTIVE DIAGNOSES */}
        <div>
          <Section
            icon={<Heart className="h-4 w-4" />}
            title={t('medical.emergency.diagnoses') || 'ACTIVE DIAGNOSES'}
            accentColor="var(--ember-orange)"
            accentBg="rgba(22,163,74,0.06)"
          >
            {diagnoses.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_diagnoses') || 'No diagnoses on file.'}
              </p>
            ) : (
              <div className="space-y-2">
                {diagnoses.map((diag) => (
                  <div
                    key={diag.id}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'rgba(22,163,74,0.06)' }}
                  >
                    <Activity className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--ember-orange)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {diag.name}
                        </p>
                        {diag.icd_code && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                            {diag.icd_code}
                          </span>
                        )}
                      </div>
                      {diag.notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{diag.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* 5. EMERGENCY CONTACTS */}
        <div>
          <Section
            icon={<Phone className="h-4 w-4" />}
            title={t('medical.emergency.emergency_contacts') || 'EMERGENCY CONTACTS'}
            accentColor="var(--ember-orange)"
            accentBg="rgba(22,163,74,0.06)"
          >
            {contacts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_contacts') || 'No emergency contacts on file.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="rounded-xl border p-4"
                    style={{ background: 'rgba(234,88,12,0.04)', borderColor: 'rgba(234,88,12,0.20)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(234,88,12,0.12)', color: 'var(--ember-orange)' }}
                        >
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
                            {contact.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {contact.relationship}
                          </p>
                        </div>
                      </div>
                      {contact.is_authorized_pickup && (
                        <span
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{ background: 'rgba(22,163,74,0.10)', color: 'var(--ember-orange)' }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {t('medical.emergency.authorized_pickup') || 'Authorized Pickup'}
                        </span>
                      )}
                    </div>

                    {contact.phone && (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ color: 'var(--foreground)', textDecoration: 'none' }}
                      >
                        <Phone className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--ember-orange)' }} />
                        <span className="text-base font-bold tracking-wide">{contact.phone}</span>
                      </a>
                    )}
                    {contact.phone_secondary && (
                      <a
                        href={`tel:${contact.phone_secondary}`}
                        className="flex items-center gap-2 p-2 rounded-lg transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                        style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}
                      >
                        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-sm">{contact.phone_secondary}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* 6. ACTIVE RESTRICTIONS */}
        <div>
          <Section
            icon={<Ban className="h-4 w-4" />}
            title={t('medical.emergency.restrictions') || 'ACTIVE RESTRICTIONS'}
            accentColor="var(--warm-amber)"
            accentBg="rgba(5,150,105,0.06)"
          >
            {restrictions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_restrictions') || 'No active restrictions on file.'}
              </p>
            ) : (
              <div className="space-y-2">
                {restrictions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-3 p-3 rounded-xl border"
                    style={{ background: 'rgba(180,83,9,0.06)', borderColor: 'rgba(180,83,9,0.20)' }}
                  >
                    <Ban className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warm-amber)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{r.description}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                          {r.restriction_type}
                        </span>
                      </div>
                      {r.notes && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{r.notes}</p>
                      )}
                      {(r.start_date || r.end_date) && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {r.start_date && `From ${new Date(r.start_date).toLocaleDateString()}`}
                          {r.end_date && ` · Until ${new Date(r.end_date).toLocaleDateString()}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* 7. RECENT VISITS & TREATMENTS */}
        <div>
          <Section
            icon={<Clock className="h-4 w-4" />}
            title={t('medical.emergency.recent_activity') || 'RECENT VISITS & TREATMENTS (last 3)'}
            accentColor="var(--muted-foreground)"
            accentBg="var(--muted)"
          >
            {recentVisits.length === 0 && recentTreatments.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {t('medical.emergency.no_recent_activity') || 'No recent activity on file.'}
              </p>
            ) : (
              <div className="space-y-2">
                {recentVisits.map((visit) => (
                  <div
                    key={`visit-${visit.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--muted)' }}
                  >
                    <Stethoscope className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(5,150,105,0.10)', color: 'var(--warm-amber)' }}>
                          {t('medical.emergency.visit') || 'Visit'}
                        </span>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {visit.chief_complaint}
                        </p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(visit.visit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {visit.visit_time && ` · ${new Date(`1970-01-01T${visit.visit_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        {visit.disposition && ` · ${visit.disposition.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                  </div>
                ))}
                {recentTreatments.map((log) => (
                  <div
                    key={`treatment-${log.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--muted)' }}
                  >
                    <ClipboardList className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--muted-foreground)' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(37,99,235,0.10)', color: 'var(--night-sky-blue)' }}>
                          {t('medical.emergency.treatment_log') || 'Treatment'}
                        </span>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          {log.title}
                        </p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(log.treatment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {log.treatment_time && ` · ${new Date(`1970-01-01T${log.treatment_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                        {` · ${log.type.replace(/_/g, ' ')}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Footer note */}
        <div>
          <div
            className="rounded-xl border p-4 flex items-center gap-3"
            style={{ background: 'var(--muted)', borderColor: 'var(--border)' }}
          >
            <Shield className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.emergency.read_only_note') || 'This is a read-only emergency view. To update medical information, return to the full medical record.'}
              {' '}
              <Link
                to={ROUTES.MEDICAL_RECORD_DETAIL(id)}
                className="font-medium underline"
                style={{ color: 'var(--ember-orange)' }}
              >
                {t('medical.emergency.go_to_record') || 'Go to full record'}
              </Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
