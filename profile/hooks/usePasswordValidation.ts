/**
 * usePasswordValidation
 *
 * Evaluates a password string against the system's complexity requirements
 * and returns per-requirement status for real-time display.
 *
 * Requirements mirror the backend policy (AppServiceProvider + PasswordResetService):
 *   12+ chars · uppercase · lowercase · number · special character
 */

export interface PasswordRequirement {
  label: string;
  met: boolean;
}

export function usePasswordValidation(password: string): {
  requirements: PasswordRequirement[];
  allMet: boolean;
} {
  const requirements: PasswordRequirement[] = [
    { label: 'Minimum 12 characters',         met: password.length >= 12 },
    { label: 'At least one uppercase letter',  met: /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter',  met: /[a-z]/.test(password) },
    { label: 'At least one number',            met: /[0-9]/.test(password) },
    { label: 'At least one special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return {
    requirements,
    allMet: requirements.every((r) => r.met),
  };
}
