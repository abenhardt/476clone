<?php

namespace App\Notifications;

use App\Models\Conversation;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a user is added to a new conversation.
 *
 * Notifies participants of new conversation creation without exposing
 * PHI in email content. All sensitive content remains in-app only.
 *
 * HIPAA Compliance: No PHI in email body.
 */
class NewConversationNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Conversation $conversation
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * Respects the user's notification_preferences for messages.
     * The database channel is always included for in-app Recent Updates.
     * Email is gated by the user's preference (default: enabled).
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['messages'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * IMPORTANT: No PHI is included in the email. Users must log in
     * to view full conversation details.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New Conversation - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You have been added to a new conversation.')
            ->line('Subject: '.$this->conversation->subject)
            ->line('Please log in to view the full conversation and respond.')
            ->action('View Conversation', config('app.frontend_url').'/inbox/conversations/'.$this->conversation->id)
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Get the array representation of the notification.
     *
     * Stored in database notifications table for in-app display.
     * The title and message fields are used by the Recent Updates widget.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $subject = $this->conversation->subject;
        $createdBy = $this->conversation->creator?->name ?? 'Camp Staff';

        return [
            'type' => 'new_conversation',
            'title' => "New conversation: {$subject}",
            'message' => "{$createdBy} has started a conversation with you: \"{$subject}\".",
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $subject,
            'created_by' => $createdBy,
            'created_at' => $this->conversation->created_at->toIso8601String(),
        ];
    }
}
