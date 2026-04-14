<?php

use App\Http\Middleware\AddRequestId;
use App\Http\Middleware\AuditPhiAccess;
use App\Http\Middleware\EnsureMfaEnrolled;
use App\Http\Middleware\EnsureMfaStepUp;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\EnsureUserIsMedicalProvider;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            /**
             * Configure rate limiting for API endpoints.
             *
             * Implements tiered rate limiting to prevent brute force attacks and abuse:
             * - Authentication endpoints: Strict limits to prevent credential stuffing
             * - Sensitive operations: Moderate limits for MFA and uploads
             * - General API: Standard limits for normal operations
             */
            RateLimiter::for('api', function (Request $request) {
                // Authenticated users get a higher limit — the admin/medical portals make
                // many parallel sub-requests per page (allergies, medications, contacts, etc.).
                // 60/min was too low for normal browsing and caused cascade 429 failures.
                // Unauthenticated requests keep the lower limit to block enumeration attacks.
                $limit = $request->user() ? 300 : 60;

                return Limit::perMinute($limit)->by($request->user()?->id ?: $request->ip());
            });

            RateLimiter::for('auth', function (Request $request) {
                return [
                    Limit::perMinute(5)->by($request->ip()),
                    Limit::perHour(20)->by($request->ip()),
                ];
            });

            RateLimiter::for('mfa', function (Request $request) {
                return [
                    Limit::perMinute(3)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(10)->by($request->user()?->id ?: $request->ip()),
                ];
            });

            RateLimiter::for('uploads', function (Request $request) {
                return [
                    Limit::perMinute(5)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(50)->by($request->user()?->id ?: $request->ip()),
                ];
            });

            RateLimiter::for('sensitive', function (Request $request) {
                return [
                    Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()),
                    Limit::perHour(100)->by($request->user()?->id ?: $request->ip()),
                ];
            });
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(\Illuminate\Http\Middleware\HandleCors::class);
        $middleware->append(SecurityHeaders::class);
        $middleware->append(AddRequestId::class);
        $middleware->append(AuditPhiAccess::class);

        $middleware->alias([
            // Override the default Authenticate middleware so unauthenticated API
            // requests return 401 JSON instead of attempting a login redirect.
            'auth' => \App\Http\Middleware\Authenticate::class,
            'role' => EnsureUserHasRole::class,
            'admin' => EnsureUserIsAdmin::class,
            'medical' => EnsureUserIsMedicalProvider::class,
            'mfa.enrolled' => EnsureMfaEnrolled::class,
            'mfa.step_up' => EnsureMfaStepUp::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // This is an API-only application — always return JSON for every exception type.
        // Without this, Laravel's fallback exception handler calls route('login') which
        // does not exist, causing a RouteNotFoundException (500) instead of a clean 401.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            return response()->json([
                'message' => 'Authentication required.',
            ], Response::HTTP_UNAUTHORIZED);
        });

        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            return response()->json([
                'message' => 'Access denied.',
            ], Response::HTTP_FORBIDDEN);
        });

        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            return response()->json([
                'message' => 'Resource not found.',
            ], Response::HTTP_NOT_FOUND);
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            return response()->json([
                'message' => 'Endpoint not found.',
            ], Response::HTTP_NOT_FOUND);
        });
    })->create();
