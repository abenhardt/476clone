<?php

namespace App\Notifications;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when a new message is received in a conversation.
 *
 * Alerts participants of new messages without exposing PHI in email content.
 * Message body and attachments are only accessible in-app after authentication.
 *
 * HIPAA Compliance: No PHI in email body.
 *
 * Channel strategy:
 *   - Database (in-app bell): sent synchronously via notifyNow() in MessageService
 *     so the notification appears immediately without requiring a queue worker.
 *   - Email: queued via SendNotificationJob so mail failures cannot delay the
 *     HTTP response or roll back the message transaction.
 *
 * Use the static factories:
 *   - NewMessageNotification::forDatabase($msg, $conv) → ['database'] only, not Queueable
 *   - NewMessageNotification::forMail($msg, $conv)     → ['mail'] only, Queueable
 */
class NewMessageNotification extends Notification
{
    use Queueable;

    /** @var array<int, string>|null When set, overrides the via() logic. */
    private ?array $channelsOverride = null;

    public function __construct(
        protected Message $message,
        protected Conversation $conversation
    ) {}

    /**
     * Returns a database-only instance for synchronous in-app notification.
     * The Queueable trait is present but unused — callers should use notifyNow().
     */
    public static function forDatabase(Message $message, Conversation $conversation): static
    {
        $instance = new static($message, $conversation);
        $instance->channelsOverride = ['database'];

        return $instance;
    }

    /**
     * Returns a mail-only instance intended for queued delivery via SendNotificationJob.
     * Gating on notification_preferences is handled inside via() when channelsOverride is null.
     */
    public static function forMail(Message $message, Conversation $conversation): static
    {
        $instance = new static($message, $conversation);
        $instance->channelsOverride = ['mail'];

        return $instance;
    }

    /**
     * Get the notification's delivery channels.
     *
     * When channelsOverride is set (via forDatabase/forMail factories), returns
     * exactly those channels. Otherwise falls back to prefs-based logic.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($this->channelsOverride !== null) {
            return $this->channelsOverride;
        }

        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['messages'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * IMPORTANT: No PHI or message content is included in the email.
     * Users must log in to view the actual message.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $mailMessage = (new MailMessage)
            ->subject('New Message - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You have received a new message in a conversation.')
            ->line('Conversation: '.$this->conversation->subject)
            ->line('From: '.$this->message->sender->name);

        if ($this->message->hasAttachments()) {
            $attachmentCount = $this->message->attachmentCount();
            $mailMessage->line("This message includes {$attachmentCount} attachment(s).");
        }

        $mailMessage->line('Please log in to view the full message and respond.')
            ->action('View Message', config('app.frontend_url').'/inbox/conversations/'.$this->conversation->id)
            ->salutation('Camp Burnt Gin');

        return $mailMessage;
    }

    /**
     * Get the array representation of the notification.
     *
     * Stored in database notifications table for in-app bell display.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $senderName = $this->message->sender->name;
        $subject = $this->conversation->subject;
        $attachments = $this->message->hasAttachments();
        $attachNote = $attachments ? ' (includes attachment)' : '';

        return [
            'type' => 'new_message',
            'title' => "New message from {$senderName}",
            'message' => "You have a new message in \"{$subject}\"{$attachNote}.",
            'message_id' => $this->message->id,
            'conversation_id' => $this->conversation->id,
            'conversation_subject' => $subject,
            'sender_name' => $senderName,
            'sender_id' => $this->message->sender->id,
            'has_attachments' => $attachments,
            'attachment_count' => $this->message->attachmentCount(),
            'created_at' => $this->message->created_at->toIso8601String(),
        ];
    }
}
