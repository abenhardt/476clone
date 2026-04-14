import { useState } from 'react';
import { Lock, AlertTriangle } from 'lucide-react';

interface FieldKeyInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  isExistingField: boolean;
  hasApplicationData?: boolean;
  error?: string;
  disabled?: boolean;
}

export function FieldKeyInput({
  value, onChange, onBlur,
  isExistingField, hasApplicationData = false,
  error, disabled = false,
}: FieldKeyInputProps) {
  const [originalValue] = useState(value);
  const hasChanged = isExistingField && value !== originalValue;

  function handleChange(raw: string) {
    // Auto-format: lowercase, spaces → underscores, strip non-alphanumeric
    const formatted = raw
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+/, '')
      .slice(0, 100);
    onChange(formatted);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1">
        Field Key
        {isExistingField && <Lock size={10} className="text-[var(--muted-foreground)]" />}
      </label>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled || (isExistingField && hasApplicationData)}
        className={`w-full px-3 py-2 text-sm font-mono border rounded-lg bg-[var(--background)] focus:outline-none focus:ring-1 ${
          error
            ? 'border-red-400 focus:ring-red-400'
            : 'border-[var(--border)] focus:ring-[var(--ember-orange)]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        placeholder="field_key"
      />
      {hasApplicationData && (
        <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
          <Lock size={10} /> Referenced by existing applications — cannot change
        </p>
      )}
      {hasChanged && !hasApplicationData && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle size={10} /> Changing the key may break existing references
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
