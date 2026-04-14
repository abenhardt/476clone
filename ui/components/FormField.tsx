/**
 * FormField.tsx
 * Reusable labeled input field with error display.
 * Integrates with react-hook-form via registration props.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={fieldId}
          className="text-sm font-medium"
          style={{ color: 'var(--on-image-text)' }}
        >
          {label}
        </label>

        <input
          ref={ref}
          id={fieldId}
          className={cn(
            'w-full rounded-lg px-4 py-3 text-sm outline-none',
            'border transition-all duration-300',
            'focus:ring-2 focus:ring-ember-orange/40',
            error
              ? 'border-destructive/60 focus:border-destructive'
              : 'border-on-image-border focus:border-ember-orange',
            className
          )}
          style={{
            background: 'var(--input)',
            color: 'var(--on-image-text)',
          }}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...props}
        />

        {hint && !error && (
          <p
            id={`${fieldId}-hint`}
            className="text-xs"
            style={{ color: 'var(--on-image-muted)' }}
          >
            {hint}
          </p>
        )}

        {error && (
          <p
            id={`${fieldId}-error`}
            role="alert"
            className="text-xs"
            style={{ color: 'var(--destructive)' }}
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
