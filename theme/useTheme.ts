/**
 * useTheme.ts
 *
 * Purpose: Public barrel export for the theme system.
 *
 * Why a barrel?
 *   Instead of importing from three different files (ThemeContext, ThemeEngine,
 *   types), consumers import everything from a single path:
 *     import { useThemeContext, ThemeProvider } from '@/theme/useTheme'
 *
 * Exports:
 *   - useThemeContext — hook to read { resolvedTheme } from any component.
 *   - ThemeProvider   — wrap the app root with this to supply the context value.
 *   - ThemeContextValue — TypeScript type for the context shape.
 */

export { useThemeContext } from './ThemeContext';
export { ThemeProvider } from './ThemeEngine';
export type { ThemeContextValue } from './types';
