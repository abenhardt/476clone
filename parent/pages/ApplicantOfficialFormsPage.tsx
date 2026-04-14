/**
 * ApplicantOfficialFormsPage.tsx
 *
 * Purpose: Paper form submission workflow for applicants choosing the paper path.
 *
 * This page exists for one reason: to guide applicants who want to submit their
 * application using paper forms instead of the digital form. Everything on this
 * page is scoped to that single workflow.
 *
 * Step 1 — Get blank forms: View or download any official blank form.
 * Step 2 — Upload completed forms: Upload signed, completed paper forms.
 * Step 3 — Submit for review: Explicitly submit uploads so staff can see them.
 *
 * This page does NOT handle the digital application workflow.
 * Digital applications are started from the Applications section.
 *
 * Route: /applicant/forms
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  CheckCircle2,
  FileText,
  Loader2,
  AlertCircle,
  Eye,
  X,
  Send,
  RefreshCw,
} from 'lucide-react';

import { HeroSlideshow } from '@/ui/components/HeroSlideshow';

import {
  downloadFormTemplate,
  getDocuments,
  getFormTemplates,
  getApplications,
  uploadDocument,
  submitDocument,
} from '@/features/parent/api/applicant.api';
import type { OfficialFormTemplate } from '@/shared/types';
import type { Document } from '@/features/parent/api/applicant.api';
import { Button } from '@/ui/components/Button';
import { useAppSelector } from '@/store/hooks';

// ── Upload slot definitions ───────────────────────────────────────────────────
// These define the required and optional uploads for the paper submission path.
// document_type values match what the admin review page and compliance checks look for.

interface UploadSlotDef {
  id: string;
  labelKey: string;
  descKey: string;
  documentType: string;
  required: boolean;
}

const UPLOAD_SLOTS: UploadSlotDef[] = [
  {
    id: 'application',
    labelKey: 'official_forms.slot_app_label',
    descKey: 'official_forms.slot_app_desc',
    documentType: 'paper_application_packet',
    required: true,
  },
  {
    id: 'medical',
    labelKey: 'official_forms.slot_medical_label',
    descKey: 'official_forms.slot_medical_desc',
    documentType: 'official_medical_form',
    required: true,
  },
  {
    id: 'cyshcn',
    labelKey: 'official_forms.slot_cyshcn_label',
    descKey: 'official_forms.slot_cyshcn_desc',
    documentType: 'official_cyshcn_form',
    required: false,
  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface SlotState {
  uploadStatus: 'idle' | 'uploading' | 'done' | 'error';
  uploadedDoc: Document | null;
}

interface PreviewState {
  open: boolean;
  loading: boolean;
  error: boolean;
  blobUrl: string | null;
  formLabel: string;
  formId: string | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ApplicantOfficialFormsPage() {
  const { t } = useTranslation();
  const userId = useAppSelector((state) => state.auth.user?.id);
  const draftKey = `cbg_app_draft_${userId ?? 'anon'}`;

  const [forms, setForms] = useState<OfficialFormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [slotStates, setSlotStates] = useState<Record<string, SlotState>>({});
  const [activeApplicationId, setActiveApplicationId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingForm, setDownloadingForm] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    open: false, loading: false, error: false, blobUrl: null, formLabel: '', formId: null,
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [formData, existingDocs, apps] = await Promise.all([
          getFormTemplates(),
          getDocuments(),
          getApplications(),
        ]);

        setForms(formData);

        // Find the best application to link uploads to.
        // Prefer a submitted application; fall back to any draft.
        const submittedApp = apps.find((a) => !a.is_draft && a.submitted_at);
        const draftApp = apps.find((a) => a.is_draft);
        const localDraft = sessionStorage.getItem(draftKey);

        if (submittedApp) {
          setActiveApplicationId(submittedApp.id);
        } else if (draftApp || localDraft) {
          if (draftApp) setActiveApplicationId(draftApp.id);
        }

        // Initialize slot states from previously uploaded documents.
        const initial: Record<string, SlotState> = {};
        UPLOAD_SLOTS.forEach((slot) => {
          const uploadedDoc = existingDocs.find((d) => d.document_type === slot.documentType) ?? null;
          initial[slot.id] = {
            uploadStatus: uploadedDoc ? 'done' : 'idle',
            uploadedDoc,
          };
        });
        setSlotStates(initial);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [draftKey]);

  // ── Derived state ───────────────────────────────────────────────────────────

  // All required uploads present (submission is allowed)
  const requiredComplete = UPLOAD_SLOTS.filter((s) => s.required).every(
    (s) => slotStates[s.id]?.uploadedDoc != null
  );

  // All uploaded required items already submitted to staff
  const allRequiredSubmitted = UPLOAD_SLOTS.filter((s) => s.required).every(
    (s) => slotStates[s.id]?.uploadedDoc?.submitted_at != null
  );

  // Any uploaded item not yet submitted
  const hasUnsubmitted = UPLOAD_SLOTS.some((s) => {
    const st = slotStates[s.id];
    return st?.uploadedDoc && !st.uploadedDoc.submitted_at;
  });

  // ── PDF preview handlers ────────────────────────────────────────────────────

  async function handleViewForm(form: OfficialFormTemplate) {
    setPreview({ open: true, loading: true, error: false, blobUrl: null, formLabel: form.label, formId: form.id });
    try {
      const blob = await downloadFormTemplate(form.id);
      const url = URL.createObjectURL(blob);
      setPreview((prev) => ({ ...prev, loading: false, blobUrl: url }));
    } catch {
      setPreview((prev) => ({ ...prev, loading: false, error: true }));
    }
  }

  function closePreview() {
    setPreview((prev) => {
      if (prev.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return { open: false, loading: false, error: false, blobUrl: null, formLabel: '', formId: null };
    });
  }

  // ── Download handlers ───────────────────────────────────────────────────────

  async function handleDownloadForm(form: OfficialFormTemplate) {
    setDownloadingForm(form.id);
    try {
      const blob = await downloadFormTemplate(form.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = form.download_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('official_forms.download_success', { label: form.label }));
    } catch {
      toast.error(t('official_forms.download_error'));
    } finally {
      setDownloadingForm(null);
    }
  }

  // Download the currently previewed form using the already-fetched blob URL.
  function handleDownloadFromPreview() {
    if (!preview.blobUrl || !preview.formId) return;
    const form = forms.find((f) => f.id === preview.formId);
    if (!form) return;
    const link = document.createElement('a');
    link.href = preview.blobUrl;
    link.download = form.download_filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── Upload handlers ─────────────────────────────────────────────────────────

  function triggerSlotUpload(slotId: string) {
    fileInputRefs.current[slotId]?.click();
  }

  async function handleSlotUpload(slot: UploadSlotDef, file: File) {
    setSlotStates((prev) => ({
      ...prev,
      [slot.id]: { ...prev[slot.id], uploadStatus: 'uploading' },
    }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', slot.documentType);
      // Link to the active application so it appears in the admin review context.
      if (activeApplicationId !== null) {
        formData.append('documentable_type', 'App\\Models\\Application');
        formData.append('documentable_id', String(activeApplicationId));
      }
      await uploadDocument(formData);

      // Re-fetch to get the canonical document record (includes id, url, submitted_at).
      const updatedDocs = await getDocuments();
      const uploadedDoc = updatedDocs.find((d) => d.document_type === slot.documentType) ?? null;
      setSlotStates((prev) => ({
        ...prev,
        [slot.id]: { uploadStatus: 'done', uploadedDoc },
      }));
      toast.success(t('official_forms.upload_success', { label: t(slot.labelKey) }));
    } catch {
      setSlotStates((prev) => ({
        ...prev,
        [slot.id]: { ...prev[slot.id], uploadStatus: 'error' },
      }));
      toast.error(t('official_forms.upload_error'));
    }
  }

  // ── Submission handler ──────────────────────────────────────────────────────

  async function handleSubmitAll() {
    // Collect IDs of uploaded documents that have not yet been submitted.
    const toSubmit = UPLOAD_SLOTS.flatMap((slot) => {
      const st = slotStates[slot.id];
      return st?.uploadedDoc && !st.uploadedDoc.submitted_at ? [st.uploadedDoc.id] : [];
    });

    if (toSubmit.length === 0) return;

    setSubmitting(true);
    try {
      await Promise.all(toSubmit.map((id) => submitDocument(id)));

      // Refresh to capture updated submitted_at values from the server.
      const updatedDocs = await getDocuments();
      setSlotStates((prev) => {
        const next = { ...prev };
        UPLOAD_SLOTS.forEach((slot) => {
          const uploadedDoc = updatedDocs.find((d) => d.document_type === slot.documentType) ?? null;
          if (uploadedDoc) {
            next[slot.id] = { uploadStatus: 'done', uploadedDoc };
          }
        });
        return next;
      });
      toast.success(t('official_forms.submit_success'));
    } catch {
      toast.error(t('official_forms.submit_error'));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--muted)',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          color: 'var(--destructive)',
        }}
      >
        <AlertCircle className="w-8 h-8" />
        <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>
          {t('official_forms.load_error')}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── PDF Preview Modal ──────────────────────────────────────────────── */}
      {preview.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-md)',
          }}
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) closePreview(); }}
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.3))',
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--foreground)',
                  }}
                >
                  {preview.formLabel}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {preview.blobUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadFromPreview}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('official_forms.download_form')}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={closePreview}
                  style={{ display: 'flex', alignItems: 'center', padding: '6px' }}
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Modal body */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--muted)',
              }}
            >
              {preview.loading && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    color: 'var(--muted-foreground)',
                    padding: 40,
                  }}
                >
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>
                    {t('official_forms.preview_loading')}
                  </span>
                </div>
              )}
              {preview.error && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    color: 'var(--destructive)',
                    padding: 40,
                    textAlign: 'center',
                  }}
                >
                  <AlertCircle className="w-8 h-8" />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)' }}>
                    {t('official_forms.preview_error')}
                  </span>
                </div>
              )}
              {preview.blobUrl && (
                <iframe
                  src={preview.blobUrl}
                  style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }}
                  title={preview.formLabel}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Page ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 max-w-5xl">

        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <div
          className="relative flex flex-col justify-end rounded-2xl overflow-hidden"
          style={{ minHeight: 200 }}
        >
          <HeroSlideshow initialIndex={3} />

          {/* Overlay content */}
          <div className="relative z-10 px-6 py-7 lg:px-8 lg:py-8">
            {/* Title */}
            <h1
              style={{
                fontFamily: 'var(--font-headline)',
                fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                lineHeight: 1.15,
                textShadow: '0 1px 4px rgba(0,0,0,0.35)',
              }}
            >
              {t('official_forms.title')}
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'rgba(255,255,255,0.82)',
                marginTop: 8,
                maxWidth: 560,
                lineHeight: 1.6,
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              {t('official_forms.subtitle')}
            </p>
          </div>
        </div>

        {/* ── Steps ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-8">

        {/* ── Step 1: Get Blank Forms ──────────────────────────────────────── */}
        <section>
          <StepHeader step={1} title={t('official_forms.step1_title')} subtitle={t('official_forms.step1_subtitle')} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forms.map((form) => (
              <FormDownloadCard
                key={form.id}
                form={form}
                isDownloading={downloadingForm === form.id}
                onView={() => handleViewForm(form)}
                onDownload={() => handleDownloadForm(form)}
                t={t}
              />
            ))}
          </div>
        </section>

        {/* ── Step 2: Upload Completed Forms ──────────────────────────────── */}
        <section>
          <StepHeader step={2} title={t('official_forms.step2_title')} subtitle={t('official_forms.step2_subtitle')} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {UPLOAD_SLOTS.map((slot) => {
              const state = slotStates[slot.id] ?? { uploadStatus: 'idle', uploadedDoc: null };
              return (
                <div key={slot.id}>
                  <UploadSlotCard
                    slot={slot}
                    state={state}
                    onUpload={() => triggerSlotUpload(slot.id)}
                    t={t}
                  />
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    ref={(el) => { fileInputRefs.current[slot.id] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSlotUpload(slot, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Step 3: Submit for Review ────────────────────────────────────── */}
        <section>
          <StepHeader step={3} title={t('official_forms.step3_title')} subtitle={t('official_forms.step3_subtitle')} />

          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-md)',
            }}
          >
            {/* Readiness checklist */}
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
              {UPLOAD_SLOTS.filter((s) => s.required).map((slot) => {
                const st = slotStates[slot.id];
                const uploaded = st?.uploadedDoc != null;
                const submitted = !!(st?.uploadedDoc?.submitted_at);
                return (
                  <div
                    key={slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 0',
                    }}
                  >
                    {uploaded ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                    ) : (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          border: '2px solid var(--border)',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 'var(--text-sm)',
                        color: uploaded ? 'var(--foreground)' : 'var(--muted-foreground)',
                        flex: 1,
                      }}
                    >
                      {t(slot.labelKey)}
                    </span>
                    {submitted && (
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: '#16a34a',
                          fontWeight: 500,
                        }}
                      >
                        {t('official_forms.submitted_label')}
                      </span>
                    )}
                    {uploaded && !submitted && (
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 'var(--text-xs)',
                          color: '#92400e',
                          fontWeight: 500,
                        }}
                      >
                        {t('official_forms.uploaded_not_submitted')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit area */}
            {allRequiredSubmitted ? (
              <div
                style={{
                  background: 'rgba(22,163,74,0.07)',
                  border: '1px solid rgba(22,163,74,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                <div>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: 'var(--text-sm)',
                      color: '#16a34a',
                      margin: 0,
                    }}
                  >
                    {t('official_forms.all_submitted_label')}
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--muted-foreground)',
                      margin: '3px 0 0',
                    }}
                  >
                    {t('official_forms.all_submitted_note')}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!requiredComplete && (
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--muted-foreground)',
                      margin: 0,
                    }}
                  >
                    {t('official_forms.missing_required')}
                  </p>
                )}
                <Button
                  variant="primary"
                  size="md"
                  disabled={!requiredComplete || !hasUnsubmitted || submitting}
                  onClick={handleSubmitAll}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitting ? t('official_forms.submitting') : t('official_forms.submit_btn')}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Footer note */}
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-foreground)',
            textAlign: 'center',
          }}
        >
          {t('official_forms.footer_note')}
        </p>

        </div>{/* end max-w-2xl steps container */}
      </div>{/* end max-w-5xl outer container */}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  return (
    <div
      style={{
        marginBottom: 'var(--spacing-md)',
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--ember-orange)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-headline)',
          fontWeight: 700,
          fontSize: 13,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {step}
      </div>
      <div>
        <h2
          style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-foreground)',
            margin: '2px 0 0',
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function FormDownloadCard({
  form,
  isDownloading,
  onView,
  onDownload,
  t,
}: {
  form: OfficialFormTemplate;
  isDownloading: boolean;
  onView: () => void;
  onDownload: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(22,101,52,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <FileText className="w-5 h-5" style={{ color: 'var(--ember-orange)' }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          {form.label}
        </p>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-foreground)',
            margin: '2px 0 0',
            lineHeight: 1.45,
          }}
        >
          {form.description}
        </p>
        {!form.available && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: 'var(--muted-foreground)',
              margin: '4px 0 0',
              fontStyle: 'italic',
            }}
          >
            {t('official_forms.form_not_available')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Button
          variant="ghost"
          size="sm"
          disabled={!form.available}
          onClick={onView}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Eye className="w-3.5 h-3.5" />
          {t('official_forms.view_form')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!form.available || isDownloading}
          onClick={onDownload}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {isDownloading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          {isDownloading ? t('official_forms.downloading') : t('official_forms.download_form')}
        </Button>
      </div>
    </div>
  );
}

