/**
 * MedicalFollowUpsPage.tsx
 *
 * Global follow-up task management page. Not scoped to a single camper.
 *
 * Route: /medical/follow-ups
 */

import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import {
  ClipboardCheck, Plus, X, Loader2, Save, CheckCircle,
  Clock, AlertCircle, ChevronDown, Trash2, Search, User,
} from 'lucide-react';

import {
  getMedicalFollowUps,
  createMedicalFollowUp,
  updateMedicalFollowUp,
  deleteMedicalFollowUp,
  getMedicalCampers,
  type MedicalFollowUp,
  type FollowUpStatus,
  type FollowUpPriority,
} from '@/features/medical/api/medical.api';
import { Skeletons } from '@/ui/components/Skeletons';
import { EmptyState } from '@/ui/components/EmptyState';

import { ROUTES } from '@/shared/constants/routes';
import type { Camper } from '@/features/admin/types/admin.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'pending' | 'in_progress' | 'overdue' | 'completed';

interface TabDef {
  key: TabKey;
  label: string;
  status?: FollowUpStatus;
  overdue?: boolean;
}

const TABS: TabDef[] = [
  { key: 'all',         label: 'All' },
  { key: 'pending',     label: 'Pending',     status: 'pending' },
  { key: 'in_progress', label: 'In Progress',  status: 'in_progress' },
  { key: 'overdue',     label: 'Overdue',      overdue: true },
  { key: 'completed',   label: 'Completed',   status: 'completed' },
];

// ─── Priority meta ────────────────────────────────────────────────────────────

const PRIORITY_META: Record<FollowUpPriority, { label: string; color: string; bg: string; borderColor: string }> = {
  urgent: {
    label: 'Urgent',
    color: 'var(--destructive)',
    bg: 'rgba(220,38,38,0.08)',
    borderColor: 'rgba(220,38,38,0.35)',
  },
  high: {
    label: 'High',
    color: '#c2410c',
    bg: 'rgba(194,65,12,0.08)',
    borderColor: 'rgba(194,65,12,0.25)',
  },
  medium: {
    label: 'Medium',
    color: '#b45309',
    bg: 'rgba(180,83,9,0.08)',
    borderColor: 'rgba(180,83,9,0.20)',
  },
  low: {
    label: 'Low',
    color: 'var(--muted-foreground)',
    bg: 'var(--muted)',
    borderColor: 'var(--border)',
  },
};

const STATUS_META: Record<FollowUpStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#b45309',              bg: 'rgba(180,83,9,0.10)' },
  in_progress: { label: 'In Progress', color: 'var(--night-sky-blue)', bg: 'rgba(37,99,235,0.10)' },
  completed:   { label: 'Completed',   color: 'var(--ember-orange)',   bg: 'rgba(22,163,74,0.10)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--muted-foreground)', bg: 'var(--muted)' },
};

// ─── Badges ───────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: FollowUpPriority }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.low;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: FollowUpStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className="inline-flex items-center text-xs px-2 py-0.5 rounded-full"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

// ─── Follow-up card ───────────────────────────────────────────────────────────

