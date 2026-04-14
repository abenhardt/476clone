/**
 * CASS — Contrast-Aware Surface System
 *
 * Decision engine for automatic surface tier assignment.
 *
 * Surface Tiers:
 *   surface-primary  → text-heavy content (panels, tables, dashboards, lists)
 *   surface-glass    → decorative only (stat cards, visual accents, hero — PROTECTED)
 *   surface-solid    → critical data requiring zero background bleed (medical, audit)
 *
 * Decision rules (highest priority wins):
 *   1. CRITICAL type (medical, audit, compliance)     → surface-solid
 *   2. DENSE density OR DATA/INTERACTIVE type         → surface-primary
 *   3. Over background image with non-minimal text    → surface-primary
 *   4. MINIMAL text + DECORATIVE type                 → surface-glass
 *
 * Protected components (surface assignment is frozen — never apply CASS):
 *   • CTA / action buttons
 *   • Status badges (approved, rejected, pending, etc.)
 *   • Hero section
 */

export type ContentDensity = 'minimal' | 'moderate' | 'dense';
export type ContentType    = 'decorative' | 'interactive' | 'data' | 'critical';
export type SurfaceTier    = 'surface-glass' | 'surface-primary' | 'surface-solid';

export interface SurfaceContext {
  /** How much text/data is displayed in the container */
  density: ContentDensity;
  /** Semantic content category */
  type: ContentType;
  /** True when the container floats over a background image or slideshow */
  overImage?: boolean;
}

/**
 * Determine the correct CASS surface tier for a given content context.
 *
 * @example
 *   const tier = getSurfaceTier({ density: 'dense', type: 'data' });
 *   // → 'surface-primary'
 *
 *   const tier = getSurfaceTier({ density: 'minimal', type: 'decorative' });
 *   // → 'surface-glass'
 *
 *   const tier = getSurfaceTier({ density: 'moderate', type: 'critical' });
 *   // → 'surface-solid'
 */
export function getSurfaceTier(ctx: SurfaceContext): SurfaceTier {
  // Rule 1 — Critical data always gets solid (no background bleed risk)
  if (ctx.type === 'critical') return 'surface-solid';

  // Rule 2 — Dense or data/interactive content always gets primary
  if (ctx.density === 'dense' || ctx.type === 'data' || ctx.type === 'interactive') {
    return 'surface-primary';
  }

  // Rule 3 — Any non-minimal text over a background image gets primary
  if (ctx.overImage && ctx.density !== 'minimal') return 'surface-primary';

  // Rule 4 — Minimal decorative content can use glass
  return 'surface-glass';
}

/**
 * Maps a CASS SurfaceTier to the corresponding GlassCard variant name.
 *
 * Use this when you need to pass a variant prop to <GlassCard>.
 *
 * @example
 *   const variant = tierToGlassVariant(getSurfaceTier({ density: 'dense', type: 'data' }));
 *   return <GlassCard variant={variant}>…</GlassCard>;
 */
export function tierToGlassVariant(
  tier: SurfaceTier,
): 'primary' | 'card' | 'solid' {
  switch (tier) {
    case 'surface-solid':   return 'solid';
    case 'surface-primary': return 'primary';
    case 'surface-glass':   return 'card';
  }
}

// ─── Density constants ────────────────────────────────────────────────────────
// Use these instead of raw strings for type safety and refactor-safety.
//
//   DENSE    → tables, lists with 5+ rows, dashboards, directory pages
//   MODERATE → cards with paragraphs, form sections, 2–3 stat rows
//   MINIMAL  → single metric (number + label), icon + title only
//
export const DENSITY = {
  DENSE:    'dense',
  MODERATE: 'moderate',
  MINIMAL:  'minimal',
} as const satisfies Record<string, ContentDensity>;

// ─── Content type constants ───────────────────────────────────────────────────
// Use these for the `type` field of SurfaceContext.
//
//   CRITICAL    → medical data, audit logs, compliance forms → always SOLID
//   DATA        → tables, directory listings, reports        → PRIMARY
//   INTERACTIVE → forms, modals, sidebars                    → PRIMARY
//   DECORATIVE  → stat cards (icon + number), visual accents → GLASS
//
export const CONTENT_TYPE = {
  CRITICAL:    'critical',
  DATA:        'data',
  INTERACTIVE: 'interactive',
  DECORATIVE:  'decorative',
} as const satisfies Record<string, ContentType>;

// ─── isReadable guard ─────────────────────────────────────────────────────────
// Programmatic readability check. Returns false when a surface should be
// upgraded. The decision engine above prevents this from ever being needed
// in production, but it's useful in tests or dev-mode assertions.
//
//   backgroundOpacity    — CSS rgba alpha (0–1)
//   hasTextContent       — true if the surface contains readable text
//   overComplexBg        — true if background is an image or high-noise gradient
//
export function isReadable(
  backgroundOpacity: number,
  hasTextContent: boolean,
  overComplexBg: boolean,
): boolean {
  if (!hasTextContent) return true;
  if (backgroundOpacity < 0.30 && hasTextContent) return false;
  if (overComplexBg && backgroundOpacity < 0.70) return false;
  return true;
}