function UploadSlotCard({
  slot,
  state,
  onUpload,
  t,
}: {
  slot: UploadSlotDef;
  state: SlotState;
  onUpload: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const isUploaded = state.uploadedDoc != null;
  const isSubmittedToStaff = !!(state.uploadedDoc?.submitted_at);
  const isDraft = isUploaded && !isSubmittedToStaff;

  return (
    <div
      style={{
        background: 'var(--card)',
        border: `1px solid ${isUploaded ? 'rgba(22,163,74,0.22)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Status icon */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 'var(--radius-md)',
          background: isUploaded ? 'rgba(22,163,74,0.07)' : 'var(--muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUploaded ? (
          <CheckCircle2 className="w-5 h-5" style={{ color: '#16a34a' }} />
        ) : (
          <Upload className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            {t(slot.labelKey)}
          </p>
          <span
            style={{
              fontSize: '0.7rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              background: slot.required ? 'rgba(22,101,52,0.08)' : 'var(--muted)',
              color: slot.required ? 'var(--ember-orange)' : 'var(--muted-foreground)',
              borderRadius: 999,
              padding: '1px 8px',
            }}
          >
            {slot.required ? t('official_forms.required_badge') : t('official_forms.optional_badge')}
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xs)',
            color: 'var(--muted-foreground)',
            margin: '3px 0 0',
            lineHeight: 1.45,
          }}
        >
          {isUploaded
            ? `${t('official_forms.uploaded_file')}: ${state.uploadedDoc!.file_name}`
            : t(slot.descKey)}
        </p>
        {isDraft && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-xs)',
              color: '#92400e',
              margin: '3px 0 0',
              fontWeight: 500,
            }}
          >
            {t('official_forms.draft_note')}
          </p>
        )}
        {state.uploadStatus === 'error' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--destructive)',
              fontSize: 'var(--text-xs)',
              fontFamily: 'var(--font-body)',
              marginTop: 4,
            }}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {t('official_forms.upload_failed')}
          </div>
        )}
      </div>

      {/* Upload action */}
      <div style={{ flexShrink: 0 }}>
        <Button
          variant={isUploaded ? 'ghost' : 'secondary'}
          size="sm"
          disabled={state.uploadStatus === 'uploading'}
          onClick={onUpload}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          {state.uploadStatus === 'uploading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isUploaded ? (
            <RefreshCw className="w-3.5 h-3.5" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {state.uploadStatus === 'uploading'
            ? t('official_forms.uploading')
            : isUploaded
            ? t('official_forms.replace_upload')
            : t('official_forms.upload_form_btn')}
        </Button>
      </div>
    </div>
  );
}
