<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SystemNotificationService — Automated System Notification Delivery
 *
 * This service creates "system notifications" — automated messages from the
 * platform itself rather than from a human user. Think of them as official
 * letters from the camp system delivered to a user's inbox.
 *
 * How system notifications work:
 *  - Each notification creates a new Conversation record (so the inbox shows
 *    one row per event, like Gmail's notification threads)
 *  - The conversation has no human creator (created_by_id = null)
 *  - The message inside has no human sender (sender_id = null)
 *  - The conversation is tagged as is_system_generated = true so the UI can
 *    display it in the "System" tab and show it as non-replyable
 *
 * Named constructor methods (applicationApproved, passwordChanged, etc.) are
 * provided for each distinct event type so calling code stays readable and
 * doesn't need to remember subject/body templates.
 *
 * Event taxonomy (prefix determines the category badge in the UI):
 *   application.*  | security.*  | role.*  | medical.*
 *
 * All event type strings are defined as public constants so controllers can
 * reference them without hardcoding strings.
 */
class SystemNotificationService
{
    // ─── Event type constants ─────────────────────────────────────────────────
    // Use these constants (not raw strings) when calling notify() directly.
    // They also serve as documentation of every event the system can trigger.

    // Application lifecycle events
    public const APPLICATION_SUBMITTED = 'application.submitted';
    public const APPLICATION_APPROVED = 'application.approved';
    public const APPLICATION_REJECTED = 'application.rejected';
    public const APPLICATION_STATUS_CHANGED = 'application.status_changed';

    // Security events — notify the user any time their account security changes
    public const SECURITY_PASSWORD_CHANGED = 'security.password_changed';
    public const SECURITY_MFA_ENABLED = 'security.mfa_enabled';
    public const SECURITY_MFA_DISABLED = 'security.mfa_disabled';
    public const SECURITY_ACCOUNT_LOCKED = 'security.account_locked';

    // Role governance events
    public const ROLE_CHANGED = 'role.changed';

    // Medical provider link events
    public const MEDICAL_PROVIDER_LINK_GENERATED = 'medical.provider_link_generated';
    public const MEDICAL_PROVIDER_LINK_REVOKED = 'medical.provider_link_revoked';

    // Document request lifecycle events
    public const DOCUMENT_REQUESTED = 'document.requested';
    public const DOCUMENT_UPLOADED = 'document.uploaded';
    public const DOCUMENT_APPROVED = 'document.approved';
    public const DOCUMENT_REJECTED = 'document.rejected';

    // ─── Category labels ──────────────────────────────────────────────────────
    // Maps event prefix → human-readable category label for the UI badge
    private const EVENT_CATEGORIES = [
        'application' => 'Application',
        'security' => 'Security',
        'role' => 'Role',
        'medical' => 'Medical',
        'document' => 'Document',
    ];

    // ─── Core delivery method ─────────────────────────────────────────────────

    /**
     * Create and deliver a system notification to a user.
     *
     * This is the low-level method used by all named constructors below.
     * It creates the conversation and first message inside a DB transaction,
     * then writes an audit log entry.
     *
     * @param  User  $recipient  The user who will receive this notification
     * @param  string  $eventType  Machine-readable event (use class constants)
     * @param  string  $subject  Short subject line shown as conversation title
     * @param  string  $body  Full notification body (may contain HTML)
     * @param  string|null  $relatedType  Optional entity type (e.g. 'App\Models\Application')
     * @param  int|null  $relatedId  Optional entity ID (used for deep-linking in UI)
     * @param  array  $adminVisibleTo  Additional User objects that should also see this
     */
    public function notify(
        User $recipient,
        string $eventType,
        string $subject,
        string $body,
        ?string $relatedType = null,
        ?int $relatedId = null,
        array $adminVisibleTo = []
    ): Conversation {
        // Derive the category label (e.g. "Application") from the event type prefix
        $category = $this->deriveCategory($eventType);

        // Wrap all database writes in a transaction for atomicity
        return DB::transaction(function () use (
            $recipient, $eventType, $category, $subject, $body,
            $relatedType, $relatedId, $adminVisibleTo
        ) {
            // Create the system conversation — no human creator
            $conversation = Conversation::create([
                'created_by_id' => null,         // No human creator
                'subject' => $subject,
                'category' => 'system',
                'is_system_generated' => true,         // Marks this as a system message
                'system_event_type' => $eventType,
                'system_event_category' => $category,
                // Optional links to related entities for UI deep-linking
                'related_entity_type' => $relatedType,
                'related_entity_id' => $relatedId,
                'last_message_at' => now(),
                'is_archived' => false,
            ]);

            // Add the recipient as the primary participant
            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $recipient->id,
                'joined_at' => now(),
            ]);

            // Add any admin users who should also see this notification (e.g. for security events)
            foreach ($adminVisibleTo as $adminUser) {
                // Skip if the admin is the same person as the recipient (avoid duplicate rows)
                if ($adminUser instanceof User && $adminUser->id !== $recipient->id) {
                    ConversationParticipant::create([
                        'conversation_id' => $conversation->id,
                        'user_id' => $adminUser->id,
                        'joined_at' => now(),
                    ]);
                }
            }

            // Create the notification message — no human sender
            Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => null,               // No human sender
                'body' => $body,
                // Each message still needs a unique idempotency key
                'idempotency_key' => Str::uuid()->toString(),
            ]);

            // Write an audit log entry — safe for CLI usage (request() might be null)
            AuditLog::create([
                'request_id' => request()?->header('X-Request-ID', Str::uuid()->toString()) ?? Str::uuid()->toString(),
                'user_id' => null,                // System-generated — no human actor
                'event_type' => 'system_notification',
                'auditable_type' => Conversation::class,
                'auditable_id' => $conversation->id,
                'action' => 'system_notification_created',
                'description' => "System notification created: {$eventType} for user {$recipient->id}",
                'new_values' => [
                    'event_type' => $eventType,
                    'category' => $category,
                    'recipient_id' => $recipient->id,
                    'related_entity_type' => $relatedType,
                    'related_entity_id' => $relatedId,
                ],
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'created_at' => now(),
            ]);

            return $conversation->load(['participants.role', 'lastMessage']);
        });
    }

    // ─── Named constructors for each event type ───────────────────────────────
    // Each method below is a convenience wrapper for a specific notification event.
    // Controllers call these instead of calling notify() directly with raw strings.

    /**
     * Notify the parent that their application was successfully submitted.
     */
    public function applicationSubmitted(User $recipient, int $applicationId, string $camperName): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::APPLICATION_SUBMITTED,
            subject: "Application submitted for {$camperName}",
            body: "<p>Your camp application for <strong>{$camperName}</strong> has been successfully submitted and is now pending review by our team.</p><p>You will be notified when a decision has been made. If you have any questions in the meantime, please contact us through the inbox.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId: $applicationId,
        );
    }

    /**
     * Notify the parent that their application was approved.
     */
    public function applicationApproved(User $recipient, int $applicationId, string $camperName): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::APPLICATION_APPROVED,
            subject: "Application approved for {$camperName}",
            // Green colour on "approved" to make the good news visually clear
            body: "<p>Great news! The camp application for <strong>{$camperName}</strong> has been <strong style=\"color:#16a34a\">approved</strong>.</p><p>Please log in to your portal to review the acceptance details and next steps.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId: $applicationId,
        );
    }

    /**
     * Notify the parent that their application was not approved.
     * Includes reviewer notes if provided.
     */
    public function applicationRejected(User $recipient, int $applicationId, string $camperName, ?string $notes = null): Conversation
    {
        // Only include a notes paragraph if reviewer notes were actually provided.
        // e() escapes HTML entities so an admin cannot inject markup into the applicant's inbox.
        $noteHtml = $notes ? '<p><em>Reviewer notes: '.e($notes).'</em></p>' : '';

        return $this->notify(
            recipient: $recipient,
            eventType: self::APPLICATION_REJECTED,
            subject: "Application not approved for {$camperName}",
            body: "<p>We regret to inform you that the camp application for <strong>{$camperName}</strong> was not approved at this time.</p>{$noteHtml}<p>If you have questions, please reach out through the inbox.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId: $applicationId,
        );
    }

    /**
     * Notify the parent that their application status changed to any other status.
     * Used for statuses like Waitlisted that don't have a dedicated method.
     */
    public function applicationStatusChanged(User $recipient, int $applicationId, string $camperName, string $newStatus): Conversation
    {
        // Convert snake_case status to a human-readable label (e.g. "under_review" → "Under Review")
        $statusLabel = ucfirst(str_replace('_', ' ', $newStatus));

        return $this->notify(
            recipient: $recipient,
            eventType: self::APPLICATION_STATUS_CHANGED,
            subject: "Application status updated — {$statusLabel}",
            body: "<p>The status of the application for <strong>{$camperName}</strong> has been updated to <strong>{$statusLabel}</strong>.</p><p>Log in to your portal to view the full details.</p>",
            relatedType: 'App\\Models\\Application',
            relatedId: $applicationId,
        );
    }

    /**
     * Notify the user that their password was changed.
     * This is a security alert — if the user didn't do this, they should act immediately.
     */
    public function passwordChanged(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_PASSWORD_CHANGED,
            subject: 'Your password was changed',
            body: '<p>Your account password was successfully updated. If you did not make this change, please contact support immediately and secure your account.</p>',
        );
    }

    /**
     * Notify the user that two-factor authentication was enabled on their account.
     */
    public function mfaEnabled(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_MFA_ENABLED,
            subject: 'Two-factor authentication enabled',
            body: '<p>Two-factor authentication (2FA) has been <strong>enabled</strong> on your account. Your account is now more secure.</p>',
        );
    }

    /**
     * Notify the user that two-factor authentication was disabled on their account.
     * Encourages them to re-enable it as a security best practice.
     */
    public function mfaDisabled(User $recipient): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_MFA_DISABLED,
            subject: 'Two-factor authentication disabled',
            body: '<p>Two-factor authentication (2FA) has been <strong>disabled</strong> on your account. We recommend re-enabling it to keep your account secure.</p>',
        );
    }

    /**
     * Notify the user that their account was temporarily locked after failed logins.
     * The $lockoutMinutes parameter tells them how long to wait before trying again.
     */
    public function accountLocked(User $recipient, int $lockoutMinutes = 5): Conversation
    {
        return $this->notify(
            recipient: $recipient,
            eventType: self::SECURITY_ACCOUNT_LOCKED,
            subject: 'Account temporarily locked',
            body: "<p>Your account has been temporarily locked for {$lockoutMinutes} minute(s) due to multiple failed login attempts.</p><p>If this was not you, please change your password immediately after the lockout expires.</p>",
        );
    }

    /**
     * Notify the user that a super-admin changed their account role.
     * Includes old and new role names so the change is clearly explained.
     */
    public function roleChanged(User $recipient, string $oldRole, string $newRole, User $changedBy): Conversation
    {
        // Convert role slugs to Title Case (e.g. "super_admin" → "Super Admin")
        $oldLabel = ucwords(str_replace('_', ' ', $oldRole));
        $newLabel = ucwords(str_replace('_', ' ', $newRole));

        return $this->notify(
            recipient: $recipient,
            eventType: self::ROLE_CHANGED,
            subject: 'Your account role has been updated',
            body: "<p>Your account role has been changed from <strong>{$oldLabel}</strong> to <strong>{$newLabel}</strong> by a system administrator.</p><p>Your portal access has been updated accordingly. If you believe this is an error, please contact support.</p>",
            // Link to the user record for audit-trail deep linking
            relatedType: 'App\\Models\\User',
            relatedId: $recipient->id,
        );
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Derive the category label from the event type string.
     *
     * Splits on the first dot to get the prefix (e.g. "application" from
     * "application.submitted"), then maps it to a human-readable category.
     * Falls back to "System" if the prefix is unrecognised.
     */
    private function deriveCategory(string $eventType): string
    {
        // e.g. 'application.submitted' → ['application', 'submitted'] → take [0]
        $prefix = explode('.', $eventType)[0] ?? 'system';

        return self::EVENT_CATEGORIES[$prefix] ?? 'System';
    }
}
