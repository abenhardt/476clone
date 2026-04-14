/**
 * FieldSettingsPanel — Panel 4 of the Form Builder.
 *
 * Appears on the right when a field is selected on the canvas.
 * Provides inline editing of all field properties with auto-save on blur.
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FormFieldAdmin, FormSectionAdmin, UpdateFieldPayload, FieldWidth } from '@/features/forms/types/form.types';
import { OptionsEditor, type OptionDraft } from '../OptionsEditor';
import { FieldKeyInput } from './FieldKeyInput';
import { WidthSelector } from '../shared/WidthSelector';
import { RequiredToggle } from '../shared/RequiredToggle';
import { ConditionalLogicPanel } from './ConditionalLogicPanel';
import { ValidationRulesPanel } from './ValidationRulesPanel';
import { OPTION_TYPES } from '../fieldLibraryConfig';

interface FieldSettingsPanelProps {
  field: FormFieldAdmin | null;
  section: FormSectionAdmin | null;
  allSectionFields: FormFieldAdmin[];
  isEditable: boolean;
  saving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSave: (sectionId: number, fieldId: number, payload: UpdateFieldPayload) => Promise<void>;
  onDelete: (fieldId: number) => void;
  onSaveOptions: (fieldId: number, options: OptionDraft[]) => Promise<void>;
}

function inputClass(error?: string) {
  return `w-full px-3 py-2 text-sm border rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 ${
    error
      ? 'border-red-400 focus:ring-red-400'
      : 'border-[var(--border)] focus:ring-[var(--ember-orange)]'
  }`;
}

export function FieldSettingsPanel({
  field, section, allSectionFields, isEditable, saving, saveError,
  onClose, onSave, onDelete, onSaveOptions,
}: FieldSettingsPanelProps) {
  // Local edit state — buffered until blur
  const [label, setLabel]           = useState('');
  const [fieldKey, setFieldKey]     = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [helpText, setHelpText]     = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [width, setWidth]           = useState<FieldWidth>('full');
  const [options, setOptions]       = useState<OptionDraft[]>([]);
  const [conditional, setConditional] = useState<{ show_if: { field_key: string; equals: unknown } } | null>(null);
  const [validation, setValidation] = useState<Record<string, unknown> | null>(null);
  const [fieldKeyError, setFieldKeyError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local state when field changes
  useEffect(() => {
    if (!field) return;
    setLabel(field.label);
    setFieldKey(field.field_key);
    setPlaceholder(field.placeholder ?? '');
    setHelpText(field.help_text ?? '');
    setIsRequired(field.is_required);
    setWidth(field.width);
    setOptions(field.options.map((o) => ({ label: o.label, value: o.value })));
    setConditional(field.conditional_logic);
    setValidation(field.validation_rules);
    setConfirmDelete(false);
    setFieldKeyError('');
  }, [field?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveField = useCallback(async (payload: UpdateFieldPayload) => {
    if (!field || !section || !isEditable) return;
    try {
      await onSave(section.id, field.id, payload);
      setFieldKeyError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('key')) {
        setFieldKeyError('This key is referenced by existing applications and cannot be changed.');
        setFieldKey(field.field_key); // revert
      }
    }
  }, [field, section, isEditable, onSave]);

  const hasOptions = field ? OPTION_TYPES.includes(field.field_type) : false;

  if (!field) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`settings-${field.id}`}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.18 }}
        className="absolute right-0 top-0 bottom-0 w-96 flex flex-col bg-[var(--card)] border-l border-[var(--border)] overflow-hidden shadow-xl z-20"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Field Settings
            </p>
            <p className="text-sm font-medium text-[var(--card-foreground)] truncate mt-0.5">
              {field.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-[var(--muted-foreground)] hover:text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Save status */}
        {(saving || saveError) && (
          <div className={`px-4 py-1.5 text-xs ${saveError ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
            {saving ? 'Saving…' : saveError}
          </div>
        )}

        {/* Settings form */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Field type (read-only badge) */}
          <div>
            <span className="text-xs font-medium text-[var(--muted-foreground)]">Field Type</span>
            <div className="mt-1">
              <span className="inline-block px-2 py-1 text-xs font-mono rounded border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]">
                {field.field_type}
              </span>
            </div>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label htmlFor="fsp-label" className="text-xs font-medium text-[var(--muted-foreground)]">Label</label>
            <input
              id="fsp-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={() => { if (label.trim() !== field.label) saveField({ label: label.trim() }); }}
              disabled={!isEditable}
              className={inputClass()}
              placeholder="Field label"
            />
          </div>

          {/* Field key */}
          <FieldKeyInput
            value={fieldKey}
            onChange={setFieldKey}
            onBlur={() => { if (fieldKey !== field.field_key) saveField({ field_key: fieldKey }); }}
            isExistingField
            error={fieldKeyError}
            disabled={!isEditable}
          />

          {/* Placeholder (skip for layout types) */}
          {!['divider', 'section_header', 'checkbox', 'yesno', 'file', 'signature', 'address'].includes(field.field_type) && (
            <div className="space-y-1">
              <label htmlFor="fsp-placeholder" className="text-xs font-medium text-[var(--muted-foreground)]">Placeholder</label>
              <input
                id="fsp-placeholder"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                onBlur={() => { if ((placeholder || null) !== field.placeholder) saveField({ placeholder: placeholder || null }); }}
                disabled={!isEditable}
                className={inputClass()}
                placeholder="Hint shown inside field"
              />
            </div>
          )}

          {/* Help text */}
          <div className="space-y-1">
            <label htmlFor="fsp-help-text" className="text-xs font-medium text-[var(--muted-foreground)]">Help Text</label>
            <textarea
              id="fsp-help-text"
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              onBlur={() => { if ((helpText || null) !== field.help_text) saveField({ help_text: helpText || null }); }}
              disabled={!isEditable}
              rows={2}
              className={`${inputClass()} resize-none`}
              placeholder="Shown below the field"
            />
          </div>

          {/* Required toggle */}
          {!['divider', 'section_header'].includes(field.field_type) && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Required</span>
              <RequiredToggle
                value={isRequired}
                onChange={(v) => { setIsRequired(v); saveField({ is_required: v }); }}
                disabled={!isEditable}
              />
            </div>
          )}

          {/* Width selector */}
          {!['divider', 'section_header'].includes(field.field_type) && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Width</span>
              <WidthSelector
                value={width}
                onChange={(v) => { setWidth(v); saveField({ width: v }); }}
                disabled={!isEditable}
              />
            </div>
          )}

          {/* Options editor */}
          {hasOptions && (
            <div className="space-y-1.5">
              <OptionsEditor
                options={options}
                onChange={(opts) => {
                  setOptions(opts);
                  // Debounce-style: save when called (OptionsEditor triggers on every change)
                  // We save options separately via onSaveOptions
                }}
              />
              {isEditable && (
                <button
                  type="button"
                  onClick={() => onSaveOptions(field.id, options)}
                  disabled={saving}
                  className="w-full py-1.5 text-xs rounded-lg border border-[var(--ember-orange)] text-[var(--ember-orange)] hover:bg-[var(--ember-orange)]/10 transition-colors disabled:opacity-50"
                >
                  Save Options
                </button>
              )}
            </div>
          )}

          {/* Conditional logic */}
          <ConditionalLogicPanel
            value={conditional}
            onChange={(v) => { setConditional(v); saveField({ conditional_logic: v }); }}
            allFields={allSectionFields}
            currentFieldId={field.id}
            disabled={!isEditable}
          />

          {/* Validation rules */}
          <ValidationRulesPanel
            fieldType={field.field_type}
            value={validation}
            onChange={(v) => { setValidation(v); saveField({ validation_rules: v }); }}
            disabled={!isEditable}
          />
        </div>

        {/* Footer: delete */}
        {isEditable && (
          <div className="px-4 py-3 border-t border-[var(--border)]">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-red-600 font-medium">Delete this field?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(field.id)}
                    className="flex-1 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-1.5 text-xs rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              >
                <Trash2 size={12} /> Delete Field
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
