/**
 * useIdleTimeout.ts — HIPAA-compliant idle session timeout
 *
 * Tracks user activity (mouse, keyboard, touch, scroll) and automatically
 * clears the session after a configurable period of inactivity.
 *
 * Why this matters for HIPAA:
 *   Protected health information (PHI) is visible in several portals. If a
 *   staff member walks away from an unlocked screen, the session must close
 *   automatically to prevent unauthorized access to PHI.
 *
 * Behaviour:
 *   - When the user is authenticated, activity events reset a local timer.
 *   - Every minute, a background check tests whether the inactivity window
 *     has been exceeded.
 *   - On timeout: the Bearer token is removed from localStorage, Redux auth
 *     state is cleared, and the user is redirected to /login by ProtectedRoute.
 *   - Does nothing when the user is not authenticated (no event listeners added).
 *   - Disabled entirely in demo mode (no real session to expire).
 */

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearAuth } from '@/features/auth/store/authSlice';
import { DEMO_MODE } from '@/lib/demo/demoMode';

/** Inactivity window before the session is terminated (60 minutes). */
const IDLE_TIMEOUT_MS = 60 * 60 * 1_000;

/**
 * Minimum gap between updating the "last activity" timestamp.
 * Without this, rapid mouse movement would dispatch hundreds of updates/second.
 */
const ACTIVITY_THROTTLE_MS = 5_000;

/** How often the idle check runs. Granularity is acceptable at 60 s. */
const CHECK_INTERVAL_MS = 60_000;

/** DOM events treated as "the user is actively using the app." */
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export function useIdleTimeout(): void {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  // lastActivityRef holds a Unix timestamp (ms). Kept in a ref so the idle
  // check interval always reads the latest value without a stale closure.
  const lastActivityRef = useRef<number>(Date.now());
  // Tracks whether an activity update is already pending (throttle guard).
  const throttledRef = useRef(false);

  useEffect(() => {
    // Skip in demo mode — there is no real backend session to expire.
    if (DEMO_MODE) return;
    // Do nothing while the user is not authenticated.
    if (!isAuthenticated) return;

    // Stamp the current time as the last known activity so the first check
    // has a valid baseline to compare against.
    lastActivityRef.current = Date.now();

    function handleActivity() {
      // Throttle: at most one update per ACTIVITY_THROTTLE_MS window.
      if (throttledRef.current) return;
      throttledRef.current = true;
      lastActivityRef.current = Date.now();
      setTimeout(() => { throttledRef.current = false; }, ACTIVITY_THROTTLE_MS);
    }

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    // Periodic idle check — fires once per minute.
    const idleCheckInterval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= IDLE_TIMEOUT_MS) {
        // Remove the persisted token so the next page load doesn't restore
        // the session for the person who now has physical access to the device.
        sessionStorage.removeItem('auth_token');
        dispatch(clearAuth());
        toast.info('Your session has expired due to inactivity. Please sign in again.', {
          duration: 8_000,
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      clearInterval(idleCheckInterval);
    };
  }, [dispatch, isAuthenticated]);
}
