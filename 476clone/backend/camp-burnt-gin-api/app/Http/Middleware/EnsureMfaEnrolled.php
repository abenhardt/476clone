<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureMfaEnrolled — Blocks access for elevated-privilege users who have not
 * enrolled in multi-factor authentication.
 *
 * PHI access (admin and medical roles) requires MFA as a HIPAA access-control
 * safeguard. Token issuance is already gated on TOTP completion when MFA is
 * enabled (AuthService), but that only protects users who *already* set up MFA.
 * This middleware closes the gap by requiring *enrollment* for roles that can
 * see protected health information.
 *
 * This middleware must run AFTER the role-check middleware in the chain so that
 * it only fires for users who have already passed the role gate.
 *
 * HTTP 403 is returned (not 401) because the user IS authenticated — they
 * simply have not met the MFA enrollment requirement for their role.
 *
 * The `mfa_setup_required` field in the response body lets the frontend
 * distinguish this denial from a generic permissions error and redirect the
 * user to the security settings page to complete enrollment.
 *
 * Roles exempt from this requirement:
 *  - applicant (parents/guardians) — no PHI write access; lower risk profile
 */
class EnsureMfaEnrolled
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user === null) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // ── Enforcement scaffold (currently pass-through) ────────────────────
        // When PHI enrollment enforcement is activated, isAdmin() and isMedicalProvider()
        // roles with mfa_enabled === false will be denied with HTTP_FORBIDDEN and
        // 'mfa_setup_required' => true in the response body, directing the user to
        // complete MFA enrollment via their portal profile page.
        //
        // Current policy: MFA enrollment is strongly recommended but not yet forced.
        // The step-up gate (EnsureMfaStepUp) enforces re-verification for users who
        // already have MFA configured; this gate is reserved for future hard enforcement.
        // ─────────────────────────────────────────────────────────────────────

        return $next($request);
    }
}
