<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\Auth\MfaService;
use App\Services\SystemNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * MfaController — Multi-Factor Authentication management.
 *
 * MFA (also called "two-factor authentication" or "2FA") adds a second layer of
 * security on top of the password. After enabling it, the user must enter a
 * 6-digit code from an authenticator app (like Google Authenticator) each time
 * they log in.
 *
 * This controller manages three actions:
 *   - setup:   Start the MFA enrollment process (generate QR code + secret).
 *   - verify:  Confirm a code from the authenticator app and officially enable MFA.
 *   - disable: Turn MFA off (requires both the current code and the password).
 *
 * Implements FR-2 (MFA requirement) and NFR-5 (security standards).
 */
class MfaController extends Controller
{
    // MfaService handles TOTP secret generation and code validation.
    // SystemNotificationService sends in-app security alerts when MFA status changes.
    public function __construct(
        protected MfaService $mfaService,
        protected SystemNotificationService $systemNotifications,
    ) {}

    /**
     * Initialize MFA setup for the current user.
     *
     * POST /api/mfa/setup
     *
     * Returns a QR code image (as a data URI) and the raw secret string so the
     * user can scan it into an authenticator app. MFA is NOT yet active at this
     * point — the user must call verify() with a valid code to confirm setup.
     *
     * Step-by-step:
     *   1. Check that MFA isn't already enabled — no need to set it up twice.
     *   2. Ask MfaService to generate a TOTP secret and QR code image.
     *   3. Return both to the frontend so the user can scan the QR code.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        // Prevent re-initializing setup when MFA is already active on the account.
        if ($user->mfa_enabled) {
            return response()->json([
                'message' => 'MFA is already enabled for this account.',
            ], Response::HTTP_BAD_REQUEST);
        }

        // Generate a new TOTP secret and a QR code the user can scan with their authenticator app.
        $setupData = $this->mfaService->initializeSetup($user);

        return response()->json([
            'message' => 'MFA setup initialized. Scan the QR code with your authenticator app.',
            'data' => $setupData,
        ]);
    }

    /**
     * Verify and enable MFA for the current user.
     *
     * POST /api/mfa/verify
     *
     * The user scans the QR code in setup(), then enters the 6-digit code shown
     * by their authenticator app here to prove the app is synced correctly.
     *
     * Step-by-step:
     *   1. Validate that exactly a 6-character code was submitted.
     *   2. Pass the code to MfaService, which compares it against the stored TOTP secret.
     *   3. On success, MFA is enabled and recovery codes are returned (save these!).
     *   4. A security notification is sent to inform the user via inbox.
     */
    public function verify(Request $request): JsonResponse
    {
        // The TOTP code is always exactly 6 digits — reject anything else immediately.
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();
        // MfaService validates the code against the stored secret using TOTP algorithm.
        $result = $this->mfaService->verifyAndEnable($user, $request->code);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Audit: MFA enable is a security-critical event — always record it.
        AuditLog::logAuth('mfa_enabled', $user);

        // Notify the user via the system inbox that MFA was enabled on their account.
        $this->systemNotifications->mfaEnabled($user);

        return response()->json([
            'message' => 'MFA has been enabled successfully.',
            'data' => [
                // Recovery codes let the user bypass MFA if they lose their authenticator app.
                'recovery_codes' => $result['recovery_codes'] ?? [],
            ],
        ]);
    }

    /**
     * Complete a step-up authentication challenge.
     *
     * POST /api/mfa/step-up
     *
     * Called immediately before a sensitive or destructive action. The user
     * submits a current TOTP code to prove they still have possession of their
     * second factor. On success, MfaService records a short-lived cache entry
     * that EnsureMfaStepUp middleware will accept for the next N minutes.
     *
     * Step-by-step:
     *   1. Validate that a 6-digit code was submitted.
     *   2. Delegate to MfaService which checks the code and records the grant.
     *   3. Return 200 on success so the frontend can retry the blocked action.
     *
     * Rate limited: 5 attempts per 10 minutes (via throttle:mfa on the route).
     */
    public function stepUp(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
        ]);

        $user = $request->user();

        if (! $user->mfa_enabled) {
            return response()->json([
                'message' => 'MFA is not enabled on this account. Enable MFA before performing step-up.',
            ], Response::HTTP_BAD_REQUEST);
        }

        $result = $this->mfaService->verifyStepUp($user, $request->code);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_UNAUTHORIZED);
        }

        return response()->json([
            'message' => 'Step-up verification successful.',
        ]);
    }

    /**
     * Disable MFA for the current user.
     *
     * POST /api/mfa/disable
     *
     * Requires both the current TOTP code AND the account password as a double
     * confirmation — this prevents someone who grabbed an unlocked phone from
     * silently removing the second factor.
     *
     * Step-by-step:
     *   1. Validate that a 6-digit code and a non-empty password were supplied.
     *   2. MfaService checks the code and verifies the password hash.
     *   3. On success, the stored TOTP secret is cleared and mfa_enabled is set false.
     *   4. A security notification is sent so the account owner is informed.
     */
    public function disable(Request $request): JsonResponse
    {
        // Both fields are required — the TOTP code proves app access, the password proves account ownership.
        $request->validate([
            'code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();
        // MfaService verifies the code and password before wiping the TOTP secret.
        $result = $this->mfaService->disable($user, $request->code, $request->password);

        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        // Audit: MFA disable is a security-critical event — always record it.
        AuditLog::logAuth('mfa_disabled', $user);

        // Alert the user via inbox that MFA was disabled — important security transparency.
        $this->systemNotifications->mfaDisabled($user);

        return response()->json([
            'message' => 'MFA has been disabled.',
        ]);
    }
}
