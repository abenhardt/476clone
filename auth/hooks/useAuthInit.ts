/**
 * useAuthInit.ts — App-startup authentication hydration hook
 *
 * Called once in App.tsx when the app first mounts. It handles the common scenario
 * where a user refreshes the page — they have a valid token saved in sessionStorage
 * but Redux is empty because page refresh wipes in-memory state.
 *
 * What it does:
 * 1. Registers a global listener for the 'auth:unauthorized' custom window event.
 *    The axios interceptor fires this event when any protected API request gets a
 *    401 mid-session (e.g. the token silently expired while the user was browsing).
 * 2. On mount, reads the token from sessionStorage and calls GET /api/user to
 *    validate it. If valid, restores the Redux auth state so the user stays logged in.
 *    If invalid or absent, clears auth state and lets ProtectedRoute redirect to /login.
 *
 * The eslint-disable comment on the second useEffect is intentional — that effect
 * should only ever run once on mount, not re-run when dispatch changes.
 */

import { useEffect, useRef } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { store } from '@/store';
import { setUser, setToken, clearAuth, hydrateAuth } from '@/features/auth/store/authSlice';
import { getAuthenticatedUser } from '@/features/auth/api/auth.api';
import { DEMO_MODE, DEMO_USER } from '@/lib/demo/demoMode';

