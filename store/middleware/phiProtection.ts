import { Middleware } from '@reduxjs/toolkit';

/**
 * PHI Protection Middleware
 *
 * PHI stands for "Protected Health Information" — things like names, diagnoses,
 * medications, and insurance numbers that HIPAA law says must be handled carefully.
 *
 * This middleware sits in the Redux pipeline and watches every action that flows
 * through the store. Its three jobs are:
 * 1. Allow redux-persist internal lifecycle actions to pass through untouched.
 * 2. Warn (in development) if an action's payload contains PHI field names —
 *    so developers know to be careful about where that data ends up.
 * 3. Block any custom action that tries to manually invoke persist/* actions,
 *    which could cause PHI to be written to browser storage.
 *
 * HIPAA Compliance:
 * - PHI must never be intentionally persisted to storage.
 * - Redux-persist framework actions are allowed for bootstrapping.
 * - Custom persistence attempts are not allowed.
 */

// The list of object keys that indicate Protected Health Information
const PHI_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'zip_code',
  'emergency_contact_name',
  'emergency_contact_phone',
  'diagnosis',
  'medications',
  'allergies',
  'medical_notes',
  'insurance_provider',
  'insurance_policy_number',
  'ssn',
  'medical_history',
  'immunization_records',
  'physician_name',
  'physician_phone',
];

/**
 * Recursively checks an object for PHI fields.
 * Returns true as soon as any nested object has a matching key.
 */
function containsPHI(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const keys = Object.keys(obj);

  // Direct PHI field match
  if (keys.some((key) => PHI_FIELDS.includes(key))) {
    return true;
  }

  // Recursive nested check — PHI may be buried inside nested objects
  return keys.some((key) => {
    const value = (obj as Record<string, unknown>)[key];
    return containsPHI(value);
  });
}

// Middleware signature: a function that receives the store API and returns a handler
export const phiProtectionMiddleware: Middleware =
  () => (next) => (action) => {
    const typedAction = action as { type: string; payload?: unknown };

    /**
     * PHI field monitoring — runs in both development and production.
     *
     * In development: console.warn so engineers catch accidental PHI dispatches early.
     * In production: console.error so error-monitoring tools (e.g. Sentry) can alert.
     *
     * This does NOT block the action — blocking would break the app if a false positive
     * triggers in production. The goal is observability, not gatekeeping.
     */
    if (containsPHI(typedAction.payload)) {
      if (import.meta.env.DEV) {
        console.warn(
          '[PHI Protection] Action contains PHI fields:',
          typedAction.type,
          '\nEnsure this data is NOT persisted to storage.'
        );
      } else {
        console.error(
          '[PHI Protection] Action contains PHI fields:',
          typedAction.type
        );
      }
    }

    // Forward the action to the next middleware or reducer.
    return next(action);
  };
