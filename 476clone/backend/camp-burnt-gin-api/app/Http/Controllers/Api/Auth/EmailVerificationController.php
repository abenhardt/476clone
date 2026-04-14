<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Notifications\Auth\EmailVerificationNotification;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * EmailVerificationController — Email address verification endpoints.
 *
 * Handles email verification link validation and resend requests
 * for the SPA frontend. Uses Laravel signed URLs for secure token-less
 * verification without requiring a separate tokens table.
 *
 * How signed URLs work:
 *   When a user registers, Laravel generates a URL containing their user ID,
 *   a SHA-1 hash of their email, an expiry timestamp, and an HMAC signature.
 *   The HMAC is computed with the app key, so only this server can produce it.
 *   When the user clicks the link, the SPA extracts those four values and sends
 *   them here as a JSON POST body for verification.
 */
class EmailVerificationController extends Controller
{
    /**
     * Verify the user's email address.
     *
     * POST /auth/email/verify
     *
     * Expects signed URL parameters passed from the frontend as JSON body:
     *   - id:        user ID from the verification link
     *   - hash:      sha1 hash of the email address
     *   - expires:   timestamp from the signed URL
     *   - signature: HMAC signature from the signed URL
     *
     * Step-by-step:
     *   1. Validate that all four required fields are present in the request.
     *   2. Reconstruct the original signed URL and ask Laravel to validate the signature.
     *   3. Load the user record and confirm the hash matches their email.
     *   4. If all checks pass, mark the email as verified and fire the Verified event.
     */
    public function verify(Request $request): JsonResponse
    {
        // Ensure the four signed-URL components are present and have the right types.
        $request->validate([
            'id' => ['required', 'integer'],
            'hash' => ['required', 'string'],
            'expires' => ['required', 'integer'],
            'signature' => ['required', 'string'],
        ]);

        // Reconstruct the signed URL in the exact format Laravel produced when signing.
        // Laravel's signedRoute() calls ksort() on all parameters before computing the HMAC,
        // so params must appear in alphabetical order: expires, hash, id, signature.
        // The route has no path params, so we build the query string manually.
        $params = [
            'expires' => $request->integer('expires'),
            'hash' => (string) $request->string('hash'),
            'id' => $request->integer('id'),
        ];
        ksort($params);
        $urlToVerify = route('verification.verify').'?'.http_build_query($params).'&signature='.$request->string('signature');

        // Ask Laravel's URL facade to confirm the HMAC signature is valid and hasn't expired.
        if (! \Illuminate\Support\Facades\URL::hasValidSignature(
            \Illuminate\Http\Request::create($urlToVerify)
        )) {
            return response()->json(['message' => 'Invalid or expired verification link.'], 422);
        }

        // Fetch the user by ID — fail fast if the ID doesn't exist in the database.
        $user = \App\Models\User::findOrFail($request->integer('id'));

        // Verify the hash matches the user's email.
        // hash_equals() prevents timing attacks by comparing in constant time.
        if (! hash_equals(sha1($user->getEmailForVerification()), (string) $request->string('hash'))) {
            return response()->json(['message' => 'Invalid verification link.'], 422);
        }

        // Guard against re-verifying an already-verified email address.
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        // Stamp the email_verified_at timestamp in the database.
        $user->markEmailAsVerified();
        // Fire the Verified event so listeners (e.g., welcome notifications) can react.
        event(new Verified($user));

        return response()->json(['message' => 'Email verified successfully.']);
    }

    /**
     * Resend the email verification notification.
     *
     * POST /auth/email/resend
     *
     * Requires authentication. Throttled to prevent abuse.
     *
     * If the user's email is already verified there is nothing to do — return early.
     * Otherwise, send a fresh signed verification link via the notification system.
     */
    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        // Skip resending if the email is already confirmed.
        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        // Dispatch a fresh verification email using the custom notification class.
        $user->notify(new EmailVerificationNotification);

        return response()->json(['message' => 'Verification email sent.']);
    }
}
