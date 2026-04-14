/**
 * GlassCard.tsx
 *
 * Reusable container component for the adaptive glass system.
 *
 * Legacy variants (direct glass class mapping):
 *   'card'    → .glass-card   — DECORATIVE ONLY: metric stat cards, quick-links
 *   'panel'   → .glass-panel  — semi-opaque glass for sections, lists
 *   'hero'    → .glass-strong — rich glass for hero banners (PROTECTED)
 *   'data'    → .glass-data   — solid high-contrast fallback for dense tables
 *
 * CASS surface tier variants (preferred for new components):
 *   'primary' → .surface-primary — default for all text-heavy content
 *                                   (tables, dashboards, inbox, documents, analytics)
 *   'solid'   → .surface-solid   — critical data requiring zero background bleed
 *                                   (medical records, audit logs, compliance forms)
 *   Use 'card' (→ .surface-glass) for decorative/minimal-text surfaces.
 *
 * The CSS classes are defined in design-tokens.css and adapt to the
 * current background tone via the [data-bg-tone] attribute on the shell root.
 *
 * Usage:
 *   <GlassCard variant="primary" className="rounded-2xl overflow-hidden">
 *     <table>…</table>
 *   </GlassCard>
 */

import type { ReactNode, CSSProperties, ElementType } from 'react';

type GlassVariant = 'card' | 'panel' | 'hero' | 'data' | 'primary' | 'solid';

const VARIANT_CLASS: Record<GlassVariant, string> = {
  card:    'glass-card',
  panel:   'glass-panel',
  hero:    'glass-strong',
  data:    'glass-data',
  primary: 'surface-primary',
  solid:   'surface-solid',
};

interface GlassCardProps {
  variant?: GlassVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Render as a different element (default: div) */
  as?: ElementType;
  [key: string]: unknown;
}

export function GlassCard({
  variant = 'card',
  className = '',
  style,
  children,
  as: Tag = 'div',
  ...rest
}: GlassCardProps) {
  return (
    <Tag
      className={`${VARIANT_CLASS[variant]} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
