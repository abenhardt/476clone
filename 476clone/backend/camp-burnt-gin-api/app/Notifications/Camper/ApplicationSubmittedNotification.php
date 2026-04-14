<?php

namespace App\Notifications\Camper;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when an application is submitted.
 *
 * Confirms successful application submission to the parent.
 * Implements FR-27: Submission confirmation.
 */
class ApplicationSubmittedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Application $application
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * Respects the user's notification_preferences for application_updates.
     * The database channel is always included for in-app Recent Updates.
     * Email is gated by the user's preference (default: enabled).
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        $prefs = $notifiable->notification_preferences ?? [];
        $emailEnabled = $prefs['application_updates'] ?? true;

        return $emailEnabled ? ['mail', 'database'] : ['database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Application Submitted - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Your application has been successfully submitted.')
            ->line('Camper: '.$this->application->camper->full_name)
            ->line('Camp Session: '.$this->application->campSession->name)
            ->line('Submitted: '.$this->application->submitted_at->format('F j, Y \a\t g:i A'))
            ->line('We will review your application and notify you of the decision.')
            ->action('View Application', config('app.frontend_url').'/applications/'.$this->application->id)
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Get the array representation of the notification.
     *
     * Stored in the database notifications table for in-app display.
     * The title and message fields are used by the Recent Updates widget.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $camperName = $this->application->camper->full_name;
        $sessionName = $this->application->campSession->name;

        return [
            'type' => 'application_submitted',
            'title' => "Application submitted for {$camperName}",
            'message' => "Your application for {$camperName} ({$sessionName}) has been received and is now pending review.",
            'application_id' => $this->application->id,
            'camper_name' => $camperName,
            'camp_session' => $sessionName,
            'submitted_at' => $this->application->submitted_at->toIso8601String(),
        ];
    }
}
