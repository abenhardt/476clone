/**
 * useBootstrapReady.ts
 *
 * Render stability gate — returns true only after:
 *  1. Component has mounted (eliminates SSR/hydration flash)
 *  2. Redux auth rehydration from persist is complete
 *
 * Usage: gate any conditional UI (empty state, toolbar, tabs) behind this.
 * Until ready, render only skeleton. This eliminates the "pop-in" glitch
 * where UI briefly shows one state before snapping to the correct state.
 */

import { useEffect, useState } from 'react';
import { useAppSelector } from '@/store/hooks';

export function useBootstrapReady(): boolean {
  const authIsLoading = useAppSelector((s) => s.auth.isLoading);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted && !authIsLoading;
}
