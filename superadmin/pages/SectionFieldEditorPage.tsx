/**
 * SectionFieldEditorPage — Screen 3+4 of the multi-screen Form Builder.
 *
 * Shows all fields within a single section.
 * Clicking a field opens the FieldSettingsPanel slide-in panel (Screen 4).
 * Supports drag-to-reorder and add-field via FieldTypePickerModal.
 *
 * Route: /super-admin/form-builder/:formId/sections/:sectionId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Plus, Lock } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getFormDefinition,
  createField,
  updateField,
  deleteField,
  reorderFields,
  activateField,
  deactivateField,
  createOption,
  updateOption,
  deleteOption,
} from '@/features/forms/api/forms.api';
import type {
  FormDefinitionDetail,
  FormFieldAdmin,
  UpdateFieldPayload,
  FieldType,
} from '@/features/forms/types/form.types';
import { ROUTES } from '@/shared/constants/routes';
import { DEFAULT_LABELS } from '../components/form-builder/fieldLibraryConfig';
import { FormBreadcrumb } from '../components/form-builder/shared/FormBreadcrumb';
import { SectionFieldRow } from '../components/form-builder/section-editor/SectionFieldRow';
import { FieldTypePickerModal } from '../components/form-builder/section-editor/FieldTypePickerModal';
import { FieldSettingsPanel } from '../components/form-builder/field-settings/FieldSettingsPanel';
import type { OptionDraft } from '../components/form-builder/OptionsEditor';

const pageEntry = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

const staggerContainer = {
  visible: { transition: { staggerChildren: 0.04 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.16 } },
};

export function SectionFieldEditorPage() {
  const { formId, sectionId } = useParams<{ formId: string; sectionId: string }>();
  const fid = parseInt(formId ?? '0', 10);
  const sid = parseInt(sectionId ?? '0', 10);

  const [def, setDef]                         = useState<FormDefinitionDetail | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  const [retryKey, setRetryKey]               = useState(0);

  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [fieldSaving, setFieldSaving]         = useState(false);
  const [fieldSaveError, setFieldSaveError]   = useState<string | null>(null);
  const [actionLoading, setActionLoading]     = useState<string | null>(null);

  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const [confirmDelete, setConfirmDelete]     = useState<{ id: number; sectionId: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);

  // Derived values
  const section    = def?.sections.find((s) => s.id === sid) ?? null;
  const fields     = section?.fields ?? [];
  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  const isEditable = def?.is_editable ?? false;

  const loadDef = useCallback(async () => {
    if (!fid || isNaN(fid) || !sid || isNaN(sid)) {
      setError('Invalid URL. Please navigate from the Form Builder.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await getFormDefinition(fid);
      const targetSection = detail.sections.find((s) => s.id === sid);
      if (!targetSection) {
        setError('Section not found. It may have been deleted.');
        setDef(detail);
        return;
      }
      setDef(detail);
    } catch {
      setError('Failed to load section. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fid, sid, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDef(); }, [loadDef]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedFieldId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Field actions ─────────────────────────────────────────────────────────

  async function handleAddField(type: FieldType) {
    if (!def) return;
    const label    = DEFAULT_LABELS[type] ?? 'New Field';
    const fieldKey = `${type}_${Date.now()}`;
    setActionLoading('adding');
    try {
      const created = await createField(sid, {
        field_type: type,
        label,
        field_key: fieldKey,
        width: 'full',
      });
      await loadDef();
      setSelectedFieldId(created.id);
    } catch {
      setError('Failed to add field. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSaveField(sectionId: number, fieldId: number, payload: UpdateFieldPayload) {
    setFieldSaving(true);
    setFieldSaveError(null);
    try {
      await updateField(sectionId, fieldId, payload);
      await loadDef();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setFieldSaveError(msg);
      throw err;
    } finally {
      setFieldSaving(false);
    }
  }

  async function handleSaveOptions(fieldId: number, options: OptionDraft[]) {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    setFieldSaving(true);
    try {
      // Build a working copy of server options to track what still exists after deletes
      const serverOptions = [...field.options];

      // 1. Delete options that no longer appear in the draft (matched by value, not position)
      for (const existing of serverOptions) {
        const stillPresent = options.some((o) => o.value === existing.value);
        if (!stillPresent) await deleteOption(fieldId, existing.id);
      }

      // 2. Remaining server options after deletes (same value match)
      const remainingServer = serverOptions.filter((existing) =>
        options.some((o) => o.value === existing.value)
      );

      // 3. Create or update by matching on value
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const matched = remainingServer.find((s) => s.value === opt.value);
        if (matched) {
          if (opt.label !== matched.label || i !== matched.sort_order) {
            await updateOption(fieldId, matched.id, { label: opt.label, value: opt.value, sort_order: i });
          }
        } else {
          await createOption(fieldId, { label: opt.label, value: opt.value, sort_order: i });
        }
      }
      await loadDef();
    } catch {
      setFieldSaveError('Failed to save options. Please try again.');
    } finally {
      setFieldSaving(false);
    }
  }

  async function handleToggleFieldActive(field: FormFieldAdmin) {
    if (field.is_active) await deactivateField(field.id);
    else await activateField(field.id);
    await loadDef();
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      await deleteField(confirmDelete.sectionId, confirmDelete.id);
      if (selectedFieldId === confirmDelete.id) setSelectedFieldId(null);
      await loadDef();
    } finally {
      setDeleteLoading(false);
      setConfirmDelete(null);
    }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  async function handleDragEnd(result: DropResult) {
    if (!result.destination || !isEditable) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const originalFields = [...fields];
    const ids = fields.map((f) => f.id);
    const [moved] = ids.splice(source.index, 1);
    ids.splice(destination.index, 0, moved);

    // Optimistic reorder
    const reordered = ids.map((id, i) => {
      const f = fields.find((field) => field.id === id)!;
      return { ...f, sort_order: i };
    });
    setDef((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sid ? { ...s, fields: reordered } : s
        ),
      };
    });

    try {
      await reorderFields(sid, ids);
      await loadDef();
    } catch {
      // Roll back to original order on failure
      setDef((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sid ? { ...s, fields: originalFields } : s
          ),
        };
      });
      setError('Failed to reorder fields. Please try again.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const defName     = def?.name ?? '…';
  const sectionName = section?.title ?? '…';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] flex-shrink-0">
        <FormBreadcrumb
          items={[
            { label: 'Form Builder', to: ROUTES.SUPER_ADMIN_FORM_BUILDER },
            { label: defName, to: ROUTES.SUPER_ADMIN_FORM_STRUCTURE(fid) },
            { label: sectionName },
          ]}
        />
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-lg font-bold text-[var(--card-foreground)]" style={{ fontFamily: 'var(--font-headline)' }}>
              {sectionName}
            </h1>
            {section && (
              <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                {section.field_count} {section.field_count === 1 ? 'field' : 'fields'}
                {section.description && ` · ${section.description}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isEditable && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] px-2.5 py-1.5 rounded-lg">
                <Lock size={11} /> Read-only
              </span>
            )}
            {isEditable && (
              <button
                type="button"
                onClick={() => setShowFieldPicker(true)}
                disabled={actionLoading === 'adding'}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                <Plus size={14} />
                {actionLoading === 'adding' ? 'Adding…' : 'Add Field'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content: field list + settings panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Field list */}
        <motion.div
          variants={pageEntry}
          initial="hidden"
          animate="visible"
          className="flex-1 overflow-y-auto px-6 py-5"
        >
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
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-[var(--card)] border border-[var(--border)] rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {/* Field rows */}
          {!loading && section && (
            <>
              {fields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    No fields in this section yet.
                  </p>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => setShowFieldPicker(true)}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 transition-opacity"
                    >
                      <Plus size={14} /> Add First Field
                    </button>
                  )}
                </div>
              )}

              {fields.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId={`section-${sid}`}>
                    {(droppableProvided) => (
                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        ref={droppableProvided.innerRef}
                        {...droppableProvided.droppableProps}
                        className="space-y-2"
                      >
                        {fields.map((field, index) => (
                          <Draggable
                            key={field.id}
                            draggableId={`field-${field.id}`}
                            index={index}
                            isDragDisabled={!isEditable}
                          >
                            {(draggableProvided, snapshot) => (
                              <motion.div variants={staggerChild}>
                                <SectionFieldRow
                                  field={field}
                                  isSelected={selectedFieldId === field.id}
                                  isEditable={isEditable}
                                  provided={draggableProvided}
                                  isDragging={snapshot.isDragging}
                                  onSelect={() => setSelectedFieldId(field.id)}
                                  onToggleActive={() => handleToggleFieldActive(field)}
                                  onDelete={() =>
                                    setConfirmDelete({ id: field.id, sectionId: sid, name: field.label })
                                  }
                                />
                              </motion.div>
                            )}
                          </Draggable>
                        ))}
                        {droppableProvided.placeholder}
                      </motion.div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Add field button at bottom of list */}
              {isEditable && fields.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFieldPicker(true)}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-sm text-[var(--muted-foreground)] border-2 border-dashed border-[var(--border)] rounded-xl hover:text-[var(--ember-orange)] hover:border-[var(--ember-orange)] transition-colors"
                >
                  <Plus size={15} /> Add Field
                </button>
              )}
            </>
          )}
        </motion.div>

        {/* Field Settings Panel (slide-in) */}
        <AnimatePresence>
          {selectedFieldId !== null && selectedField && section && (
            <FieldSettingsPanel
              key={selectedFieldId}
              field={selectedField}
              section={section}
              allSectionFields={fields}
              isEditable={isEditable}
              saving={fieldSaving}
              saveError={fieldSaveError}
              onClose={() => setSelectedFieldId(null)}
              onSave={handleSaveField}
              onDelete={(fieldId) =>
                setConfirmDelete({ id: fieldId, sectionId: sid, name: selectedField.label })
              }
              onSaveOptions={handleSaveOptions}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Field type picker modal */}
      {showFieldPicker && (
        <FieldTypePickerModal
          onSelect={handleAddField}
          onClose={() => setShowFieldPicker(false)}
        />
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-semibold text-[var(--card-foreground)]">Delete Field?</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  "{confirmDelete.name}" will be permanently deleted. This cannot be undone.
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
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
