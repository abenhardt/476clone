/**
 * BackgroundSlideshow.tsx
 *
 * Renders a full-cover crossfading photo background.
 * All images are always mounted; opacity transitions handle the crossfade.
 * Pure CSS — no Framer Motion, minimal JS.
 *
 * Positioned fixed to the viewport (z-index: 0, pointer-events: none).
 * Place anywhere in the DOM — it escapes all containing blocks and covers the full screen.
 *
 * Adaptive Glass Integration:
 * Each image has a pre-assigned BgTone that describes its luminosity.
 * When the active slide changes, onToneChange is called so the
 * BackgroundBrightnessContext can update the CSS data-bg-tone attribute,
 * which in turn adapts glass opacity/blur values across all cards.
 */

import { useState, useEffect } from 'react';
import type { BgTone } from '@/ui/context/BackgroundBrightnessContext';

interface SlideConfig {
  src: string;
  /** Pre-assigned luminosity tone for adaptive glass system */
  tone: BgTone;
}

const SLIDES: SlideConfig[] = [
  { src: '/backgrounds/bg-mountain-river.jpg', tone: 'dark'    },
  { src: '/backgrounds/bg-italy.jpg',          tone: 'light'   },
  { src: '/backgrounds/bg-rocky-stream.jpg',   tone: 'neutral' },
  { src: '/backgrounds/bg-lantern.jpg',        tone: 'dark'    },
];

/** Milliseconds each photo stays visible before crossfading */
const HOLD_MS = 9000;
/** Crossfade duration — must match the CSS transition below */
const FADE_MS = 2200;

interface BackgroundSlideshowProps {
  onToneChange?: (tone: BgTone) => void;
}

export function BackgroundSlideshow({ onToneChange }: BackgroundSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Emit the initial tone immediately on mount
  useEffect(() => {
    onToneChange?.(SLIDES[0].tone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => {
        const next = (i + 1) % SLIDES.length;
        // Emit tone change slightly before the fade completes for a smooth feel
        setTimeout(() => onToneChange?.(SLIDES[next].tone), FADE_MS * 0.4);
        return next;
      });
    }, HOLD_MS + FADE_MS);

    return () => clearInterval(timer);
  // onToneChange is stable (useCallback) — safe to omit from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="overflow-hidden"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
      }}
    >
      {SLIDES.map(({ src }, i) => (
        <img
          key={src}
          src={src}
          alt=""
          decoding="async"
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            transition: `opacity ${FADE_MS}ms ease-in-out`,
            opacity: i === activeIndex ? 1 : 0,
            // Slight scale on active image gives a subtle Ken Burns feel
            transform: i === activeIndex ? 'scale(1.03)' : 'scale(1)',
            transitionProperty: 'opacity, transform',
            transitionDuration: `${FADE_MS}ms`,
            transitionTimingFunction: 'ease-in-out',
            willChange: 'opacity, transform',
          }}
        />
      ))}
      {/*
       * Dimming overlay — sits on top of all slide images.
       * Reduces photo brightness so the background feels atmospheric
       * rather than dominant, and improves contrast for glass surfaces.
       */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.40)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
