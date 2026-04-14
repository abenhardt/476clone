/**
 * authSlice.ts — Redux slice for authentication state
 *
 * A Redux "slice" bundles the state shape, initial values, and all the functions
 * (called "reducers") that can change that state into one tidy object.
 *
 * This slice tracks:
 * - Who is logged in (user object)
 * - The Bearer token used to prove identity on API calls
 * - Whether MFA (two-factor authentication) is required and completed
 * - Session metadata (ID, last activity timestamp)
 * - Whether the app is still loading the initial auth state (isLoading)
 *
 * isLoading starts as true on every page load. ProtectedRoute shows a spinner
 * until useAuthInit() finishes checking the token, then sets it to false.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/shared/types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  // The currently logged-in user, or null if nobody is logged in
  user: User | null;
  // The API Bearer token, or null if not authenticated
  token: string | null;
  // Unix timestamp (ms) when the token expires, or null if no expiry info
  tokenExpiry: number | null;
  // True when a valid token + user are confirmed by the API
  isAuthenticated: boolean;
  // True while useAuthInit() is validating a stored token on page load
  isLoading: boolean;
  // True if the backend says MFA must be completed before accessing the app
  mfaRequired: boolean;
  // True once the user has successfully completed the MFA verification step
  mfaVerified: boolean;
  // An optional server-assigned session identifier
  sessionId: string | null;
  // Unix timestamp (ms) of the last recorded user activity (for timeout tracking)
  lastActivity: number | null;
  // Unix timestamp (ms) when a step-up MFA challenge was last completed.
  // null means no step-up has been verified in this session.
  // The backend cache (TTL 15 min) is authoritative — this mirrors it locally
  // so the UI can show "verified" state without an extra round-trip.
  mfaStepUpVerifiedAt: number | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  tokenExpiry: null,
  isAuthenticated: false,
  // starts true — ProtectedRoute shows a loader until auth is resolved on page refresh
  isLoading: true,
  mfaRequired: false,
  mfaVerified: false,
  sessionId: null,
  lastActivity: null,
  mfaStepUpVerifiedAt: null,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /** Set the authenticated user and mark as authenticated */
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      // isAuthenticated is derived from whether a user object exists
      state.isAuthenticated = action.payload !== null;
    },

    /** Store the Bearer token and compute its expiry timestamp */
    setToken(
      state,
      action: PayloadAction<{ token: string; expiresIn?: number }>
    ) {
      state.token = action.payload.token;
      // expiresIn is in seconds from the server; convert to an absolute ms timestamp
      state.tokenExpiry = action.payload.expiresIn
        ? Date.now() + action.payload.expiresIn * 1000
        : null;
    },

    /** Signal that MFA is required before accessing the app */
    setMfaRequired(state, action: PayloadAction<boolean>) {
      state.mfaRequired = action.payload;
    },

    /** Signal that the user has completed MFA verification */
    setMfaVerified(state, action: PayloadAction<boolean>) {
      state.mfaVerified = action.payload;
    },

    /**
     * Record that a step-up MFA challenge was completed successfully.
     * Pass Date.now() on success; pass null to clear (e.g. on MFA disable).
     */
    setMfaStepUpVerifiedAt(state, action: PayloadAction<number | null>) {
      state.mfaStepUpVerifiedAt = action.payload;
    },

    /** Store the current session identifier */
    setSessionId(state, action: PayloadAction<string | null>) {
      state.sessionId = action.payload;
    },

    /** Update the last activity timestamp (for session timeout tracking) */
    updateLastActivity(state) {
      state.lastActivity = Date.now();
    },

    /** Manually control the loading flag */
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },

    /**
     * Called after the auth init check completes (token valid or no token found).
     * Sets isLoading to false so ProtectedRoute can evaluate auth state and
     * either show the page or redirect to /login.
     */
    hydrateAuth(state) {
      state.isLoading = false;
    },

    /**
     * Merge a partial update into the current user without replacing the whole object.
     *
     * Prefer this over setUser when only one or two fields change (e.g. after an
     * avatar upload or a profile field save). Unlike `setUser({ ...authUser, ... })`,
     * this reads from the *current* Immer-managed state inside the reducer, so it
     * is immune to stale-closure bugs that occur when the caller spreads a
     * render-time snapshot of the user.
     */
    patchUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        Object.assign(state.user, action.payload);
      }
    },

    /**
     * Full state reset — called on logout or when a 401 mid-session event fires.
     * Returns the initial state but with isLoading explicitly false so no spinner
     * appears after logout.
     */
    clearAuth() {
      return { ...initialState, isLoading: false };
    },
  },
});

// Export individual action creators so components can dispatch them
export const {
  setUser,
  patchUser,
  setToken,
  setMfaRequired,
  setMfaVerified,
  setMfaStepUpVerifiedAt,
  setSessionId,
  updateLastActivity,
  setLoading,
  hydrateAuth,
  clearAuth,
} = authSlice.actions;

// Export the reducer to be registered in the store
export const authReducer = authSlice.reducer;
