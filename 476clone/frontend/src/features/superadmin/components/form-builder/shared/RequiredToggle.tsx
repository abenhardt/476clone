interface RequiredToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function RequiredToggle({ value, onChange, disabled = false, label }: RequiredToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
          value ? 'bg-[var(--ember-orange)]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            value ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      {label && (
        <span className="text-sm text-[var(--card-foreground)]">{label}</span>
      )}
    </button>
  );
}
