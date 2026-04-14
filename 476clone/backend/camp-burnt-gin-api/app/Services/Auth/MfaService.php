<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

/**
 * MfaService — Multi-Factor Authentication (MFA) Management
 *
 * Think of MFA as a second lock on a door. Even if someone steals your password,
 * they still can't get in without the 6-digit code from your phone.
 *
 * This service handles the full lifecycle of TOTP-based (Time-based One-Time Password)
 * two-factor authentication. TOTP is the same technology used by Google Authenticator
 * and Authy — it generates a new code every 30 seconds using a shared secret key.
 *
 * Responsibilities:
 *  - Generate a secret key and QR code URL for the initial setup scan
 *  - Verify the first code the user enters to confirm their authenticator app is working
 *  - Verify codes on each login when MFA is active
 *  - Disable MFA after double-verifying both password and current code (with rate limiting)
 *
 * Implements functional requirements FR-2 and NFR-5 (MFA requirements).
 */
class MfaService
{
    // The Google2FA library instance — shared across all methods in this service
    protected Google2FA $google2fa;

    /**
     * Inject the Google2FA library instance once when the service is created.
     */
    public function __construct()
    {
        $this->google2fa = new Google2FA;
    }

    /**
     * Step 1 of MFA setup: Generate a secret key and QR code for the user to scan.
     *
     * When a user wants to enable MFA, we:
     *  1. Generate a random secret key (a long string only this user knows)
     *  2. Save it to their user record (they need it for every future verification)
     *  3. Build a URL that encodes the secret so Google Authenticator can scan it
     *
     * The user then scans the QR code with their phone app, which stores the secret.
     * From that point on, both the server and the phone can independently generate
     * the same 6-digit codes every 30 seconds.
     *
     * @return array<string, mixed> Contains 'secret' and 'qr_code_url'
     */
    public function initializeSetup(User $user): array
    {
        // Generate a cryptographically random base32-encoded secret key
        $secret = $this->google2fa->generateSecretKey();

        // Save the secret to the database so we can verify codes later
        $user->update(['mfa_secret' => $secret]);

        // Build the QR code URL in the standard "otpauth://" format that authenticator apps understand
        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'Camp Burnt Gin'), // Issuer name shown in the authenticator app
            $user->email,                          // Account identifier shown in the app
            $secret                                // The shared secret that drives code generation
        );

        return [
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ];
    }

    /**
     * Step 2 of MFA setup: Confirm the user scanned the QR code correctly.
     *
     * After scanning, the user enters the first 6-digit code shown by their app.
     * If that code is valid, we know their app is synced with our secret and we
     * officially turn MFA on for their account.
     *
     * Rate-limited: 5 failed attempts per 15 minutes. After the threshold, the
     * account must wait before trying again — this prevents TOTP brute-force attacks
     * during the enrollment window.
     *
     * @return array<string, mixed> 'success' => true/false with optional 'message'
     */
    public function verifyAndEnable(User $user, string $code): array
    {
        // Per-user rate-limit key for MFA setup verification attempts
        $rateLimitKey = "mfa_verify_attempts:{$user->id}";
        $attempts = Cache::get($rateLimitKey, 0);

        if ($attempts >= 5) {
            return [
                'success' => false,
                'message' => 'Too many failed verification attempts. Please wait 15 minutes before trying again.',
            ];
        }

        // Guard: setup must have been run first (initializeSetup stores the secret)
        if (! $user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA setup has not been initialized.',
            ];
        }

        try {
            // verifyKey checks whether the code matches the current 30-second window
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));

                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            // The library throws if the secret is malformed — count as failed attempt
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Replay attack prevention: reject the code if it was already used in this window
        if ($this->isCodeAlreadyUsed($user->id, $code)) {
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Code is valid — clear the rate-limit counter so it resets
        Cache::forget($rateLimitKey);

        // Flip the MFA flag on and record when it was first verified
        $user->update([
            'mfa_enabled' => true,
            'mfa_verified_at' => now(),
        ]);

        return [
            'success' => true,
        ];
    }

    /**
     * Verify a TOTP code during the login flow.
     *
     * Called by AuthService (and potentially AuthController) when a user with MFA
     * enabled submits their 6-digit code after a successful password check.
     *
     * Returns a simple boolean — no messages — because the caller decides what
     * error to show based on the true/false result.
     */
    public function verifyCode(User $user, string $code): bool
    {
        // Without a stored secret there is nothing to verify against
        if (! $user->mfa_secret) {
            return false;
        }

        try {
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                return false;
            }
        } catch (\Exception $e) {
            // Malformed secret or library error — treat as failed verification
            return false;
        }

        // Replay attack prevention: reject the code if it was already used in this window
        if ($this->isCodeAlreadyUsed($user->id, $code)) {
            return false;
        }

        return true;
    }

    /**
     * Verify a TOTP code for a step-up authentication challenge.
     *
     * Step-up authentication re-proves identity before a sensitive or
     * destructive action executes — even when the user already has a valid
     * session. On success, a short-lived cache entry grants the user a
     * temporary step-up window so they are not re-prompted on every click
     * within the same working period.
     *
     * TTL: 15 minutes (configurable via auth.mfa_step_up_ttl_minutes).
     * Rate limit: 5 failed attempts per 10 minutes.
     *
     * @return array<string, mixed> 'success' => bool, optional 'message'
     */
    public function verifyStepUp(User $user, string $code): array
    {
        $rateLimitKey = "mfa_step_up_attempts:{$user->id}";
        $attempts = Cache::get($rateLimitKey, 0);

        if ($attempts >= 5) {
            return [
                'success' => false,
                'message' => 'Too many failed attempts. Please wait 10 minutes before trying again.',
            ];
        }

        if (! $user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA is not configured on this account.',
            ];
        }

        try {
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(10));

                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(10));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Replay attack prevention: reject the code if it was already used in this window
        if ($this->isCodeAlreadyUsed($user->id, $code)) {
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(10));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        Cache::forget($rateLimitKey);

        // Record the successful step-up in the cache scoped to this specific token.
        // The TTL controls how long the user can perform sensitive actions without re-verifying.
        $ttlMinutes = config('auth.mfa_step_up_ttl_minutes', 15);
        $tokenId = $user->currentAccessToken()?->id ?? 'unknown';
        Cache::put("mfa_step_up:{$user->id}:{$tokenId}", true, now()->addMinutes($ttlMinutes));

        return ['success' => true];
    }

    /**
     * Check whether the user has a valid step-up verification in the cache.
     *
     * Used by EnsureMfaStepUp middleware to decide whether to gate the request.
     */
    public function hasValidStepUp(User $user): bool
    {
        $tokenId = $user->currentAccessToken()?->id ?? 'unknown';

        return Cache::has("mfa_step_up:{$user->id}:{$tokenId}");
    }

    /**
     * Invalidate an existing step-up token for a user.
     *
     * Called when MFA is disabled so a lingering step-up grant cannot be
     * used to perform sensitive actions after the second factor is gone.
     */
    public function invalidateStepUp(User $user): void
    {
        Cache::forget("mfa_step_up:{$user->id}"); // legacy key (backward compatibility)
        $tokenId = $user->currentAccessToken()?->id ?? 'unknown';
        Cache::forget("mfa_step_up:{$user->id}:{$tokenId}");
    }

    /**
     * Disable MFA for a user after confirming both their password and current code.
     *
     * Turning off MFA is a sensitive action, so we require two proofs of identity:
     *  1. Their current account password
     *  2. A valid TOTP code from their authenticator app
     *
     * A per-user rate limit (5 attempts per 15 minutes) prevents someone who
     * steals a session token from brute-forcing the disable action.
     *
     * On success: MFA fields are cleared and the secret is wiped from the database.
     *
     * @return array<string, mixed> 'success' => true/false with optional 'message'
     */
    public function disable(User $user, string $code, string $password): array
    {
        // Build a unique cache key per user to track disable attempts
        $rateLimitKey = "mfa_disable_attempts:{$user->id}";
        $attempts = Cache::get($rateLimitKey, 0);

        // Block further attempts after 5 failures within the 15-minute window
        if ($attempts >= 5) {
            $ttl = Cache::get("{$rateLimitKey}:ttl");
            // Calculate remaining minutes; default to 15 if cache entry is missing
            $remainingMinutes = $ttl ? ceil($ttl / 60) : 15;

            return [
                'success' => false,
                'message' => "Too many MFA disable attempts. Please try again in {$remainingMinutes} minutes.",
            ];
        }

        // Can't disable MFA if it was never set up
        if (! $user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA is not enabled for this account.',
            ];
        }

        // Proof 1: Verify the submitted password matches the stored bcrypt hash
        if (! Hash::check($password, $user->password)) {
            // Increment the rate-limit counter and set a 15-minute TTL
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));
            Cache::put("{$rateLimitKey}:ttl", 900, now()->addMinutes(15));

            return [
                'success' => false,
                'message' => 'Invalid password.',
            ];
        }

        try {
            // Proof 2: Verify the current TOTP code from the authenticator app
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));
                Cache::put("{$rateLimitKey}:ttl", 900, now()->addMinutes(15));

                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            // Library error — count as a failed attempt and return generic message
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));
            Cache::put("{$rateLimitKey}:ttl", 900, now()->addMinutes(15));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Replay attack prevention: reject the code if it was already used in this window
        if ($this->isCodeAlreadyUsed($user->id, $code)) {
            Cache::put($rateLimitKey, $attempts + 1, now()->addMinutes(15));
            Cache::put("{$rateLimitKey}:ttl", 900, now()->addMinutes(15));

            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Both proofs passed — clear the rate-limit cache so the counter resets
        Cache::forget($rateLimitKey);
        Cache::forget("{$rateLimitKey}:ttl");

        // Wipe all MFA fields from the user record
        $user->update([
            'mfa_enabled' => false,
            'mfa_secret' => null,       // Delete the secret so old codes can never be replayed
            'mfa_verified_at' => null,
        ]);

        // Invalidate any active step-up grant so a lingering cache entry
        // cannot be used to reach sensitive routes after MFA is turned off.
        $this->invalidateStepUp($user);

        return ['success' => true];
    }

    /**
     * Check whether a TOTP code has already been consumed for this user.
     * If it has not, record it as consumed and return false (not used yet).
     * If it has, return true (already used — replay detected).
     *
     * The nonce is tied to the 30-second TOTP counter window so that a code
     * verified at the end of one window cannot be replayed at the start of
     * the next (the 75-second TTL covers the current plus one adjacent window).
     */
    private function isCodeAlreadyUsed(int $userId, string $code): bool
    {
        // The time counter changes every 30 seconds — ties the nonce to its window
        $counter = (int) floor(time() / 30);
        $nonce = "mfa_used:{$userId}:{$code}:{$counter}";

        if (Cache::has($nonce)) {
            return true; // code was already used in this window
        }

        // Mark as used with 75-second TTL (covers current + adjacent window)
        Cache::put($nonce, true, 75);

        return false;
    }
}
