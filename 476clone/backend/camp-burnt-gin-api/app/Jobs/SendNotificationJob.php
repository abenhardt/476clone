<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * SendNotificationJob — sends a notification in the background so the API stays fast.
 *
 * Sending emails or SMS messages can take a second or two. If we sent them directly
 * inside an API request, the user would have to wait. Instead, we push this job onto
 * a queue. A background worker picks it up and sends the notification separately,
 * without slowing down the original request.
 *
 * If the notification fails (e.g., the mail server is temporarily down), the job
 * retries automatically with increasing wait times between each attempt.
 */
class SendNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * How many times to attempt the job before giving up.
     */
    public int $tries = 3;

    /**
     * How many seconds to wait before each retry attempt (exponential backoff).
     * First retry: 1 minute. Second: 5 minutes. Third: 15 minutes.
     *
     * @var array<int>
     */
    public array $backoff = [60, 300, 900]; // 1min, 5min, 15min

    /**
     * Maximum number of unhandled exceptions before the job is marked as failed.
     */
    public int $maxExceptions = 3;

    /**
     * Store the recipient and the notification so the queue worker can use them later.
     * The job is sent to the "notifications" queue to keep it separate from other work.
     */
    public function __construct(
        public mixed $notifiable,        // The model receiving the notification (e.g., a User).
        public Notification $notification // The notification object to send (e.g., a reminder email).
    ) {
        $this->onQueue('notifications');
    }

    /**
     * Execute the job: deliver the notification to the recipient.
     * Laravel's notification system figures out which channels to use (email, database, etc.).
     */
    public function handle(): void
    {
        $this->notifiable->notify($this->notification);
    }

    /**
     * Return the retry delay schedule for this job.
     * Called by the queue worker to know how long to wait before each retry.
     */
    public function backoff(): array
    {
        return $this->backoff;
    }

    /**
     * Handle a job failure after all retries are exhausted.
     * Logs the details so developers can investigate the root cause.
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error('Notification job failed', [
            'notifiable_type' => get_class($this->notifiable),
            'notifiable_id' => $this->notifiable->id ?? null,
            'notification_type' => get_class($this->notification),
            'exception' => $exception->getMessage(),
        ]);
    }
}
