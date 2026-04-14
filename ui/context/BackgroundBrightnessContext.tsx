/**
 * BackgroundBrightnessContext.tsx
 *
 * Provides the adaptive glass system with a tone signal that describes
 * the current background image's luminosity.
 *
 * Consumers:
 *   - BackgroundSlideshow calls setTone() when the active slide changes.
 *   - DashboardShell applies data-bg-tone to the root shell div, which
 *     CSS attribute selectors use to adapt glass opacity/blur values.
 *
 * Tone values:
 *   'dark'    → dark background → increase glass opacity for readability
 *   'light'   → bright background → reduce glass opacity, let bg breathe
 *   'neutral' → balanced background → default glass values
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type BgTone = 'dark' | 'light' | 'neutral';

interface BackgroundBrightnessContextValue {
  tone: BgTone;
  setTone: (tone: BgTone) => void;
}

const BackgroundBrightnessContext = createContext<BackgroundBrightnessContextValue>({
  tone: 'neutral',
  setTone: () => {},
});

export function BackgroundBrightnessProvider({ children }: { children: ReactNode }) {
  const [tone, setToneState] = useState<BgTone>('neutral');

  const setTone = useCallback((next: BgTone) => {
    setToneState(next);
  }, []);

  return (
    <BackgroundBrightnessContext.Provider value={{ tone, setTone }}>
      {children}
    </BackgroundBrightnessContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBackgroundTone(): BackgroundBrightnessContextValue {
  return useContext(BackgroundBrightnessContext);
}
