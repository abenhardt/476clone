<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * NotificationCreated — Real-time broadcast fired when a new database notification
 * is written for a user.
 *
 * Broadcasts immediately (ShouldBroadcastNow) so the recipient's bell badge
 * updates without waiting for the 60-second polling cycle.
 *
 * Channel: private-user.{userId}
 * Payload contains only display metadata — no PHI.
 *
 * This event is dispatched by DatabaseNotificationObserver after the enclosing
 * DB transaction commits, so the notification row is guaranteed to be visible
 * when the frontend refetches the notification list.
 */
class NotificationCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        private readonly int $userId,
        private readonly string $notificationType,
        private readonly string $title,
    ) {}

    public function broadcastOn(): Channel
    {
        return new PrivateChannel('user.'.$this->userId);
    }

    /**
     * Dot-prefixed name so the frontend listens for exactly '.NotificationCreated'
     * without Laravel's automatic namespace prefix.
     */
    public function broadcastAs(): string
    {
        return 'NotificationCreated';
    }

    /**
     * Minimal payload — enough for the frontend to refresh the bell badge.
     * Message body and sensitive data are never broadcast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'type' => $this->notificationType,
            'title' => $this->title,
        ];
    }
}
