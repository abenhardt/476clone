# State Management

## Overview

The frontend uses Redux Toolkit for global state. The store is minimal by design: only the authentication slice is registered. All other data (applications, campers, medical records, sessions, etc.) is fetched on-demand within components using local `useState` and `useEffect`, and is not stored in Redux.

There is no redux-persist library. The auth token is persisted manually to `sessionStorage` under the key `auth_token`. The Redux store itself is entirely in-memory and is reset on page refresh; `useAuthInit` restores the auth state from `sessionStorage` on every page load.

---

## Store Setup

**File:** `src/store/index.ts`

```ts
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(phiProtectionMiddleware),
  devTools: import.meta.env.VITE_ENABLE_DEVTOOLS === 'true',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Key configuration decisions:

- **Single reducer:** Only `auth` is registered. Feature data is local to components.
- **PHI protection middleware:** A custom middleware appended after Redux Toolkit's built-in middleware. See the PHI Protection Middleware section below.
- **DevTools gated by env var:** Redux DevTools are only enabled when `VITE_ENABLE_DEVTOOLS=true` is set. They are off by default in all environments.

---

## Typed Hooks

**File:** `src/store/hooks.ts`

The raw `useDispatch` and `useSelector` hooks from `react-redux` are not used directly in components. Typed wrappers are imported instead, giving TypeScript full knowledge of the store shape:

```ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

All components import from `@/store/hooks`:

```ts
import { useAppDispatch, useAppSelector } from '@/store/hooks';

const dispatch = useAppDispatch();
const user = useAppSelector((state) => state.auth.user);
```

---

## Auth Slice

**File:** `src/features/auth/store/authSlice.ts`

The only Redux slice in the application. It tracks everything needed to determine whether a user is authenticated and what they are permitted to do.

### State Shape

```ts
interface AuthState {
  user:            User | null;       // Authenticated user object, or null
  token:           string | null;     // API Bearer token, or null
  tokenExpiry:     number | null;     // Unix timestamp (ms) of token expiry, or null
  isAuthenticated: boolean;           // True when user + valid token are confirmed
  isLoading:       boolean;           // True while useAuthInit is validating stored token
  mfaRequired:     boolean;           // True if backend requires MFA before portal access
  mfaVerified:     boolean;           // True after the user passes the MFA check
  sessionId:       string | null;     // Optional server-assigned session identifier
  lastActivity:    number | null;     // Unix timestamp (ms) of last user activity
}
```

**Initial state:**

```ts
{
  user: null,
  token: null,
  tokenExpiry: null,
  isAuthenticated: false,
  isLoading: true,          // starts true — ProtectedRoute shows spinner until resolved
  mfaRequired: false,
  mfaVerified: false,
  sessionId: null,
  lastActivity: null,
}
```

`isLoading` starts as `true` on every page load. `ProtectedRoute` renders a `<FullPageLoader />` while `isLoading` is true, preventing a flash redirect to `/login` on page refresh before `useAuthInit` has had a chance to validate the stored token.

### Actions

| Action | Payload | Effect |
|---|---|---|
| `setUser(user \| null)` | `User \| null` | Sets `state.user`; sets `isAuthenticated` to `user !== null` |
| `setToken({ token, expiresIn? })` | `{ token: string; expiresIn?: number }` | Sets `state.token`; computes `tokenExpiry` from `expiresIn` (seconds → absolute ms timestamp) |
| `setMfaRequired(bool)` | `boolean` | Sets `state.mfaRequired` |
| `setMfaVerified(bool)` | `boolean` | Sets `state.mfaVerified` |
| `setSessionId(id \| null)` | `string \| null` | Sets `state.sessionId` |
| `updateLastActivity()` | none | Sets `state.lastActivity` to `Date.now()` |
| `setLoading(bool)` | `boolean` | Manually sets `state.isLoading` |
| `hydrateAuth()` | none | Sets `state.isLoading` to `false`; called when startup validation completes (success or terminal failure) |
| `clearAuth()` | none | Resets entire state to `initialState` with `isLoading: false`; called on logout or confirmed 401 |

---

## Session Persistence

### What Persists

Only the raw Bearer token string is persisted. It is written to `sessionStorage` under the key `auth_token` immediately after a successful login, and removed on logout or confirmed session expiry.

```ts
// Written in LoginPage.tsx and RegisterPage.tsx after successful API response:
sessionStorage.setItem('auth_token', token);

// Removed on logout or confirmed 401:
sessionStorage.removeItem('auth_token');
```

`sessionStorage` is tab-scoped: the token is cleared automatically when the browser tab is closed. Opening the application in a new tab requires a fresh login.

### What Does Not Persist

Everything else in the Redux store — the `user` object, `isAuthenticated`, MFA state, session ID, last activity — exists only in memory. It is not written to `sessionStorage`, `localStorage`, or any other storage mechanism.

### Startup Restoration (`useAuthInit`)

**File:** `src/features/auth/hooks/useAuthInit.ts`

Called once from `App.tsx` on mount. On every page load the Redux store is empty (`isLoading: true`, `user: null`). `useAuthInit` bridges the gap:

1. Reads `auth_token` from `sessionStorage`.
2. If no token is found, dispatches `hydrateAuth()` immediately (sets `isLoading: false`), and `ProtectedRoute` redirects to `/login`.
3. If a token is found, calls `GET /api/user` to validate it with the backend.
4. On success: dispatches `setToken()` + `setUser()` + `hydrateAuth()`. The user is seamlessly returned to the page they were on.
5. On failure: employs a tiered retry strategy before giving up.

