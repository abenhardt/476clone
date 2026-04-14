/**
 * EmptyState.tsx / ErrorState.tsx
 *
 * Purpose: Reusable placeholder components for data-fetching UI states.
 *
 * Exports:
 *   - EmptyState  — shown when a data fetch succeeds but returns zero results.
 *   - ErrorState  — shown when a data fetch fails with an error.
 *
 * Both components:
 *   - Center their content vertically and horizontally within their container.
 *   - Accept optional action buttons (e.g. "Create first record" or "Try again").
 *
 * Usage:
 *   // When a list is empty:
 *   <EmptyState title="No campers yet" action={{ label: 'Add Camper', onClick: ... }} />
 *
 *   // When a fetch failed:
 *   <ErrorState onRetry={() => setRetryKey(k => k + 1)} />
 */

import type { LucideIcon } from 'lucide-react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from './Button';

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  title: string;
  /** Supporting sentence below the title — describes why the list is empty. */
  description?: string;
  /** Icon rendered in the colored box — defaults to the Inbox icon. */
  icon?: LucideIcon;
  /** Optional call-to-action button (e.g. "Create your first record"). */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Icon in a muted square container — neutral gray signals "nothing here" */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--muted)' }}
      >
        <Icon className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
      </div>

      <h3
        className="text-base font-headline font-semibold mb-1"
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </h3>

      {/* Description is optional — not all empty states need an explanation */}
      {description && (
        <p
          className="text-sm max-w-xs leading-relaxed mb-6"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {description}
        </p>
      )}

      {/* Action button — only rendered when an action is provided */}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorState
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  /** Headline error message — defaults to a generic "Something went wrong". */
  title?: string;
  /** Detail sentence — defaults to a generic retry prompt. */
  description?: string;
  /** When provided, renders a "Try again" button that calls this function. */
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this data. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Red-tinted icon container signals an error state */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(220,38,38,0.08)' }}
      >
        <AlertCircle className="h-6 w-6" style={{ color: 'var(--destructive)' }} />
      </div>

      <h3
        className="text-base font-headline font-semibold mb-1"
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </h3>

      <p
        className="text-sm max-w-xs leading-relaxed mb-6"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {description}
      </p>

      {/* Retry button — only rendered when a retry handler is provided.
          Typically the parent increments a `retryKey` state to trigger a re-fetch. */}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
