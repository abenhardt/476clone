<?php

namespace App\Notifications\Camper;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * AcceptanceLetterNotification — the formal acceptance email sent when an application is approved.
 *
 * This is a significant communication milestone — it tells the family their camper has been accepted.
 * The email includes camp name, session name, dates, location, and a link to the application details
 * so the family can review next steps and complete any outstanding forms.
 *
 * Implements FR-18: Digital acceptance letters must be sent when an application is approved.
 *
 * The notification is sent to the applicant user (the parent/guardian) who owns the application.
 * Channel: mail only — the formal letter is delivered by email, not as an in-app notification.
 * Queue: uses Queueable so the email sends asynchronously without slowing the admin UI.
 */
class AcceptanceLetterNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Accept the approved application so its session, camp, and camper details can be referenced.
     */
    public function __construct(
        protected Application $application
    ) {}

    /**
     * Get the delivery channels for this notification.
     *
     * Acceptance letters are sent by email only — this is the formal acceptance document.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Build the acceptance letter email.
     *
     * Loads session and camp details from the application and constructs a warm,
     * professional letter with all the information families need to prepare for camp.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Load the session and its parent camp to fill in the letter details
        $session = $this->application->campSession;
        $camp = $session->camp;

        return (new MailMessage)
            ->subject('Congratulations! Application Accepted - '.$camp->name)
            ->greeting('Dear '.$notifiable->name.',')
            ->line('We are delighted to inform you that the application for '.$this->application->camper->full_name.' has been accepted!')
            ->line('')
            ->line('**Camp Details:**')
            ->line('Camp: '.$camp->name)
            ->line('Session: '.$session->name)
            // Format dates as "June 2 - June 8, 2026" for readability
            ->line('Dates: '.$session->start_date->format('F j').' - '.$session->end_date->format('F j, Y'))
            ->line('Location: '.$camp->location)
            ->line('')
            ->line('Please review the camp information and ensure all required forms are completed before the session begins.')
            // Deep link to the specific application so the family can see their details
            ->action('View Application Details', config('app.frontend_url').'/applications/'.$this->application->id)
            ->line('')
            ->line('We look forward to seeing '.$this->application->camper->first_name.' at camp!')
            ->salutation('Warm regards,'."\n".'Camp Burnt Gin');
    }
}
