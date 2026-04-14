/**
 * Button.tsx
 *
 * Purpose: The primary interactive button component used throughout the app.
 *
 * Responsibilities:
 *   - Supports four visual variants: primary, secondary, ghost, destructive.
 *   - Supports three sizes: sm, md, lg.
 *   - Shows a spinning loader icon when `loading` is true (and disables the button).
 *   - Accepts a leading `icon` prop for buttons with an icon + label.
 *   - Supports `fullWidth` to span 100% of its container.
 *   - Polymorphic via the `as` prop — can render as a React Router <Link> or
 *     any other element type when you need a link that looks like a button.
 *   - Forwarded ref so parent components can focus or measure the element.
 *
 * Styling:
 *   Uses CTA design tokens (var(--cta-primary-bg), etc.) so the button color
 *   automatically reflects the current design-token values.
 */

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ElementType,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** When true, shows a spinner and prevents interaction. */
  loading?: boolean;
  /** Stretch the button to fill its container's full width. */
  fullWidth?: boolean;
  /** Optional leading icon rendered before the label text. */
  icon?: ReactNode;
  /**
   * Render as a different element (e.g. React Router's Link) while keeping
   * all button styles. Useful for navigation that should look like a button.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: ElementType<any>;
  /** Used when `as` is a Link component that needs a `to` prop. */
  to?: string;
}

// ── Variant style maps ────────────────────────────────────────────────────────

/**
 * Text and border color classes per variant.
 * Background colors are applied via inline style (design tokens) below
 * because Tailwind can't interpolate CSS custom properties at build time.
 */
const variantStyles: Record<ButtonVariant, string> = {
  primary:     'text-cta-primary-color border-cta-primary-border',
  secondary:   'text-on-image-text border-on-image-border',
  ghost:       'border-transparent text-on-image-muted hover:text-on-image-text',
  destructive: 'border-destructive/50 text-destructive',
};

/** Padding and font size per size option. */
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * forwardRef allows parent components (e.g. ConfirmDialog) to call
 * .focus() on this button via a ref.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      icon,
      as: Component,
      ...props
    },
    ref
  ) => {
    // Combine the two conditions into one flag so both disabled and loading
    // disable interaction and reduce opacity in the same way.
    const isDisabled = disabled || loading;
    const isPrimary = variant === 'primary';

    // Build the complete className string once — shared between both render paths.
    const sharedClassName = cn(
      'relative inline-flex items-center justify-center gap-2',
      'rounded-xl border font-headline font-medium',
      'transition-all duration-button cursor-pointer',
      // focus-visible ring only appears on keyboard focus, not mouse click.
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-orange/60',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantStyles[variant],
      sizeStyles[size],
      fullWidth && 'w-full',
      className
    );

    // Background and shadow are CSS-token-based — applied via inline style.
    const sharedStyle =
      isPrimary
        ? { background: 'var(--cta-primary-bg)', boxShadow: 'var(--shadow-ember-primary)', color: 'var(--cta-primary-color)' }
        : variant === 'secondary'
        ? { background: 'var(--cta-secondary-bg)', boxShadow: 'var(--shadow-ember-secondary)' }
        : undefined;

    // The inner content: spinner OR icon (never both), then the label children.
    const content = (
      <>
        {/* Spinning loader replaces the icon when loading is true */}
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {/* Icon only shown when NOT in loading state */}
        {!loading && icon}
        {children}
      </>
    );

    // Polymorphic path: when `as` is provided render as that element (e.g. Link).
    if (Component) {
      return (
        <Component
          className={sharedClassName}
          style={sharedStyle}
          {...props}
        >
          {content}
        </Component>
      );
    }

    // Default path: a plain button element.
    return (
      <button
        ref={ref}
        className={sharedClassName}
        style={sharedStyle}
        disabled={isDisabled}
        {...(props as object)}
      >
        {content}
      </button>
    );
  }
);

// displayName helps React DevTools and error stack traces show a readable name.
Button.displayName = 'Button';
