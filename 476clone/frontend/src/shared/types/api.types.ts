/**
 * api.types.ts
 *
 * Standard API response shapes matching the Laravel backend's response format.
 * All API modules return these types.
 *
 * Think of this file as the "envelope" specification: every response from the
 * server arrives in one of these shapes, so every API module unwraps the same
 * way. Having one place for this means you only need to learn the pattern once.
 */

// ---------------------------------------------------------------------------
// Standard success responses
// ---------------------------------------------------------------------------

/**
 * ApiResponse<T> — the standard single-item response envelope.
 * Laravel wraps every successful response like: { message: "...", data: <T> }
 * Callers typically return `data.data` to skip past the envelope.
 */
export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
}

/**
 * PaginatedResponse<T> — the standard list response envelope.
 * Laravel's paginator adds `links` (page URLs) and `meta` (page numbers, totals).
 * The actual array of items is in `data`. The `meta` block tells you which page
 * you're on and how many pages exist, so you can show "Load more" buttons.
 */
export interface PaginatedResponse<T = unknown> {
  data: T[];
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    /** Total active (non-final) applications in the scoped session — for queue-position display. Null in global view. */
    queue_total?: number | null;
  };
}

// ---------------------------------------------------------------------------
// Error responses
// ---------------------------------------------------------------------------

/**
 * ValidationError — returned by Laravel on 422 Unprocessable Entity.
 * `errors` is a map of field names to arrays of error messages.
 * Example: { message: "...", errors: { email: ["Email is required"] } }
 */
export interface ValidationError {
  message: string;
  errors: Record<string, string[]>;
}

/**
 * ApiError — generic error for 4xx/5xx responses without field-level details.
 */
export interface ApiError {
  message: string;
  status?: number;
}

/**
 * RateLimitError — returned when the user is temporarily throttled.
 * `retryAfter` tells how many seconds to wait before retrying.
 */
export interface RateLimitError {
  retryAfter: number;
}

/**
 * LockoutError — returned when the account is locked out after too many failed logins.
 * `lockout: true` is the distinguishing field; type guards use this to tell it apart
 * from a plain RateLimitError.
 */
export interface LockoutError {
  lockout: true;
  retryAfter: number;
}

// ---------------------------------------------------------------------------
// Axios error result types (returned by axios.config.ts interceptors)
// ---------------------------------------------------------------------------

/**
 * AxiosErrorResult — union of all the error shapes the axios interceptor can produce.
 * Components receive one of these when an API call rejects, and use the type guards
 * below to figure out which branch to handle.
 */
export type AxiosErrorResult =
  | ValidationError
  | RateLimitError
  | LockoutError
  | ApiError
  | { message: string }; // network error

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * isValidationError — returns true when the error is a 422 validation response.
 * Checks for the presence of an `errors` object property.
 */
export function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errors' in error &&
    typeof (error as ValidationError).errors === 'object'
  );
}

/**
 * isLockoutError — returns true when the error signals an account lockout.
 * The distinguishing signal is `lockout === true`.
 */
export function isLockoutError(error: unknown): error is LockoutError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'lockout' in error &&
    (error as LockoutError).lockout === true
  );
}

/**
 * isRateLimitError — returns true when the server is throttling requests.
 * Distinguished from LockoutError by the absence of the `lockout` field.
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryAfter' in error &&
    !('lockout' in error)
  );
}