function FollowUpCard({
  followUp,
  onStatusChange,
  onDelete,
}: {
  followUp: MedicalFollowUp;
  onStatusChange: (id: number, status: FollowUpStatus) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [actioning, setActioning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const prioMeta = PRIORITY_META[followUp.priority] ?? PRIORITY_META.low;
  const dueDate = new Date(followUp.due_date);
  const isOverdue = followUp.status !== 'completed' && dueDate < new Date();

  const dueDateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleMarkInProgress = async () => {
    setActioning(true);
    try {
      await updateMedicalFollowUp(followUp.id, { status: 'in_progress' });
      onStatusChange(followUp.id, 'in_progress');
    } catch { /* ignore */ }
    finally { setActioning(false); }
  };

  const handleMarkComplete = async () => {
    setActioning(true);
    try {
      await updateMedicalFollowUp(followUp.id, { status: 'completed' });
      onStatusChange(followUp.id, 'completed');
    } catch { /* ignore */ }
    finally { setActioning(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMedicalFollowUp(followUp.id);
      onDelete(followUp.id);
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: 'var(--card)', borderColor: prioMeta.borderColor }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <PriorityBadge priority={followUp.priority} />
            <StatusBadge status={followUp.status} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{followUp.title}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {followUp.camper && (
              <Link
                to={ROUTES.MEDICAL_RECORD_DETAIL(followUp.camper.id)}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: 'var(--ember-orange)' }}
              >
                <User className="h-3 w-3" />
                {followUp.camper.full_name}
              </Link>
            )}
            {followUp.assignee && (
              <span>Assigned to {followUp.assignee.name}</span>
            )}
            <span className={isOverdue ? 'font-medium' : ''} style={{ color: isOverdue ? 'var(--destructive)' : undefined }}>
              Due {dueDateStr}
              {isOverdue && ' — Overdue'}
            </span>
          </div>

          {followUp.notes && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              {followUp.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => void handleMarkInProgress()}
            disabled={actioning || followUp.status !== 'pending'}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50${followUp.status !== 'pending' ? ' invisible' : ''}`}
            style={{ borderColor: 'var(--border)', color: 'var(--night-sky-blue)', background: 'rgba(37,99,235,0.06)' }}
            title={t('medical.follow_ups.mark_in_progress') || 'Mark In Progress'}
          >
            {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
            {t('medical.follow_ups.in_progress') || 'In Progress'}
          </button>
          <button
            onClick={() => void handleMarkComplete()}
            disabled={actioning || followUp.status === 'completed'}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-50${followUp.status === 'completed' ? ' invisible' : ''}`}
            style={{ borderColor: 'var(--border)', color: 'var(--ember-orange)', background: 'rgba(22,163,74,0.06)' }}
            title={t('medical.follow_ups.mark_complete') || 'Mark Complete'}
          >
            {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            {t('medical.follow_ups.complete') || 'Complete'}
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="p-1.5 rounded-lg transition-colors disabled:opacity-50 hover:bg-[var(--dash-nav-hover-bg)]"
            style={{ color: 'var(--muted-foreground)' }}
            title={t('common.delete') || 'Delete'}
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Camper search ────────────────────────────────────────────────────────────

function CamperSearch({
  value,
  onSelect,
  onClear,
}: {
  value: Camper | null;
  onSelect: (camper: Camper) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Camper[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getMedicalCampers({ search: val });
        setSuggestions(res.data.slice(0, 8));
        setOpen(true);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  };

  if (value) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm"
        style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
        <span className="flex-1">{value.full_name}</span>
        <button
          type="button"
          onClick={onClear}
          className="p-0.5 rounded hover:bg-[var(--dash-nav-hover-bg)]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
        <input
          type="text"
          className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40"
          style={{ background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          placeholder={t('medical.follow_ups.search_camper') || 'Search camper by name…'}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin" style={{ color: 'var(--muted-foreground)' }} />}
      </div>

      {open && suggestions.length > 0 && (
          <div
            className="absolute z-20 w-full mt-1 rounded-xl border shadow-lg overflow-hidden"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            {suggestions.map((camper) => (
              <button
                key={camper.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                style={{ color: 'var(--foreground)' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(camper);
                  setQuery('');
                  setSuggestions([]);
                  setOpen(false);
                }}
              >
                <User className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                {camper.full_name}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

// ─── Add follow-up form ───────────────────────────────────────────────────────

const BASE_INPUT = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ember-orange)]/40";
const INPUT_STYLE = { background: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' };

const PRIORITY_OPTIONS: { value: FollowUpPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const INITIAL_FORM = {
  title: '',
  priority: 'medium' as FollowUpPriority,
  due_date: '',
  notes: '',
};

function AddFollowUpForm({
  onSaved,
  onClose,
}: {
  onSaved: (fu: MedicalFollowUp) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedCamper, setSelectedCamper] = useState<Camper | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCamper || !form.title || !form.due_date) {
      setError(t('medical.follow_ups.form_error') || 'Please fill in all required fields including camper selection.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fu = await createMedicalFollowUp({
        camper_id: selectedCamper.id,
        title: form.title,
        priority: form.priority,
        due_date: form.due_date,
        notes: form.notes || undefined,
        status: 'pending',
      });
      onSaved(fu);
    } catch {
      setError(t('medical.follow_ups.save_error') || 'Failed to save follow-up. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 mb-6"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-headline text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {t('medical.follow_ups.form_title') || 'Add Follow-Up Task'}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)]" style={{ color: 'var(--muted-foreground)' }}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.follow_ups.camper') || 'Camper'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <CamperSearch
            value={selectedCamper}
            onSelect={setSelectedCamper}
            onClear={() => setSelectedCamper(null)}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.follow_ups.title_field') || 'Title'} <span style={{ color: 'var(--destructive)' }}>*</span>
          </label>
          <input
            type="text"
            className={BASE_INPUT}
            style={INPUT_STYLE}
            value={form.title}
            onChange={(e) => setField('title')(e.target.value)}
            placeholder={t('medical.follow_ups.title_placeholder') || 'What needs to be done?'}
            maxLength={255}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.follow_ups.priority') || 'Priority'}
            </label>
            <select className={BASE_INPUT} style={INPUT_STYLE} value={form.priority} onChange={(e) => setField('priority')(e.target.value)}>
              {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {t('medical.follow_ups.due_date') || 'Due Date'} <span style={{ color: 'var(--destructive)' }}>*</span>
            </label>
            <input
              type="date"
              className={BASE_INPUT}
              style={INPUT_STYLE}
              value={form.due_date}
              onChange={(e) => setField('due_date')(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--muted-foreground)' }}>
            {t('medical.follow_ups.notes') || 'Notes'}
          </label>
          <textarea
            className={BASE_INPUT}
            style={INPUT_STYLE}
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes')(e.target.value)}
            placeholder={t('medical.follow_ups.notes_placeholder') || 'Additional context or instructions…'}
          />
        </div>

        {error && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--destructive)' }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--ember-orange)', color: '#fff' }}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('medical.follow_ups.save') || 'Add Follow-Up'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MedicalFollowUpsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [followUps, setFollowUps] = useState<MedicalFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [tabCounts, setTabCounts] = useState<Partial<Record<TabKey, number>>>({});

  const buildParams = useCallback((tab: TabKey, pg: number) => {
    const tab_def = TABS.find((t) => t.key === tab);
    return {
      ...(tab_def?.status && { status: tab_def.status }),
      ...(tab_def?.overdue && { overdue: true }),
      page: pg,
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setPage(1);
    try {
      const res = await getMedicalFollowUps(buildParams(activeTab, 1));
      setFollowUps(res.data);
      setHasMore(res.meta.current_page < res.meta.last_page);
      setTabCounts((prev) => ({ ...prev, [activeTab]: res.meta.total }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab, retryKey, buildParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getMedicalFollowUps(buildParams(activeTab, nextPage));
      setFollowUps((prev) => [...prev, ...res.data]);
      setPage(nextPage);
      setHasMore(res.meta.current_page < res.meta.last_page);
    } catch { /* silently fail */ }
    finally { setLoadingMore(false); }
  };

  const handleStatusChange = (id: number, status: FollowUpStatus) => {
    setFollowUps((prev) =>
      prev.map((fu) => fu.id === id ? { ...fu, status } : fu)
    );
  };

  const handleDelete = (id: number) => {
    setFollowUps((prev) => prev.filter((fu) => fu.id !== id));
  };

  const handleSaved = (fu: MedicalFollowUp) => {
    setFollowUps((prev) => [fu, ...prev]);
    setShowForm(false);
  };

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(22,163,74,0.10)' }}>
            <ClipboardCheck className="h-3.5 w-3.5" style={{ color: 'var(--ember-orange)' }} />
          </div>
          <h1 className="font-headline text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            {t('medical.follow_ups.title') || 'Follow-Up Tasks'}
          </h1>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: showForm ? 'var(--muted)' : 'var(--ember-orange)', color: showForm ? 'var(--muted-foreground)' : '#fff' }}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm
            ? (t('common.cancel') || 'Cancel')
            : (t('medical.follow_ups.add') || 'Add Follow-Up')
          }
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <AddFollowUpForm onSaved={handleSaved} onClose={() => setShowForm(false)} />
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setLoading(true); setActiveTab(tab.key); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                background: isActive ? 'var(--ember-orange)' : 'transparent',
                color: isActive ? '#fff' : 'var(--muted-foreground)',
              }}
            >
              {tab.key === 'overdue' && <AlertCircle className="h-3 w-3" />}
              {t(`medical.follow_ups.tab_${tab.key}`) || tab.label}
              {tabCounts[tab.key] !== undefined && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--muted)',
                    color: isActive ? '#fff' : 'var(--muted-foreground)',
                    minWidth: '20px',
                    textAlign: 'center',
                  }}
                >
                  {tabCounts[tab.key]}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs"
          style={{ color: 'var(--muted-foreground)', background: 'var(--muted)' }}
          aria-label={t('medical.follow_ups.add') || 'Add Follow-Up'}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeletons.Card key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          title={t('common.error_loading') || 'Failed to load follow-ups'}
          description={t('common.try_again') || 'Please try again.'}
          action={{ label: t('common.retry') || 'Retry', onClick: () => setRetryKey((k) => k + 1) }}
        />
      ) : followUps.length === 0 ? (
        <EmptyState
          title={t('medical.follow_ups.empty_title') || 'No follow-ups found'}
          description={t('medical.follow_ups.empty_desc') || 'No follow-up tasks match the current filter.'}
        />
      ) : (
        <>
          <div className="space-y-3">
            {followUps.map((fu) => (
              <div key={fu.id}>
                <FollowUpCard
                  followUp={fu}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'var(--card)' }}
              >
                {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('common.load_more') || 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
