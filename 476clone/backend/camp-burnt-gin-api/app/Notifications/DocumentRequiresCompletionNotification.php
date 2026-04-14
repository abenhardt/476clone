<?php

namespace App\Notifications;

use App\Models\ApplicantDocument;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent to an applicant when an admin sends them a document to complete.
 *
 * Notifies the applicant that a new document has been assigned without exposing
 * PHI in email content. All document content remains accessible in-app only.
 *
 * HIPAA Compliance: No PHI in email body.
 */
class DocumentRequiresCompletionNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected ApplicantDocument $applicantDocument
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * Respects the user's notification_preferences for documents.
     * The database channel is always included for in-app Recent Updates.
     * Email is gated by the user's preference (default: enabled).
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['documents'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    /**
     * Get the mail representation of the notification.
     *
     * IMPORTANT: No PHI is included in the email. Users must log in
     * to view the document and complete it.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $adminName = $this->applicantDocument->uploadedByAdmin?->name ?? 'Camp Staff';
        $docName = $this->applicantDocument->original_file_name;

        return (new MailMessage)
            ->subject('Document Requires Your Completion - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line($adminName.' has sent you a document that requires your completion.')
            ->line('Document: '.$docName)
            ->line('Please log in to download the document, complete it, and upload your completed version.')
            ->action('View Document', config('app.frontend_url').'/applicant/documents')
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
        $adminName = $this->applicantDocument->uploadedByAdmin?->name ?? 'Camp Staff';
        $docName = $this->applicantDocument->original_file_name;

        return [
            'type' => 'document_requires_completion',
            'title' => 'Document Requires Your Completion',
            'message' => $adminName.' has sent you a document to complete: "'.$docName.'".',
            'applicant_document_id' => $this->applicantDocument->id,
        ];
    }
}
