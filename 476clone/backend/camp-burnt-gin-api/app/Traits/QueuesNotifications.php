<?php

namespace App\Traits;

use App\Jobs\SendNotificationJob;
use Illuminate\Notifications\Notification;

/**
 * Trait for queueing notifications asynchronously.
 *
 * Use this trait in controllers to dispatch notifications without blocking HTTP responses.
 * Automatically uses SendNotificationJob with retry logic.
 */
trait QueuesNotifications
{
    /**
     * Queue a notification for async sending.
     *
     * @param  mixed  $notifiable  User or model that receives notification
     * @param  Notification  $notification  The notification to send
     * @param  string|null  $queue  Optional queue name (defaults to 'notifications')
     */
    protected function queueNotification(
        mixed $notifiable,
        Notification $notification,
        ?string $queue = null
    ): void {
        $job = new SendNotificationJob($notifiable, $notification);

        if ($queue) {
            $job->onQueue($queue);
        }

        dispatch($job);
    }

    /**
     * Queue multiple notifications.
     *
     * @param  array<mixed, Notification>  $notifications  Array of [notifiable => notification]
     */
    protected function queueNotifications(array $notifications): void
    {
        foreach ($notifications as $notifiable => $notification) {
            $this->queueNotification($notifiable, $notification);
        }
    }
}
