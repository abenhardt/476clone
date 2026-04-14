import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error,
      helperText,
      className,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-');

    const baseStyles =
      'h-4 w-4 rounded border-neutral-300 text-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:border-neutral-700 dark:bg-neutral-900';

    const borderStyles = error
      ? 'border-danger-500 focus:ring-danger-500'
      : '';

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={
              error
                ? `${checkboxId}-error`
                : helperText
                  ? `${checkboxId}-helper`
                  : undefined
            }
            className={cn(baseStyles, borderStyles, 'mt-0.5', className)}
            {...props}
          />

          {label && (
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer select-none"
            >
              {label}
              {required && <span className="text-danger-500 ml-1">*</span>}
            </label>
          )}
        </div>

        {error && (
          <p
            id={`${checkboxId}-error`}
            className="text-sm text-danger-500 ml-6"
            role="alert"
          >
            {error}
          </p>
        )}

        {helperText && !error && (
          <p
            id={`${checkboxId}-helper`}
            className="text-sm text-neutral-500 dark:text-neutral-400 ml-6"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
