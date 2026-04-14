<?php

namespace App\Services\Auth;

use App\Models\User;
use App\Notifications\Auth\PasswordChangedConfirmationNotification;
use App\Notifications\Auth\PasswordResetNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * PasswordResetService — Account Recovery via Email
 *
 * This service handles the two-step "forgot password" flow:
 *
 *  Step 1 — sendResetLink(): The user submits their email. We generate a
 *            random token, store a hashed copy in the database, and email
 *            the plain-text token inside a link to the user.
 *
 *  Step 2 — resetPassword(): The user clicks the link, which sends the
 *            plain-text token back to the API along with their new password.
 *            We verify the token, check it hasn't expired, update the password,
 *            and delete the token so it can't be reused.
 *
 * Security design:
 *  - Tokens are stored as bcrypt hashes, not plain text (same principle as passwords)
 *  - Tokens expire after TOKEN_EXPIRATION_MINUTES (60 minutes by default)
 *  - Step 1 always returns success=true regardless of whether the email exists
 *    (this prevents "account enumeration" — revealing which emails are registered)
 *
 * Implements FR-3: Account recovery and password reset.
 */
class PasswordResetService
{
    /**
     * Token expiration time in minutes.
     * After this window, a reset link is no longer valid and the user must request a new one.
     */
    protected const TOKEN_EXPIRATION_MINUTES = 60;

    /**
     * Send a password reset link to the given email address.
     *
     * If no account exists for the email, we do nothing — but we still return
     * success=true. This is intentional: it prevents attackers from probing
     * which email addresses have accounts (account enumeration attack prevention).
     *
     * Flow:
     *  1. Look up the user by email
     *  2. Generate a 64-character random token
     *  3. Store a bcrypt hash of the token in password_reset_tokens (upsert in case they
     *     already have a pending request — replaces the old one)
     *  4. Send the plain-text token to the user's email inside a clickable link
     *
     * @return array<string, mixed> Always returns ['success' => true]
     */
    public function sendResetLink(string $email): array
    {
        // Look up the user — if not found, silently return success (enumeration prevention)
        $user = User::where('email', $email)->first();

        if (! $user) {
            // We return success here deliberately — the caller shouldn't know the email was missing
            return ['success' => true];
        }

        // Generate a cryptographically random 64-character token
        $token = Str::random(64);

        // Upsert: if a record already exists for this email, update it with the fresh token
        // This ensures only the most recent reset link is valid at any time
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                // Store the hashed token — never store the plain text version
                'token' => Hash::make($token),
                'created_at' => now(),
            ]
        );

        // Email the plain-text token to the user via Laravel's notification system
        $user->notify(new PasswordResetNotification($token));

        return ['success' => true];
    }

    /**
     * Reset the user's password using the token from the reset email.
     *
     * This is called when the user clicks the link in the email and submits
     * their new password. We verify the token is genuine and hasn't expired
     * before allowing the password change.
     *
     * Flow:
     *  1. Find the reset record for this email
     *  2. Verify the submitted token matches the stored hash
     *  3. Check that the token was created within the last 60 minutes
     *  4. Update the user's password with a fresh bcrypt hash
     *  5. Delete the reset token so it can't be used a second time
     *
     * @return array<string, mixed> Contains 'success' and optional 'message' on failure
     */
    public function resetPassword(string $email, string $token, string $password): array
    {
        // Step 1: Find the pending reset record for this email address
        $record = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        // No record means no reset was requested, or it was already used
        if (! $record) {
            return [
                'success' => false,
                'message' => 'Invalid password reset request.',
            ];
        }

        // Step 2: Verify the submitted token against the stored bcrypt hash
        // Hash::check does the same comparison as password verification
        if (! Hash::check($token, $record->token)) {
            return [
                'success' => false,
                'message' => 'Invalid password reset token.',
            ];
        }

        // Step 3: Check if the token has expired (60 minutes after creation)
        $createdAt = \Carbon\Carbon::parse($record->created_at);
        if ($createdAt->addMinutes(self::TOKEN_EXPIRATION_MINUTES)->isPast()) {
            return [
                'success' => false,
                'message' => 'Password reset token has expired.',
            ];
        }

        // Step 4: Find the actual user account to update
        $user = User::where('email', $email)->first();

        if (! $user) {
            // Edge case: account was deleted after the reset link was sent
            return [
                'success' => false,
                'message' => 'User not found.',
            ];
        }

        // Update the password with a fresh bcrypt hash — never store plain text
        $user->update([
            'password' => Hash::make($password),
        ]);

        // Invalidate all active Sanctum tokens so any stolen or remembered sessions
        // cannot continue after a password reset. The user must log in again.
        $user->tokens()->delete();

        // Record the password reset in the audit log for HIPAA compliance
        \App\Models\AuditLog::logAuth('password_reset', $user);

        // Best-effort invalidation of any MFA step-up cache entry for this user.
        // Step-up cache is keyed by user + token ID; since all Sanctum tokens were
        // deleted above, any surviving step-up grants reference non-existent tokens.
        // Clear both the legacy user-scoped key and the 'unknown'-tokenId fallback
        // used when no Sanctum token is active (e.g. web guard or test context).
        \Illuminate\Support\Facades\Cache::forget("mfa_step_up:{$user->id}");
        \Illuminate\Support\Facades\Cache::forget("mfa_step_up:{$user->id}:unknown");

        // Notify the account holder that their password changed so they can act
        // if the change was unauthorised (security assurance email)
        $user->notify(new PasswordChangedConfirmationNotification);

        // Step 5: Delete the used token so it cannot be replayed
        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->delete();

        return ['success' => true];
    }
}
