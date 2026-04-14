<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * AuthController — Handles all core authentication actions.
 *
 * This is the front door of the API for user identity. It is responsible for:
 *   - Creating new accounts (register)
 *   - Signing users in and issuing API tokens (login)
 *   - Signing users out and revoking their token (logout)
 *   - Returning the currently-signed-in user's profile (user)
 *
 * The heavy lifting (credential checking, rate limiting, MFA checks) lives in
 * AuthService, keeping this controller thin and easy to read.
 */
class AuthController extends Controller
{
    // Laravel injects AuthService automatically via the constructor.
    public function __construct(
        protected AuthService $authService
    ) {}

    /**
     * Register a new user account.
     *
     * POST /api/auth/register
     *
     * Step-by-step:
     *   1. Laravel validates the incoming request using RegisterRequest rules.
     *   2. AuthService creates the User record in the database.
     *   3. A verification email is dispatched so the user can confirm their address.
     *   4. A Sanctum API token is minted and returned so the user is immediately logged in.
     *   5. The new user object (with their role) and the token are returned as JSON.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        // AuthService handles hashing the password and setting the default role.
        $user = $this->authService->register($request->validated());

        // Audit: record account creation so the trail shows when each account was created.
        AuditLog::logAuth('register', $user, [
            'role' => $user->role?->name ?? 'applicant',
        ]);

        // Trigger email verification notification.
        // Wrapped in try-catch so an SMTP failure does not roll back a successful registration.
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            Log::warning('Failed to send email verification notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Create a personal API token — the plain-text value is only available here; store it securely on the client.
        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully. Please check your email to verify your address.',
            'data' => [
                'user' => $this->buildUserArray($user->load('role')),
                'token' => $token,
            ],
        ], Response::HTTP_CREATED);
    }

    /**
     * Authenticate a user and issue an API token.
     *
     * POST /api/auth/login
     *
     * Step-by-step:
     *   1. Validated credentials are passed to AuthService.
     *   2. If login fails (bad password, lockout) a 401 is returned with detail.
     *   3. If the user has MFA enabled, a prompt is returned instead of a token.
     *   4. On full success, the user object and their new token are returned.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        // AuthService checks credentials, tracks failed attempts, and enforces lockouts.
        $result = $this->authService->login($request->validated());

        if (! $result['success']) {
            // Audit: record the failed attempt. User is null for unknown-email attempts.
            AuditLog::logAuth('login_failed', $result['user'] ?? null, [
                'reason' => $result['message'] ?? 'invalid_credentials',
                'lockout' => $result['lockout'] ?? false,
            ]);

            $response = [
                'success' => false,
                'message' => $result['message'],
            ];

            // Include lockout information if account is locked
            if (isset($result['lockout']) && $result['lockout']) {
                // Tell the client how many seconds to wait before retrying.
                $response['lockout'] = true;
                $response['retry_after'] = $result['retry_after'];
            }

            // Include remaining attempts for failed login
            if (isset($result['attempts_remaining'])) {
                // Warn the user how many tries they have left before a lockout.
                $response['attempts_remaining'] = $result['attempts_remaining'];
            }

            return response()->json($response, Response::HTTP_UNAUTHORIZED);
        }

        // If MFA is required, don't issue a token yet — the client must call the MFA verify endpoint.
        if ($result['mfa_required'] ?? false) {
            // Audit: password was correct but MFA step is still pending.
            // AuthService does not include 'user' in the mfa_required response, so look up by email.
            $mfaUser = User::where('email', $request->input('email'))->first();
            AuditLog::logAuth('login_mfa_required', $mfaUser);

            return response()->json([
                'success' => true,
                'message' => 'MFA verification required.',
                'mfa_required' => true,
            ], Response::HTTP_OK);
        }

        // Audit: full login success.
        AuditLog::logAuth('login', $result['user'], [
            'role' => $result['user']?->role?->name,
        ]);

        // Full success — return user profile and the new API token.
        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => $this->buildUserArray($result['user']),
                'token' => $result['token'],
            ],
        ]);
    }

    /**
     * Log out the current user and revoke their token.
     *
     * POST /api/auth/logout
     *
     * Deletes only the specific token that was used for this request, not all tokens.
     * This means the user stays logged in on other devices/tabs.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        // Audit: record the logout before revoking the token (user object is still available here).
        AuditLog::logAuth('logout', $user);

        // currentAccessToken() refers to the Sanctum token attached to this HTTP request.
        $user->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the authenticated user's profile.
     *
     * GET /api/auth/user
     *
     * Used by the frontend on app load to restore the session and determine role-based routing.
     * The `role` relationship is eager-loaded so the frontend receives the role name in one request.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user()->load('role');

        return response()->json(['data' => $this->buildUserArray($user)]);
    }

    /**
     * Convert a User model to a response-ready array with the computed avatar_url field.
     *
     * Laravel's toArray() only serialises database columns. avatar_url is a computed
     * public Storage URL that must be appended manually. Centralising this here ensures
     * login, register, and the /user endpoint all return an identical user shape so the
     * frontend always has avatar_url regardless of which auth flow was used.
     */
    private function buildUserArray(User $user): array
    {
        $data = $user->toArray();
        $data['avatar_url'] = $user->avatar_path
            ? Storage::disk('public')->url($user->avatar_path)
            : null;

        return $data;
    }
}
