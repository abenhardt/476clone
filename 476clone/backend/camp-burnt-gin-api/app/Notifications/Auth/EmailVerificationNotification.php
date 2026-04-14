<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/**
 * EmailVerificationNotification — sends a signed verification link to newly registered users.
 *
 * When a user creates an account, this notification fires automatically and emails them a link.
 * Clicking the link proves they own the email address and activates their account.
 *
 * How it works:
 *   1. A temporary signed route is generated (expires in 24 hours). The signature prevents anyone
 *      from manually constructing a fake verification URL.
 *   2. The backend URL is stripped down to just its query parameters.
 *   3. Those parameters are reassembled into a frontend URL so the verification flow happens
 *      on the React app instead of hitting the Laravel API directly.
 *   4. The final URL is embedded in the email as a clickable button.
 *
 * Channel: mail only (no in-app notification needed — the user hasn't logged in yet).
 * Queue: uses Queueable so the email is dispatched asynchronously without blocking the response.
 */
class EmailVerificationNotification extends Notification
{
    use Queueable;

    /**
     * Get the delivery channels for this notification.
     *
     * Only "mail" — email verification happens before the user has an in-app inbox.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Build the email message containing the verification link.
     *
     * Steps:
     *   1. Generate a Laravel signed route URL (backend route with expiry + signature hash)
     *   2. Extract just the query string from that URL (signature, expires, etc.)
     *   3. Rebuild the URL pointing to the frontend verification page instead
     *   4. Compose the email with that frontend URL as the action button
     *
     * The signed URL mechanism ensures that if anyone tampers with the URL parameters,
     * Laravel's signature verification will reject it.
     */
    public function toMail(object $notifiable): MailMessage
    {
        // Generate a backend signed URL valid for 24 hours
        // The 'hash' is an sha1 of the user's email, used to verify ownership
        $signedUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addHours(24),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())]
        );

        // Extract only the query string from the backend URL (contains signature, expires, etc.)
        $parsed = parse_url($signedUrl);
        $query = $parsed['query'] ?? '';

        // Redirect the user to the frontend React page, passing all the signature params
        // The frontend will then call the backend API to complete verification
        // Note: $query already contains id, hash, expires, and signature from temporarySignedRoute()
        $verifyUrl = config('app.frontend_url').'/verify-email?'.$query;

        return (new MailMessage)
            ->subject('Verify Your Email Address - Camp Burnt Gin')
            ->greeting('Welcome, '.$notifiable->name.'!')
            ->line('Thank you for registering with Camp Burnt Gin. Please verify your email address to activate your account.')
            ->action('Verify Email Address', $verifyUrl)
            ->line('This verification link will expire in 24 hours.')
            ->line('If you did not create an account, no further action is required.')
            ->salutation('Camp Burnt Gin');
    }
}
