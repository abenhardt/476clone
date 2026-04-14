<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * MessageSent — Real-time broadcast event fired when a message is sent.
 *
 * Broadcasts immediately (ShouldBroadcastNow) so the recipient sees
 * the notification without any queue-worker delay.
 *
 * Channel: private-user.{recipientId}
 * Each event instance targets exactly one recipient. MessageService
 * fires one event per non-sender participant.
 *
 * HIPAA: The broadcast payload contains no PHI — only metadata.
 * Message body and attachments are only accessible after authentication
 * via the standard API endpoints.
 */
class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        private readonly Message $message,
        private readonly Conversation $conversation,
        private readonly int $recipientId
    ) {}

    /**
     * Broadcast on the recipient's private user channel.
     *
     * Each user subscribes only to their own channel, so no user can
     * receive another user's notifications.
     */
    public function broadcastOn(): Channel
    {
        return new PrivateChannel('user.'.$this->recipientId);
    }

    /**
     * Event name as seen by the frontend Echo listener.
     *
     * Using a dot-prefixed name bypasses Laravel's automatic namespace
     * prefix so the frontend listens for exactly '.MessageSent'.
     */
    public function broadcastAs(): string
    {
        return 'MessageSent';
    }

    /**
     * Payload delivered to the frontend.
     *
     * Intentionally omits message body and attachment content — only
     * enough metadata to update the UI and show a notification toast.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'message_id' => $this->message->id,
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $this->conversation->subject,
            'sender_id' => $this->message->sender?->id,
            'sender_name' => $this->message->sender?->name,
            'has_attachments' => $this->message->hasAttachments(),
            'sent_at' => $this->message->created_at->toIso8601String(),
        ];
    }
}
