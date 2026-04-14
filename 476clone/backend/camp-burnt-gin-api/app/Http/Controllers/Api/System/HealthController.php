<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * HealthController — System health check endpoints for infrastructure monitoring.
 *
 * Container orchestration systems (Kubernetes, Docker Swarm, ECS) need a way
 * to ask "is this app healthy?" without using an authenticated endpoint.
 * These two probes serve that purpose:
 *
 *   liveness()  — "Is the PHP process alive?" — fast, no external checks.
 *   readiness() — "Can this app serve real traffic?" — checks DB and storage.
 *
 * Why two separate probes?
 *   If the DB is down, the app is NOT ready to serve users but the process is
 *   still alive. Kubernetes uses liveness to decide whether to restart a pod,
 *   and readiness to decide whether to route traffic to it. Separating them
 *   prevents unnecessary restarts during short dependency outages.
 *
 * HTTP status codes:
 *   200 → healthy / ready
 *   503 → not ready (readiness only — liveness always returns 200 if PHP runs)
 */
class HealthController extends Controller
{
    /**
     * Liveness probe — confirms the application process is running.
     *
     * GET /health/live
     *
     * This endpoint is intentionally simple. If PHP can execute code and return
     * a response, the process is alive. No database or filesystem checks are
     * performed — those belong in readiness().
     *
     * Returns 200 if the application process is alive.
     * Does NOT check dependencies (database, cache, etc.)
     */
    public function liveness(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            // config('app.name') pulls the APP_NAME env variable — useful for multi-service setups.
            'service' => config('app.name'),
            // Include a timestamp so monitoring tools can confirm the response is fresh.
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    /**
     * Readiness probe — confirms the application can serve real traffic.
     *
     * GET /health/ready
     *
     * Runs a quick check on each critical dependency and aggregates the results.
     * Returns 200 if all checks pass, 503 if any check fails.
     *
     * The `checks` object in the response body tells the monitoring system
     * exactly which dependency failed, making diagnosis faster.
     *
     * Checks performed:
     *   - database: can we connect and identify the DB?
     *   - storage:  can we write to and read from the local disk?
     */
    public function readiness(): JsonResponse
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'storage' => $this->checkStorage(),
        ];

        // All checks must pass — if even one dependency is down, the app isn't ready.
        $allHealthy = collect($checks)->every(fn ($check) => $check['healthy']);

        return response()->json([
            'status' => $allHealthy ? 'ready' : 'not_ready',
            'service' => config('app.name'),
            // Return all check results so monitoring can show exactly what's wrong.
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
            // Use 503 Service Unavailable when not all dependencies are healthy.
        ], $allHealthy ? Response::HTTP_OK : Response::HTTP_SERVICE_UNAVAILABLE);
    }

    /**
     * Check database connectivity.
     *
     * Attempts to obtain a PDO connection and read the database name.
     * Any exception (wrong credentials, server down, etc.) is caught
     * and returned as an unhealthy status.
     *
     * In production, the raw error message is hidden to avoid leaking
     * connection details; in other environments it is included for debugging.
     *
     * @return array<string, mixed>
     */
    protected function checkDatabase(): array
    {
        try {
            // getPdo() opens the actual TCP connection — this is where failures surface.
            DB::connection()->getPdo();
            // getDatabaseName() confirms the correct database is selected on this connection.
            DB::connection()->getDatabaseName();

            return [
                'healthy' => true,
                'message' => 'Database connection successful',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'message' => 'Database connection failed',
                // Hide raw error details in production to avoid exposing connection strings.
                'error' => app()->environment('production') ? 'Connection error' : $e->getMessage(),
            ];
        }
    }

    /**
     * Check storage accessibility.
     *
     * Performs a write → read → delete cycle on a temporary file.
     * If any step fails, or if the read content doesn't match what was written,
     * storage is marked unhealthy.
     *
     * This tests both disk write permission and read-after-write consistency,
     * catching issues like full disks or misconfigured mount points.
     *
     * @return array<string, mixed>
     */
    protected function checkStorage(): array
    {
        try {
            $disk = \Illuminate\Support\Facades\Storage::disk('local');
            // Use a timestamp-based name to avoid collisions if multiple health checks run concurrently.
            $testFile = '.health_check_'.time();

            // Write test file
            $disk->put($testFile, 'test');

            // Read test file
            $content = $disk->get($testFile);

            // Delete test file
            $disk->delete($testFile);

            // Verify the content matches to confirm write → read consistency.
            return [
                'healthy' => $content === 'test',
                'message' => 'Storage read/write successful',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'message' => 'Storage check failed',
                // Same production safety — don't expose filesystem paths in error messages.
                'error' => app()->environment('production') ? 'Storage error' : $e->getMessage(),
            ];
        }
    }
}
