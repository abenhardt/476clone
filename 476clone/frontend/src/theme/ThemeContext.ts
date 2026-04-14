/**
 * ThemeContext.ts
 *
 * Purpose: Creates and exports the React context object that carries the
 * current theme value (always 'light') throughout the component tree.
 *
 * Two exports:
 *   - ThemeContext — the raw context object, consumed by ThemeEngine's Provider.
 *   - useThemeContext() — a safe hook that throws a descriptive error when used
 *     outside a <ThemeProvider>, making misconfiguration obvious during development.
 *
 * Why a separate file from ThemeEngine.tsx?
 *   React's fast-refresh requires that files exporting components don't also
 *   export non-component values. Splitting context creation here ensures hot
 *   reload works correctly for both the Provider and consumer hooks.
 */

import { createContext, useContext } from 'react';
import type { ThemeContextValue } from './types';

// Initial value is null; the Provider in ThemeEngine supplies the real value.
export const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Safe hook for reading the theme context.
 * Throws a helpful error message if used outside <ThemeProvider> so developers
 * get a clear signal rather than a cryptic null-dereference.
 */
export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext must be used within <ThemeProvider>');
  return ctx;
}
