/**
 * types.ts
 *
 * Purpose: TypeScript type definitions for the theme system.
 *
 * ThemeContextValue is the shape of the object stored in ThemeContext and
 * returned by useThemeContext(). It deliberately has only one field because
 * this application is always light-mode — there is no user-switchable dark mode.
 *
 * If dark mode is ever added, extend this interface and update ThemeEngine.tsx
 * to compute the value dynamically.
 */

export interface ThemeContextValue {
  /** Always 'light' — dark mode is not supported in this application. */
  resolvedTheme: 'light';
}
