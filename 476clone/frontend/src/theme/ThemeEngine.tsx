/**
 * ThemeEngine.tsx
 *
 * Purpose: Provides the ThemeContext value to the entire React component tree.
 *
 * Design decision — permanent light mode:
 *   This application is always light-mode only (permanent design decision). The ThemeProvider
 *   hard-codes `resolvedTheme: 'light'` instead of reading system preferences or
 *   localStorage. This keeps the provider tiny and avoids any flash-of-unstyled-
 *   content that dark-mode detection can introduce.
 *
 * Separation of concerns:
 *   Accessibility preference utilities (font scale, high contrast, reduced motion)
 *   live in themePreferences.ts. They are kept in a separate file so that Vite's
 *   fast-refresh can hot-reload preference functions without dismounting the provider.
 */

import { type ReactNode } from 'react';
import type { ThemeContextValue } from './types';
import { ThemeContext } from './ThemeContext';

/**
 * Wrap your app with <ThemeProvider> near the root so any component can call
 * useTheme() / useThemeContext() to read the current resolved theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // Always 'light' — dark mode is not supported in this application.
  const value: ThemeContextValue = { resolvedTheme: 'light' };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
