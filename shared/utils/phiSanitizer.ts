/**
 * phiSanitizer.ts — Protected Health Information (PHI) redaction utility
 *
 * HIPAA regulations prohibit exposing patient health data in error logs,
 * console output, or any monitoring system that might be seen by unauthorized people.
 *
 * This utility recursively walks an error object (typically an Axios error) and
 * replaces the value of any known PHI field with the string "[REDACTED]".
 *
 * It specifically targets:
 * - error.response.data — the response body from the server
 * - error.config.data   — the request body that was sent (may contain form input)
 *
 * Used by: axios.config.ts when logging 5xx server errors.
 */

// All object keys that may contain Protected Health Information
// Any nested object containing these keys will have its values redacted
const PHI_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'email',
  'phone',
  'diagnosis',
  'physician_name',
  'insurance_provider',
  'policy_number',
  'allergen',
  'reaction',
  'treatment',
  'medication_name',
  'dosage',
  'prescribing_physician',
  'contact_name',
  'contact_phone',
  'contact_email',
  'address',
  'city',
  'state',
  'zip_code',
];

/**
 * phiSanitizer — Redact PHI fields from an error object before logging.
 *
 * Returns a new object with the same structure as the input, except that
 * any PHI field values are replaced with "[REDACTED]".
 * Non-object inputs (strings, numbers, null) are returned unchanged.
 */
export function phiSanitizer(error: unknown): unknown {
  // Primitive values have no keys to redact — return as-is
  if (typeof error !== 'object' || error === null) {
    return error;
  }

  // Shallow copy so the original error object is never mutated
  const sanitized = { ...error } as Record<string, unknown>;

  /**
   * removePHI — Recursive helper that walks any object or array.
   * - Arrays: each item is processed individually.
   * - Objects: PHI-keyed values become "[REDACTED]", other objects recurse deeper.
   * - Primitives: returned unchanged.
   */
  const removePHI = (obj: unknown): unknown => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    // Arrays may contain objects with PHI — map each element through removePHI
    if (Array.isArray(obj)) {
      return obj.map((item) => removePHI(item));
    }

    const cleaned: Record<string, unknown> = {};

    for (const key in obj as Record<string, unknown>) {
      const value = (obj as Record<string, unknown>)[key];

      if (PHI_FIELDS.includes(key)) {
        // This key is a known PHI field — replace its value with a safe placeholder
        cleaned[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        // Non-PHI object or array — recurse to check nested keys
        cleaned[key] = removePHI(value);
      } else {
        // Non-PHI primitive — pass through unchanged
        cleaned[key] = value;
      }
    }

    return cleaned;
  };

  // Sanitize the response body (what the server sent back)
  if ('response' in sanitized && typeof sanitized.response === 'object' && sanitized.response) {
    const response = sanitized.response as Record<string, unknown>;
    if ('data' in response) {
      response.data = removePHI(response.data);
    }
  }

  // Sanitize the request body (what the frontend sent to the server)
  // config.data is stored as a JSON string by Axios — parse it first before sanitizing
  if ('config' in sanitized && typeof sanitized.config === 'object' && sanitized.config) {
    const config = sanitized.config as Record<string, unknown>;
    if ('data' in config && typeof config.data === 'string') {
      try {
        config.data = removePHI(JSON.parse(config.data as string));
      } catch {
        // If JSON parsing fails, leave data as is — better than crashing the error handler
      }
    }
  }

  return sanitized;
}
