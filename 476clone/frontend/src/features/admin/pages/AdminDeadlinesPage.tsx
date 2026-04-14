/**
 * AdminDeadlinesPage.tsx
 *
 * Purpose: Central deadline management for admins and super admins.
 * Route:   /admin/deadlines
 *
 * Responsibilities:
 *  - List all deadlines (filterable by session, entity type, status)
 *  - Create targeted and session-wide deadlines
 *  - Extend deadlines with admin-provided reason
 *  - Manually complete (override) deadlines for individual applicants
 *  - Delete deadlines (auto-removes the linked calendar event via observer)
 *
 * Every deadline write automatically syncs to the calendar via DeadlineObserver.
 * No separate calendar management is needed from this page.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { Plus, Calendar, CheckCircle, Trash2, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

import {
  getDeadlines, createDeadline, createBulkSessionDeadline,
  extendDeadline, completeDeadline, deleteDeadline,
  type Deadline, type EntityType, type EnforcementMode,
} from '@/features/admin/api/deadlines.api';
import { DeadlineBadge } from '@/ui/components/DeadlineBadge';
import { Button } from '@/ui/components/Button';
import { SkeletonCard } from '@/ui/components/Skeletons';

// ── Types & constants ──────────────────────────────────────────────────────────

type ModalMode = 'create' | 'extend' | 'complete' | null;

interface CreateFormState {
  camp_session_id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string;
  description: string;
  due_date: string;
  grace_period_days: string;
  is_enforced: boolean;
  enforcement_mode: EnforcementMode;
  is_visible_to_applicants: boolean;
  is_session_wide: boolean;
}

const DEFAULT_CREATE: CreateFormState = {
  camp_session_id: '',
  entity_type: 'document_request',
  entity_id: '',
  title: '',
  description: '',
  due_date: '',
  grace_period_days: '0',
  is_enforced: false,
  enforcement_mode: 'soft',
  is_visible_to_applicants: true,
  is_session_wide: false,
};

// ── Styles ─────────────────────────────────────────────────────────────────────

function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background:   'var(--card)',
    border:       '1px solid var(--border)',
    borderRadius: '12px',
    padding:      '20px 24px',
    ...extra,
  };
}

function inputStyle(): CSSProperties {
  return {
    width: '100%', padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.12)',
    fontSize: '0.9375rem',
    background: '#f9fafb',
    color: 'var(--foreground)',
    outline: 'none',
  };
}

function labelStyle(): CSSProperties {
  return { fontSize: '0.8125rem', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '4px' };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AdminDeadlinesPage() {
  const { t } = useTranslation();

  // Defined inside component so labels re-render when language changes
  const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    document_request:    t('deadlines.entity_type_document_request'),
    application:         t('deadlines.entity_type_application'),
    medical_requirement: t('deadlines.entity_type_medical_requirement'),
    session:             t('deadlines.entity_type_session'),
  };

  const [deadlines, setDeadlines]     = useState<Deadline[]>([]);
  const [loading, setLoading]         = useState(true);
  const [retryKey, setRetryKey]       = useState(0);
  const [modalMode, setModalMode]     = useState<ModalMode>(null);
  const [selectedDeadline, setSelected] = useState<Deadline | null>(null);
  const [saving, setSaving]           = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState<EntityType | ''>('');

  // Create form
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE);

  // Extend/complete forms
  const [extendDate, setExtendDate]     = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [completeReason, setCompleteReason] = useState('');

  // ── Data loading ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getDeadlines({
      status:      filterStatus || undefined,
      entity_type: filterType || undefined,
    })
      .then((res) => setDeadlines(res.data))
      .catch(() => toast.error(t('deadlines.error_load')))
      .finally(() => setLoading(false));
  }, [retryKey, filterStatus, filterType, t]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!createForm.camp_session_id || !createForm.title || !createForm.due_date) {
      toast.error(t('deadlines.error_create_validation'));
      return;
    }
    setSaving(true);
    try {
      if (createForm.is_session_wide) {
        await createBulkSessionDeadline({
          camp_session_id:          +createForm.camp_session_id,
          entity_type:              createForm.entity_type,
          title:                    createForm.title,
          description:              createForm.description || undefined,
          due_date:                 createForm.due_date,
          grace_period_days:        +createForm.grace_period_days,
          is_enforced:              createForm.is_enforced,
          enforcement_mode:         createForm.enforcement_mode,
          is_visible_to_applicants: createForm.is_visible_to_applicants,
        });
        toast.success(t('deadlines.success_create_session_wide'));
      } else {
        await createDeadline({
          camp_session_id:          +createForm.camp_session_id,
          entity_type:              createForm.entity_type,
          entity_id:                createForm.entity_id ? +createForm.entity_id : undefined,
          title:                    createForm.title,
          description:              createForm.description || undefined,
          due_date:                 createForm.due_date,
          grace_period_days:        +createForm.grace_period_days,
          is_enforced:              createForm.is_enforced,
          enforcement_mode:         createForm.enforcement_mode,
          is_visible_to_applicants: createForm.is_visible_to_applicants,
        });
        toast.success(t('deadlines.success_create'));
      }
      setModalMode(null);
      setCreateForm(DEFAULT_CREATE);
      setRetryKey((k) => k + 1);
    } catch {
      toast.error(t('deadlines.error_create'));
    } finally {
      setSaving(false);
    }
  }

  async function handleExtend() {
    if (!selectedDeadline || !extendDate || !extendReason) {
      toast.error(t('deadlines.error_extend_validation'));
      return;
    }
    setSaving(true);
    try {
      await extendDeadline(selectedDeadline.id, { new_due_date: extendDate, reason: extendReason });
      toast.success(t('deadlines.success_extend'));
      setModalMode(null);
      setExtendDate('');
      setExtendReason('');
      setRetryKey((k) => k + 1);
    } catch {
      toast.error(t('deadlines.error_extend'));
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!selectedDeadline || !completeReason) {
      toast.error(t('deadlines.error_complete_validation'));
      return;
    }
    setSaving(true);
    try {
      await completeDeadline(selectedDeadline.id, completeReason);
      toast.success(t('deadlines.success_complete'));
      setModalMode(null);
      setCompleteReason('');
      setRetryKey((k) => k + 1);
    } catch {
      toast.error(t('deadlines.error_complete'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(deadline: Deadline) {
    if (!confirm(t('deadlines.confirm_delete', { title: deadline.title }))) return;
    try {
      await deleteDeadline(deadline.id);
      toast.success(t('deadlines.success_delete'));
      setRetryKey((k) => k + 1);
    } catch {
      toast.error(t('deadlines.error_delete'));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const stats = {
    overdue:    deadlines.filter((d) => d.urgency_level === 'overdue').length,
    approaching: deadlines.filter((d) => d.urgency_level === 'approaching').length,
    total:      deadlines.length,
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            {t('deadlines.page_title')}
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
            {t('deadlines.page_subtitle')}
          </p>
        </div>
        <Button onClick={() => { setCreateForm(DEFAULT_CREATE); setModalMode('create'); }}>
          <Plus size={16} style={{ marginRight: '6px' }} /> {t('deadlines.new_deadline_btn')}
        </Button>
      </div>

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: t('deadlines.stat_total'),      value: stats.total,       color: 'var(--foreground)' },
          { label: t('deadlines.stat_approaching'), value: stats.approaching, color: '#b45309' },
          { label: t('deadlines.stat_overdue'),     value: stats.overdue,     color: '#dc2626' },
        ].map((s) => (
          <div key={s.label} style={card({ textAlign: 'center' })}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ ...inputStyle(), width: 'auto', minWidth: '140px' }}
        >
          <option value="">{t('deadlines.filter_all_statuses')}</option>
          <option value="pending">{t('deadlines.filter_status_pending')}</option>
          <option value="overdue">{t('deadlines.filter_status_overdue')}</option>
          <option value="extended">{t('deadlines.filter_status_extended')}</option>
          <option value="completed">{t('deadlines.filter_status_completed')}</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as EntityType | '')}
          style={{ ...inputStyle(), width: 'auto', minWidth: '180px' }}
        >
          <option value="">{t('deadlines.filter_all_types')}</option>
          {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* ── Deadline list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : deadlines.length === 0 ? (
        <div style={{ ...card(), textAlign: 'center', padding: '48px', color: 'var(--muted-foreground)' }}>
          <Calendar size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>{t('deadlines.empty_state_message')}</p>
          <p style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
            {t('deadlines.empty_state_subtitle')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {deadlines.map((d) => (
            <DeadlineRow
              key={d.id}
              deadline={d}
              onExtend={() => { setSelected(d); setExtendDate(''); setExtendReason(''); setModalMode('extend'); }}
              onComplete={() => { setSelected(d); setCompleteReason(''); setModalMode('complete'); }}
              onDelete={() => handleDelete(d)}
            />
          ))}
        </div>
      )}

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      {modalMode === 'create' && (
        <Modal title={t('deadlines.modal_create_title')} onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <FormField label={t('deadlines.form_session_id_label')}>
              <input
                type="number"
                placeholder={t('deadlines.form_session_id_placeholder')}
                value={createForm.camp_session_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, camp_session_id: e.target.value }))}
                style={inputStyle()}
              />
            </FormField>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="session-wide"
                checked={createForm.is_session_wide}
                onChange={(e) => setCreateForm((f) => ({ ...f, is_session_wide: e.target.checked, entity_id: '' }))}
              />
              <label htmlFor="session-wide" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                {t('deadlines.form_session_wide_label')}
              </label>
            </div>

            <FormField label={t('deadlines.form_type_label')}>
              <select
                value={createForm.entity_type}
                onChange={(e) => setCreateForm((f) => ({ ...f, entity_type: e.target.value as EntityType }))}
                style={inputStyle()}
              >
                {(Object.entries(ENTITY_TYPE_LABELS) as [EntityType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FormField>

            {!createForm.is_session_wide && (
              <FormField label={t('deadlines.form_entity_id_label')}>
                <input
                  type="number"
                  placeholder={t('deadlines.form_entity_id_placeholder')}
                  value={createForm.entity_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, entity_id: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
            )}

            <FormField label={t('deadlines.form_title_label')}>
              <input
                placeholder={t('deadlines.form_title_placeholder')}
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                style={inputStyle()}
              />
            </FormField>

            <FormField label={t('deadlines.form_description_label')}>
              <textarea
                placeholder={t('deadlines.form_description_placeholder')}
                value={createForm.description}
                onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <FormField label={t('deadlines.form_due_date_label')}>
                <input
                  type="date"
                  value={createForm.due_date}
                  onChange={(e) => setCreateForm((f) => ({ ...f, due_date: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
              <FormField label={t('deadlines.form_grace_period_label')}>
                <input
                  type="number"
                  min="0" max="30"
                  value={createForm.grace_period_days}
                  onChange={(e) => setCreateForm((f) => ({ ...f, grace_period_days: e.target.value }))}
                  style={inputStyle()}
                />
              </FormField>
            </div>

            <div style={{ padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px' }}>{t('deadlines.form_enforcement_section_title')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.is_enforced}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_enforced: e.target.checked }))}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{t('deadlines.form_enforce_checkbox_label')}</span>
                </label>
                {createForm.is_enforced && (
                  <select
                    value={createForm.enforcement_mode}
                    onChange={(e) => setCreateForm((f) => ({ ...f, enforcement_mode: e.target.value as EnforcementMode }))}
                    style={{ ...inputStyle(), width: 'auto' }}
                  >
                    <option value="soft">{t('deadlines.form_enforcement_soft_option')}</option>
                    <option value="hard">{t('deadlines.form_enforcement_hard_option')}</option>
                  </select>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.is_visible_to_applicants}
                    onChange={(e) => setCreateForm((f) => ({ ...f, is_visible_to_applicants: e.target.checked }))}
                  />
                  <span style={{ fontSize: '0.875rem' }}>{t('deadlines.form_visible_to_applicants_label')}</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>{t('deadlines.modal_cancel_btn')}</Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? t('deadlines.modal_create_btn_loading') : t('deadlines.modal_create_btn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Extend Modal ───────────────────────────────────────────────────── */}
      {modalMode === 'extend' && selectedDeadline && (
        <Modal title={t('deadlines.modal_extend_title', { title: selectedDeadline.title })} onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
              {t('deadlines.extend_current_due_date_label')} <strong>{format(parseISO(selectedDeadline.due_date), 'MMM d, yyyy')}</strong>
            </div>
            <FormField label={t('deadlines.form_new_due_date_label')}>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                style={inputStyle()}
              />
            </FormField>
            <FormField label={t('deadlines.form_extend_reason_label')}>
              <textarea
                placeholder={t('deadlines.form_extend_reason_placeholder')}
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>{t('deadlines.modal_cancel_btn')}</Button>
              <Button onClick={handleExtend} disabled={saving}>
                {saving ? t('deadlines.modal_extend_btn_loading') : t('deadlines.modal_extend_btn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Complete Override Modal ────────────────────────────────────────── */}
      {modalMode === 'complete' && selectedDeadline && (
        <Modal title={t('deadlines.modal_complete_title', { title: selectedDeadline.title })} onClose={() => setModalMode(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 12px', background: 'rgba(217,119,6,0.08)', borderRadius: '8px', fontSize: '0.875rem' }}>
              {t('deadlines.complete_warning_message')}
            </div>
            <FormField label={t('deadlines.form_complete_reason_label')}>
              <textarea
                placeholder={t('deadlines.form_complete_reason_placeholder')}
                value={completeReason}
                onChange={(e) => setCompleteReason(e.target.value)}
                rows={3}
                style={{ ...inputStyle(), resize: 'vertical' }}
              />
            </FormField>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setModalMode(null)}>{t('deadlines.modal_cancel_btn')}</Button>
              <Button onClick={handleComplete} disabled={saving}>
                {saving ? t('deadlines.modal_complete_btn_loading') : t('deadlines.modal_complete_btn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function DeadlineRow({
  deadline,
  onExtend,
  onComplete,
  onDelete,
}: {
  deadline: Deadline;
  onExtend: () => void;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  // Defined here so labels re-render when language changes
  const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
    document_request:    t('deadlines.entity_type_document_request'),
    application:         t('deadlines.entity_type_application'),
    medical_requirement: t('deadlines.entity_type_medical_requirement'),
    session:             t('deadlines.entity_type_session'),
  };

  return (
    <div
      style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '16px',
        padding:       '14px 20px',
        background:    'var(--card)',
        border:        '1px solid var(--border)',
        borderRadius:  '10px',
        flexWrap:      'wrap',
      }}
    >
      {/* Urgency indicator */}
      <div style={{ width: '4px', height: '40px', borderRadius: '2px', background: URGENCY_COLORS[deadline.urgency_level], flexShrink: 0 }} />

      {/* Main info */}
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--foreground)' }}>
          {deadline.title}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', background: 'rgba(0,0,0,0.05)', padding: '2px 7px', borderRadius: '4px' }}>
            {ENTITY_TYPE_LABELS[deadline.entity_type]}
            {deadline.entity_id !== null ? ` #${deadline.entity_id}` : t('deadlines.entity_session_wide_suffix')}
          </span>
          {deadline.is_enforced && (
            <span style={{ fontSize: '0.75rem', color: deadline.enforcement_mode === 'hard' ? '#dc2626' : '#b45309', fontWeight: 600 }}>
              {deadline.enforcement_mode === 'hard' ? t('deadlines.enforcement_hard_badge') : t('deadlines.enforcement_soft_badge')}
            </span>
          )}
          {!deadline.is_visible_to_applicants && (
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{t('deadlines.visibility_internal_only')}</span>
          )}
        </div>
      </div>

      {/* Badge */}
      <DeadlineBadge
        dueDate={deadline.due_date}
        urgencyLevel={deadline.urgency_level}
        compact
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {deadline.status !== 'completed' && (
          <>
            <Button variant="ghost" size="sm" onClick={onExtend}>
              <Edit2 size={13} style={{ marginRight: '4px' }} /> {t('deadlines.action_extend')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onComplete}>
              <CheckCircle size={13} style={{ marginRight: '4px' }} /> {t('deadlines.action_complete')}
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete} style={{ color: 'var(--destructive)' }}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--card)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle()}>{label}</label>
      {children}
    </div>
  );
}

const URGENCY_COLORS: Record<string, string> = {
  safe:       '#16a34a',
  approaching: '#d97706',
  overdue:    '#dc2626',
  completed:  '#9ca3af',
};
