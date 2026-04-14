<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;

/**
 * MfaService — Multi-Factor Authentication (Root-Level Copy)
 *
 * This is the root-level copy of the MFA service. The canonical version
 * with rate limiting lives at App\Services\Auth\MfaService. This copy
 * is an older variant that lacks the per-user rate limiting added in
 * App\Services\Auth\MfaService but is functionally identical otherwise.
 *
 * Responsibilities:
 *  - Generate a TOTP secret key and QR code URL for MFA setup
 *  - Verify the first code to confirm the authenticator app is linked
 *  - Verify login codes when MFA is active
 *  - Disable MFA after verifying both password and current code
 *
 * TOTP (Time-based One-Time Password) works by both the server and the
 * authenticator app independently computing the same 6-digit code from
 * a shared secret + the current time. Codes change every 30 seconds.
 *
 * Implements FR-2 and NFR-5: MFA requirements.
 */
class MfaService
{
    // Shared Google2FA library instance used across all methods
    protected Google2FA $google2fa;

    /**
     * Create the Google2FA instance once when the service is instantiated.
     */
    public function __construct()
    {
        $this->google2fa = new Google2FA;
    }

    /**
     * Step 1 of MFA setup: Generate a secret key and QR code URL.
     *
     * Generates a random secret, stores it on the user record, and produces
     * a QR code URL that an authenticator app can scan. After scanning, the
     * app and server share the same secret and can generate matching codes.
     *
     * @return array<string, mixed> 'secret' and 'qr_code_url'
     */
    public function initializeSetup(User $user): array
    {
        // Generate a cryptographically random base32-encoded TOTP secret
        $secret = $this->google2fa->generateSecretKey();

        // Persist the secret to the user record so it can be verified later
        $user->update(['mfa_secret' => $secret]);

        // Build the standard otpauth:// URL that authenticator apps scan
        $qrCodeUrl = $this->google2fa->getQRCodeUrl(
            config('app.name', 'Camp Burnt Gin'), // Issuer name shown in the authenticator app
            $user->email,                          // Account label shown in the app
            $secret
        );

        return [
            'secret' => $secret,
            'qr_code_url' => $qrCodeUrl,
        ];
    }

    /**
     * Step 2 of MFA setup: Confirm the user's authenticator app is working.
     *
     * The user scans the QR code and enters the first 6-digit code shown.
     * If valid, MFA is officially enabled on their account.
     *
     * @return array<string, mixed> 'success' => true/false with optional 'message'
     */
    public function verifyAndEnable(User $user, string $code): array
    {
        // Guard: cannot verify a code if setup hasn't been started
        if (! $user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA setup has not been initialized.',
            ];
        }

        try {
            // verifyKey checks the code against the current 30-second TOTP window
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            // Catch library exceptions (e.g. malformed secret) and return a clean error
            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Code confirmed — enable MFA and record the verification timestamp
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
     * Returns a simple boolean so the caller can decide what response to show.
     * No account lockout logic in this version (see Auth\MfaService for that).
     */
    public function verifyCode(User $user, string $code): bool
    {
        // Cannot verify without a stored secret
        if (! $user->mfa_secret) {
            return false;
        }

        try {
            return $this->google2fa->verifyKey($user->mfa_secret, $code);
        } catch (\Exception $e) {
            // Any library error is treated as a failed verification
            return false;
        }
    }

    /**
     * Disable MFA for a user after verifying both their password and TOTP code.
     *
     * Requires two proofs of identity to prevent someone with a stolen session
     * from disabling MFA without knowing the user's credentials.
     *
     * Note: This version does not implement rate limiting. See Auth\MfaService
     * for the version with per-user attempt tracking.
     *
     * @return array<string, mixed> 'success' => true/false with optional 'message'
     */
    public function disable(User $user, string $code, string $password): array
    {
        // Guard: MFA must be enabled before it can be disabled
        if (! $user->mfa_secret) {
            return [
                'success' => false,
                'message' => 'MFA is not enabled for this account.',
            ];
        }

        // Proof 1: Verify the current account password against the stored hash
        if (! Hash::check($password, $user->password)) {
            return [
                'success' => false,
                'message' => 'Invalid password.',
            ];
        }

        try {
            // Proof 2: Verify the current TOTP code from the authenticator app
            if (! $this->google2fa->verifyKey($user->mfa_secret, $code)) {
                return [
                    'success' => false,
                    'message' => 'Invalid verification code.',
                ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'Invalid verification code.',
            ];
        }

        // Both proofs passed — clear all MFA fields from the database
        $user->update([
            'mfa_enabled' => false,
            'mfa_secret' => null,       // Remove the secret so old codes can never be replayed
            'mfa_verified_at' => null,
        ]);

        return ['success' => true];
    }
}
