/**
 * ConfirmDialog.tsx
 *
 * Purpose: An accessible confirmation dialog that replaces
 * window.confirm() throughout the application.
 *
 * Responsibilities:
 *   - Renders via a React portal so it always appears above every other UI layer
 *     (z-index 600 — above the messaging compose panel at z-index ~500).
 *   - Supports three visual variants: 'default' (orange), 'warning' (amber),
 *     and 'danger' (red) to communicate the severity of the action.
 *   - Auto-focuses the confirm button when opened so keyboard users can
 *     immediately press Enter or Space to confirm (or Tab to cancel).
 *   - Pressing Escape calls onCancel — standard dialog keyboard behavior.
 *   - Clicking the backdrop also calls onCancel.
 *   - Clicking inside the dialog card stops event propagation so the backdrop
 *     click handler does not fire through the card.
 *
 * Props:
 *   open         — controls visibility
 *   title        — short action description (e.g. "Delete this record?")
 *   message      — longer explanation of consequences
 *   confirmLabel — label for the confirm button (default: "Confirm")
 *   cancelLabel  — label for the cancel button (default: "Cancel")
 *   variant      — color scheme: 'default' | 'warning' | 'danger'
 *   onConfirm    — called when the user confirms
 *   onCancel     — called when the user cancels (Escape, backdrop, or Cancel button)
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'default';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Maps each variant to the confirm button background and text colors. */
const VARIANT_COLORS: Record<ConfirmVariant, { bg: string; text: string }> = {
  danger:  { bg: 'var(--destructive)', text: '#ffffff' },
  warning: { bg: 'var(--warm-amber)',  text: '#ffffff' },
  default: { bg: 'var(--ember-orange)', text: '#ffffff' },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Ref to the confirm button so we can auto-focus it when the dialog opens.
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the confirm button shortly after open=true so keyboard users
  // can immediately confirm or Tab to the cancel button.
  useEffect(() => {
    if (open) {
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  // Attach a keydown listener when the dialog is open so Escape closes it.
  // The listener is removed when the dialog closes to avoid memory leaks.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  const colors = VARIANT_COLORS[variant];

  // createPortal renders the dialog directly into document.body so it escapes
  // any overflow:hidden or z-index stacking contexts in the component tree.
  return createPortal(
    <>
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────── */}
          {/* Semi-transparent black overlay — clicking it calls onCancel */}
          <button
            type="button"
            aria-label="Cancel"
            className="fixed inset-0 cursor-default"
            style={{ zIndex: 599, background: 'rgba(0,0,0,0.40)' }}
            onClick={onCancel}
          />

          {/* ── Dialog card ────────────────────────────────────────────────── */}
          {/*
           * pointer-events-none on the outer centering div so backdrop clicks
           * pass through to the backdrop div above. The inner card is
           * pointer-events-auto so clicks inside it are captured.
           */}
          <div
            className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
            style={{ zIndex: 600 }}
          >
            <div
              role="presentation"
              className="w-full max-w-sm rounded-2xl p-6 pointer-events-auto"
              style={{
                background: '#ffffff',
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              }}
              // Stop clicks and key events inside the card from reaching the backdrop.
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* ── Icon + Title + Message ── */}
              <div className="flex items-start gap-3 mb-3">
                {/* Colored icon background — 18 hex = 10% opacity of the variant color */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${colors.bg}18` }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: colors.bg }} />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
                    {title}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                    {message}
                  </p>
                </div>
              </div>

              {/* ── Action buttons ── */}
              <div className="flex items-center justify-end gap-2 mt-5">
                {/* Cancel — subtle ghost style so the confirm button gets more visual weight */}
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--dash-nav-hover-bg)]"
                  style={{ color: 'var(--foreground)' }}
                >
                  {cancelLabel}
                </button>
                {/* Confirm — auto-focused, variant-colored, hover reduces opacity */}
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>,
    // Attach to document.body so the dialog is always on top of the page.
    document.body,
  );
}
