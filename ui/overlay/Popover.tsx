/**
 * Popover.tsx
 *
 * Reusable base popover component.
 * - Renders via React portal (no z-index stacking context issues)
 * - Positioned relative to anchor via getBoundingClientRect (fixed positioning)
 * - Closes on Escape key or click outside
 * - Enforces z-[200] in the app z-index hierarchy
 */

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export type PopoverPlacement = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  placement?: PopoverPlacement;
  className?: string;
}

function computePosition(
  anchor: HTMLElement,
  placement: PopoverPlacement,
): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;

  // Uses fixed positioning — coordinates are relative to viewport
  switch (placement) {
    case 'bottom-left':
      return { position: 'fixed', top: rect.bottom + gap, left: rect.left };
    case 'bottom-right':
      return { position: 'fixed', top: rect.bottom + gap, right: window.innerWidth - rect.right };
    case 'top-left':
      return { position: 'fixed', bottom: window.innerHeight - rect.top + gap, left: rect.left };
    case 'top-right':
      return { position: 'fixed', bottom: window.innerHeight - rect.top + gap, right: window.innerWidth - rect.right };
  }
}

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  placement = 'bottom-left',
  className = '',
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [posStyle, setPosStyle] = useState<CSSProperties>({});

  // Recompute position whenever the popover opens
  useEffect(() => {
    if (open && anchorRef.current) {
      setPosStyle(computePosition(anchorRef.current, placement));
    }
  }, [open, anchorRef, placement]);

  // Close on Escape + click outside
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const isInsidePopover = popoverRef.current?.contains(target);
      const isInsideAnchor  = anchorRef.current?.contains(target);
      if (!isInsidePopover && !isInsideAnchor) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [open, onClose, anchorRef]);

  return createPortal(
    <>
      {open && (
        <div
          ref={popoverRef}
          style={{
            ...posStyle,
            zIndex: 1100,
            background: 'var(--card)',
            borderColor: 'var(--border)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
          className={`rounded-xl border overflow-hidden ${className}`}
        >
          {children}
        </div>
      )}
    </>,
    document.body,
  );
}
