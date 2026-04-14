<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureUserIsMedicalProvider — Gates routes to medical staff and admins.
 *
 * This middleware restricts access to medical-portal routes. It allows two
 * types of users:
 *  - Medical providers (role: 'medical') — the camp's clinical team.
 *  - Admins and super_admins — for oversight and administrative access.
 *
 * Parents (applicants) are excluded from all medical-portal routes because
 * they interact with medical data through the camper/application flow instead.
 *
 * How it is used in routes:
 *   ->middleware('medical')
 */
class EnsureUserIsMedicalProvider
{
    /**
     * Handle an incoming request.
     *
     * Steps:
     *  1. Confirm the user is authenticated.
     *  2. Confirm the user is either a medical provider or an admin.
     *  3. Pass the request through if either check passes.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Pull the authenticated user from the current session/token.
        $user = $request->user();

        // No logged-in user at all — send 401 Unauthorized.
        if ($user === null) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Allow both medical providers and admins. If neither, block with 403.
        // isAdmin() covers both 'admin' and 'super_admin' roles.
        if (! $user->isMedicalProvider() && ! $user->isAdmin()) {
            return response()->json([
                'message' => 'Access denied. Medical provider privileges required.',
            ], Response::HTTP_FORBIDDEN);
        }

        // MFA enforcement is intentionally NOT checked here. Routes that require
        // MFA enrollment should use the 'mfa.enrolled' middleware alias at the
        // route level (e.g. ->middleware('mfa.enrolled')). Embedding an MFA check
        // here would prevent unenrolled medical staff from reaching the /profile
        // page needed to complete their MFA setup, creating a bootstrap deadlock.
        // This pattern matches EnsureUserHasRole and EnsureUserIsAdmin.

        // User is either medical staff or an admin — allow through.
        return $next($request);
    }
}
