<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * AnnouncementController — manages camp-wide announcements for the dashboard and notification feed.
 *
 * Announcements are messages posted by admins to inform users about important camp news.
 * They support scheduling (future published_at), urgency flags, audience targeting, and pinning.
 *
 * Authorization model:
 *   - Listing (index): any authenticated user; non-admins see only "all"-audience announcements
 *   - Viewing (show): same audience restriction applies to non-admins
 *   - Creating: admin and super_admin only
 *   - Updating/Deleting: admin OR the original author
 *   - Pinning: admin only
 *
 * Routes:
 *   GET    /api/announcements           — list published announcements (audience-filtered)
 *   POST   /api/announcements           — create a new announcement (admin)
 *   GET    /api/announcements/{id}      — view a single announcement
 *   PUT    /api/announcements/{id}      — update an announcement (admin or author)
 *   DELETE /api/announcements/{id}      — delete an announcement (admin or author)
 *   POST   /api/announcements/{id}/pin  — toggle pin status (admin)
 */
class AnnouncementController extends Controller
{
    /**
     * List published announcements visible to the authenticated user.
     *
     * The published() scope filters out scheduled/draft announcements (future published_at).
     * The ordered() scope puts pinned items first, then sorts by most recent.
     * Non-admins only receive "all"-audience announcements for their role level.
     *
     * Pagination is applied with a configurable limit (default 20, max 50).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Start with published, correctly ordered announcements and load the author name
        $query = Announcement::with('author:id,name')
            ->published()
            ->ordered();

        // Non-admins only see announcements targeted at "all" users —
        // admin-only or session-specific announcements are hidden
        if (! $user->isAdmin()) {
            $query->forAudience('all');
        }

        // Cap the page size at 50 to prevent excessively large payloads
        $limit = min((int) $request->query('limit', 20), 50);

        $announcements = $query->paginate($limit);

        return response()->json($announcements);
    }

    /**
     * Create a new announcement (admin only).
     *
     * The author is automatically set to the authenticated admin user.
     * If published_at is omitted, the announcement is published immediately (now()).
     * A future published_at schedules the announcement as a draft until that time.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Hard gate: non-admins cannot post announcements under any circumstances
        abort_unless($user->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'is_pinned' => ['boolean'],
            'is_urgent' => ['boolean'],
            // audience must be one of these four values
            'audience' => ['required', Rule::in(['all', 'accepted', 'staff', 'session'])],
            // target_session_id is only relevant when audience = "session"
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            // Future date = scheduled draft; null = publish now
            'published_at' => ['nullable', 'date'],
        ]);

        $announcement = Announcement::create([
            ...$data,
            // Attach this announcement to the currently logged-in admin
            'author_id' => $user->id,
            // Default to publishing immediately if no date was provided
            'published_at' => $data['published_at'] ?? now(),
        ]);

        // Load the author relationship so the response includes the author name
        $announcement->load('author:id,name');

        return response()->json([
            'message' => 'Announcement published.',
            'data' => $announcement,
        ], Response::HTTP_CREATED);
    }

    /**
     * Show a single announcement.
     *
     * Admins can view any announcement. Non-admins are restricted to published,
     * "all"-audience announcements — consistent with the filter in index().
     * This prevents users from guessing announcement IDs to read staff-only content.
     */
    public function show(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        if (! $user->isAdmin()) {
            // Enforce the same three conditions that scopePublished() + forAudience() apply
            abort_unless(
                $announcement->published_at !== null &&
                $announcement->published_at <= now() &&
                $announcement->audience === 'all',
                Response::HTTP_FORBIDDEN,
                'Not authorized to view this announcement.'
            );
        }

        // Load author name and the target session name for the detail view
        $announcement->load('author:id,name', 'targetSession:id,name');

        return response()->json(['data' => $announcement]);
    }

    /**
     * Update an existing announcement (admin or the original author).
     *
     * Uses "sometimes" rules so only the fields included in the request are validated and updated.
     * This allows partial updates without requiring the caller to re-send the entire record.
     */
    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        // Either the admin can edit it, or the person who originally wrote it
        abort_unless(
            $user->isAdmin() || $announcement->author_id === $user->id,
            Response::HTTP_FORBIDDEN,
            'Not authorized to edit this announcement.'
        );

        $data = $request->validate([
            // "sometimes" means the field is only validated if it's present in the request
            'title' => ['sometimes', 'string', 'max:200'],
            'body' => ['sometimes', 'string', 'max:5000'],
            'is_pinned' => ['boolean'],
            'is_urgent' => ['boolean'],
            'audience' => ['sometimes', Rule::in(['all', 'accepted', 'staff', 'session'])],
            'target_session_id' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            'published_at' => ['nullable', 'date'],
        ]);

        $announcement->update($data);

        return response()->json([
            'message' => 'Announcement updated.',
            // fresh() re-reads from DB and loads the author relationship cleanly
            'data' => $announcement->fresh(['author:id,name']),
        ]);
    }

    /**
     * Delete an announcement (admin or the original author).
     *
     * Same ownership rule as update — either role can remove the announcement.
     */
    public function destroy(Request $request, Announcement $announcement): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $user->isAdmin() || $announcement->author_id === $user->id,
            Response::HTTP_FORBIDDEN,
            'Not authorized to delete this announcement.'
        );

        $announcement->delete();

        return response()->json(['message' => 'Announcement deleted.']);
    }

    /**
     * Toggle the pinned state of an announcement (admin only).
     *
     * Pinned announcements always appear at the top of the list regardless of date.
     * The response includes the new is_pinned value so the frontend can update immediately.
     */
    public function togglePin(Request $request, Announcement $announcement): JsonResponse
    {
        // Only admins control which announcements are pinned
        abort_unless($request->user()->isAdmin(), Response::HTTP_FORBIDDEN, 'Admins only.');

        // Flip the boolean flag — if it was true it becomes false and vice versa
        $announcement->update(['is_pinned' => ! $announcement->is_pinned]);

        return response()->json([
            'message' => $announcement->is_pinned ? 'Announcement pinned.' : 'Announcement unpinned.',
            // Return the new value so the UI can update the pin icon without a refresh
            'is_pinned' => $announcement->is_pinned,
        ]);
    }
}
