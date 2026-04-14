/**
 * themePreferences.ts
 *
 * Purpose: Utility functions for reading and applying persistent accessibility
 * preferences that the user can change in the Settings page.
 *
 * Three preference categories:
 *   1. Font scale — adjusts base font size via a data-font-scale attribute.
 *   2. High contrast — enables stronger color contrast via a data-high-contrast attribute.
 *   3. Reduced motion — disables animations via a data-reduced-motion attribute.
 *
 * How it works:
 *   Each "apply" function sets a data-* attribute on <html> (documentElement).
 *   CSS in design-tokens.css reads these attributes with attribute selectors
 *   (e.g. [data-font-scale="large"]) and overrides the relevant CSS custom properties.
 *   Simultaneously the preference is saved to localStorage so it persists across sessions.
 *
 * Separation from ThemeEngine.tsx:
 *   React fast-refresh requires component files to only export components.
 *   Keeping these plain utility functions here avoids breaking hot reload.
 */

// localStorage keys — prefixed with "cbg-" to avoid collisions with other apps.
const FONT_SCALE_KEY    = 'cbg-font-scale';
const HIGH_CONTRAST_KEY = 'cbg-high-contrast';
const REDUCED_MOTION_KEY = 'cbg-reduced-motion';

/** The four available font scale options — maps to data-font-scale CSS attribute values. */
export type FontScale = 'small' | 'default' | 'large' | 'xlarge';

/**
 * Applies a font scale by setting a data attribute on <html>.
 * Also persists the choice to localStorage for the next session.
 */
export function applyFontScale(scale: FontScale) {
  document.documentElement.setAttribute('data-font-scale', scale);
  // Try/catch guards against Safari's restrictive localStorage in private mode.
  try { localStorage.setItem(FONT_SCALE_KEY, scale); } catch { /* noop */ }
}

/**
 * Enables or disables high-contrast mode by toggling a data attribute on <html>.
 * CSS responds with stronger border colors and higher-contrast text tokens.
 */
export function applyHighContrast(enabled: boolean) {
  document.documentElement.setAttribute('data-high-contrast', String(enabled));
  try { localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled)); } catch { /* noop */ }
}

/**
 * Enables or disables reduced motion by toggling a data attribute on <html>.
 * CSS (and optionally JS code) checks this to skip or shorten animations.
 */
export function applyReducedMotion(enabled: boolean) {
  document.documentElement.setAttribute('data-reduced-motion', String(enabled));
  try { localStorage.setItem(REDUCED_MOTION_KEY, String(enabled)); } catch { /* noop */ }
}

/**
 * Reads the saved font scale from localStorage.
 * Returns 'default' if no preference was saved or the value is unrecognized.
 */
export function getSavedFontScale(): FontScale {
  try {
    const v = localStorage.getItem(FONT_SCALE_KEY);
    // Only accept known valid values — reject anything else to avoid bad CSS states.
    if (v === 'small' || v === 'default' || v === 'large' || v === 'xlarge') return v;
  } catch { /* noop */ }
  return 'default';
}

/** Reads the saved high-contrast preference from localStorage. Defaults to false. */
export function getSavedHighContrast(): boolean {
  try { return localStorage.getItem(HIGH_CONTRAST_KEY) === 'true'; } catch { return false; }
}

/** Reads the saved reduced-motion preference from localStorage. Defaults to false. */
export function getSavedReducedMotion(): boolean {
  try { return localStorage.getItem(REDUCED_MOTION_KEY) === 'true'; } catch { return false; }
}
