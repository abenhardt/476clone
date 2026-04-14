<?php

namespace App\Notifications\Camper;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification sent as a reminder for incomplete applications.
 *
 * Reminds parents about draft applications that need completion.
 * Implements FR-29: Incomplete application reminders.
 */
class IncompleteApplicationReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected Application $application
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Complete Your Application - Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('You have an incomplete application that needs your attention.')
            ->line('Camper: '.$this->application->camper->full_name)
            ->line('Camp Session: '.$this->application->campSession->name)
            ->line('Registration closes: '.$this->application->campSession->registration_closes_at?->format('F j, Y'))
            ->line('Please complete and submit your application to secure your spot.')
            ->action('Complete Application', config('app.frontend_url').'/applications/'.$this->application->id.'/edit')
            ->salutation('Camp Burnt Gin');
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'incomplete_application_reminder',
            'application_id' => $this->application->id,
            'camper_name' => $this->application->camper->full_name,
            'camp_session' => $this->application->campSession->name,
            'created_at' => $this->application->created_at->toIso8601String(),
        ];
    }
}
