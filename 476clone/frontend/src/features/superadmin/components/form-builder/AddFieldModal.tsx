/**
 * AddFieldModal — create or edit a form field.
 * Includes inline OptionsEditor for select/radio/checkbox_group types.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OptionsEditor, type OptionDraft } from './OptionsEditor';
import type { CreateFieldPayload, FieldType, FieldWidth, FormFieldAdmin } from '@/features/forms/types/form.types';

interface AddFieldModalProps {
  field?: FormFieldAdmin | null;
  onSave: (payload: CreateFieldPayload) => Promise<void>;
  onClose: () => void;
}

const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'text',           label: 'Text' },
  { type: 'textarea',       label: 'Text Area' },
  { type: 'email',          label: 'Email' },
  { type: 'phone',          label: 'Phone' },
  { type: 'number',         label: 'Number' },
  { type: 'date',           label: 'Date' },
  { type: 'select',         label: 'Dropdown' },
  { type: 'radio',          label: 'Radio' },
  { type: 'checkbox',       label: 'Checkbox' },
  { type: 'checkbox_group', label: 'Checkbox Group' },
  { type: 'yesno',          label: 'Yes / No' },
  { type: 'file',           label: 'File Upload' },
  { type: 'repeater',       label: 'Repeater' },
];

const OPTION_TYPES: FieldType[] = ['select', 'radio', 'checkbox_group'];

const WIDTH_OPTIONS: { value: FieldWidth; label: string }[] = [
  { value: 'full',  label: 'Full width' },
  { value: 'half',  label: 'Half width' },
  { value: 'third', label: 'Third width' },
];

export function AddFieldModal({ field, onSave, onClose }: AddFieldModalProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(field);

  const [fieldKey, setFieldKey]       = useState(field?.field_key ?? '');
  const [label, setLabel]             = useState(field?.label ?? '');
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? '');
  const [helpText, setHelpText]       = useState(field?.help_text ?? '');
  const [fieldType, setFieldType]     = useState<FieldType>(field?.field_type ?? 'text');
  const [isRequired, setIsRequired]   = useState(field?.is_required ?? false);
  const [width, setWidth]             = useState<FieldWidth>(field?.width ?? 'full');
  const [options, setOptions]         = useState<OptionDraft[]>(
    field?.options?.map((o) => ({ label: o.label, value: o.value })) ?? []
  );
  const [showConditional, setShowConditional] = useState(Boolean(field?.conditional_logic));
  const [condFieldKey, setCondFieldKey]       = useState(field?.conditional_logic?.show_if?.field_key ?? '');
  const [condValue, setCondValue]             = useState(
    field?.conditional_logic ? String(field.conditional_logic.show_if.equals) : ''
  );

  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [keyChanged, setKeyChanged] = useState(false);

  const showsOptions = OPTION_TYPES.includes(fieldType);

  // Auto-generate field_key from label when creating
  useEffect(() => {
    if (!isEdit && label) {
      const generated = label
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+/, '')
        .slice(0, 100);
      setFieldKey(generated);
    }
  }, [label, isEdit]);

  // Warn if editing an existing field_key
  useEffect(() => {
    if (isEdit && fieldKey !== field?.field_key) {
      setKeyChanged(true);
    } else {
      setKeyChanged(false);
    }
  }, [fieldKey, field?.field_key, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fieldKey.trim() || !label.trim() || !fieldType) return;

    const payload: CreateFieldPayload = {
      field_key:   fieldKey.trim(),
      label:       label.trim(),
      placeholder: placeholder.trim() || null,
      help_text:   helpText.trim() || null,
      field_type:  fieldType,
      is_required: isRequired,
      width,
    };

    if (showConditional && condFieldKey.trim()) {
      // Parse the equals value — try boolean/number first, fall back to string
      let equals: unknown = condValue;
      if (condValue === 'true')  equals = true;
      if (condValue === 'false') equals = false;
      if (!isNaN(Number(condValue)) && condValue !== '') equals = Number(condValue);
      payload.conditional_logic = { show_if: { field_key: condFieldKey.trim(), equals } };
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? t('form_builder.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4">
      <div className="bg-[var(--card)] rounded-xl shadow-xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            {isEdit ? t('form_builder.edit_field') : t('form_builder.add_field')}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--dash-nav-hover-bg)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-2">
              {t('form_builder.field_type')} *
            </label>
            <div className="grid grid-cols-4 gap-1">
              {FIELD_TYPES.map(({ type, label: typeLabel }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFieldType(type)}
                  className={`px-2 py-1.5 text-xs rounded border transition-colors text-center ${
                    fieldType === type
                      ? 'bg-[var(--ember-orange)] text-white border-[var(--ember-orange)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--ember-orange)]'
                  }`}
                >
                  {typeLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.field_label')} *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={255}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
          </div>

          {/* Field Key */}
          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.field_key')} *
              <span className="ml-1 text-xs text-[var(--muted-foreground)]">(snake_case)</span>
            </label>
            <input
              type="text"
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              maxLength={100}
              pattern="^[a-z][a-z0-9_]*$"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
            {keyChanged && (
              <div className="mt-1 flex items-start gap-1.5 text-amber-700 bg-amber-50 rounded p-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <p className="text-xs">{t('form_builder.field_key_change_warning')}</p>
              </div>
            )}
          </div>

          {/* Placeholder & Help Text */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                {t('form_builder.placeholder')}
              </label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                maxLength={255}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
                {t('form_builder.width')}
              </label>
              <select
                value={width}
                onChange={(e) => setWidth(e.target.value as FieldWidth)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
              >
                {WIDTH_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--card-foreground)] mb-1">
              {t('form_builder.help_text')}
            </label>
            <textarea
              value={helpText}
              onChange={(e) => setHelpText(e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ember-orange)]"
            />
          </div>

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded border-[var(--border)] text-[var(--ember-orange)] focus:ring-[var(--ember-orange)]"
            />
            <span className="text-sm text-[var(--card-foreground)]">
              {t('form_builder.required')}
            </span>
          </label>

          {/* Options editor */}
          {showsOptions && (
            <div className="border border-[var(--border)] rounded-lg p-3">
              <OptionsEditor options={options} onChange={setOptions} />
            </div>
          )}

          {/* Conditional logic */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={showConditional}
                onChange={(e) => setShowConditional(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--ember-orange)] focus:ring-[var(--ember-orange)]"
              />
              <span className="text-sm text-[var(--card-foreground)]">
                {t('form_builder.conditional_logic')}
              </span>
            </label>
            {showConditional && (
              <div className="grid grid-cols-2 gap-3 pl-5">
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                    {t('form_builder.show_if_field_key')}
                  </label>
                  <input
                    type="text"
                    value={condFieldKey}
                    onChange={(e) => setCondFieldKey(e.target.value)}
                    placeholder="e.g. has_seizures"
                    className="w-full px-2 py-1.5 border border-[var(--border)] rounded bg-[var(--background)] font-mono text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted-foreground)] mb-1">
                    {t('form_builder.show_if_equals')}
                  </label>
                  <input
                    type="text"
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                    placeholder="true / false / value"
                    className="w-full px-2 py-1.5 border border-[var(--border)] rounded bg-[var(--background)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !fieldKey.trim() || !label.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--ember-orange)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
