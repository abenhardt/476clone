/**
 * FormStructurePage — Screen 2 of the multi-screen Form Builder.
 *
 * Shows the sections of a single form definition.
 * Admins can reorder sections, add/edit/delete sections, publish the form,
 * and navigate into a section to edit its fields.
 *
 * Route: /super-admin/form-builder/:formId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Upload, History, Monitor, Tablet, Smartphone } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getFormDefinition,
  listFormDefinitions,
  publishFormDefinition,
  duplicateFormDefinition,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from '@/features/forms/api/forms.api';
import type {
  FormDefinitionDetail,
  FormDefinitionListItem,
  FormSectionAdmin,
  CreateSectionPayload,
  UpdateSectionPayload,
} from '@/features/forms/types/form.types';
import { ROUTES } from '@/shared/constants/routes';
import { FormBreadcrumb } from '../components/form-builder/shared/FormBreadcrumb';
import { StatusBadge } from '../components/form-builder/shared/StatusBadge';
import { FormSectionRow } from '../components/form-builder/structure/FormSectionRow';
import { SectionInlineEditor } from '../components/form-builder/section-manager/SectionInlineEditor';
import { VersionHistoryDrawer } from '../components/form-builder/version-history/VersionHistoryDrawer';
import { PreviewModeOverlay } from '../components/form-builder/preview/PreviewModeOverlay';

type PreviewMode = 'off' | 'desktop' | 'tablet' | 'mobile';

const pageEntry = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.05 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

export function FormStructurePage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const id = parseInt(formId ?? '0', 10);

  const [def, setDef]                     = useState<FormDefinitionDetail | null>(null);
  const [definitions, setDefinitions]     = useState<FormDefinitionListItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [retryKey, setRetryKey]           = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Section editing state
  const [showAddSection, setShowAddSection]   = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Preview and version history
  const [previewMode, setPreviewMode]           = useState<PreviewMode>('off');
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const isEditable = def?.is_editable ?? false;

  const loadDef = useCallback(async () => {
    if (!id || isNaN(id)) {
      setError('Invalid form ID. Please return to the Form Builder.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, allDefs] = await Promise.all([
        getFormDefinition(id),
        listFormDefinitions(),
      ]);
      setDef(detail);
      setDefinitions(allDefs);
    } catch {
      setError('Failed to load form. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDef(); }, [loadDef]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previewMode !== 'off') { setPreviewMode('off'); return; }
        if (showVersionHistory) { setShowVersionHistory(false); return; }
      }
      if (
        e.key === 'p' && !e.ctrlKey && !e.metaKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setPreviewMode((m) => (m === 'off' ? 'desktop' : 'off'));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMode, showVersionHistory]);

  // ── Section actions ───────────────────────────────────────────────────────

  async function handleAddSection(data: CreateSectionPayload) {
    if (!def) return;
    await createSection(def.id, data);
    setShowAddSection(false);
    await loadDef();
  }

  async function handleEditSection(sectionId: number, data: UpdateSectionPayload) {
    if (!def) return;
    await updateSection(def.id, sectionId, data);
    setEditingSectionId(null);
    await loadDef();
  }

  async function handleToggleSection(section: FormSectionAdmin) {
    if (!def) return;
    await updateSection(def.id, section.id, { is_active: !section.is_active });
    await loadDef();
  }

  async function handleDeleteSection() {
    if (!confirmDelete || !def) return;
    setDeleteLoading(true);
    try {
      await deleteSection(def.id, confirmDelete.id);
      await loadDef();
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(null);
    }
  }

  async function handleReorderSections(ids: number[]) {
    if (!def) return;
    const originalSections = def.sections;
    // Optimistic update
    const reordered = ids.map((sid, i) => {
      const s = def.sections.find((sec) => sec.id === sid)!;
      return { ...s, sort_order: i };
    });
    setDef({ ...def, sections: reordered });
    try {
      await reorderSections(def.id, ids);
    } catch {
      // Roll back to original order on failure
      setDef({ ...def, sections: originalSections });
      setError('Failed to reorder sections. Please try again.');
    }
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || !def || !isEditable) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const ids = def.sections.map((s) => s.id);
    const [moved] = ids.splice(source.index, 1);
    ids.splice(destination.index, 0, moved);
    handleReorderSections(ids);
  }

  // ── Form-level actions ────────────────────────────────────────────────────

  async function handlePublish() {
    if (!def) return;
    setActionLoading(`publish-${def.id}`);
    try {
      await publishFormDefinition(def.id);
      await loadDef();
    } catch {
      setError('Failed to publish. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDuplicate(id: number) {
    setActionLoading(`dup-${id}`);
    try {
      const newDef = await duplicateFormDefinition(id);
      navigate(ROUTES.SUPER_ADMIN_FORM_STRUCTURE(newDef.id));
    } finally {
      setActionLoading(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      <motion.div
        variants={pageEntry}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto"
      >
        {/* Page header */}
        <div className="px-6 py-5 border-b border-[var(--border)] bg-[var(--card)]">
          <FormBreadcrumb
            items={[
              { label: 'Form Builder', to: ROUTES.SUPER_ADMIN_FORM_BUILDER },
              { label: def?.name ?? '…' },
            ]}
          />

          {def && (
            <div className="flex items-start justify-between gap-4 mt-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
                    {def.name}
                  </h1>
                  <StatusBadge status={def.status} />
                </div>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  v{def.version} · {def.sections.length} sections
                  {def.description && ` · ${def.description}`}
                </p>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Preview mode picker */}
                <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
                  {(['desktop', 'tablet', 'mobile'] as const).map((m) => {
                    const Icon = m === 'desktop' ? Monitor : m === 'tablet' ? Tablet : Smartphone;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPreviewMode(m)}
                        title={`Preview ${m}`}
                        className={`p-2 transition-colors ${
                          previewMode === m
                            ? 'bg-[var(--ember-orange)] text-white'
                            : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)]'
                        }`}
                      >
                        <Icon size={14} />
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowVersionHistory(true)}
                  className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  title="Version history"
                >
                  <History size={15} />
                </button>

                {isEditable && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={actionLoading === `publish-${def.id}`}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    <Upload size={13} />
                    {actionLoading === `publish-${def.id}` ? 'Publishing…' : 'Publish'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-w-3xl">
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
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-[var(--card)] border border-[var(--border)] rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Section list */}
          {!loading && def && (
            <>
              {def.sections.length === 0 && !showAddSection && (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    No sections yet. Add your first section to get started.
                  </p>
                </div>
              )}

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="form-sections">
                  {(droppableProvided) => (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="space-y-2"
                    >
                      {def.sections.map((section, index) => (
                        <div key={section.id}>
                          <Draggable
                            draggableId={`section-${section.id}`}
                            index={index}
                            isDragDisabled={!isEditable}
                          >
                            {(draggableProvided, snapshot) => (
                              <motion.div variants={staggerChild}>
                                <FormSectionRow
                                  section={section}
                                  index={index}
                                  isEditable={isEditable}
                                  provided={draggableProvided}
                                  isDragging={snapshot.isDragging}
                                  onEnter={() =>
                                    navigate(ROUTES.SUPER_ADMIN_SECTION_EDITOR(def.id, section.id))
                                  }
                                  onEdit={() => {
                                    setShowAddSection(false);
                                    setEditingSectionId(section.id);
                                  }}
                                  onToggleActive={() => handleToggleSection(section)}
                                  onDelete={() =>
                                    setConfirmDelete({ id: section.id, name: section.title })
                                  }
                                />
                              </motion.div>
                            )}
                          </Draggable>

                          {/* Inline editor for editing this section */}
                          {editingSectionId === section.id && (
                            <div className="mt-2">
                              <SectionInlineEditor
                                section={section}
                                onSave={(data) => handleEditSection(section.id, data)}
                                onCancel={() => setEditingSectionId(null)}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {droppableProvided.placeholder}
                    </motion.div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Add section inline editor */}
              {showAddSection && (
                <div className="mt-2">
                  <SectionInlineEditor
                    onSave={handleAddSection}
                    onCancel={() => setShowAddSection(false)}
                  />
                </div>
              )}

              {/* Add section button */}
              {isEditable && !showAddSection && (
                <button
                  type="button"
                  onClick={() => { setEditingSectionId(null); setShowAddSection(true); }}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--muted-foreground)] border-2 border-dashed border-[var(--border)] rounded-xl hover:text-[var(--ember-orange)] hover:border-[var(--ember-orange)] transition-colors"
                >
                  <Plus size={15} /> Add Section
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[var(--card-foreground)]">Delete Section?</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  "{confirmDelete.name}" and all its fields will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSection}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version history drawer */}
      <AnimatePresence>
        {showVersionHistory && (
          <VersionHistoryDrawer
            definitions={definitions}
            selectedId={def?.id ?? null}
            actionLoading={actionLoading}
            onClose={() => setShowVersionHistory(false)}
            onSelect={(did) => {
              navigate(ROUTES.SUPER_ADMIN_FORM_STRUCTURE(did));
              setShowVersionHistory(false);
            }}
            onDuplicate={handleDuplicate}
          />
        )}
      </AnimatePresence>

      {/* Preview overlay */}
      <AnimatePresence>
        {previewMode !== 'off' && def && (
          <div className="absolute inset-0 z-20">
            <PreviewModeOverlay
              definition={def}
              mode={previewMode as 'desktop' | 'tablet' | 'mobile'}
              onClose={() => setPreviewMode('off')}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
