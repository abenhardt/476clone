<?php

namespace App\Services\System;

use App\Models\Application;
use App\Notifications\Camper\AcceptanceLetterNotification;
use App\Notifications\Camper\RejectionLetterNotification;

/**
 * LetterService — Formal Decision Letter Generation and Delivery
 *
 * When an application is approved or rejected, Camp Burnt Gin sends the parent
 * a formal letter via email. This service handles both generation and delivery
 * of those letters.
 *
 * Think of this service as the camp's "letter office" — ApplicationService calls
 * it at the end of the review workflow to dispatch the appropriate letter.
 *
 * Two types of letters are supported:
 *  - Acceptance letter: Congratulates the parent, confirms session dates and location
 *  - Rejection letter:  Politely notifies the parent, includes reviewer notes if any
 *
 * Each send*Letter() method uses Laravel's notification system to deliver the
 * letter via email. The actual email template lives in the Notification class.
 *
 * The generate*Content() methods produce a structured data array used to
 * populate the letter template — useful for preview or PDF export.
 *
 * Implements FR-18: Digital acceptance and rejection letters.
 */
class LetterService
{
    /**
     * Email an acceptance letter to the parent of an approved camper.
     *
     * Notifies via the AcceptanceLetterNotification, which formats and sends
     * the email using the camper and session data from the application.
     */
    public function sendAcceptanceLetter(Application $application): void
    {
        // Notify the parent user (the user linked to the camper)
        $application->camper->user->notify(new AcceptanceLetterNotification($application));
    }

    /**
     * Email a rejection letter to the parent of a rejected applicant.
     *
     * Notifies via the RejectionLetterNotification, which formats and sends
     * the email, optionally including the reviewer's notes.
     */
    public function sendRejectionLetter(Application $application): void
    {
        $application->camper->user->notify(new RejectionLetterNotification($application));
    }

    /**
     * Generate the structured data content for an acceptance letter.
     *
     * Returns an array of key details that the letter template uses to fill in
     * the recipient's name, camper name, session details, and camp location.
     * This method is also useful for generating a preview or a downloadable PDF.
     *
     * @return array<string, mixed>
     */
    public function generateAcceptanceLetterContent(Application $application): array
    {
        return [
            'type' => 'acceptance',
            // Format today's date as a readable string like "March 7, 2026"
            'date' => now()->format('F j, Y'),
            'recipient' => $application->camper->user->name,
            'camper_name' => $application->camper->full_name,
            'camp_name' => $application->campSession->camp->name,
            'session_name' => $application->campSession->name,
            // Include start and end dates so the parent knows when to prepare
            'session_dates' => [
                'start' => $application->campSession->start_date->format('F j, Y'),
                'end' => $application->campSession->end_date->format('F j, Y'),
            ],
            'location' => $application->campSession->camp->location,
        ];
    }

    /**
     * Generate the structured data content for a rejection letter.
     *
     * Returns key details for the letter template. Reviewer notes are included
     * when present so the parent understands why the application was not accepted.
     *
     * @return array<string, mixed>
     */
    public function generateRejectionLetterContent(Application $application): array
    {
        return [
            'type' => 'rejection',
            'date' => now()->format('F j, Y'),
            'recipient' => $application->camper->user->name,
            'camper_name' => $application->camper->full_name,
            'camp_name' => $application->campSession->camp->name,
            'session_name' => $application->campSession->name,
            // Include the reviewer's notes if any were provided during the review
            'notes' => $application->notes,
        ];
    }
}
