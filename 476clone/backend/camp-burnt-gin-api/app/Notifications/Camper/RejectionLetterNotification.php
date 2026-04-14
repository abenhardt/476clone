<?php

namespace App\Notifications\Camper;

use App\Models\Application;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * RejectionLetterNotification — the formal rejection letter sent when an application is not approved.
 *
 * This notification handles a sensitive communication — it must be professional, compassionate,
 * and clear about next steps. If the admin recorded notes on the application, they are included
 * in the letter to explain the decision or provide guidance.
 *
 * Implements FR-18: Digital rejection letters must be sent when an application is declined.
 *
 * The notification is sent to the applicant user (the parent/guardian) who owns the application.
 * Channel: mail only — formal decisions are communicated by email.
 * Queue: uses Queueable so the email sends asynchronously without slowing the admin UI.
 */
class RejectionLetterNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Accept the declined application so its session, camp, and notes can be referenced in the letter.
     */
    public function __construct(
        protected Application $application
    ) {}

    /**
     * Get the delivery channels for this notification.
     *
     * Rejection letters are sent by email only.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Build the rejection letter email.
     *
     * Starts with a thank-you, delivers the decision with care, and conditionally
     * includes admin notes if the admin recorded a reason or additional information.
     * Ends with encouragement to apply for future sessions with a helpful link.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Load session and camp to personalise the letter with specific program details
        $session = $this->application->campSession;
        $camp = $session->camp;

        // Build the base message — the negative news is delivered gently but clearly
        $message = (new MailMessage)
            ->subject('Application Update - '.$camp->name)
            ->greeting('Dear '.$notifiable->name.',')
            ->line('Thank you for your interest in '.$camp->name.'.')
            ->line('')
            ->line('After careful review, we regret to inform you that we are unable to accept the application for '.$this->application->camper->full_name.' for the '.$session->name.' session at this time.');

        // Conditionally include admin notes if any were recorded on the application
        // Notes might explain the reason for rejection or suggest what to do next
        if ($this->application->notes) {
            $message->line('')
                ->line('**Additional Information:**')
                ->line($this->application->notes);
        }

        // Encourage the family to apply again and give them a useful link to browse sessions
        return $message
            ->line('')
            ->line('We encourage you to apply for future camp sessions. If you have any questions, please do not hesitate to contact us.')
            ->action('View Other Sessions', config('app.frontend_url').'/sessions')
            ->line('')
            ->line('Thank you for your understanding.')
            ->salutation('Sincerely,'."\n".'Camp Burnt Gin');
    }
}
