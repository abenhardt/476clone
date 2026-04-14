<?php

namespace App\Notifications\Camper;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent when an application status changes.
 *
 * Notifies the parent of application status updates.
 * Implements FR-28: Status change notifications.
 */
class ApplicationStatusChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        protected Application $application,
        protected string $previousStatus
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
        $message = (new MailMessage)
            ->greeting('Hello '.$notifiable->name.',');

        if ($this->application->status === ApplicationStatus::Approved) {
            $message->subject('Application Approved! - Camp Burnt Gin')
                ->line('Great news! Your application has been approved.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('Camp Session: '.$this->application->campSession->name)
                ->line('Session Dates: '.$this->application->campSession->start_date->format('F j').' - '.$this->application->campSession->end_date->format('F j, Y'))
                ->line('We look forward to seeing '.$this->application->camper->first_name.' at camp!');
        } elseif ($this->application->status === ApplicationStatus::Rejected) {
            $message->subject('Application Update - Camp Burnt Gin')
                ->line('We regret to inform you that your application was not approved at this time.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('Camp Session: '.$this->application->campSession->name);

            $message->line('If you have any questions, please contact us.');
        } else {
            $message->subject('Application Status Update - Camp Burnt Gin')
                ->line('Your application status has been updated.')
                ->line('Camper: '.$this->application->camper->full_name)
                ->line('New Status: '.$this->application->status->label());
        }

        return $message
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
        $newStatus = $this->application->status->value;
        $statusLabel = ucfirst(str_replace('_', ' ', $newStatus));
        $previousLabel = ucfirst(str_replace('_', ' ', $this->previousStatus));
        $camperName = $this->application->camper->full_name;

        return [
            'type' => 'application_status_changed',
            'title' => "Application status updated — {$statusLabel}",
            'message' => "The application for {$camperName} has been updated from {$previousLabel} to {$statusLabel}.",
            'application_id' => $this->application->id,
            'camper_name' => $camperName,
            'camp_session' => $this->application->campSession->name,
            'previous_status' => $this->previousStatus,
            'new_status' => $newStatus,
            'changed_at' => now()->toIso8601String(),
        ];
    }
}
