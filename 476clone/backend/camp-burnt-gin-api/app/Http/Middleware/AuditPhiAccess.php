<?php

namespace App\Http\Middleware;

use App\Models\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * AuditPhiAccess — HIPAA-compliant PHI access logging middleware.
 *
 * PHI stands for Protected Health Information — things like a camper's
 * diagnoses, allergies, medications, and medical records. HIPAA (a US
 * healthcare privacy law) requires that every time someone accesses PHI,
 * a record of that access is created and kept for auditing.
 *
 * This middleware runs after every response to check whether the request
 * touched a PHI-related route. If it did AND the response was successful,
 * it creates an AuditLog entry capturing who accessed what and when.
 *
 * Design principles:
 *  - Runs AFTER the response so it never blocks the user's actual request.
 *  - Graceful degradation: if the audit write fails, the failure is logged
 *    to the error log but the user's response is still returned normally.
 *  - Only logs successful responses (2xx) — failed requests are not PHI access.
 *  - Route parameters are sanitized to avoid storing passwords in audit logs.
 */
class AuditPhiAccess
{
    /**
     * PHI-related route name patterns that require audit logging.
     *
     * Laravel's Str::is() supports wildcard '*' matching, so 'allergies.*'
     * will match 'allergies.index', 'allergies.show', 'allergies.store', etc.
     */
    protected array $phiRoutePatterns = [
        'medical-records.*',
        'allergies.*',
        'medications.*',
        'emergency-contacts.*',
        'documents.*',
        'applications.show',
        'applications.store',
        'applications.review',
        'campers.index',
        'campers.show',
        'campers.risk-summary',
        'campers.compliance-status',
        'diagnoses.*',
        'behavioral-profiles.*',
        'feeding-plans.*',
        'assistive-devices.*',
        'activity-permissions.*',
        // Clinical encounter and care records — all contain HIPAA-regulated PHI
        'personal-care-plans.*',
        'treatment-logs.*',
        'medical-visits.*',
        'medical-incidents.*',
        'medical-follow-ups.*',
        'medical-restrictions.*',
    ];

    /**
     * Handle an incoming request.
     *
     * The request is passed to the next handler first; we only inspect
     * the response after the controller has done its work.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Let the request proceed to the controller and get a response.
        $response = $next($request);

        // Decide whether this request touched PHI and was successful.
        if ($this->shouldAudit($request, $response)) {
            $this->logPhiAccess($request, $response);
        }

        // Always return the actual response to the client unchanged.
        return $response;
    }

    /**
     * Decide whether this request should be recorded in the audit log.
     *
     * All requests must match a PHI route pattern AND succeed (2xx).
     */
    protected function shouldAudit(Request $request, Response $response): bool
    {
        // Unauthenticated requests have no PHI access to audit.
        if (! $request->user()) {
            return false;
        }

        // If no route was matched (e.g., 404), there is nothing to audit.
        $route = $request->route();
        if (! $route) {
            return false;
        }

        // Unnamed routes cannot be matched to our pattern list.
        $routeName = $route->getName();
        if (! $routeName) {
            return false;
        }

        // Walk through each PHI pattern and check if the current route matches.
        foreach ($this->phiRoutePatterns as $pattern) {
            if (\Illuminate\Support\Str::is($pattern, $routeName)) {
                // Only log if the response was a success (2xx) —
                // we don't want audit noise from 403s, 404s, etc.
                return $response->isSuccessful();
            }
        }

        return false;
    }

    /**
     * Write a PHI access record to the audit log.
     *
     * If the database write fails for any reason (e.g., DB outage), we catch
     * the exception and write to the error log instead. The user's request is
     * never blocked — availability takes priority, but the failure is flagged
     * for operational follow-up.
     */
    protected function logPhiAccess(Request $request, Response $response): void
    {
        try {
            $route = $request->route();
            // Translate the HTTP method + route name into a human action word.
            $action = $this->determineAction($request);

            AuditLog::create([
                // X-Request-ID ties this log entry back to a specific request trace.
                // Fall back to a fresh UUID if the client did not send the header — the
                // column is NOT NULL, so a null would cause a silent DB exception and
                // the PHI access would go unlogged, violating HIPAA §164.312(b).
                'request_id' => $request->header('X-Request-ID', \Illuminate\Support\Str::uuid()->toString()),
                'user_id' => $request->user()?->id,
                'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
                'action' => $action,
                // Human-readable summary: e.g., "GET medical-records/42"
                'description' => sprintf(
                    '%s %s',
                    $request->method(),
                    $request->path()
                ),
                'metadata' => [
                    'route' => $route?->getName(),
                    'method' => $request->method(),
                    'status' => $response->getStatusCode(),
                    // Route parameters (e.g., camper ID) stored for context.
                    'route_parameters' => $this->sanitizeParameters($route?->parameters() ?? []),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            // Log the audit failure but DO NOT block the request.
            // This prevents audit system issues from causing service outages.
            Log::error('AUDIT LOG FAILED - PHI access not recorded', [
                'exception' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_id' => $request->header('X-Request-ID'),
                'user_id' => $request->user()?->id,
                'route' => $request->route()?->getName(),
                'method' => $request->method(),
                'path' => $request->path(),
                'ip' => $request->ip(),
            ]);

            // Optionally: dispatch alert/notification about audit failure
            // This is critical for HIPAA compliance monitoring
        }
    }

    /**
     * Map the HTTP method (and route name) to a plain-English action word.
     *
     * We store 'view', 'create', 'update', or 'delete' rather than the raw
     * HTTP verb so the audit log is easier for non-technical staff to read.
     *
     * Special case: review routes use POST but represent an update action,
     * so we detect them by route name suffix and return 'update'.
     */
    protected function determineAction(Request $request): string
    {
        $routeName = $request->route()?->getName();

        // Special case: review routes are updates even though they use POST.
        if ($routeName && str_ends_with($routeName, '.review')) {
            return 'update';
        }

        // Map standard HTTP methods to audit action words.
        return match ($request->method()) {
            'GET' => 'view',
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'access',
        };
    }

    /**
     * Strip sensitive values from route parameters before storing them.
     *
     * Route parameters can contain things like token values that should
     * never be written to a log. Eloquent model objects are reduced to just
     * their primary key so the log stays readable without leaking model data.
     */
    protected function sanitizeParameters(array $parameters): array
    {
        $sanitized = [];

        foreach ($parameters as $key => $value) {
            // Never log tokens, passwords, or secrets — replace with a placeholder.
            if (in_array($key, ['token', 'password', 'secret'])) {
                $sanitized[$key] = '[REDACTED]';
            } elseif (is_object($value) && method_exists($value, 'getKey')) {
                // Eloquent models: store only the primary key (e.g., the camper ID).
                $sanitized[$key] = $value->getKey();
            } else {
                // Scalars (strings, ints) are safe to store as-is; others become type names.
                $sanitized[$key] = is_scalar($value) ? $value : gettype($value);
            }
        }

        return $sanitized;
    }
}
