<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * SecurityHeaders — Adds defensive HTTP headers to every API response.
 *
 * Web browsers use HTTP response headers as hints and rules about how to
 * handle content from a server. This middleware attaches a standard set of
 * security headers that reduce the risk of common web attacks:
 *
 *  - MIME sniffing attacks (X-Content-Type-Options)
 *  - Clickjacking attacks (X-Frame-Options)
 *  - Cross-site scripting / XSS attacks (X-XSS-Protection, Permissions-Policy)
 *  - Referrer leaks (Referrer-Policy)
 *  - Downgrade attacks / HTTP interception (Strict-Transport-Security)
 *
 * HSTS is only sent in production — in local development the app may run
 * over plain HTTP, and sending HSTS there would break the developer's browser.
 *
 * Note: Content-Security-Policy (CSP) headers should also be enforced at
 * the reverse-proxy level (nginx/Apache) for full defence-in-depth coverage.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        // Let the request proceed to the controller and collect the response.
        $response = $next($request);

        // Prevent MIME-type sniffing: browsers must respect the declared Content-Type.
        // Without this, a browser might execute a file as JavaScript even if the
        // server labelled it as 'text/plain'.
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Deny framing entirely (clickjacking protection).
        // DENY prevents any site (including this one) from embedding pages in an iframe.
        $response->headers->set('X-Frame-Options', 'DENY');

        // Legacy XSS filter for older browsers (belt-and-suspenders approach).
        // Modern browsers use CSP instead, but this header protects older ones too.
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Control what URL information is sent in the Referer header.
        // 'strict-origin-when-cross-origin' sends the full URL for same-origin
        // requests, but only the origin (no path) for cross-origin HTTPS requests,
        // and nothing at all for cross-origin HTTP requests.
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Disable browser features this application does not need.
        // Blocking camera, microphone, geolocation, payment, and USB access prevents
        // malicious scripts from silently activating these capabilities.
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
        );

        // HSTS: tell browsers to always use HTTPS.
        // Only sent in production — avoids breaking local dev over HTTP.
        // max-age=63072000 is two years. includeSubDomains covers all subdomains.
        // preload allows submission to browser HSTS preload lists.
        if (config('app.env') === 'production') {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=63072000; includeSubDomains; preload'
            );
        }

        return $response;
    }
}
