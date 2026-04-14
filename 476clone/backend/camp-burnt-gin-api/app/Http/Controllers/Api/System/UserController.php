<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\SystemNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * UserController — Super-admin user management panel.
 *
 * Gives super administrators the ability to browse all user accounts in the
 * system, change their roles, and activate or deactivate them.
 *
 * All endpoints in this controller require the super_admin role (enforced
 * at the route level via middleware, not here).
 *
 * Key safety rules built into this controller:
 *   - An admin cannot modify their own role or account status.
 *   - Deactivating a user revokes all their Sanctum tokens immediately,
 *     so they are signed out everywhere without waiting for token expiry.
 *   - A role change fires a system inbox notification so the affected user
 *     is informed of the change.
 *
 * Provides:
 *   index        — paginated, searchable, filterable user list
 *   updateRole   — assign a new role to a user
 *   deactivate   — disable login access
 *   reactivate   — restore login access
 */
class UserController extends Controller
{
    /**
     * Create a new staff user account.
     *
     * POST /api/users
     *
     * Allows super admins to create admin, medical, or super_admin accounts directly
     * without requiring those users to self-register and have their role elevated.
     *
     * Applicants must always self-register via /api/auth/register.
     * This endpoint explicitly disallows creating applicant-role accounts.
     *
     * The created account is immediately active and verified — no email confirmation
     * step is enforced because the super admin is vouching for the account.
     * The new user will be prompted to change their password on first login
     * (via the standard profile password-change flow).
     *
     * An audit log entry is created so there is a record of which super admin
     * created which staff account.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $role = Role::where('name', $data['role'])->firstOrFail();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role_id' => $role->id,
            // Mark as active and email-verified immediately — super admin vouches for this account.
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        $user->load('role');

        AuditLog::logAdminAction(
            action: 'user_created',
            user: $request->user(),
            description: "Created new {$role->name} account for {$user->email}",
            metadata: ['new_user_id' => $user->id, 'role' => $role->name]
        );

        // Notify the new user via inbox so they know their account is ready.
        app(SystemNotificationService::class)->roleChanged(
            $user, 'none', $role->name, $request->user()
        );

        return response()->json([
            'message' => 'User account created successfully.',
            'data' => $this->formatUser($user),
        ], 201);
    }

    /**
     * Return a paginated, filterable list of all users.
     *
     * GET /api/users
     *
     * Query parameters:
     *   - search:    text match against name or email
     *   - role:      filter by role slug (e.g. "applicant", "admin")
     *   - per_page:  number of results per page (default 20)
     *   - page:      pagination page number
     *
     * Results are formatted through formatUser() to match the frontend User type.
     */
    public function index(Request $request): JsonResponse
    {
        // Validate filter inputs to prevent injection and ensure sensible lengths.
        $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:50'],
        ]);

        // Start from newest accounts first — most recent signups appear at the top.
        // Exclude deactivated/deleted accounts — is_active=false means the user has
        // requested deletion or been deactivated; they should not appear in this list.
        $query = User::with('role')->where('is_active', true)->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $term = $request->string('search');
            // Match against both name and email so admins can search however they remember the user.
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%");
            });
        }

        if ($request->filled('role')) {
            $roleName = $request->string('role');
            // Filter by role name using a whereHas sub-query through the role relationship.
            $query->whereHas('role', fn ($q) => $q->where('name', $roleName));
        }

        $users = $query->paginate($request->integer('per_page', 20));

        return response()->json([
            // Map each User model through formatUser() to produce the flat shape the frontend expects.
            'data' => collect($users->items())->map(fn ($u) => $this->formatUser($u))->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                // from/to tell the frontend which records (e.g., "21-40 of 150") are shown.
                'from' => $users->firstItem(),
                'to' => $users->lastItem(),
            ],
        ]);
    }

    /**
     * Assign a new role to the given user.
     *
     * PUT /api/users/{user}/role
     *
     * Prevents self-modification and validates the new role exists in the roles table.
     * Fires a system inbox notification so the affected user is informed of the change.
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        // Prevent a super_admin from accidentally locking themselves out by changing their own role.
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot modify your own role.'], 403);
        }

        // 'exists:roles,name' ensures the requested role is a real entry in the roles table.
        $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $role = Role::where('name', $request->string('role'))->firstOrFail();

        // Guard: cannot demote the last super_admin (would permanently lock out all admins).
        // The route middleware already ensures only super_admins reach this point, so we
        // only need to check the "last super_admin" edge case here.
        if ($user->isSuperAdmin() && $role->name !== 'super_admin') {
            $superAdminCount = User::whereHas('role', fn ($q) => $q->where('name', 'super_admin'))->count();
            if ($superAdminCount <= 1) {
                return response()->json(['message' => 'Cannot demote the last super administrator.'], 403);
            }
        }

        // Capture the old role name before changing it — used in the notification message.
        $oldRoleName = $user->role?->name ?? 'applicant';
        $user->role_id = $role->id;
        $user->save();
        // Reload the role relationship so formatUser() returns the updated role name.
        $user->load('role');

        // System inbox notification: role changed
        // Notify the affected user so they aren't confused by unexpected permission changes.
        app(SystemNotificationService::class)->roleChanged(
            $user, $oldRoleName, $role->name, $request->user()
        );

        return response()->json([
            'message' => 'Role updated.',
            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Deactivate a user account.
     *
     * POST /api/users/{user}/deactivate
     *
     * Sets is_active = false and immediately revokes all Sanctum tokens so the
     * user cannot continue using any active sessions. Does not delete the account.
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        // An admin deactivating their own account would lock them out immediately.
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 403);
        }

        $user->is_active = false;
        $user->email_verified_at = null;
        $user->save();

        // Revoke all active tokens so the user is immediately signed out.
        // Without this, the user could continue using their current token until it expires.
        $user->tokens()->delete();

        return response()->json(['message' => 'User deactivated.']);
    }

    /**
     * Reactivate a user account.
     *
     * POST /api/users/{user}/reactivate
     *
     * Sets is_active = true so the user can log in again.
     * Does not re-issue any tokens — the user must log in fresh.
     */
    public function reactivate(Request $request, User $user): JsonResponse
    {
        // Guard against a self-modification edge case (less dangerous than deactivate, but consistent).
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'You cannot modify your own account status.'], 403);
        }

        $user->is_active = true;
        $user->email_verified_at = now();
        $user->save();

        return response()->json(['message' => 'User reactivated.']);
    }

    /**
     * Format a User model into the shape the frontend expects.
     *
     * The frontend User type expects a flat `role` string, not a relationship object.
     * This helper converts the Eloquent model to that flat array, keeping the
     * transformation logic in one place so every endpoint stays consistent.
     */
    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            // Flatten the role relationship to just the name string; default to 'applicant' if unset.
            'role' => $user->role?->name ?? 'applicant',
            // Cast to bool so JSON encodes as true/false, not 1/0.
            'is_active' => (bool) $user->is_active,
            // toISOString() gives the frontend a timezone-aware string (e.g., "2026-01-15T10:30:00.000Z").
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'mfa_enabled' => (bool) $user->mfa_enabled,
            'created_at' => $user->created_at->toISOString(),
        ];
    }
}
