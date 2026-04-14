/**
 * Input.tsx
 *
 * Purpose: A reusable, accessible text input component with an optional label,
 * error message, and helper text.
 *
 * Responsibilities:
 *   - Renders a <label> (when provided) linked to the input via htmlFor/id.
 *   - Shows a red asterisk next to the label when the field is required.
 *   - Applies a red border when `error` is set; normal border otherwise.
 *   - Announces validation errors to screen readers via role="alert" and
 *     aria-describedby so assistive technology reads the error after the field.
 *   - Shows a `helperText` paragraph below the input (only when there is no error,
 *     to avoid two messages stacking).
 *   - Supports `fullWidth` to stretch to 100% of the container.
 *   - Forwarded ref so react-hook-form or parent components can control focus.
 *
 * Usage with react-hook-form:
 *   <Input label="Email" error={errors.email?.message} {...register('email')} />
 */

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Validation error message — when set the border turns red and the message appears below. */
  error?: string;
  /** Supplementary hint text shown below the input (hidden when error is present). */
  helperText?: string;
  /** Stretch the input wrapper to 100% width. */
  fullWidth?: boolean;
}

/**
 * forwardRef lets react-hook-form's register() attach a ref to the underlying
 * <input> element so it can manage focus on validation errors.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      className,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    // Generate an id from the label text if none is provided explicitly.
    // e.g. label="Email Address" → id="email-address"
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    // Base visual styles shared by all input instances.
    const baseStyles =
      'h-10 px-4 rounded-lg border bg-white text-neutral-900 placeholder:text-neutral-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-600';

    // Red border + ring when there is a validation error; normal gray border otherwise.
    const borderStyles = error
      ? 'border-danger-500 focus-visible:ring-danger-500'
      : 'border-neutral-300 dark:border-neutral-700';

    return (
      // Outer wrapper stacks label → input → message vertically with consistent spacing.
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
            {/* Red asterisk signals the field is required — common convention */}
            {required && <span className="text-danger-500 ml-1">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          // aria-invalid="true" signals to screen readers that the field has an error.
          aria-invalid={error ? 'true' : 'false'}
          // aria-describedby links this input to its error or helper message element.
          aria-describedby={
            error
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          className={cn(baseStyles, borderStyles, className)}
          {...props}
        />

        {/* Error message — role="alert" causes screen readers to announce it immediately */}
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-danger-500"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper text — only shown when there is no error to avoid conflicting messages */}
        {helperText && !error && (
          <p
            id={`${inputId}-helper`}
            className="text-sm text-neutral-500 dark:text-neutral-400"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