**Retry strategy for transient failures (5xx / network errors):**

| Attempt | Delay | Rationale |
|---|---|---|
| 0 | immediate | First try |
| 1 | 2 s | Fast retry — brief network blip |
| 2 | 2 s | Fast retry |
| 3 | 8 s | Slow retry — allows for server restart (~30 s total) |
| 4 | 8 s | Slow retry |
| Give up | — | Dispatches `hydrateAuth()` — ProtectedRoute redirects to `/login` |

A `401` response (token definitively invalid or expired) bypasses the retry loop entirely: the token is removed from `sessionStorage` and `clearAuth()` is dispatched immediately.

A `429` response (rate-limited) also bypasses retries: `hydrateAuth()` is dispatched so the app surfaces and the rate limit clears naturally.

A `useRef` guard (`isRevalidating`) prevents concurrent re-validation calls when multiple API requests return 401 simultaneously on the same page.

### Mid-Session 401 Handling

The axios response interceptor fires a `CustomEvent('auth:unauthorized')` on the `window` object when any protected endpoint returns a 401 during an active session. `useAuthInit` registers a listener for this event.

On receiving the event, the listener re-validates with `GET /api/user` before clearing the session. This prevents a misconfigured endpoint (which returns 401 for reasons unrelated to the session token) from logging the user out when their token is actually still valid. If re-validation also fails, `sessionStorage.removeItem('auth_token')` and `clearAuth()` are called.

Auth endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/mfa/*`) are excluded from the `auth:unauthorized` event dispatch, because a 401 from those endpoints indicates wrong credentials rather than an expired session.

---

## PHI Protection Middleware

**File:** `src/store/middleware/phiProtection.ts`

A custom Redux middleware that runs on every dispatched action. It has three responsibilities:

**1. Allow redux-persist framework actions (pass-through).**
The following internal lifecycle action types are allowed through without inspection: `persist/PERSIST`, `persist/REHYDRATE`, `persist/REGISTER`, `persist/FLUSH`, `persist/PAUSE`, `persist/PURGE`.

**2. Warn on PHI in action payloads (development only).**
If `import.meta.env.DEV` is true and an action's payload recursively contains any of the following keys, a `console.warn` is emitted: `first_name`, `last_name`, `date_of_birth`, `email`, `phone`, `address`, `city`, `state`, `zip_code`, `emergency_contact_name`, `emergency_contact_phone`, `diagnosis`, `medications`, `allergies`, `medical_notes`, `insurance_provider`, `insurance_policy_number`, `ssn`, `medical_history`, `immunization_records`, `physician_name`, `physician_phone`. This is a warning only; the action is not blocked.

**3. Block unauthorized persist attempts.**
Any action whose type starts with `persist/` that is not in the framework allow-list is blocked — the action is swallowed and never reaches a reducer. This prevents any component from manually triggering storage persistence of PHI.

---

## API Layer Integration

**File:** `src/api/axios.config.ts`

The shared Axios instance reads the Bearer token on every outbound request via a request interceptor:

```ts
axiosInstance.interceptors.request.use((config) => {
  const token = store.getState().auth.token ?? sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});
```

Token resolution order:
1. `store.getState().auth.token` — the in-memory Redux value, populated after `useAuthInit` completes.
2. `sessionStorage.getItem('auth_token')` — the persisted value, used as a fallback for the `GET /api/user` validation request itself, which fires before the Redux store has been populated on page refresh.

The `X-Request-ID` header is a `crypto.randomUUID()` value added to every request so server log entries can be correlated with frontend errors.

For `FormData` payloads (file uploads), the `Content-Type: application/json` header is deleted so the browser can set the correct `multipart/form-data; boundary=...` value automatically.

**Demo mode:** When `VITE_DEMO_MODE=true`, `axiosInstance` is created with a `demoAdapter` instead of the default HTTP adapter. All API calls are intercepted and return mock data; no network requests leave the browser.

---

## Local State Patterns

Feature data is managed locally within components, not in Redux. The standard pattern used across all portal pages is:

```ts
const [data, setData]       = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError]     = useState<string | null>(null);
const [retryKey, setRetryKey] = useState(0);  // increment to retry after error

useEffect(() => {
  let cancelled = false;
  setLoading(true);
  fetchData()
    .then((result) => { if (!cancelled) setData(result); })
    .catch((err)   => { if (!cancelled) setError(err.message); })
    .finally(()    => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, [retryKey, ...otherDependencies]);
```

Key conventions:
- **`retryKey` pattern:** Error states include a "Retry" button that calls `setRetryKey(k => k + 1)`, which re-runs the effect without a page reload.
- **Cancellation flag:** `cancelled` prevents state updates on unmounted components when a navigation occurs while a fetch is in flight.
- **Consolidated filters state:** Pages with multiple filter controls (search, session filter, status filter) combine all filter values into a single `filters` state object to prevent double-fetch race conditions from multiple independent `setState` calls.
- **No caching layer:** There is no client-side cache (no React Query, no RTK Query). Data is re-fetched on every mount. This is appropriate for a low-traffic administrative application where stale data would have operational consequences (e.g., application status decisions).
