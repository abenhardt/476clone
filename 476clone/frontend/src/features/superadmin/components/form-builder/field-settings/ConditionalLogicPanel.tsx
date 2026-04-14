import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FormFieldAdmin } from '@/features/forms/types/form.types';

interface ConditionalLogicValue {
  show_if: { field_key: string; equals: unknown };
}

interface ConditionalLogicPanelProps {
  value: ConditionalLogicValue | null;
  onChange: (v: ConditionalLogicValue | null) => void;
  allFields: FormFieldAdmin[];
  currentFieldId: number;
  disabled?: boolean;
}

export function ConditionalLogicPanel({
  value, onChange, allFields, currentFieldId, disabled = false,
}: ConditionalLogicPanelProps) {
  const [open, setOpen] = useState(!!value);
  const enabled = !!value;

  // Available fields to reference (exclude self)
  const availableFields = allFields.filter((f) => f.id !== currentFieldId);

  function handleToggle() {
    if (enabled) {
      onChange(null);
    } else {
      onChange({ show_if: { field_key: '', equals: '' } });
      setOpen(true);
    }
  }

  function updateFieldKey(key: string) {
    if (!value) return;
    onChange({ show_if: { ...value.show_if, field_key: key } });
  }

  function updateEquals(eq: string) {
    if (!value) return;
    // Coerce type
    let coerced: unknown = eq;
    if (eq === 'true') coerced = true;
    else if (eq === 'false') coerced = false;
    else if (eq !== '' && !isNaN(Number(eq))) coerced = Number(eq);
    onChange({ show_if: { ...value.show_if, equals: coerced } });
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-50"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="flex-1 text-left">Conditional Logic</span>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); handleToggle(); }}
          className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
            enabled
              ? 'bg-[var(--ember-orange)]/10 text-[var(--ember-orange)] border-[var(--ember-orange)]/30'
              : 'bg-[var(--background)] text-[var(--muted-foreground)] border-[var(--border)]'
          }`}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </button>

      {open && enabled && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)] pt-2">Show this field when:</p>

          <div className="space-y-1">
            <label htmlFor="clp-field-key" className="text-xs text-[var(--muted-foreground)]">Field</label>
            <select
              id="clp-field-key"
              value={value.show_if.field_key}
              onChange={(e) => updateFieldKey(e.target.value)}
              disabled={disabled}
              className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] disabled:opacity-50"
            >
              <option value="">Select field…</option>
              {availableFields.map((f) => (
                <option key={f.id} value={f.field_key}>{f.label} ({f.field_key})</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="clp-equals" className="text-xs text-[var(--muted-foreground)]">Equals</label>
            <input
              id="clp-equals"
              value={String(value.show_if.equals ?? '')}
              onChange={(e) => updateEquals(e.target.value)}
              disabled={disabled}
              placeholder="e.g. true, yes, 18"
              className="w-full px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
