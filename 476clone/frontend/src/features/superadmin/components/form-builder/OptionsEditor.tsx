/**
 * OptionsEditor — inline list editor for select/radio/checkbox_group options.
 * Used inside AddFieldModal when the selected field type requires options.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface OptionDraft {
  label: string;
  value: string;
}

interface OptionsEditorProps {
  options: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
}

export function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const { t } = useTranslation();
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  function addOption() {
    const label = newLabel.trim();
    const value = newValue.trim() || label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!label) return;
    onChange([...options, { label, value }]);
    setNewLabel('');
    setNewValue('');
  }

  function removeOption(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, field: 'label' | 'value', val: string) {
    const updated = options.map((opt, i) => (i === index ? { ...opt, [field]: val } : opt));
    onChange(updated);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
        {t('form_builder.options')}
      </p>

      {options.length > 0 && (
        <div className="space-y-1">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(i, 'label', e.target.value)}
                placeholder={t('form_builder.option_label')}
                className="flex-1 px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
              />
              <input
                type="text"
                value={opt.value}
                onChange={(e) => updateOption(i, 'value', e.target.value)}
                placeholder={t('form_builder.option_value')}
                className="w-32 px-2 py-1 text-sm border border-[var(--border)] rounded bg-[var(--card)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 rounded text-[var(--muted-foreground)] hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new option row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
          placeholder={t('form_builder.new_option_label')}
          className="flex-1 px-2 py-1 text-sm border border-dashed border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
          placeholder={t('form_builder.new_option_value_hint')}
          className="w-32 px-2 py-1 text-sm border border-dashed border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)]"
        />
        <button
          type="button"
          onClick={addOption}
          className="p-1 rounded text-[var(--ember-orange)] hover:bg-[var(--ember-orange)]/10 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">
        {t('form_builder.option_value_hint')}
      </p>
    </div>
  );
}
