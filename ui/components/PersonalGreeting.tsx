/**
 * PersonalGreeting.tsx
 *
 * Full-width liquid glass greeting panel shown at the top of each dashboard.
 *
 * Design intent:
 *  - Spans the full hero width — no constrained max-width
 *  - Large headline name (using Crimson Pro at ~3rem) so it reads at a glance
 *  - Time-aware salutation + rotating role-aware subtitle
 *  - Liquid glass: backdrop-blur + specular top highlight + depth shadow
 *  - Text is white with shadows — readable over any photo background
 */

import { useState, useEffect, useRef } from 'react';
import type { User } from '@/shared/types/user.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type GreetingRole = 'applicant' | 'admin' | 'medical' | 'super_admin';

interface GreetingStats {
  pendingCount?: number;
  unreadCount?: number;
  camperCount?: number;
  overdueCount?: number;
  docOverdueCount?: number;
}

interface PersonalGreetingProps {
  user: User | null;
  role: GreetingRole;
  stats?: GreetingStats;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Welcome back';
}

function getDisplayName(user: User | null): string {
  if (!user) return 'there';
  const preferred = user.preferred_name?.trim();
  if (preferred) return preferred;
  return user.name ?? 'there';
}

function buildSubtitles(role: GreetingRole, stats: GreetingStats): string[] {
  const base: Record<GreetingRole, string[]> = {
    applicant: [
      "Let's make this summer unforgettable.",
      "Your camper's adventure starts here.",
      'Camp Burnt Gin is ready for you.',
      'A great season is just ahead.',
    ],
    admin: [
      'Camp operations are on track.',
      'The camp season is shaping up beautifully.',
      'Ready to make today count.',
      'Your team is counting on you.',
    ],
    medical: [
      'All campers are in good hands.',
      'Ready for a safe camp season.',
      'Keeping every camper healthy and happy.',
      'Your care makes all the difference.',
    ],
    super_admin: [
      'You have full visibility across the platform.',
      'Camp Burnt Gin is running smoothly.',
      'All systems operational.',
      'The platform is yours to command.',
    ],
  };

  const messages = [...base[role]];

  if (role === 'applicant' && stats.camperCount && stats.camperCount > 0) {
    const noun = stats.camperCount === 1 ? 'camper' : 'campers';
    messages.unshift(`${stats.camperCount} ${noun} registered for camp.`);
  }
  if ((role === 'admin' || role === 'super_admin') && stats.pendingCount && stats.pendingCount > 0) {
    const noun = stats.pendingCount === 1 ? 'application needs' : 'applications need';
    messages.unshift(`${stats.pendingCount} ${noun} your review.`);
  }
  if ((role === 'admin' || role === 'super_admin') && stats.unreadCount && stats.unreadCount > 0) {
    const noun = stats.unreadCount === 1 ? 'unread message' : 'unread messages';
    messages.unshift(`${stats.unreadCount} ${noun} waiting in your inbox.`);
  }
  if (role === 'super_admin' && stats.docOverdueCount && stats.docOverdueCount > 0) {
    const noun = stats.docOverdueCount === 1 ? 'document request is' : 'document requests are';
    messages.unshift(`${stats.docOverdueCount} ${noun} overdue.`);
  }
  if (role === 'medical' && stats.overdueCount && stats.overdueCount > 0) {
    const noun = stats.overdueCount === 1 ? 'follow-up is' : 'follow-ups are';
    messages.unshift(`${stats.overdueCount} ${noun} overdue.`);
  }

  return messages;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalGreeting({ user, role, stats = {} }: PersonalGreetingProps) {
  const subtitles = buildSubtitles(role, stats);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (subtitles.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setSubtitleIndex((i) => (i + 1) % subtitles.length);
        setVisible(true);
      }, 400);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [subtitles.length, role]);

  const greeting = getTimeGreeting();
  const name = getDisplayName(user);

  return (
    <div
      className="w-full rounded-2xl px-7 py-6 relative"
      style={{
        // ── Liquid glass ───────────────────────────────────────────────────
        background: 'rgba(255, 255, 255, 0.13)',
        backdropFilter: 'blur(32px) saturate(200%) brightness(108%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%) brightness(108%)',
        border: '1px solid rgba(255, 255, 255, 0.40)',
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        borderRightColor: 'rgba(255, 255, 255, 0.12)',
        boxShadow: [
          '0 24px 64px rgba(0, 0, 0, 0.24)',
          '0 4px 16px rgba(0, 0, 0, 0.14)',
          'inset 0 1.5px 0 rgba(255, 255, 255, 0.55)',
          'inset 1.5px 0 0 rgba(255, 255, 255, 0.20)',
          'inset -1px -1px 0 rgba(0, 0, 0, 0.06)',
        ].join(', '),
      }}
    >
      {/* Specular rim highlight — simulates light on the top edge of glass */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.65) 25%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0.65) 75%, transparent)',
        }}
        aria-hidden="true"
      />

      {/* Greeting salutation */}
      <p
        className="text-xs font-semibold uppercase tracking-[0.2em] mb-2 select-none"
        style={{
          color: 'rgba(255, 255, 255, 0.85)',
          textShadow: '0 1px 4px rgba(0,0,0,0.55)',
        }}
      >
        {greeting}
      </p>

      {/* Name — large headline */}
      <h2
        className="font-headline font-semibold leading-none mb-3 select-none"
        style={{
          fontSize: 'clamp(2.2rem, 4vw, 3.2rem)',
          color: '#ffffff',
          textShadow: '0 2px 10px rgba(0,0,0,0.50), 0 0 32px rgba(0,0,0,0.18)',
        }}
      >
        {name}
      </h2>

      {/* Thin separator */}
      <div
        className="mb-3"
        style={{ height: '1px', background: 'rgba(255,255,255,0.20)', width: '100%' }}
        aria-hidden="true"
      />

      {/* Rotating subtitle */}
      <p
        className="leading-snug select-none"
        style={{
          fontSize: 'clamp(0.9375rem, 1.5vw, 1.0625rem)',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.96)',
          textShadow: '0 1px 6px rgba(0,0,0,0.55)',
          transition: 'opacity 400ms ease-in-out',
          opacity: visible ? 1 : 0,
          minHeight: '1.5rem',
          letterSpacing: '0.01em',
        }}
      >
        {subtitles[subtitleIndex]}
      </p>
    </div>
  );
}
