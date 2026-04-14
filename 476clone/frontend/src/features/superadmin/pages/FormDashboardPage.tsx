/**
 * FormDashboardPage — Screen 1 of the multi-screen Form Builder.
 *
 * Shows all form definitions as cards. Admins can create, duplicate,
 * archive, preview, or navigate into a form for structure editing.
 *
 * Route: /super-admin/form-builder
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Plus, FileText } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  listFormDefinitions,
  getFormDefinition,
  createFormDefinition,
  duplicateFormDefinition,
  deleteFormDefinition,
} from '@/features/forms/api/forms.api';
import type { FormDefinitionListItem, FormDefinitionDetail } from '@/features/forms/types/form.types';
import { ROUTES } from '@/shared/constants/routes';
import { FormDefinitionCard } from '../components/form-builder/dashboard/FormDefinitionCard';
import { CreateFormModal } from '../components/form-builder/dashboard/CreateFormModal';
import { PreviewModeOverlay } from '../components/form-builder/preview/PreviewModeOverlay';

type PreviewMode = 'off' | 'desktop' | 'tablet' | 'mobile';

const pageEntry = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export function FormDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPortal = location.pathname.startsWith('/admin');
  const formStructureRoute = isAdminPortal ? ROUTES.ADMIN_FORM_STRUCTURE : ROUTES.SUPER_ADMIN_FORM_STRUCTURE;

  const [definitions, setDefinitions]   = useState<FormDefinitionListItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [retryKey, setRetryKey]         = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Preview state
  const [previewDef, setPreviewDef]     = useState<FormDefinitionDetail | null>(null);
  const [previewMode, setPreviewMode]   = useState<PreviewMode>('off');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmArchive, setConfirmArchive]   = useState<{ id: number; name: string } | null>(null);
  const [archiveLoading, setArchiveLoading]   = useState(false);

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFormDefinitions();
      setDefinitions(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load forms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDefinitions(); }, [loadDefinitions]);

  async function handleCreate(name: string, description: string | null) {
    try {
      const newDef = await createFormDefinition({ name, description });
      setShowCreateModal(false);
      navigate(formStructureRoute(newDef.id));
    } catch {
      setError('Failed to create form. Please try again.');
      setShowCreateModal(false);
    }
  }

  async function handleDuplicate(id: number) {
    setActionLoading(`dup-${id}`);
    try {
      const newDef = await duplicateFormDefinition(id);
      await loadDefinitions();
      navigate(formStructureRoute(newDef.id));
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePreview(id: number) {
    setActionLoading(`preview-${id}`);
    try {
      const def = await getFormDefinition(id);
      setPreviewDef(def);
      setPreviewMode('desktop');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleArchive() {
    if (!confirmArchive) return;
    setArchiveLoading(true);
    try {
      await deleteFormDefinition(confirmArchive.id);
      await loadDefinitions();
    } finally {
      setArchiveLoading(false);
      setConfirmArchive(null);
    }
  }

  // Keyboard shortcut: Escape closes preview
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && previewMode !== 'off') setPreviewMode('off');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMode]);

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <motion.div
        variants={pageEntry}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
              Form Builder
            </h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
              Manage application form definitions. Edit sections and fields without code changes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Plus size={15} /> New Form
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle size={16} />
            {error}
            <button
              className="ml-auto text-xs underline"
              onClick={() => { setError(null); setRetryKey((k) => k + 1); }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[var(--border)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[var(--border)] rounded w-3/4" />
                    <div className="h-3 bg-[var(--border)] rounded w-1/3" />
                  </div>
                </div>
                <div className="h-3 bg-[var(--border)] rounded w-1/2 mb-3" />
                <div className="h-8 bg-[var(--border)] rounded mt-4" />
              </div>
            ))}
          </div>
        )}

        {/* Form cards grid */}
        {!loading && definitions.length > 0 && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {definitions.map((def) => (
              <motion.div key={def.id} variants={staggerChild}>
                <FormDefinitionCard
                  def={def}
                  actionLoading={actionLoading}
                  onEdit={() => navigate(formStructureRoute(def.id))}
                  onPreview={() => handlePreview(def.id)}
                  onDuplicate={() => handleDuplicate(def.id)}
                  onArchive={() => setConfirmArchive({ id: def.id, name: def.name })}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && definitions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-[var(--ember-orange)]/10 mb-4">
              <FileText size={32} className="text-[var(--ember-orange)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--card-foreground)] mb-1">No forms yet</h3>
            <p className="text-sm text-[var(--muted-foreground)] max-w-xs mb-5">
              Create your first form to start collecting applications.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={15} /> Create First Form
            </button>
          </div>
        )}
      </motion.div>

      {/* Create form modal */}
      {showCreateModal && (
        <CreateFormModal
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Archive confirm dialog */}
      {confirmArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[var(--card-foreground)]">Delete Draft?</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  "{confirmArchive.name}" will be permanently deleted. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmArchive(null)}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiveLoading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {archiveLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview overlay */}
      <AnimatePresence>
        {previewMode !== 'off' && previewDef && (
          <div className="absolute inset-0 z-20">
            <PreviewModeOverlay
              definition={previewDef}
              mode={previewMode as 'desktop' | 'tablet' | 'mobile'}
              onClose={() => setPreviewMode('off')}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
