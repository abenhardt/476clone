<?php

namespace App\Observers;

use App\Events\NotificationCreated;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * DatabaseNotificationObserver
 *
 * Watches Laravel's built-in notifications table and fires a real-time
 * NotificationCreated broadcast whenever a new notification is inserted for
 * a user, allowing the frontend bell badge to update immediately instead of
 * waiting for the 60-second polling cycle.
 *
 * TIMING — WHY DB::afterCommit():
 *   Some notification writes (e.g. NewMessageNotification) happen inside a DB
 *   transaction (MessageService::sendMessage). A naïve observer would fire the
 *   broadcast before the transaction commits, causing the frontend to refetch
 *   the notification list before the row is visible — resulting in a missed
 *   update. DB::afterCommit() defers the broadcast until after the enclosing
 *   transaction (or immediately if no transaction is active).
 *
 * FAULT TOLERANCE:
 *   Broadcasting is wrapped in try/catch. A downed Reverb server must never
 *   break notification delivery — the 60-second polling fallback in
 *   DashboardHeader.tsx catches anything missed here.
 */
class DatabaseNotificationObserver
{
    public function created(DatabaseNotification $notification): void
    {
        // Only broadcast for user notifications — other notifiable types
        // (if any future ones are added) should not trigger the user bell.
        if ($notification->notifiable_type !== (new User)->getMorphClass()) {
            return;
        }

        $data = $notification->data ?? [];
        $type = $data['type'] ?? class_basename($notification->type);
        $title = $data['title'] ?? '';
        $userId = (int) $notification->notifiable_id;

        // Defer until after the active transaction commits.
        // If there is no active transaction, DB::afterCommit() fires immediately.
        DB::afterCommit(function () use ($userId, $type, $title): void {
            try {
                broadcast(new NotificationCreated($userId, $type, $title));
            } catch (\Throwable $e) {
                Log::warning('NotificationCreated broadcast failed', [
                    'user_id' => $userId,
                    'type' => $type,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }
}
