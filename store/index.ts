/**
 * store/index.ts — Redux store configuration
 *
 * Redux is a global state manager — a single source of truth for data that
 * multiple components need to share (like "who is logged in?").
 *
 * This file:
 * 1. Combines all slice reducers into one store.
 * 2. Adds the PHI protection middleware (HIPAA compliance).
 * 3. Exports TypeScript types so hooks stay type-safe.
 *
 * Auth token persistence is handled via sessionStorage directly (not redux-persist).
 * PHI is never written to storage — only the opaque Bearer token is stored.
 */

import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@/features/auth/store/authSlice';
import { phiProtectionMiddleware } from './middleware/phiProtection';

export const store = configureStore({
  reducer: {
    // auth slice: holds the logged-in user, token, MFA state, etc.
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    // Append our custom HIPAA middleware after Redux Toolkit's built-in ones
    getDefaultMiddleware().concat(phiProtectionMiddleware),
  // Only show Redux DevTools in the browser extension when explicitly enabled via env var
  devTools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
});

// RootState: the shape of the entire Redux state tree — used in useAppSelector
export type RootState = ReturnType<typeof store.getState>;
// AppDispatch: the type of the dispatch function — used in useAppDispatch
export type AppDispatch = typeof store.dispatch;
