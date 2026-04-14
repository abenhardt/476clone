/**
 * Full Page Loader Component
 *
 * Displays a centered loading spinner that covers the entire viewport.
 * Used during auth state hydration and other critical loading states.
 *
 * Accessibility:
 * - Uses role="status" and aria-live="polite" for screen readers
 * - Provides semantic loading message
 * - Keyboard accessible (no interaction needed)
 */
export function FullPageLoader() {
  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-white dark:bg-neutral-900"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'var(--ember-orange)', borderTopColor: 'transparent' }}
        />
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
