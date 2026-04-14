import type { FieldWidth } from '@/features/forms/types/form.types';

interface WidthSelectorProps {
  value: FieldWidth;
  onChange: (v: FieldWidth) => void;
  disabled?: boolean;
}

const OPTIONS: { value: FieldWidth; label: string }[] = [
  { value: 'full',  label: 'Full'  },
  { value: 'half',  label: 'Half'  },
  { value: 'third', label: 'Third' },
];

export function WidthSelector({ value, onChange, disabled = false }: WidthSelectorProps) {
  return (
    <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            value === opt.value
              ? 'bg-[var(--ember-orange)] text-white'
              : 'bg-[var(--background)] text-[var(--muted-foreground)] hover:bg-[var(--dash-nav-hover-bg)]'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
