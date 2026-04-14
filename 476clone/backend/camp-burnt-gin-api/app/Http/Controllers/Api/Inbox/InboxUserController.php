<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * InboxUserController — provides a searchable, role-aware user list for the compose window.
 *
 * When a user opens the "New Conversation" compose panel and starts typing a recipient name,
 * this endpoint returns matching users they are allowed to message. The results are filtered
 * by the role of the authenticated user so that:
 *   - Applicants (parents) can only find admin/super_admin users to message
 *   - Medical users can find admins and applicants
 *   - Admins / super_admins can find anyone
 *
 * This prevents parents from discovering and messaging each other through the inbox.
 *
 * GET /api/inbox/users?search=...
 */
class InboxUserController extends Controller
{
    /**
     * Search for users that the authenticated user is permitted to start a conversation with.
     *
     * Steps:
     *   1. Validate the search string (optional, max 100 chars)
     *   2. Build a base query excluding the current user
     *   3. Apply role-based visibility filters
     *   4. Narrow by name/email if a search term was provided
     *   5. Return up to 20 results ordered alphabetically
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            // Search is optional; max 100 prevents excessively large LIKE queries
            'search' => 'nullable|string|max:100',
        ]);

        $authUser = $request->user();
        // trim() removes leading/trailing whitespace the frontend may send
        $search = trim($request->string('search', ''));

        // Start with all users and eagerly load their role for the filter below
        $query = User::query()
            ->with('role')
            // Always exclude the authenticated user — you can't message yourself
            ->where('id', '!=', $authUser->id);

        // Apply role-based recipient restrictions
        if ($authUser->isApplicant()) {
            // Parents may only compose messages to camp admin staff
            $query->whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']));
        } elseif ($authUser->isMedicalProvider()) {
            // Medical users can message admin staff and applicant families
            $query->whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin', 'applicant']));
        }
        // Admins and super_admins have no additional restrictions — they see all users

        // Apply the search filter if the user typed something in the compose box
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                // Search by full name OR email address (partial match using LIKE)
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Limit to 20 results to keep the dropdown fast; order alphabetically by name
        $users = $query->orderBy('name')->limit(20)->get();

        return response()->json([
            'success' => true,
            // Return only id/name/role — email is PII and is not needed by the compose
            // window to route messages. Excluding it prevents participant enumeration.
            'data' => $users->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                // Include the role name so the UI can show "Admin" or "Medical" badges
                'role' => $u->role?->name ?? 'unknown',
            ])->values(),
        ]);
    }
}
