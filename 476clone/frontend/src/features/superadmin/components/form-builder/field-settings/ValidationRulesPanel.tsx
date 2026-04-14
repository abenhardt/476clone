import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { FieldType } from '@/features/forms/types/form.types';

interface ValidationRulesPanelProps {
  fieldType: FieldType;
  value: Record<string, unknown> | null;
  onChange: (v: Record<string, unknown> | null) => void;
  disabled?: boolean;
}

export function ValidationRulesPanel({ fieldType, value, onChange, disabled = false }: ValidationRulesPanelProps) {
  const [open, setOpen] = useState(false);
  const rules = value ?? {};

  function update(key: string, val: string) {
    const next = { ...rules };
    if (val === '') {
      delete next[key];
    } else {
      next[key] = isNaN(Number(val)) ? val : Number(val);
    }
    onChange(Object.keys(next).length > 0 ? next : null);
  }

  const showMin    = ['number', 'text', 'textarea', 'email', 'phone'].includes(fieldType);
  const showMax    = showMin;
  const showPattern = ['text', 'email', 'phone'].includes(fieldType);

  if (!showMin && !showMax && !showPattern) {
    return null;
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-[var(--card-foreground)] hover:bg-[var(--dash-nav-hover-bg)] transition-colors disabled:opacity-50"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="flex-1 text-left">Validation Rules</span>
        {value && Object.keys(value).length > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ember-orange)]" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)] pt-2">
          {showMin && (
            <div className="flex items-center gap-2">
              <label htmlFor="vrp-min" className="text-xs text-[var(--muted-foreground)] w-16">Min</label>
              <input
                id="vrp-min"
                type="number"
                value={String(rules['min'] ?? '')}
                onChange={(e) => update('min', e.target.value)}
                disabled={disabled}
                className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] disabled:opacity-50"
                placeholder="No minimum"
              />
            </div>
          )}
          {showMax && (
            <div className="flex items-center gap-2">
              <label htmlFor="vrp-max" className="text-xs text-[var(--muted-foreground)] w-16">Max</label>
              <input
                id="vrp-max"
                type="number"
                value={String(rules['max'] ?? '')}
                onChange={(e) => update('max', e.target.value)}
                disabled={disabled}
                className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] disabled:opacity-50"
                placeholder="No maximum"
              />
            </div>
          )}
          {showPattern && (
            <div className="flex items-center gap-2">
              <label htmlFor="vrp-pattern" className="text-xs text-[var(--muted-foreground)] w-16">Pattern</label>
              <input
                id="vrp-pattern"
                type="text"
                value={String(rules['pattern'] ?? '')}
                onChange={(e) => update('pattern', e.target.value)}
                disabled={disabled}
                className="flex-1 px-2 py-1 text-xs font-mono border border-[var(--border)] rounded bg-[var(--background)] focus:outline-none focus:ring-1 focus:ring-[var(--ember-orange)] disabled:opacity-50"
                placeholder="Regex pattern"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
