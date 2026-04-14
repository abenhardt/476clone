/**
 * HeroSlideshow.tsx
 *
 * A contained crossfading photo background for hero sections.
 * Positions itself to fill a `position: relative; overflow: hidden` parent.
 * Includes a bottom-to-top gradient scrim for text readability.
 *
 * Uses the same four camp backgrounds as BackgroundSlideshow,
 * with a configurable initial offset so different portals start
 * on different images.
 *
 * Pure CSS crossfade + Ken Burns scale. No Framer Motion.
 */

import { useState, useEffect } from 'react';

const IMAGES = [
  '/backgrounds/bg-rocky-stream.jpg',
  '/backgrounds/bg-mountain-river.jpg',
  '/backgrounds/bg-italy.jpg',
  '/backgrounds/bg-lantern.jpg',
];

/** ms each photo stays fully visible before the crossfade begins */
const HOLD_MS = 8000;
/** Crossfade duration — must match the CSS transition below */
const FADE_MS = 2000;

interface HeroSlideshowProps {
  /** Index into IMAGES to start on — staggers portals so they open on different scenes */
  initialIndex?: number;
}

export function HeroSlideshow({ initialIndex = 0 }: HeroSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex % IMAGES.length);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % IMAGES.length);
    }, HOLD_MS + FADE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Crossfading images */}
      {IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: i === activeIndex ? 1 : 0,
            transform: i === activeIndex ? 'scale(1.05)' : 'scale(1)',
            transition: `opacity ${FADE_MS}ms ease-in-out, transform ${FADE_MS}ms ease-in-out`,
            willChange: 'opacity, transform',
          }}
        />
      ))}

      {/* Bottom-to-top gradient scrim — keeps text readable over any image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.25) 45%, transparent 80%)',
        }}
      />
    </>
  );
}
