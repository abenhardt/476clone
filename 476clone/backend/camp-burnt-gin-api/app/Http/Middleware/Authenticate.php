<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

/**
 * Authenticate — Custom authentication middleware for this API-only application.
 *
 * Overrides Laravel's default Authenticate middleware to prevent it from
 * attempting a redirect to a 'login' named route when a request is unauthenticated.
 *
 * By default, Laravel's Authenticate::redirectTo() calls route('login'), which
 * throws a RouteNotFoundException in this API-only app (there is no 'login' web route).
 * That exception produces a 500 response instead of the expected 401.
 *
 * The fix: return null from redirectTo() so the AuthenticationException propagates
 * cleanly and is rendered as a 401 JSON response by the exception handler in
 * bootstrap/app.php.
 */
class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when not authenticated.
     *
     * Returns null for all requests — this is an API-only app with no web login page.
     * Returning null causes the parent class to throw an AuthenticationException,
     * which bootstrap/app.php renders as {"message": "Authentication required."} HTTP 401.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
