import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
  delay?: number;
}

/**
 * Tooltip — portal-based accessible hover tooltip.
 *
 * Renders into document.body via createPortal so it is NEVER clipped by
 * overflow:hidden ancestors (cards, tab panels, factor rows, etc.).
 *
 * Positioning uses getBoundingClientRect() + position:fixed so coordinates
 * are always relative to the viewport, not the scroll container.
 */

const GAP = 9; // px gap between trigger edge and tooltip box

export function Tooltip({
  content,
  children,
  placement = 'top',
  maxWidth = 280,
  delay = 180,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [style, setStyle]     = useState<React.CSSProperties>({});
  const timerRef   = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLSpanElement>(null);

  /** Compute fixed-position coords from the trigger's viewport rect */
  const compute = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let transform = '';

    switch (placement) {
      case 'top':
        top       = r.top - GAP;
        left      = r.left + r.width / 2;
        transform = 'translate(-50%, -100%)';
        break;
      case 'bottom':
        top       = r.bottom + GAP;
        left      = r.left + r.width / 2;
        transform = 'translate(-50%, 0)';
        break;
      case 'left':
        top       = r.top + r.height / 2;
        left      = r.left - GAP;
        transform = 'translate(-100%, -50%)';
        break;
      case 'right':
        top       = r.top + r.height / 2;
        left      = r.right + GAP;
        transform = 'translate(0, -50%)';
        break;
    }

    setStyle({ position: 'fixed', top, left, transform, maxWidth, zIndex: 9999 });
  }, [placement, maxWidth]);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    compute();
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [compute, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  /** CSS-triangle arrows — one per placement direction */
  const ARROW: Record<string, React.CSSProperties> = {
    top: {
      position: 'absolute',
      bottom: -5,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0,
      height: 0,
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderTop: '5px solid #1e293b',
    },
    bottom: {
      position: 'absolute',
      top: -5,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 0,
      height: 0,
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderBottom: '5px solid #1e293b',
    },
    left: {
      position: 'absolute',
      right: -5,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 0,
      height: 0,
      borderTop: '5px solid transparent',
      borderBottom: '5px solid transparent',
      borderLeft: '5px solid #1e293b',
    },
    right: {
      position: 'absolute',
      left: -5,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 0,
      height: 0,
      borderTop: '5px solid transparent',
      borderBottom: '5px solid transparent',
      borderRight: '5px solid #1e293b',
    },
  };

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={style}
            className="pointer-events-none bg-[#1e293b] text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-xl"
          >
            {content}
            <span style={ARROW[placement]} aria-hidden />
          </div>,
          document.body,
        )}
    </span>
  );
}
