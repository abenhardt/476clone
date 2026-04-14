/**
 * StatCard.tsx
 *
 * Purpose: A statistic card used on all dashboard overview pages.
 *
 * Redesigned (Phase 12) for localization resilience:
 *   - Left-aligned layout with flexible width
 *   - Reduced padding so cards don't feel cramped in 5-column grids
 *   - Label wraps gracefully instead of truncating
 *   - Minimum width safeguard prevents awkward squishing
 *   - Works in English and Spanish without layout breakage
 *
 * Adaptive glass (glass system upgrade):
 *   Uses .glass-card CSS class instead of inline styles.
 *   The class adapts automatically to the background tone via data-bg-tone
 *   on the DashboardShell root — see design-tokens.css.
 */

import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Icon and accent color — defaults to `var(--ember-orange)`. */
  color?: string;
  /** Optional unit suffix appended after the number (e.g. "%", "hrs"). */
  suffix?: string;
  /** Kept for API compatibility. */
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'var(--ember-orange)',
  suffix = '',
}: StatCardProps) {
  return (
    <div
      className="glass-card rounded-2xl p-4 sm:p-5 flex items-start gap-3 min-w-0"
    >
      {/* Icon container — 10% opacity tint of the accent color */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Stat value and label — min-w-0 enables text wrapping instead of overflow */}
      <div className="flex-1 min-w-0">
        <p
          className="text-2xl font-headline font-semibold leading-none"
          style={{ color: 'var(--foreground)' }}
        >
          {value.toLocaleString()}{suffix}
        </p>
        <p
          className="text-xs sm:text-sm mt-1.5 leading-snug"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
