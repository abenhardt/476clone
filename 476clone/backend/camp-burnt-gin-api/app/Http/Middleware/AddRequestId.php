<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * AddRequestId — Attaches a unique correlation ID to every request and response.
 *
 * Imagine your server receives a thousand requests per minute. If something goes
 * wrong on one of them, how do you find it in the logs? A Request ID solves this
 * by tagging every request with a unique identifier that flows through log entries,
 * error reports, and the response header — making it easy to trace a single
 * transaction from start to finish.
 *
 * Behaviour:
 *  - If the incoming request already has an X-Request-ID header (e.g., set by a
 *    load balancer or the frontend), that ID is reused for continuity.
 *  - Otherwise, a new UUID is generated for this request.
 *  - The ID is injected into Laravel's log context so every log line written
 *    during this request automatically includes the ID.
 *  - The ID is also added to the response headers so the frontend or API client
 *    can reference it when reporting an issue.
 */
class AddRequestId
{
    /**
     * Handle an incoming request.
     *
     * Steps:
     *  1. Read the existing X-Request-ID, or generate a fresh UUID.
     *  2. Write the ID into the request headers so downstream code can read it.
     *  3. Add the ID (plus user and IP) to the log context for this request.
     *  4. Forward the request to the controller and get a response.
     *  5. Write the same ID into the response header so the client can see it.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Reuse the caller's ID if provided; otherwise generate a new UUID.
        // UUIDs are globally unique random strings — perfect for correlation IDs.
        $requestId = $request->header('X-Request-ID') ?? (string) Str::uuid();

        // Write the ID back into the request headers so controllers and
        // other middleware can access it via $request->header('X-Request-ID').
        $request->headers->set('X-Request-ID', $requestId);

        // Attach the ID to every log entry written during this request.
        // withContext() adds these fields to all Log::info(), Log::error(), etc. calls.
        \Illuminate\Support\Facades\Log::withContext([
            'request_id' => $requestId,
            // Also include the user ID and IP for quick filtering in log aggregators.
            'user_id' => $request->user()?->id,
            'ip' => $request->ip(),
        ]);

        // Pass the request to the next middleware/controller and capture the response.
        $response = $next($request);

        // Echo the same ID in the response header so the API client can log or
        // report it when investigating a failed request.
        $response->headers->set('X-Request-ID', $requestId);

        return $response;
    }
}
