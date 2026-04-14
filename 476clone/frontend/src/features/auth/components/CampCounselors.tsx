/**
 * CampCounselors.tsx
 *
 * Two animated camp counselors that flank the auth card and react to
 * what the user is doing:
 *
 *   idle    — gentle floating bob
 *   peek    — turn away and cover eyes (password field focused)
 *   error   — hop back in alarm (login failed)
 *   cheer   — jump and celebrate (success)
 *   excited — energetic welcome loop (register page)
 *
 * Characters are position:fixed so they stay anchored to the viewport
 * while the Register page scrolls. Hidden below lg breakpoint (1024px)
 * where there isn't enough horizontal room beside the card.
 */

import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useAuthCharacter, type CharacterMode } from '../context/AuthCharacterContext';

/* ── Per-side animation names ──────────────────────────────────────────────── */
const ANIM = {
  enter:   { left: 'counselorEnter',      right: 'counselorEnter'      },
  idle:    { left: 'counselorBob',         right: 'counselorBob'        },
  peek:    { left: 'counselorPeekLeft',    right: 'counselorPeekRight'  },
  error:   { left: 'counselorErrorLeft',   right: 'counselorErrorRight' },
  cheer:   { left: 'counselorCheerLeft',   right: 'counselorCheerRight' },
  excited: { left: 'counselorExcited',     right: 'counselorExcited'    },
} as const;

/* ── Duration / timing per animation ──────────────────────────────────────── */
const TIMING: Record<string, { duration: string; easing: string; fill: string; iteration: string }> = {
  counselorEnter:       { duration: '0.9s',  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both',    iteration: '1' },
  counselorBob:         { duration: '3.4s',  easing: 'ease-in-out',                        fill: 'none',    iteration: 'infinite' },
  counselorPeekLeft:    { duration: '0.45s', easing: 'ease-out',                           fill: 'forwards', iteration: '1' },
  counselorPeekRight:   { duration: '0.45s', easing: 'ease-out',                           fill: 'forwards', iteration: '1' },
  counselorErrorLeft:   { duration: '0.85s', easing: 'ease-in-out',                        fill: 'none',    iteration: '1' },
  counselorErrorRight:  { duration: '0.85s', easing: 'ease-in-out',                        fill: 'none',    iteration: '1' },
  counselorCheerLeft:   { duration: '1.1s',  easing: 'ease-in-out',                        fill: 'none',    iteration: '1' },
  counselorCheerRight:  { duration: '1.1s',  easing: 'ease-in-out',                        fill: 'none',    iteration: '1' },
  counselorExcited:     { duration: '1.7s',  easing: 'ease-in-out',                        fill: 'none',    iteration: 'infinite' },
};

/* ── Build the CSS animation shorthand ────────────────────────────────────── */
function buildAnimation(name: string, extraDelay = '0s'): string {
  const t = TIMING[name];
  if (!t) return 'none';
  return `${name} ${t.duration} ${t.easing} ${extraDelay} ${t.iteration} ${t.fill}`;
}

/* ── Single counselor ──────────────────────────────────────────────────────── */
interface CounselorProps {
  side:        'left' | 'right';
  src:         string;
  alt:         string;
  mode:        CharacterMode;
  enterDelay?: string;
}

function Counselor({ side, src, alt, mode, enterDelay = '0s' }: CounselorProps) {
  // Track whether the entrance animation has finished so we can switch to
  // content-driven animations without fighting the enter keyframe.
  const [entered, setEntered] = useState(false);

  // We use an `animKey` to force React to remount the img element, which
  // restarts the CSS animation from the beginning whenever we need a new
  // non-looping animation (error, cheer) that the same keyframe would
  // otherwise ignore because the element is already "at the end".
  const [animKey, setAnimKey] = useState(0);
  const prevModeRef = useRef<CharacterMode | 'entering'>('entering');

  useEffect(() => {
    const prev = prevModeRef.current;
    const next = entered ? mode : 'entering';

    // Bump the key to restart a new one-shot animation; skip for infinite loops.
    if (entered && prev !== next) {
      if (next === 'error' || next === 'cheer') {
        setAnimKey((k) => k + 1);
      }
    }

    prevModeRef.current = next;
  }, [mode, entered]);

  /* ── Derive the animation string ── */
  let animation: string;

  if (!entered) {
    animation = buildAnimation(ANIM.enter[side], enterDelay);
  } else {
    switch (mode) {
      case 'peek':
        animation = buildAnimation(ANIM.peek[side]);
        break;
      case 'error':
        animation = buildAnimation(ANIM.error[side]);
        break;
      case 'cheer':
        animation = buildAnimation(ANIM.cheer[side]);
        break;
      case 'excited':
        animation = buildAnimation(ANIM.excited[side], side === 'right' ? '0.45s' : '0s');
        break;
      case 'idle':
      default:
        animation = buildAnimation(ANIM.idle[side], side === 'right' ? '0.7s' : '0s');
        break;
    }
  }

  /* ── Fixed position beside the card ── */
  const posStyle: CSSProperties =
    side === 'left'
      ? { right: 'calc(50% + 248px)', bottom: 0 }
      : { left: 'calc(50% + 248px)', bottom: 0 };

  return (
    // Outer wrapper: hidden below lg, fixed beside card
    <div
      className="hidden lg:block"
      style={{
        position:      'fixed',
        zIndex:        5,
        pointerEvents: 'none',
        ...posStyle,
      }}
    >
      <img
        key={animKey}
        src={src}
        alt={alt}
        draggable={false}
        onAnimationEnd={() => {
          if (!entered) setEntered(true);
        }}
        style={{
          width:          '165px',
          height:         'auto',
          display:        'block',
          transformOrigin: 'bottom center',
          animation,
          // Soft drop shadow so characters feel grounded on white bg
          filter: 'drop-shadow(0 8px 18px rgba(0,0,0,0.18))',
          userSelect: 'none',
        }}
      />
    </div>
  );
}

/* ── Exported pair ──────────────────────────────────────────────────────────── */
export function CampCounselors() {
  const { mode } = useAuthCharacter();

  return (
    <>
      <Counselor
        side="left"
        src="/images/characters/counselor-female.png"
        alt="Camp counselor"
        mode={mode}
        enterDelay="0.1s"
      />
      <Counselor
        side="right"
        src="/images/characters/counselor-male.png"
        alt="Camp counselor"
        mode={mode}
        enterDelay="0.35s"
      />
    </>
  );
}
