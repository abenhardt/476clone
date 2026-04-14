<?php

namespace App\Notifications\Auth;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Confirmation notification sent after a successful password reset.
 *
 * Triggered by PasswordResetService::resetPassword() immediately after the
 * password is updated and before the one-time token is deleted.
 *
 * Purpose: security assurance — the account holder is informed that their
 * password changed, so they can take action if the change was unauthorised.
 */
class PasswordChangedConfirmationNotification extends Notification
{
    use Queueable;

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Password Has Been Changed — Camp Burnt Gin')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Your Camp Burnt Gin account password was successfully changed.')
            ->line('If you made this change, no further action is required.')
            ->line('If you did **not** make this change, please reset your password immediately and contact us so we can secure your account.')
            ->salutation('Camp Burnt Gin');
    }
}
