<?php

namespace App\Services\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * AuthService — Authentication Business Logic
 *
 * This service is the brain behind logging users in and registering new accounts.
 * Controllers call this service rather than putting all this logic directly in them,
 * which keeps things organized and easier to test.
 *
 * Responsibilities:
 *  - Register new applicant (parent) accounts
 *  - Validate credentials and enforce account lockout after failed attempts
 *  - Check MFA codes when two-factor authentication is enabled
 *  - Issue Sanctum API tokens on successful login
 *
 * Security measures built in:
 *  - Passwords are never stored in plain text (bcrypt via Hash::make)
 *  - Account lockout after 5 failed attempts (brute-force protection)
 *  - MFA verification uses time-based one-time passwords (TOTP / Google Authenticator)
 */
class AuthService
{
    /**
     * Register a new user with the "applicant" (parent) role.
     *
     * Every person who signs up through the public form becomes an applicant.
     * We look up the applicant role by name and attach its ID to the new user row.
     *
     * @param  array<string, mixed>  $data  Validated input: name, email, password
     */
    public function register(array $data): User
    {
        // Find the applicant role record so we can assign it to the new user
        $parentRole = Role::where('name', 'applicant')->first();

        // Create the user record; Hash::make converts the plain-text password to a bcrypt hash
        return User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            // The ?-> "null-safe" operator means role_id stays null if the role doesn't exist yet
            'role_id' => $parentRole?->id,
        ]);
    }

    /**
     * Authenticate a user with email and password.
     *
     * This method walks through several security checkpoints in order:
     *  1. Does the user exist?
     *  2. Is the account active (not deactivated by an admin)?
     *  3. Is the account currently locked out from too many failed tries?
     *  4. Does the password match the stored hash?
     *  5. If MFA is enabled, has a valid code been provided?
     *
     * On success: failed-attempt counter is reset and a Sanctum token is issued.
     * On failure: the failed-attempt counter is incremented; a lockout kicks in at 5.
     *
     * Returns an associative array so controllers can read 'success', 'token',
     * 'mfa_required', 'lockout', etc. without catching exceptions.
     *
     * @param  array<string, mixed>  $credentials  email, password, and optional mfa_code
     * @return array<string, mixed>
     */
    public function login(array $credentials): array
    {
        // Step 1: Look up the user by email address
        $user = User::where('email', $credentials['email'])->first();

        // Return a generic "invalid credentials" message — never reveal whether the email exists
        if (! $user) {
            return [
                'success' => false,
                'message' => 'Invalid credentials.',
            ];
        }

        // Step 2: Deactivated accounts cannot log in, even with correct credentials
        if (! $user->isActive()) {
            return [
                'success' => false,
                'message' => 'This account has been deactivated. Please contact an administrator.',
            ];
        }

        // Step 3: Check if the account is currently in a lockout window
        if ($user->isLockedOut()) {
            $minutesRemaining = $user->getLockoutMinutesRemaining();

            return [
                'success' => false,
                'message' => "Account locked due to too many failed attempts. Try again in {$minutesRemaining} minute(s).",
                'lockout' => true,
                // retry_after tells the frontend exactly how many seconds to wait
                'retry_after' => $minutesRemaining * 60,
            ];
        }

        // Step 4: Verify the submitted password matches the hashed password in the database
        if (! Hash::check($credentials['password'], $user->password)) {
            // Increment the failed-attempts counter in the database
            $user->recordFailedLogin();
            // Re-fetch the user so we have the updated failed_login_attempts count
            $user = $user->fresh();

            // Check if this latest failure pushed the account into lockout
            if ($user->isLockedOut()) {
                $minutesRemaining = $user->getLockoutMinutesRemaining();

                return [
                    'success' => false,
                    'message' => "Account locked due to too many failed attempts. Try again in {$minutesRemaining} minute(s).",
                    'lockout' => true,
                    'retry_after' => $minutesRemaining * 60,
                ];
            }

            // Tell the user how many tries they have left before lockout (max 5 total)
            return [
                'success' => false,
                'message' => 'Invalid credentials.',
                'attempts_remaining' => max(0, 5 - $user->failed_login_attempts),
            ];
        }

        // Step 5a: If MFA is enabled but no code was submitted yet, ask the frontend for it
        if ($user->mfa_enabled && empty($credentials['mfa_code'])) {
            return [
                'success' => true,
                // mfa_required = true signals the frontend to show the 6-digit code prompt
                'mfa_required' => true,
            ];
        }

        // Step 5b: If MFA is enabled and a code was submitted, verify it using TOTP
        if ($user->mfa_enabled && ! $this->verifyMfaCode($user, $credentials['mfa_code'])) {
            // A bad MFA code also counts as a failed login attempt
            $user->recordFailedLogin();

            return [
                'success' => false,
                'message' => 'Invalid MFA code.',
                'attempts_remaining' => max(0, 5 - $user->fresh()->failed_login_attempts),
            ];
        }

        // All checks passed — clear the failed-attempts counter so lockout resets
        $user->resetFailedLogins();

        // Issue a new Sanctum token; the plain-text version is returned once and never stored
        $token = $user->createToken('auth-token')->plainTextToken;

        return [
            'success' => true,
            // Load the user's role relationship so the frontend knows what UI to show
            'user' => $user->load('role'),
            'token' => $token,
        ];
    }

    /**
     * Verify a TOTP (Time-based One-Time Password) MFA code for a user.
     *
     * Google Authenticator generates a new 6-digit code every 30 seconds based
     * on the user's secret key. This method checks whether the submitted code
     * matches the current (or adjacent) time window.
     *
     * This is protected (not public) because only AuthService should call it directly.
     */
    protected function verifyMfaCode(User $user, ?string $code): bool
    {
        // Can't verify without both a code submission and a stored secret
        if (! $code || ! $user->mfa_secret) {
            return false;
        }

        // Google2FA library handles the time-window comparison automatically
        $google2fa = new \PragmaRX\Google2FA\Google2FA;

        return $google2fa->verifyKey($user->mfa_secret, $code);
    }
}
