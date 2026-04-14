<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * EnsureUserIsAdmin — Convenience middleware that gates routes to admins only.
 *
 * This is a focused shorthand equivalent to EnsureUserHasRole with just the
 * 'admin' role. Because User::isAdmin() returns true for both 'admin' and
 * 'super_admin', both roles are allowed through automatically.
 *
 * How it is used in routes:
 *   ->middleware('admin')
 *
 * Use this instead of role:admin when you know the route is always admin-only
 * and you want code that is easy to read at a glance.
 */
class EnsureUserIsAdmin
{
    /**
     * Handle an incoming request.
     *
     * Steps:
     *  1. Confirm the user is authenticated.
     *  2. Confirm the user is an admin (or super_admin).
     *  3. Pass the request through.
     *
     * MFA is NOT enforced here — that is handled by the separate mfa.enrolled
     * and mfa.step_up middleware layers applied to individual routes that need them.
     * Admins must be able to reach their profile page to complete MFA enrollment
     * before they can access PHI or sensitive action routes.
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

        // isAdmin() returns true for both 'admin' and 'super_admin' roles.
        // If neither role matches, deny with 403 Forbidden.
        if (! $user->isAdmin()) {
            return response()->json([
                'message' => 'Access denied. Administrator privileges required.',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
