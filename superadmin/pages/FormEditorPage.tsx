/**
 * FormEditorPage — Unified 3-panel Form Builder
 *
 * Replaces the multi-screen workflow (FormStructurePage + SectionFieldEditorPage)
 * with a professional three-panel interface:
 *
 *   Left  (256px) — Section Manager: all sections listed, expandable, drag-to-reorder
 *   Center (flex) — Form Canvas: visual form with all sections + fields, click to select
 *   Right  (320px) — Field Settings: appears for selected field, empty state otherwise
 *
 * Route: /super-admin/form-builder/:formId
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle, Plus, Upload, History,
  Monitor, Tablet, Smartphone,
  GripVertical, ChevronDown, ChevronRight,
  Eye, EyeOff, Pencil, Trash2,
  Lock, Layers,
} from 'lucide-react';
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
  FormDefinitionListItem,
  FormSectionAdmin,
  FormFieldAdmin,
  CreateSectionPayload,
  UpdateSectionPayload,
  UpdateFieldPayload,
  FieldType,
  FieldWidth,
} from '@/features/forms/types/form.types';
import { ROUTES } from '@/shared/constants/routes';
import { FIELD_LIBRARY, DEFAULT_LABELS, type FieldLibraryConfig } from '../components/form-builder/fieldLibraryConfig';
import { FormBreadcrumb } from '../components/form-builder/shared/FormBreadcrumb';
import { StatusBadge } from '../components/form-builder/shared/StatusBadge';
import { SectionInlineEditor } from '../components/form-builder/section-manager/SectionInlineEditor';
import { FieldTypePickerModal } from '../components/form-builder/section-editor/FieldTypePickerModal';
import { FieldSettingsPanel } from '../components/form-builder/field-settings/FieldSettingsPanel';
import { VersionHistoryDrawer } from '../components/form-builder/version-history/VersionHistoryDrawer';
import { PreviewModeOverlay } from '../components/form-builder/preview/PreviewModeOverlay';
import type { OptionDraft } from '../components/form-builder/OptionsEditor';

type PreviewMode = 'off' | 'desktop' | 'tablet' | 'mobile';

// ── Field type → display config lookup ──────────────────────────────────────
const FIELD_CONFIG_MAP = new Map<FieldType, FieldLibraryConfig>(
  FIELD_LIBRARY.map((f) => [f.type, f])
);

// ── Group color schemes ──────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  input:          'bg-blue-50 text-blue-700 border border-blue-200',
  choice:         'bg-purple-50 text-purple-700 border border-purple-200',
  upload_special: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  layout:         'bg-gray-100 text-gray-600 border border-gray-200',
};

// ── Width pill ───────────────────────────────────────────────────────────────
function WidthPill({ width }: { width: FieldWidth }) {
  const label = { full: 'Full', half: 'Half', third: 'Third' }[width] ?? width;
  return (
    <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)] font-medium">
      {label}
    </span>
  );
}

// ── Helper: find field + section from the full definition ────────────────────
function findFieldAndSection(
  def: FormDefinitionDetail,
  fieldId: number | null
): { field: FormFieldAdmin | null; section: FormSectionAdmin | null } {
  if (!fieldId) return { field: null, section: null };
  for (const sec of def.sections) {
    const f = sec.fields.find((field) => field.id === fieldId);
    if (f) return { field: f, section: sec };
  }
  return { field: null, section: null };
}

// ── Canvas field card ────────────────────────────────────────────────────────
interface CanvasFieldCardProps {
  field: FormFieldAdmin;
  isSelected: boolean;
  isEditable: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provided: any;
  isDragging: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function CanvasFieldCard({
  field, isSelected, isEditable, provided, isDragging,
  onSelect, onToggleActive, onDelete,
}: CanvasFieldCardProps) {
  const config = FIELD_CONFIG_MAP.get(field.field_type);
  const Icon = config?.icon;
  const groupColor = GROUP_COLORS[config?.group ?? 'input'];

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={[
        'group relative flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer select-none',
        'transition-all duration-100',
        isSelected
          ? 'border-[var(--ember-orange)] bg-[var(--ember-orange)]/5 shadow-sm ring-1 ring-[var(--ember-orange)]/20'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--ember-orange)]/40 hover:shadow-sm',
        !field.is_active ? 'opacity-50' : '',
        isDragging ? 'shadow-lg ring-2 ring-[var(--ember-orange)]/30' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Drag handle */}
      {isEditable ? (
        <div
          {...provided.dragHandleProps}
          role="button"
          tabIndex={0}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--card-foreground)]"
        >
          <GripVertical size={14} />
        </div>
      ) : (
        <div className="w-3.5 flex-shrink-0" />
      )}

      {/* Type badge */}
      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium flex-shrink-0 ${groupColor}`}>
        {Icon && <Icon size={10} />}
        {config?.label ?? field.field_type}
      </span>

      {/* Label */}
      <span className="flex-1 text-sm font-medium text-[var(--card-foreground)] truncate min-w-0">
        {field.label}
        {field.is_required && <span className="text-red-500 ml-1 font-normal text-xs">*</span>}
      </span>

      {/* Width pill */}
      <WidthPill width={field.width} />

      {/* Hover action buttons — positioned over the right edge */}
      {isEditable && (
        <div
          role="toolbar"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity bg-[var(--card)] pl-2"
        >
          <button
            type="button"
            onClick={onToggleActive}
            title={field.is_active ? 'Hide field' : 'Show field'}
            className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            {field.is_active ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete field"
            className="p-1 rounded text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Left panel section item ───────────────────────────────────────────────────
interface LeftPanelSectionItemProps {
  section: FormSectionAdmin;
  isExpanded: boolean;
  isEditable: boolean;
  isDragging: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragHandleProps: any;
  selectedFieldId: number | null;
  onToggleExpand: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onAddField: () => void;
  onSelectField: (fieldId: number) => void;
}

function LeftPanelSectionItem({
  section, isExpanded, isEditable, isDragging, dragHandleProps,
  selectedFieldId, onToggleExpand, onEdit, onToggleActive, onDelete,
  onAddField, onSelectField,
}: LeftPanelSectionItemProps) {
  return (
    <div className={`rounded-lg overflow-hidden ${isDragging ? 'ring-2 ring-[var(--ember-orange)] shadow-md' : ''}`}>
      {/* Section header row */}
      <div
        role="button"
        tabIndex={0}
        className={[
          'group flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer',
          'hover:bg-[var(--dash-nav-hover-bg)] transition-colors',
          !section.is_active ? 'opacity-60' : '',
        ].join(' ')}
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggleExpand(); }}
      >
        {/* Drag handle */}
        {isEditable && (
          <div
            {...dragHandleProps}
            role="button"
            tabIndex={0}
            aria-label="Drag to reorder section"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical size={12} />
          </div>
        )}

        {/* Expand chevron */}
        <span className="flex-shrink-0 text-[var(--muted-foreground)]">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        {/* Title */}
        <span className="flex-1 text-xs font-semibold text-[var(--card-foreground)] truncate min-w-0">
          {section.title}
        </span>

        {/* Field count badge */}
        <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--background)] px-1.5 py-0.5 rounded-full border border-[var(--border)] flex-shrink-0">
          {section.field_count}
        </span>

        {/* Action buttons (hover reveal) */}
        {isEditable && (
          <div
            role="toolbar"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <button
              type="button"
              onClick={onToggleActive}
              className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--background)] transition-colors"
            >
              {section.is_active ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--background)] transition-colors"
            >
              <Pencil size={11} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>

      {/* Expanded: field name list */}
      {isExpanded && (
        <div className="pl-7 pr-2 pb-1.5 space-y-0.5">
          {section.fields.map((field) => (
            <button
              key={field.id}
              type="button"
              onClick={() => onSelectField(field.id)}
              className={[
                'w-full text-left text-[11px] px-2 py-1 rounded-md truncate transition-colors',
                selectedFieldId === field.id
                  ? 'bg-[var(--ember-orange)]/10 text-[var(--ember-orange)] font-medium'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)]',
                !field.is_active ? 'opacity-50' : '',
              ].join(' ')}
            >
              {field.label}
            </button>
          ))}
          {section.fields.length === 0 && (
            <p className="text-[11px] text-[var(--muted-foreground)] px-2 py-1 italic">No fields yet</p>
          )}
          {isEditable && (
            <button
              type="button"
              onClick={onAddField}
              className="w-full text-left text-[11px] px-2 py-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--ember-orange)] transition-colors flex items-center gap-1"
            >
              <Plus size={10} /> Add field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Animation variants ───────────────────────────────────────────────────────
const pageEntry = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

// ── Delete confirm dialog ────────────────────────────────────────────────────
interface DeleteDialogProps {
  title: string;
  body: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialog({ title, body, loading, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-[var(--card-foreground)]">{title}</h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">{body}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function FormEditorPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPortal = location.pathname.startsWith('/admin');
  const formBuilderRoute = isAdminPortal ? ROUTES.ADMIN_FORM_BUILDER : ROUTES.SUPER_ADMIN_FORM_BUILDER;
  const formStructureRoute = isAdminPortal ? ROUTES.ADMIN_FORM_STRUCTURE : ROUTES.SUPER_ADMIN_FORM_STRUCTURE;
  const id = parseInt(formId ?? '0', 10);

  // Core data
  const [def, setDef]           = useState<FormDefinitionDetail | null>(null);
  const [definitions, setDefs]  = useState<FormDefinitionListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Field selection & settings panel
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [fieldSaving, setFieldSaving]         = useState(false);
  const [fieldSaveError, setFieldSaveError]   = useState<string | null>(null);

  // Left panel expand/collapse state
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  // Section editing
  const [showAddSection, setShowAddSection]     = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);

  // Field picker: tracks which section to add the field into
  const [showFieldPicker, setShowFieldPicker] = useState<{ sectionId: number } | null>(null);

  // Delete confirmations
  const [confirmDeleteField, setConfirmDeleteField]     = useState<{ id: number; sectionId: number; name: string } | null>(null);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading]               = useState(false);

  // Preview & version history
  const [previewMode, setPreviewMode]               = useState<PreviewMode>('off');
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const isEditable = def?.is_editable ?? false;

  // Derived: selected field + its parent section
  const { field: selectedField, section: selectedSection } = def
    ? findFieldAndSection(def, selectedFieldId)
    : { field: null, section: null };
  const allSectionFields = selectedSection?.fields ?? [];

  // ── Data loading ───────────────────────────────────────────────────────────
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
      setDefs(allDefs);
      // Auto-expand first section on initial load
      setExpandedSections((prev) => {
        if (prev.size === 0 && detail.sections.length > 0) {
          return new Set([detail.sections[0].id]);
        }
        return prev;
      });
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
        if (previewMode !== 'off')    { setPreviewMode('off'); return; }
        if (showVersionHistory)       { setShowVersionHistory(false); return; }
        if (selectedFieldId !== null) { setSelectedFieldId(null); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewMode, showVersionHistory, selectedFieldId]);

  // ── Left panel helpers ─────────────────────────────────────────────────────
  function toggleExpanded(sectionId: number) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // ── Section actions ────────────────────────────────────────────────────────
  async function handleAddSection(data: CreateSectionPayload) {
    if (!def) return;
    const created = await createSection(def.id, data);
    setShowAddSection(false);
    await loadDef();
    // Auto-expand the new section
    setExpandedSections((prev) => new Set([...prev, created.id]));
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

  async function handleConfirmDeleteSection() {
    if (!confirmDeleteSection || !def) return;
    setDeleteLoading(true);
    try {
      await deleteSection(def.id, confirmDeleteSection.id);
      await loadDef();
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteSection(null);
    }
  }

  // ── Field actions ──────────────────────────────────────────────────────────
  async function handleAddField(type: FieldType) {
    if (!showFieldPicker) return;
    const { sectionId } = showFieldPicker;
    setShowFieldPicker(null);
    const label    = DEFAULT_LABELS[type] ?? 'New Field';
    const fieldKey = `${type}_${Date.now()}`;
    setActionLoading('adding');
    try {
      const created = await createField(sectionId, {
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
    if (!def) return;
    let field: FormFieldAdmin | undefined;
    for (const sec of def.sections) {
      field = sec.fields.find((f) => f.id === fieldId);
      if (field) break;
    }
    if (!field) return;

    setFieldSaving(true);
    try {
      const serverOptions = [...field.options];
      // Remove options that are no longer in the draft
      for (const existing of serverOptions) {
        if (!options.some((o) => o.value === existing.value)) {
          await deleteOption(fieldId, existing.id);
        }
      }
      const remainingServer = serverOptions.filter((existing) =>
        options.some((o) => o.value === existing.value)
      );
      // Create or update
      for (let i = 0; i < options.length; i++) {
        const opt     = options[i];
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

  async function handleConfirmDeleteField() {
    if (!confirmDeleteField) return;
    setDeleteLoading(true);
    try {
      await deleteField(confirmDeleteField.sectionId, confirmDeleteField.id);
      if (selectedFieldId === confirmDeleteField.id) setSelectedFieldId(null);
      await loadDef();
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteField(null);
    }
  }

  // ── Form-level actions ─────────────────────────────────────────────────────
  async function handlePublish() {
    if (!def) return;
    setActionLoading('publish');
    try {
      await publishFormDefinition(def.id);
      await loadDef();
    } catch {
      setError('Failed to publish. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDuplicate(defId: number) {
    setActionLoading(`dup-${defId}`);
    try {
      const newDef = await duplicateFormDefinition(defId);
      navigate(formStructureRoute(newDef.id));
    } finally {
      setActionLoading(null);
    }
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────
  async function handleDragEnd(result: DropResult) {
    if (!result.destination || !def || !isEditable) return;
    const { source, destination } = result;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    // Section reorder (left panel)
    if (destination.droppableId === 'sections') {
      const originalSections = def.sections;
      const ids = def.sections.map((s) => s.id);
      const [moved] = ids.splice(source.index, 1);
      ids.splice(destination.index, 0, moved);
      // Optimistic update
      setDef({
        ...def,
        sections: ids.map((sid, i) => ({ ...def.sections.find((s) => s.id === sid)!, sort_order: i })),
      });
      try {
        await reorderSections(def.id, ids);
      } catch {
        setDef({ ...def, sections: originalSections });
        setError('Failed to reorder sections. Please try again.');
      }
      return;
    }

    // Field reorder within a section (center canvas)
    if (
      destination.droppableId.startsWith('fields-') &&
      source.droppableId === destination.droppableId
    ) {
      const sectionId = parseInt(destination.droppableId.replace('fields-', ''), 10);
      const section   = def.sections.find((s) => s.id === sectionId);
      if (!section) return;

      const originalFields = [...section.fields];
      const ids = section.fields.map((f) => f.id);
      const [moved] = ids.splice(source.index, 1);
      ids.splice(destination.index, 0, moved);
      // Optimistic update
      setDef({
        ...def,
        sections: def.sections.map((s) =>
          s.id === sectionId
            ? { ...s, fields: ids.map((fid, i) => ({ ...s.fields.find((f) => f.id === fid)!, sort_order: i })) }
            : s
        ),
      });
      try {
        await reorderFields(sectionId, ids);
        await loadDef();
      } catch {
        setDef({
          ...def,
          sections: def.sections.map((s) =>
            s.id === sectionId ? { ...s, fields: originalFields } : s
          ),
        });
        setError('Failed to reorder fields. Please try again.');
      }
      return;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden relative">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--border)] bg-[var(--card)]">
        <FormBreadcrumb
          items={[
            { label: 'Form Builder', to: formBuilderRoute },
            { label: def?.name ?? '…' },
          ]}
        />
        {def && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1
                className="text-lg font-bold text-[var(--card-foreground)] truncate"
                style={{ fontFamily: 'var(--font-headline)' }}
              >
                {def.name}
              </h1>
              <StatusBadge status={def.status} />
              {!isEditable && (
                <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] bg-[var(--background)] border border-[var(--border)] px-2 py-1 rounded-lg">
                  <Lock size={10} /> Read-only
                </span>
              )}
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Device preview picker */}
              <div className="flex items-center rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden">
                {(['desktop', 'tablet', 'mobile'] as const).map((m) => {
                  const Icon = m === 'desktop' ? Monitor : m === 'tablet' ? Tablet : Smartphone;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPreviewMode(m)}
                      title={`Preview — ${m}`}
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
                title="Version history"
                className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
              >
                <History size={14} />
              </button>

              {isEditable && (
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={actionLoading === 'publish'}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  <Upload size={13} />
                  {actionLoading === 'publish' ? 'Publishing…' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex-shrink-0 mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle size={15} />
          {error}
          <button
            className="ml-auto text-xs underline"
            onClick={() => { setError(null); setRetryKey((k) => k + 1); }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-8 w-48 bg-[var(--card)] border border-[var(--border)] rounded-lg animate-pulse mx-auto" />
            <div className="h-4 w-32 bg-[var(--card)] border border-[var(--border)] rounded animate-pulse mx-auto" />
          </div>
        </div>
      )}

      {/* ── Three-panel editor ─────────────────────────────────────────────────── */}
      {!loading && def && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <motion.div
            variants={pageEntry}
            initial="hidden"
            animate="visible"
            className="flex flex-1 min-h-0 overflow-hidden relative"
          >

            {/* ══ LEFT PANEL: Section Manager ═══════════════════════════════════ */}
            <div className="w-64 flex-shrink-0 flex flex-col border-r border-[var(--border)] bg-[var(--background)] overflow-hidden">

              {/* Panel header */}
              <div className="flex-shrink-0 px-3 py-3 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-[var(--muted-foreground)]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    Sections
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-1.5 py-0.5 rounded-full">
                    {def.sections.length}
                  </span>
                </div>
                {isEditable && (
                  <button
                    type="button"
                    onClick={() => { setEditingSectionId(null); setShowAddSection(true); }}
                    className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--ember-orange)] transition-colors"
                  >
                    <Plus size={13} /> Add
                  </button>
                )}
              </div>

              {/* Scrollable section list */}
              <div className="flex-1 overflow-y-auto py-2 px-2">
                <Droppable droppableId="sections" isDropDisabled={!isEditable}>
                  {(droppableProvided) => (
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="space-y-0.5"
                    >
                      {def.sections.map((section, index) => (
                        <Draggable
                          key={section.id}
                          draggableId={`sec-${section.id}`}
                          index={index}
                          isDragDisabled={!isEditable}
                        >
                          {(draggableProvided, snapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                            >
                              {editingSectionId === section.id ? (
                                <div className="mb-1">
                                  <SectionInlineEditor
                                    section={section}
                                    onSave={(data) => handleEditSection(section.id, data)}
                                    onCancel={() => setEditingSectionId(null)}
                                  />
                                </div>
                              ) : (
                                <LeftPanelSectionItem
                                  section={section}
                                  isExpanded={expandedSections.has(section.id)}
                                  isEditable={isEditable}
                                  isDragging={snapshot.isDragging}
                                  dragHandleProps={draggableProvided.dragHandleProps}
                                  selectedFieldId={selectedFieldId}
                                  onToggleExpand={() => toggleExpanded(section.id)}
                                  onEdit={() => {
                                    setShowAddSection(false);
                                    setEditingSectionId(section.id);
                                  }}
                                  onToggleActive={() => handleToggleSection(section)}
                                  onDelete={() =>
                                    setConfirmDeleteSection({ id: section.id, name: section.title })
                                  }
                                  onAddField={() => {
                                    setExpandedSections((prev) => new Set([...prev, section.id]));
                                    setShowFieldPicker({ sectionId: section.id });
                                  }}
                                  onSelectField={(fid) => setSelectedFieldId(fid)}
                                />
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}
                    </div>
                  )}
                </Droppable>

                {/* Add section inline editor */}
                {showAddSection && (
                  <div className="mt-1">
                    <SectionInlineEditor
                      onSave={handleAddSection}
                      onCancel={() => setShowAddSection(false)}
                    />
                  </div>
                )}

                {/* Add section dashed button */}
                {isEditable && !showAddSection && (
                  <button
                    type="button"
                    onClick={() => { setEditingSectionId(null); setShowAddSection(true); }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-lg hover:text-[var(--ember-orange)] hover:border-[var(--ember-orange)] transition-colors"
                  >
                    <Plus size={12} /> Add Section
                  </button>
                )}

                {/* Empty state */}
                {def.sections.length === 0 && !showAddSection && (
                  <p className="text-[11px] text-[var(--muted-foreground)] text-center py-8 px-3 leading-relaxed">
                    No sections yet.
                    {isEditable && <><br />Click <strong>Add</strong> to create one.</>}
                  </p>
                )}
              </div>
            </div>

            {/* ══ CENTER PANEL: Form Canvas ═════════════════════════════════════ */}
            <div className="flex-1 overflow-y-auto bg-[var(--background)]">

              {/* Empty state */}
              {def.sections.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--card)] border border-[var(--border)] flex items-center justify-center mb-4">
                    <Layers size={24} className="text-[var(--muted-foreground)]" />
                  </div>
                  <h2 className="text-base font-semibold text-[var(--card-foreground)] mb-1">
                    Form canvas is empty
                  </h2>
                  <p className="text-sm text-[var(--muted-foreground)] max-w-xs">
                    Add a section using the left panel to start building your form.
                  </p>
                </div>
              )}

              {/* Section cards */}
              {def.sections.length > 0 && (
                <div className="max-w-3xl mx-auto py-6 px-6 space-y-5">
                  {def.sections.map((section) => (
                    <div
                      key={section.id}
                      className={`bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden transition-opacity ${
                        !section.is_active ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Section header */}
                      <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2
                              className="text-sm font-bold text-[var(--card-foreground)] uppercase tracking-wide"
                              style={{ fontFamily: 'var(--font-headline)' }}
                            >
                              {section.title}
                            </h2>
                            {!section.is_active && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                                Hidden
                              </span>
                            )}
                          </div>
                          {section.description && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                              {section.description}
                            </p>
                          )}
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                            {section.field_count} {section.field_count === 1 ? 'field' : 'fields'}
                          </p>
                        </div>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => setShowFieldPicker({ sectionId: section.id })}
                            disabled={actionLoading === 'adding'}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-60 transition-opacity flex-shrink-0"
                          >
                            <Plus size={12} /> Add Field
                          </button>
                        )}
                      </div>

                      {/* Fields droppable area */}
                      <Droppable droppableId={`fields-${section.id}`} isDropDisabled={!isEditable}>
                        {(droppableProvided, droppableSnapshot) => (
                          <div
                            ref={droppableProvided.innerRef}
                            {...droppableProvided.droppableProps}
                            className={`px-4 py-3 space-y-2 min-h-[56px] transition-colors ${
                              droppableSnapshot.isDraggingOver ? 'bg-[var(--ember-orange)]/3' : ''
                            }`}
                          >
                            {section.fields.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-5 text-center">
                                <p className="text-xs text-[var(--muted-foreground)]">
                                  No fields in this section.
                                </p>
                                {isEditable && (
                                  <button
                                    type="button"
                                    onClick={() => setShowFieldPicker({ sectionId: section.id })}
                                    className="mt-2 text-xs text-[var(--ember-orange)] hover:underline"
                                  >
                                    + Add your first field
                                  </button>
                                )}
                              </div>
                            )}

                            {section.fields.map((field, index) => (
                              <Draggable
                                key={field.id}
                                draggableId={`field-${field.id}`}
                                index={index}
                                isDragDisabled={!isEditable}
                              >
                                {(draggableProvided, snapshot) => (
                                  <CanvasFieldCard
                                    field={field}
                                    isSelected={selectedFieldId === field.id}
                                    isEditable={isEditable}
                                    provided={draggableProvided}
                                    isDragging={snapshot.isDragging}
                                    onSelect={() => setSelectedFieldId(field.id)}
                                    onToggleActive={() => handleToggleFieldActive(field)}
                                    onDelete={() =>
                                      setConfirmDeleteField({
                                        id: field.id,
                                        sectionId: section.id,
                                        name: field.label,
                                      })
                                    }
                                  />
                                )}
                              </Draggable>
                            ))}

                            {droppableProvided.placeholder}

                            {/* Inline add field button at bottom of non-empty sections */}
                            {isEditable && section.fields.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowFieldPicker({ sectionId: section.id })}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-[var(--muted-foreground)] border border-dashed border-[var(--border)] rounded-xl hover:text-[var(--ember-orange)] hover:border-[var(--ember-orange)] transition-colors mt-1"
                              >
                                <Plus size={12} /> Add Field
                              </button>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ══ RIGHT PANEL: Field Settings ══════════════════════════════════ */}
            <FieldSettingsPanel
              field={selectedField}
              section={selectedSection}
              allSectionFields={allSectionFields}
              isEditable={isEditable}
              saving={fieldSaving}
              saveError={fieldSaveError}
              onClose={() => setSelectedFieldId(null)}
              onSave={handleSaveField}
              onDelete={(fieldId) =>
                setConfirmDeleteField({
                  id: fieldId,
                  sectionId: selectedSection?.id ?? 0,
                  name: selectedField?.label ?? '',
                })
              }
              onSaveOptions={handleSaveOptions}
            />
          </motion.div>
        </DragDropContext>
      )}

      {/* ── Field type picker modal ──────────────────────────────────────────── */}
      {showFieldPicker && (
        <FieldTypePickerModal
          onSelect={handleAddField}
          onClose={() => setShowFieldPicker(null)}
        />
      )}

      {/* ── Delete field dialog ──────────────────────────────────────────────── */}
      {confirmDeleteField && (
        <DeleteDialog
          title="Delete Field?"
          body={`"${confirmDeleteField.name}" will be permanently deleted. This cannot be undone.`}
          loading={deleteLoading}
          onConfirm={handleConfirmDeleteField}
          onCancel={() => setConfirmDeleteField(null)}
        />
      )}

      {/* ── Delete section dialog ────────────────────────────────────────────── */}
      {confirmDeleteSection && (
        <DeleteDialog
          title="Delete Section?"
          body={`"${confirmDeleteSection.name}" and all its fields will be permanently deleted.`}
          loading={deleteLoading}
          onConfirm={handleConfirmDeleteSection}
          onCancel={() => setConfirmDeleteSection(null)}
        />
      )}

      {/* ── Version history drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showVersionHistory && (
          <VersionHistoryDrawer
            definitions={definitions}
            selectedId={def?.id ?? null}
            actionLoading={actionLoading}
            onClose={() => setShowVersionHistory(false)}
            onSelect={(did) => {
              navigate(formStructureRoute(did));
              setShowVersionHistory(false);
            }}
            onDuplicate={handleDuplicate}
          />
        )}
      </AnimatePresence>

      {/* ── Preview overlay ──────────────────────────────────────────────────── */}
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