export function useAuthInit(): void {
  const dispatch = useAppDispatch();
  // Guards against firing multiple simultaneous re-validations when multiple
  // API calls return 401 at the same time (e.g., on a page with several fetches).
  const isRevalidating = useRef(false);

  // Effect 1: Listen for mid-session 401s fired by the axios response interceptor.
  // Rather than immediately destroying the session, first re-validate with GET /api/user.
  // This prevents a single misconfigured endpoint (or a transient 401) from logging
  // the user out when their token is actually still valid.
  useEffect(() => {
    // Demo mode: API calls will return 401 (no real token). Suppress the unauthorized
    // event so the demo session is never cleared by a failed API response.
    if (DEMO_MODE) return;

    function handleUnauthorized() {
      // De-duplicate: if a re-validation is already in flight, ignore this event.
      if (isRevalidating.current) return;

      // Short-circuit: if there's no token, auth is already gone — no API call needed.
      // Without this guard, handleUnauthorized would call getAuthenticatedUser() with no
      // token → server returns 401 → auth:unauthorized fires again → infinite loop.
      if (!sessionStorage.getItem('auth_token')) {
        dispatch(clearAuth());
        return;
      }

      // Capture the active token NOW (before the async call) using the same precedence
      // as the axios request interceptor: Redux first, sessionStorage as fallback.
      // Re-reading sessionStorage AFTER the async call is unsafe — another tab may have
      // cleared it, causing a false "no token" state.
      const activeToken = store.getState().auth.token ?? sessionStorage.getItem('auth_token');

      isRevalidating.current = true;

      getAuthenticatedUser()
        .then((user) => {
          // Token is valid — the 401 came from a specific endpoint, not the session.
          // Keep the user logged in and update the user object in case it drifted.
          // Use the token we captured at call-time, not a re-read from sessionStorage.
          if (activeToken) dispatch(setToken({ token: activeToken }));
          dispatch(setUser(user));
        })
        .catch(() => {
          // Confirmed: the token itself is invalid. Clear everything and redirect to login.
          sessionStorage.removeItem('auth_token');
          dispatch(clearAuth());
        })
        .finally(() => {
          isRevalidating.current = false;
        });
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    // Cleanup: remove the listener when the component unmounts to avoid memory leaks
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [dispatch]);

  // Effect 2: On mount, restore the session if a token exists in sessionStorage
  useEffect(() => {
    // Demo mode: skip the real auth flow entirely. Inject the mock admin user
    // directly into Redux so ProtectedRoute passes without any API call.
    if (DEMO_MODE) {
      dispatch(setToken({ token: 'demo-token' }));
      dispatch(setUser(DEMO_USER));
      dispatch(hydrateAuth());
      return;
    }

    const token = sessionStorage.getItem('auth_token');

    // No stored token — nothing to restore, mark hydration complete immediately
    if (!token) {
      dispatch(hydrateAuth());
      return;
    }

    // Token found — validate it with the API to ensure it's still active.
    //
    // Retry strategy (two tiers):
    //   Tier 1 — fast retries (0→1→2): 2 s gap each. Covers brief network blips.
    //   Tier 2 — slow retries (3→4): 8 s gap each. Covers server restarts (php artisan serve,
    //            container cold-starts) that take 10–30 s to come back up.
    //
    // A 401 response from getAuthenticatedUser() causes the axios interceptor to fire
    // auth:unauthorized, which calls handleUnauthorized (above) and removes the token from
    // sessionStorage if re-validation also fails. The catch block checks for that: an empty
    // sessionStorage means this is a confirmed auth failure, not a transient one.
    //
    // Network/5xx failures leave the token in sessionStorage → retries proceed.
    // Only after exhausting all 5 attempts with the token still present do we give up
    // and redirect to /login (the server appears to be genuinely unreachable).
    let cancelled = false;

    function tryValidate(retryCount: number) {
      // Block handleUnauthorized (Effect 1) from starting a concurrent re-validation
      // while tryValidate is already in flight. Without this, the axios interceptor
      // fires auth:unauthorized synchronously during the 401 response, which would
      // cause both tryValidate AND handleUnauthorized to run the same API call at once.
      isRevalidating.current = true;

      getAuthenticatedUser()
        .then((user) => {
          if (cancelled) return;
          dispatch(setToken({ token: token as string }));
          dispatch(setUser(user));
          dispatch(hydrateAuth());
        })
        .catch((err: { retryAfter?: number; isAuthError?: boolean } | undefined) => {
          if (cancelled) return;
          // If the token was removed, the axios interceptor already fired
          // auth:unauthorized (a real 401) — clear auth and redirect to login.
          if (!sessionStorage.getItem('auth_token')) {
            dispatch(clearAuth());
            return;
          }
          // 401 Unauthorized — the token is definitively invalid (expired or revoked).
          // The handleUnauthorized listener was blocked (isRevalidating=true), so it
          // couldn't clear the token. Do it here to prevent infinite retry loops and
          // avoid a stale token being picked up by subsequent re-validation attempts.
          if (err?.isAuthError) {
            sessionStorage.removeItem('auth_token');
            dispatch(clearAuth());
            return;
          }
          // 429 Too Many Requests — the server IS reachable, we're just rate-limited.
          // Retrying immediately makes it worse. Surface the app so the user can act,
          // and the rate limit window will clear by the next page interaction.
          if (err?.retryAfter !== undefined) {
            dispatch(hydrateAuth());
            return;
          }
          // Transient failure (5xx / network) — the token is still valid but the server
          // is momentarily unreachable. Retry rather than redirecting to /login.
          if (retryCount < 2) {
            // Tier 1: fast retries at 2 s each
            setTimeout(() => tryValidate(retryCount + 1), 2000);
          } else if (retryCount < 4) {
            // Tier 2: slow retries at 8 s each — allows ~30 s for a server restart
            setTimeout(() => tryValidate(retryCount + 1), 8000);
          } else {
            // All 5 attempts exhausted. Server appears unreachable — stop the spinner
            // and let ProtectedRoute redirect to /login. The token stays in sessionStorage
            // so the next page load (within the same browser tab) will try again once the server is back.
            dispatch(hydrateAuth());
          }
        })
        .finally(() => {
          // Release the guard so handleUnauthorized can respond to genuine 401s
          // that fire after startup validation completes.
          isRevalidating.current = false;
        });
    }

    tryValidate(0);
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
