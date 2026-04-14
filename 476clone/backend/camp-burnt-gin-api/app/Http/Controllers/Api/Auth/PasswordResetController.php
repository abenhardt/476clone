<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auth\PasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Symfony\Component\HttpFoundation\Response;

/**
 * PasswordResetController — Handles "forgot my password" flows.
 *
 * Password recovery works in two steps:
 *   1. sendResetLink — The user enters their email. If an account exists, a
 *      time-limited reset link is emailed to them.
 *   2. reset — The user clicks the link, which brings them to the SPA with the
 *      token. They enter a new password and this endpoint finalises the change.
 *
 * Security note: sendResetLink always returns the same generic message whether
 * the email exists or not — this prevents attackers from using it to discover
 * which email addresses have accounts (user enumeration).
 *
 * Implements FR-3: Account recovery and password reset.
 */
class PasswordResetController extends Controller
{
    // PasswordResetService wraps Laravel's built-in password broker.
    public function __construct(
        protected PasswordResetService $passwordResetService
    ) {}

    /**
     * Send a password reset link to the given email.
     *
     * POST /api/auth/forgot-password
     *
     * Step-by-step:
     *   1. Validate that a syntactically valid email was provided.
     *   2. Hand the email to PasswordResetService, which generates a token and
     *      emails the link if the address matches a real account.
     *   3. Return the same neutral success message regardless of outcome to
     *      prevent user enumeration.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        // Only a valid email format is required — we deliberately don't check existence here.
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        // The service decides whether to send the email; we don't expose that decision to the caller.
        $result = $this->passwordResetService->sendResetLink($request->email);

        // Always return the same neutral message — do NOT reveal whether the email was found.
        return response()->json([
            'message' => 'If an account exists with this email, a password reset link has been sent.',
        ]);
    }

    /**
     * Reset the user's password.
     *
     * POST /api/auth/reset-password
     *
     * Step-by-step:
     *   1. Validate the token (from the email link), email, and new password.
     *   2. The password must be strong: 12+ chars, mixed case, numbers, symbols,
     *      and not found in known-breached password databases (uncompromised).
     *   3. PasswordResetService verifies the token and updates the user's password.
     *   4. On failure (expired/invalid token) a 400 is returned with the reason.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            // The one-time token that was embedded in the reset email link.
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => [
                'required',
                // 'confirmed' means password_confirmation must be present and match.
                'confirmed',
                Password::min(12)
                    ->mixedCase()   // Must have both uppercase and lowercase letters.
                    ->numbers()     // Must contain at least one number.
                    ->symbols()     // Must contain at least one special character.
                    ->uncompromised(), // Rejects passwords found in known data breaches.
            ],
        ]);

        // Pass the email, token, and new password to the service for verification and update.
        $result = $this->passwordResetService->resetPassword(
            $request->email,
            $request->token,
            $request->password
        );

        // The token may have expired (default: 60 minutes) or already been used.
        if (! $result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], Response::HTTP_BAD_REQUEST);
        }

        return response()->json([
            'message' => 'Password has been reset successfully.',
        ]);
    }
}
