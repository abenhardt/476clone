# External Mailing System

**Project:** Camp Burnt Gin
**Last Updated:** 2026-03-12
**Maintained By:** Development Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Email Flow](#3-email-flow)
4. [Mailtrap SMTP Configuration](#4-mailtrap-smtp-configuration)
5. [Notification Classes and Triggers](#5-notification-classes-and-triggers)
6. [Queue System](#6-queue-system)
7. [Email Templates](#7-email-templates)
8. [How Developers Can Modify the Mailing System](#8-how-developers-can-modify-the-mailing-system)
9. [Troubleshooting](#9-troubleshooting)
10. [Testing the Mailing System](#10-testing-the-mailing-system)

---

## 1. Overview

### What it does

The Camp Burnt Gin application automatically sends emails to users when important events occur — such as when an account is created, a password reset is requested, a document is assigned, or an application status changes.

These emails are delivered through Mailtrap, a third-party email service. In the current configuration, Mailtrap is operating in **sandbox mode**, which means all outgoing emails are captured in a secure online inbox rather than delivered to real email addresses. This is intended for development and testing.

### Why emails are sent

Emails keep users informed about activity that requires their attention. Without email notifications, users would have no way of knowing that something important had happened unless they were already logged in.

### When users receive emails

| Event | Who Receives It |
|---|---|
| Account registration | Applicant (email verification link) |
| Password reset request | Applicant or admin |
| Application submitted | Admin team |
| Application status changed (approved/rejected) | Applicant |
| Acceptance or rejection letter issued | Applicant |
| Incomplete application reminder | Applicant (scheduled, 7-day draft) |
| Document assigned by admin | Applicant |
| New message received | Conversation participants |
| New conversation started | Conversation participants |
| Medical provider link created | External medical provider |
| Medical provider link expired or revoked | Applicant |
| Medical provider submits records | Applicant and admin team |

### Who receives emails

- **Applicants (parents):** Account activity, application lifecycle, documents, messages
- **Admins and Super Admins:** Application submissions, medical provider submissions
- **External medical providers:** Provider portal access links
- **Medical staff:** (in-app only; no email notifications)

### Privacy and compliance

No protected health information (PHI) is included in any email body. Medical and messaging notifications contain only a summary prompt directing the recipient to log in. Full details are only accessible after authentication.

---

## 2. System Architecture

### How it fits together

The application backend is built on **Laravel 12** (PHP). Email delivery is handled through Laravel's **Notifications** system, which queues email jobs in the database and dispatches them asynchronously via a **queue worker**. All outgoing emails are routed through **Mailtrap's SMTP server**.

### Component map

```
User Action / Scheduled Command
         |
         v
Controller or Service
         |
         v
Notification Class (app/Notifications/)
         |
         v
SendNotificationJob → Queue (database: jobs table)
         |
         v
Queue Worker (php artisan queue:work)
         |
         v
Laravel MailMessage (generates HTML/plain text)
         |
         v
SMTP Transport (config/mail.php)
         |
         v
Mailtrap (sandbox.smtp.mailtrap.io)
         |
         v
Mailtrap Inbox (captured for review)
```

### Key files

| Purpose | Location |
|---|---|
| Mail transport configuration | `config/mail.php` |
| Environment credentials | `.env` |
| All notification classes | `app/Notifications/` |
| Queue job wrapper | `app/Jobs/SendNotificationJob.php` |
| Notification queueing trait | `app/Traits/QueuesNotifications.php` |
| Queue configuration | `config/queue.php` |
| Test mail command | `app/Console/Commands/TestMail.php` |
| Incomplete reminder command | `app/Console/Commands/SendIncompleteApplicationReminders.php` |

### Services that send email

| Service | File | What it sends |
|---|---|---|
| `ApplicationService` | `app/Services/Camper/ApplicationService.php` | Status change, acceptance, rejection |
| `LetterService` | `app/Services/System/LetterService.php` | Acceptance and rejection letters |
| `PasswordResetService` | `app/Services/Auth/PasswordResetService.php` | Password reset link |
| `MedicalProviderLinkService` | `app/Services/Medical/MedicalProviderLinkService.php` | Provider link created/expired/revoked/submitted |
| `MessageService` | `app/Services/MessageService.php` | New message notification |
| `InboxService` | `app/Services/InboxService.php` | New conversation notification |

### Controllers that trigger emails

| Controller | Trigger |
|---|---|
| `ApplicationController` | Queues submission notification on `store()` |
| `EmailVerificationController` | Sends or resends verification email |
| `ApplicantDocumentController` | Sends document assignment notification |

---

## 3. Email Flow

The following steps describe what happens from the moment a user takes an action to when an email arrives in Mailtrap.

### Step-by-step lifecycle

**Step 1 — User action occurs**
A user or admin performs an action in the application (for example, submitting an application or requesting a password reset).

**Step 2 — Controller or service handles the request**
The relevant controller or service processes the action and determines that a notification should be sent.

**Step 3 — Notification job is queued**
Rather than sending the email immediately, the system dispatches a `SendNotificationJob` to the database queue. This prevents slow email delivery from blocking the user's request.

```php
// Example: queuing a notification from a controller
$this->queueNotification($user, new ApplicationSubmittedNotification($application));
```

**Step 4 — Queue worker picks up the job**
The Laravel queue worker (`php artisan queue:work`) continuously monitors the `jobs` table. When it finds a pending notification job, it picks it up and processes it.

**Step 5 — Notification class builds the email**
The notification class constructs the email content using Laravel's `MailMessage` builder. This generates both an HTML and a plain-text version automatically.

```php
// Example: inside a Notification class
public function toMail($notifiable): MailMessage
{
    return (new MailMessage)
        ->subject('Your Application Has Been Received')
        ->greeting("Hello {$notifiable->name},")
        ->line('We have received your application.')
        ->action('View Application', url('/applicant/applications'))
        ->line('Thank you for applying to Camp Burnt Gin.');
}
```

**Step 6 — SMTP connection is made**
Laravel's mail transport opens a connection to the configured SMTP server (currently Mailtrap's sandbox) using the credentials in `.env`.

**Step 7 — Email is delivered to Mailtrap**
Mailtrap accepts the email and places it in the sandbox inbox. No email is delivered to a real address while in sandbox mode.

**Step 8 — Retry on failure**
If sending fails (for example, due to a temporary SMTP error), the job is retried automatically up to three times with exponential backoff: 1 minute, then 5 minutes, then 15 minutes. If all retries fail, the job is logged as a failed job.

---

## 4. Mailtrap SMTP Configuration

### Current configuration (sandbox / development)

The following variables in `.env` control where emails are sent:

```env
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_sandbox_username
MAIL_PASSWORD=your_sandbox_password
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@campburntgin.org"
MAIL_FROM_NAME="Camp Burnt Gin"
```

### What each variable does

| Variable | Purpose |
|---|---|
| `MAIL_MAILER` | The transport driver. Use `smtp` for all external providers. |
| `MAIL_HOST` | The SMTP server hostname provided by Mailtrap. |
| `MAIL_PORT` | The port to connect on. Mailtrap sandbox accepts 25, 465, 587, or 2525. |
| `MAIL_USERNAME` | Your Mailtrap inbox username (found in Mailtrap > Sandboxes > SMTP tab). |
| `MAIL_PASSWORD` | Your Mailtrap inbox password (found alongside the username). |
| `MAIL_ENCRYPTION` | Encryption type. Set to `tls` for production. `null` is acceptable for Mailtrap sandbox. |
| `MAIL_FROM_ADDRESS` | The sender email address shown to recipients. |
| `MAIL_FROM_NAME` | The sender name shown to recipients. |

### Switching to Mailtrap live sending (production)

When you are ready to send real emails to real inboxes, update `.env` as follows:

```env
MAIL_MAILER=smtp
MAIL_HOST=live.smtp.mailtrap.io
MAIL_PORT=587
MAIL_USERNAME=api
MAIL_PASSWORD=your_live_api_token
MAIL_ENCRYPTION=tls
```

> **Important:** Mailtrap live sending requires a verified sending domain. Add and verify your domain at Mailtrap > Sending Domains before switching. Emails sent without a verified domain will be rejected.

### Switching to a different provider entirely

To use a provider such as Mailgun, Postmark, or Amazon SES, replace the SMTP values with those provided by that service. The rest of the application does not need to change — only the `.env` values and, if required, an additional driver package.

After changing `.env` values, clear the config cache:

```bash
php artisan config:clear
```

---

## 5. Notification Classes and Triggers

### Location

```
app/Notifications/
├── Auth/
│   ├── EmailVerificationNotification.php
│   └── PasswordResetNotification.php
├── Camper/
│   ├── AcceptanceLetterNotification.php
│   ├── ApplicationStatusChangedNotification.php
│   ├── ApplicationSubmittedNotification.php
│   ├── IncompleteApplicationReminderNotification.php
│   └── RejectionLetterNotification.php
├── Medical/
│   ├── ProviderLinkCreatedNotification.php
│   ├── ProviderLinkExpiredNotification.php
│   ├── ProviderLinkRevokedNotification.php
│   └── ProviderSubmissionReceivedNotification.php
├── DocumentRequiresCompletionNotification.php
├── NewConversationNotification.php
└── NewMessageNotification.php
```

### Notification preference gating

Users can opt out of certain email types through their notification preferences. The `Camper/*` notification classes respect the `notification_preferences` column on the `users` table. The following preference keys control email delivery:

| Preference Key | Controls |
|---|---|
| `application_updates` | Application status, acceptance, rejection emails |
| `messages` | New message and new conversation emails |
| `documents` | Document assignment emails |

If a preference is disabled, the notification is still recorded in-app (database channel) but no email is sent.

### Channels

Most notifications use two channels:

```php
public function via($notifiable): array
{
    return ['mail', 'database'];
}
```

Medical provider notifications (sent to external providers who have no user account) use only the `mail` channel via on-demand routing:

```php
Notification::route('mail', $providerEmail)->notify(new ProviderLinkCreatedNotification(...));
```

---

## 6. Queue System

### Why a queue is used

Sending an email over SMTP takes time. If the application sent emails synchronously, every user request that triggers an email would be delayed while waiting for the SMTP connection to complete. The queue system decouples email delivery from the user-facing request.

### How it works

All notifications are dispatched through `SendNotificationJob`, which implements `ShouldQueue`. Jobs are stored in the `jobs` database table and processed by a background worker.

**Job configuration:**

| Setting | Value |
|---|---|
| Queue name | `notifications` |
| Max attempts | 3 |
| Backoff schedule | 60s, 300s, 900s |
| After commit | Yes (waits for DB transaction to commit first) |
| Failed job logging | Yes (logs notifiable type, ID, and notification class) |

### Running the queue worker

The queue worker must be running for emails to be dispatched. To start it:

```bash
php artisan queue:work --queue=notifications
```

To run it as a continuous background process (recommended for production), use a process supervisor such as Supervisor or a system service.

To check for failed jobs:

```bash
php artisan queue:failed
```

To retry all failed jobs:

```bash
php artisan queue:retry all
```

### Scheduled email commands

The following commands are designed to run on a schedule (via `php artisan schedule:run`):

| Command | Schedule | Purpose |
|---|---|---|
| `applications:send-reminders --days=7` | Daily | Sends reminder to applicants with drafts older than 7 days |

---

## 7. Email Templates

### How templates are rendered

This project does not use custom Blade templates for emails. All email content is built using Laravel's `MailMessage` class, which automatically generates a clean HTML layout and a plain-text fallback. The HTML output uses Laravel's default mail theme.

This approach keeps email content co-located with the notification logic, making it straightforward to find and edit.

### Where content is defined

All email subject lines, body text, and call-to-action links are written inside each notification class in its `toMail()` method.

**Example — changing the body of the password reset email:**

Open `app/Notifications/Auth/PasswordResetNotification.php` and edit the `toMail()` method:

```php
public function toMail($notifiable): MailMessage
{
    return (new MailMessage)
        ->subject('Reset Your Password')
        ->greeting("Hello {$notifiable->name},")
        ->line('You requested a password reset for your Camp Burnt Gin account.')
        ->action('Reset Password', $this->resetUrl)
        ->line('This link expires in 60 minutes.')
        ->line('If you did not request this, no action is required.');
}
```

Edit the strings inside `->line()`, `->subject()`, `->greeting()`, or `->action()` to change what the email says.

### Customising the HTML layout

To override Laravel's default email layout (header, footer, colours, logo):

```bash
php artisan vendor:publish --tag=laravel-mail
```

This copies the mail layout files to:

```
resources/views/vendor/mail/
```

You can then edit `resources/views/vendor/mail/html/layout.blade.php` and related files to change the visual design of all emails without modifying individual notification classes.

---

## 8. How Developers Can Modify the Mailing System

### Create a new email notification

**1. Generate the notification class:**

```bash
php artisan make:notification YourNotificationName
```

**2. Define channels and content:**

```php
public function via($notifiable): array
{
    return ['mail', 'database'];
}

public function toMail($notifiable): MailMessage
{
    return (new MailMessage)
        ->subject('Your Subject Here')
        ->line('Your message body here.')
        ->action('Button Label', url('/your-route'));
}

public function toArray($notifiable): array
{
    return [
        'title'   => 'Your Subject Here',
        'message' => 'Short description for the in-app notification.',
    ];
}
```

**3. Dispatch it from a controller or service:**

```php
// For a user with an account:
$user->notify(new YourNotificationName($data));

// Or via the queue job wrapper (preferred):
$this->queueNotification($user, new YourNotificationName($data));

// For an external recipient with no account:
Notification::route('mail', 'external@example.com')
    ->notify(new YourNotificationName($data));
```

### Modify an existing email

Open the relevant notification class in `app/Notifications/` and edit the `toMail()` method. Changes to subject, body text, links, and button labels are all made here.

### Change when an email is triggered

Find the controller or service that dispatches the notification (refer to the table in Section 2) and modify the condition or method that calls `queueNotification()` or `->notify()`.

### Change the recipient

The recipient is the `$notifiable` passed to the notification. To redirect all email to a different address (for example, for testing), set `MAIL_TO` overrides in `.env`, or modify the `routeNotificationForMail()` method on the `User` model:

```php
// In app/Models/User.php
public function routeNotificationForMail(): string
{
    return $this->email; // Change this to redirect all mail
}
```

### Connect to a different SMTP provider

Update the following `.env` values with the credentials from your new provider, then clear the config cache:

```bash
php artisan config:clear
```

No code changes are required. All SMTP providers follow the same interface — only the host, port, username, and password differ.

---

## 9. Troubleshooting

### Emails not appearing in Mailtrap sandbox

| Check | How |
|---|---|
| Confirm queue worker is running | Run `php artisan queue:work --queue=notifications` and watch for output |
| Check for failed jobs | Run `php artisan queue:failed` |
| Confirm correct sandbox credentials | Compare `.env` values with Mailtrap > Sandboxes > My Sandbox > SMTP tab |
| Check Laravel logs for SMTP errors | `tail -f storage/logs/laravel.log` |
| Confirm config cache is cleared | Run `php artisan config:clear` after any `.env` change |

### App says "email sent" but nothing arrives

Laravel's password reset and email verification endpoints return a success response even if the user's email address does not exist in the database. This is intentional to prevent account enumeration. Verify that the email address you tested with belongs to an actual user in the system.

### SMTP authentication failure

```
Expected response code 250 but got code "535"
```

This means the username or password in `.env` is incorrect. Log into Mailtrap, navigate to Sandboxes > My Sandbox > SMTP, and copy the credentials again. Then run `php artisan config:clear`.

### Queue jobs not being processed

If emails are queued but never sent, the queue worker is likely not running. Start it with:

```bash
php artisan queue:work --queue=notifications
```

In production, ensure this process is managed by Supervisor or an equivalent daemon manager so it restarts automatically.

### Email content looks broken or unstyled

If you have customised the mail layout (via `vendor:publish`), check for syntax errors in the Blade templates under `resources/views/vendor/mail/`. Deleting those files and re-publishing resets them to the Laravel defaults.

### Checking what emails were attempted

Laravel logs failed notification jobs with context. Search the log:

```bash
grep "notification" storage/logs/laravel.log
```

Failed jobs are also visible in the database:

```bash
php artisan queue:failed
```

---

## 10. Testing the Mailing System

### Send a test email via artisan

A built-in test command is available to verify the SMTP connection:

```bash
php artisan mail:test your@email.com
```

If the command completes without error and the message appears in your Mailtrap sandbox inbox, the configuration is working correctly.

### View captured emails in Mailtrap

1. Log into [mailtrap.io](https://mailtrap.io)
2. Navigate to **Sandboxes > My Sandbox**
3. Emails sent by the application will appear in the inbox list
4. Click any email to view its HTML rendering, plain-text version, headers, and spam score

### Test a specific application flow

To test the password reset email:
1. Ensure you are using an email address that belongs to a real user in the database
2. Visit the forgot password page and submit the request
3. Check the Mailtrap sandbox inbox — the reset email should appear within a few seconds (assuming the queue worker is running)

### Log-only mode (no SMTP required)

To disable all external sending and write emails to the Laravel log file instead, change `.env`:

```env
MAIL_MAILER=log
```

Emails will be written to `storage/logs/laravel.log`. This is useful when working without network access or when SMTP credentials are not yet available.

### Verify queue processing

To confirm jobs are being picked up:

```bash
php artisan queue:work --queue=notifications --once
```

The `--once` flag processes a single job and exits, making it easy to confirm the worker and SMTP connection are both functional.

---


