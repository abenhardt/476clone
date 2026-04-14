<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * NotificationController — In-app notification management for the current user.
 *
 * Laravel stores notifications in a `notifications` database table with a JSON
 * `data` column. Each notification class defines what it puts in that column.
 * This controller retrieves those records and reshapes them into a consistent
 * structure the frontend "Recent Updates" widget can render directly.
 *
 * Key design choice: rather than making the frontend parse the raw notification
 * class name and data blob, this controller extracts `title` and `message`
 * keys from the data payload — fields that every notification class is expected
 * to include in its toArray() method.
 *
 * Supports:
 *   - Listing notifications (all or unread-only) with title/message extracted.
 *   - Marking a single notification as read.
 *   - Marking all notifications as read in one call.
 *   - Deleting all notifications (bulk clear).
 *
 * Implements FR-27 (notification list), FR-28 (read status), FR-29 (clear).
 */
class NotificationController extends Controller
{
    /**
     * List notifications for the current user.
     *
     * GET /api/notifications?unread_only=true|false&page=N
     *
     * Returns a formatted list of notifications with title, message, and
     * read status extracted from the stored notification data payload.
     *
     * The unread_count in meta is always returned, even on "all" queries,
     * so the frontend badge can update without a separate request.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Choose the query scope based on the unread_only flag from the request.
        $query = $request->boolean('unread_only')
            ? $user->unreadNotifications()
            : $user->notifications();

        // Newest notifications first; paginate to 15 items per page.
        $paginated = $query->latest()->paginate(15);

        $items = collect($paginated->items())->map(function ($notification) {
            // The data column is automatically decoded from JSON to an array by Laravel.
            $data = $notification->data ?? [];

            return [
                // Notification ID is a UUID string — the frontend stores it for markAsRead calls.
                'id' => $notification->id,
                // Use the 'type' key from data if set, otherwise derive from the class name.
                'type' => $data['type'] ?? class_basename($notification->type),
                // 'title' is the short headline shown in the notification list item.
                'title' => $data['title'] ?? '',
                // 'message' is the longer body text shown beneath the title.
                'message' => $data['message'] ?? '',
                // Pass the full data blob in case the frontend needs extra fields.
                'data' => $data,
                // null means unread; a timestamp means it was read at that moment.
                'read_at' => $notification->read_at?->toIso8601String(),
                'created_at' => $notification->created_at->toIso8601String(),
            ];
        })->values()->all();

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                // Always include the total unread count for the bell badge in the nav bar.
                'unread_count' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    /**
     * Mark a single notification as read.
     *
     * POST /api/notifications/{id}/read
     *
     * The notification is fetched through the user relationship so a user
     * cannot mark someone else's notification as read (scoped to $user).
     */
    public function markAsRead(Request $request, string $notification): JsonResponse
    {
        // Scope the lookup to the authenticated user — prevents reading other users' notification IDs.
        $notificationModel = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->first();

        if (! $notificationModel) {
            return response()->json([
                'message' => 'Notification not found.',
            ], 404);
        }

        // markAsRead() stamps the read_at timestamp with the current time.
        $notificationModel->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read.',
        ]);
    }

    /**
     * Mark all notifications as read.
     *
     * POST /api/notifications/read-all
     *
     * Issues a single bulk UPDATE instead of loading the entire unread collection
     * into memory and iterating — avoids O(n) queries for users with many notifications.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()
            ->unreadNotifications()
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'All notifications marked as read.',
        ]);
    }

    /**
     * Delete all notifications for the current user.
     *
     * DELETE /api/notifications
     *
     * Hard-deletes every notification row for this user.
     * This is a destructive operation — deleted notifications cannot be recovered.
     */
    public function deleteAll(Request $request): JsonResponse
    {
        // ->notifications() (method) returns the query builder — delete() removes all rows at once.
        $request->user()->notifications()->delete();

        return response()->json([
            'message' => 'All notifications cleared.',
        ]);
    }
}
