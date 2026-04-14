<?php

namespace App\Services;

use App\Events\MessageSent;
use App\Jobs\SendNotificationJob;
use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageRecipient;
use App\Models\User;
use App\Notifications\NewMessageNotification;
use App\Services\Document\DocumentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * MessageService — Message Sending, Reading, and Attachment Handling
 *
 * This service handles everything that happens with individual messages inside
 * conversations. While InboxService manages the conversation container,
 * MessageService manages the messages inside those containers.
 *
 * Key responsibilities:
 *  - Send messages with idempotency protection (prevents duplicate sends if the
 *    user double-clicks or a network retry fires)
 *  - Attach files to messages by delegating to DocumentService for validation
 *    and storage
 *  - Mark messages as read and track per-user read receipts
 *  - Return paginated message history (and auto-mark fetched messages as read)
 *  - Soft-delete messages (admin moderation only)
 *  - Log all attachment accesses for HIPAA audit trail compliance
 *
 * All write operations use DB transactions and write to the audit log.
 *
 * Connected services:
 *  - DocumentService: file upload, validation, and MIME scanning for attachments
 *  - InboxService:    updates conversation timestamp and retrieves other participants
 */
class MessageService
{
    /**
     * Inject the two services this class depends on.
     * Laravel's container resolves and provides these automatically.
     */
    public function __construct(
        protected DocumentService $documentService,
        protected InboxService $inboxService
    ) {}

    /**
     * Send a message within a conversation.
     *
     * Idempotency: if a message with the same idempotency key already exists,
     * the existing message is returned instead of creating a duplicate. This
     * handles network retries and double-submit scenarios gracefully.
     *
     * Flow:
     *  1. Generate or use provided idempotency key
     *  2. In a transaction: check for duplicate, create message, create recipient records,
     *     handle attachments, update conversation timestamp, notify other participants
     *  3. Write audit log entry
     *
     * @param  Conversation  $conversation  The conversation to send into
     * @param  User  $sender  The user sending the message
     * @param  string  $body  The message text content
     * @param  array  $attachments  Array of UploadedFile objects (optional)
     * @param  string|null  $idempotencyKey  Unique key to prevent duplicate sends
     * @param  array  $recipients  TO/CC/BCC recipients: [{user_id, type}]
     *                             If empty, no message_recipients rows are created
     *                             (legacy messages without explicit recipient types)
     * @param  int|null  $parentMessageId  Message being replied to (null for new)
     * @param  string|null  $replyType  'reply' | 'reply_all' | null
     *
     * @throws \Exception If attachment upload fails
     */
    public function sendMessage(
        Conversation $conversation,
        User $sender,
        string $body,
        array $attachments = [],
        ?string $idempotencyKey = null,
        array $recipients = [],
        ?int $parentMessageId = null,
        ?string $replyType = null
    ): Message {
        // Generate a random UUID idempotency key if the caller didn't provide one
        if (! $idempotencyKey) {
            $idempotencyKey = Str::uuid()->toString();
        }

        // Capture participants outside the closure so we can broadcast after commit.
        // PHP reference capture (&) lets the closure write the value back out.
        $otherParticipants = collect();

        // Wrap the entire send operation in a transaction for atomicity
        $message = DB::transaction(function () use (
            $conversation,
            $sender,
            $body,
            $attachments,
            $idempotencyKey,
            $recipients,
            $parentMessageId,
            $replyType,
            &$otherParticipants
        ) {
            // Idempotency check: if a message with this key was already created, return it
            $existingMessage = Message::where('idempotency_key', $idempotencyKey)->first();

            if ($existingMessage) {
                // Return the existing message — safe for the caller to treat as a success
                return $existingMessage->load(['sender', 'attachments', 'recipients.user']);
            }

            // Create the new message record
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'idempotency_key' => $idempotencyKey,
                'parent_message_id' => $parentMessageId,
                'reply_type' => $replyType,
            ]);

            // Create TO/CC/BCC recipient records if explicit recipients were provided.
            // Messages without recipients (legacy or system messages) are still valid —
            // the API falls back to treating all conversation_participants as implicit TO.
            if (! empty($recipients)) {
                $this->createRecipientRecords($message, $recipients);
            }

            // Process and upload each attached file through DocumentService
            if (! empty($attachments)) {
                foreach ($attachments as $file) {
                    $this->attachFile($message, $file, $sender);
                }
            }

            // Bump the conversation's last_message_at so it sorts to the top of the inbox
            $this->inboxService->updateConversationTimestamp($conversation);

            // Get all participants except the sender to notify them.
            // Captured by reference so we can broadcast after this transaction commits.
            $otherParticipants = $this->inboxService->getParticipantsExcept($conversation, $sender);

            // Two-channel notification split:
            //   1. Database (bell icon) — written synchronously via notifyNow() so the
            //      notification appears immediately without a queue worker running.
            //   2. Email — queued via SendNotificationJob so a mail failure cannot delay
            //      the HTTP response or roll back the message transaction.
            foreach ($otherParticipants as $participant) {
                // In-app bell: always write synchronously to the notifications table.
                $participant->notifyNow(NewMessageNotification::forDatabase($message, $conversation));

                // Email: only dispatch if the user has messages email preference enabled.
                $prefs = $participant->notification_preferences ?? [];
                if ($prefs['messages'] ?? true) {
                    dispatch(new SendNotificationJob($participant, NewMessageNotification::forMail($message, $conversation)));
                }
            }

            // Write an audit log entry recording this send event
            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => $sender->id,
                'event_type' => 'message',
                'auditable_type' => Message::class,
                'auditable_id' => $message->id,
                'action' => 'sent',
                'description' => "Message sent in conversation: {$conversation->subject}",
                'new_values' => [
                    'conversation_id' => $conversation->id,
                    // Log body length rather than content to avoid logging PHI in the audit table
                    'body_length' => strlen($body),
                    'attachment_count' => count($attachments),
                    'reply_type' => $replyType,
                    'recipient_count' => count($recipients),
                ],
                'metadata' => [
                    'conversation_subject' => $conversation->subject,
                    'has_attachments' => ! empty($attachments),
                    'parent_message_id' => $parentMessageId,
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);

            // Return the message with all relationships loaded for the API response
            return $message->load(['sender', 'attachments', 'recipients.user']);
        });

        // Broadcast real-time events after the transaction commits.
        // ShouldBroadcastNow fires immediately (no queue worker needed).
        // Each recipient gets their own private-channel event so no cross-user
        // data is exposed.
        //
        // Wrapped in try/catch: broadcasting is best-effort. A downed Reverb server
        // must never prevent message persistence or break the API response.
        foreach ($otherParticipants as $participant) {
            try {
                broadcast(new MessageSent($message, $conversation, $participant->id));
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('Realtime broadcast failed', [
                    'message_id' => $message->id,
                    'recipient_id' => $participant->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $message;
    }

    /**
     * Reply to a specific message — sends only to the original sender.
     *
     * The reply is appended to the same conversation thread so the full history
     * is preserved in one place. The original message author receives the reply;
     * CC and BCC recipients of the original message are NOT included.
     *
     * @param  Conversation  $conversation  The thread to send the reply in
     * @param  Message  $parentMessage  The message being replied to
     * @param  User  $sender  The user sending the reply
     * @param  string  $body  Reply message body
     * @param  array  $attachments  Optional UploadedFile attachments
     */
    public function reply(
        Conversation $conversation,
        Message $parentMessage,
        User $sender,
        string $body,
        array $attachments = []
    ): Message {
        // Reply only to the original message's sender (if it has one — system messages have no sender)
        $recipients = [];
        if ($parentMessage->sender_id && $parentMessage->sender_id !== $sender->id) {
            $recipients[] = ['user_id' => $parentMessage->sender_id, 'type' => 'to'];
        }

        // Ensure the reply-to author is a conversation participant (they should be, but be safe)
        if (! empty($recipients)) {
            $replyTarget = User::find($recipients[0]['user_id']);
            if ($replyTarget && ! $conversation->hasParticipant($replyTarget)) {
                $this->inboxService->addParticipant($conversation, $replyTarget);
            }
        }

        return $this->sendMessage(
            $conversation,
            $sender,
            $body,
            $attachments,
            null,
            $recipients,
            $parentMessage->id,
            'reply'
        );
    }

    /**
     * Reply All to a message — sends to original sender + all visible TO/CC recipients.
     *
     * BCC recipients from the original message are NEVER included in reply-all.
     * The current user is excluded from the recipient list (you don't send to yourself).
     * Any duplicate user IDs (e.g. original sender also appears in TO) are deduplicated.
     *
     * @param  Conversation  $conversation  The thread to send the reply in
     * @param  Message  $parentMessage  The message being replied to
     * @param  User  $sender  The user sending the reply-all
     * @param  string  $body  Reply message body
     * @param  array  $attachments  Optional UploadedFile attachments
     */
    public function replyAll(
        Conversation $conversation,
        Message $parentMessage,
        User $sender,
        string $body,
        array $attachments = []
    ): Message {
        $recipients = $this->calculateReplyAllRecipients($parentMessage, $sender);

        // Ensure all reply-all targets are conversation participants
        $recipientUserIds = array_column($recipients, 'user_id');
        if (! empty($recipientUserIds)) {
            $users = User::whereIn('id', $recipientUserIds)->get();
            foreach ($users as $user) {
                if (! $conversation->hasParticipant($user)) {
                    $this->inboxService->addParticipant($conversation, $user);
                }
            }
        }

        return $this->sendMessage(
            $conversation,
            $sender,
            $body,
            $attachments,
            null,
            $recipients,
            $parentMessage->id,
            'reply_all'
        );
    }

    /**
     * Calculate the recipient list for a Reply All action.
     *
     * Rules (mirrors Gmail's Reply All behavior):
     *  1. Include original sender as TO (if not the current user)
     *  2. Include original visible TO recipients (excluding current user)
     *  3. Include original CC recipients (excluding current user)
     *  4. NEVER include BCC recipients regardless of who is performing the action
     *  5. Deduplicate — same user_id cannot appear twice
     *
     * If the message has no explicit recipient records (legacy messages or messages
     * sent before TO/CC/BCC was introduced), fall back to all conversation participants
     * excluding the sender and current user, treating them all as TO.
     *
     * @param  Message  $message  The original message being replied to
     * @param  User  $currentUser  The user performing the reply-all
     * @return array Array of ['user_id' => int, 'type' => 'to'|'cc']
     */
    public function calculateReplyAllRecipients(Message $message, User $currentUser): array
    {
        $recipients = [];
        $addedUserIds = [$currentUser->id]; // Pre-exclude self

        // 1. Add original sender as TO (if they are not the current user)
        if ($message->sender_id && ! in_array($message->sender_id, $addedUserIds)) {
            $recipients[] = ['user_id' => $message->sender_id, 'type' => 'to'];
            $addedUserIds[] = $message->sender_id;
        }

        // Load explicit recipients for this message
        $explicitRecipients = $message->recipients()->with('user')->get();

        if ($explicitRecipients->isNotEmpty()) {
            // Use explicit TO/CC recipients — BCC is intentionally excluded
            foreach ($explicitRecipients as $recipient) {
                // Critical: skip BCC entries entirely
                if ($recipient->recipient_type === 'bcc') {
                    continue;
                }
                // Skip users already added (sender may overlap with TO list)
                if (in_array($recipient->user_id, $addedUserIds)) {
                    continue;
                }
                $recipients[] = [
                    'user_id' => $recipient->user_id,
                    'type' => $recipient->recipient_type, // preserve 'to' or 'cc'
                ];
                $addedUserIds[] = $recipient->user_id;
            }
        } else {
            // Legacy fallback: no recipient records exist → treat all other conversation
            // participants (excluding sender and current user) as TO recipients
            $conversation = $message->conversation;
            if ($conversation) {
                $fallbackParticipants = $this->inboxService->getParticipantsExcept(
                    $conversation,
                    $currentUser
                );
                foreach ($fallbackParticipants as $participant) {
                    if (in_array($participant->id, $addedUserIds)) {
                        continue;
                    }
                    $recipients[] = ['user_id' => $participant->id, 'type' => 'to'];
                    $addedUserIds[] = $participant->id;
                }
            }
        }

        return $recipients;
    }

    /**
     * Persist TO/CC/BCC recipient records for a message.
     *
     * Called after message creation, inside the sendMessage transaction.
     * Validates that user_id and type are present for each entry.
     * Silently skips any entry that would violate the UNIQUE constraint
     * (same user appearing twice — should not happen but guard defensively).
     *
     * @param  Message  $message  The newly created message
     * @param  array  $recipients  [['user_id' => int, 'type' => 'to'|'cc'|'bcc'], ...]
     */
    protected function createRecipientRecords(Message $message, array $recipients): void
    {
        $seen = [];
        foreach ($recipients as $entry) {
            $userId = $entry['user_id'] ?? null;
            $type = $entry['type'] ?? 'to';

            if (! $userId || in_array($userId, $seen)) {
                continue;
            }

            if (! in_array($type, ['to', 'cc', 'bcc'])) {
                $type = 'to'; // Safe default for unrecognised types
            }

            MessageRecipient::create([
                'message_id' => $message->id,
                'user_id' => $userId,
                'recipient_type' => $type,
                'is_read' => false,
            ]);

            $seen[] = $userId;
        }
    }

    /**
     * Attach a file to a message by uploading it through DocumentService.
     *
     * DocumentService handles MIME validation, safe filename generation, and
     * security scanning. This method adds the audit log entry specific to
     * the attachment action.
     *
     * @param  Message  $message  The message to attach the file to
     * @param  UploadedFile  $file  The file being attached
     * @param  User  $uploader  The user performing the upload
     *
     * @throws \Exception If the file fails validation or upload
     */
    protected function attachFile(Message $message, UploadedFile $file, User $uploader)
    {
        // Validate the attachment separately before passing to DocumentService
        $this->validateAttachment($file);

        // Delegate actual upload, scanning, and storage to DocumentService
        $result = $this->documentService->upload(
            $file,
            [
                // Link the document to the message via a polymorphic relationship
                'documentable_type' => \App\Models\Message::class,
                'documentable_id' => $message->id,
                'message_id' => $message->id,
                'document_type' => 'message_attachment',
            ],
            $uploader
        );

        if (! $result['success']) {
            throw new \Exception($result['message'] ?? 'File upload failed');
        }

        $document = $result['document'];

        // Write an attachment-specific audit log entry (separate from the message send event)
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $uploader->id,
            'event_type' => 'message_attachment',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'attached',
            'description' => "File attached to message {$message->id}",
            'new_values' => [
                'document_id' => $document->id,
                'file_size' => $file->getSize(),
                'mime_type' => $file->getMimeType(),
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $document;
    }

    /**
     * Validate an attachment before passing it to DocumentService.
     *
     * Enforces:
     *  - 10 MB file size limit
     *  - MIME type must be in the allowed list (PDF, JPEG, PNG, GIF, DOC, DOCX)
     *
     * @throws \Exception With a human-readable message if validation fails
     */
    protected function validateAttachment(UploadedFile $file): void
    {
        // 10 MB in bytes: 10 * 1024 * 1024 = 10,485,760
        if ($file->getSize() > 10485760) {
            throw new \Exception('File size exceeds 10MB limit');
        }

        $allowedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        if (! in_array($file->getMimeType(), $allowedMimeTypes)) {
            throw new \Exception('File type not allowed');
        }
    }

    /**
     * Get paginated messages for a conversation and mark unread ones as read.
     *
     * Messages are returned oldest-first (chronological order for chat display).
     * As messages are fetched, any that the user hasn't read yet are automatically
     * marked as read — so opening a conversation clears the unread badge.
     *
     * @param  Conversation  $conversation  The conversation to fetch messages for
     * @param  User  $user  The user viewing the messages
     * @param  int  $perPage  Messages per page (default 25)
     */
    public function getConversationMessages(
        Conversation $conversation,
        User $user,
        int $perPage = 25
    ): LengthAwarePaginator {
        $messages = Message::where('conversation_id', $conversation->id)
            ->with(['sender', 'attachments', 'recipients.user'])
            ->oldest()   // Chronological order for natural chat reading
            ->paginate($perPage);

        // Auto-mark any unread messages as read for this user
        foreach ($messages as $message) {
            if (! $message->isReadBy($user)) {
                $this->markAsRead($message, $user);
            }
        }

        return $messages;
    }

    /**
     * Mark a specific message as read by a user.
     *
     * Rules:
     *  - A user's own messages are never marked as read (they sent it)
     *  - Already-read messages are skipped (idempotent)
     *  - A read receipt record is created and an audit log entry is written
     */
    public function markAsRead(Message $message, User $user): void
    {
        // Don't mark a message as read if the user sent it themselves
        if ($message->sender_id === $user->id) {
            return;
        }

        // Skip if already read — keeps this method idempotent
        if ($message->isReadBy($user)) {
            return;
        }

        // Create the read receipt record via the model method
        $message->markAsReadBy($user);

        // Log the read event for HIPAA audit trail
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'message',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'read',
            'description' => "Message {$message->id} read by user {$user->id}",
            'metadata' => [
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Mark all unread messages in a conversation as read for a given user.
     *
     * Powers the "Mark as read" inbox action. Iterates only over messages that
     * the user hasn't already read (and didn't send themselves) to stay efficient.
     *
     * @param  Conversation  $conversation  The conversation to mark as read
     * @param  User  $user  The user performing the action
     */
    public function markAllAsRead(Conversation $conversation, User $user): void
    {
        $unread = Message::where('conversation_id', $conversation->id)
            ->where(function ($q) use ($user) {
                $q->whereNull('sender_id')
                    ->orWhere('sender_id', '!=', $user->id);
            })
            ->whereDoesntHave('reads', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->get();

        foreach ($unread as $message) {
            $this->markAsRead($message, $user);
        }
    }

    /**
     * Mark the most recent non-own message in a conversation as unread for a user.
     *
     * Powers the "Mark as unread" inbox action. Removes the read receipt for the
     * latest non-own message so the conversation shows as having 1 unread message.
     * The underlying message_reads table stores receipts; deleting a row undoes a read.
     *
     * @param  Conversation  $conversation  The conversation to mark as unread
     * @param  User  $user  The user performing the action
     */
    public function markConversationUnread(Conversation $conversation, User $user): void
    {
        $latest = Message::where('conversation_id', $conversation->id)
            ->where(function ($q) use ($user) {
                $q->whereNull('sender_id')
                    ->orWhere('sender_id', '!=', $user->id);
            })
            ->latest('created_at')
            ->first();

        if ($latest) {
            // Remove the read receipt — this makes the message (and conversation) appear unread
            $latest->reads()->where('user_id', $user->id)->delete();
        }
    }

    /**
     * Get the total count of unread messages for a user across all conversations.
     *
     * Used to drive the unread badge on the inbox navigation icon.
     * Implemented as a single aggregated query — no N+1.
     *
     * Filters applied to match exactly what the inbox displays:
     *  - userConversations(): excludes system-generated notification threads.
     *    System threads live in the System folder, not the Inbox — counting their
     *    unread messages would create a badge count that can never reach zero.
     *  - trashed_at IS NULL: excludes conversations the user moved to their trash.
     */
    public function getUnreadMessageCount(User $user): int
    {
        return Message::whereHas('conversation', function ($query) use ($user) {
            $query->forUser($user)
                ->active()
                ->userConversations()  // Exclude is_system_generated threads — not shown in inbox
                ->whereHas('participantRecords', function ($q) use ($user) {
                    // Exclude conversations the user has trashed — trashed items don't show in inbox
                    $q->where('user_id', $user->id)->whereNull('trashed_at');
                });
        })
            ->unreadBy($user)  // scope: no read receipt exists for this user
            ->count();
    }

    /**
     * Get the unread message count for a specific conversation and user.
     *
     * Used to show the unread count badge on a specific conversation row.
     */
    public function getConversationUnreadCount(Conversation $conversation, User $user): int
    {
        // Delegates to the model's method for encapsulated query logic
        return $conversation->getUnreadCountForUser($user);
    }

    /**
     * Soft delete a message (admin-only moderation action).
     *
     * Sets deleted_at so the message disappears from conversation views.
     * The database record is retained for audit purposes.
     * Only administrators are permitted to call this method.
     */
    public function deleteMessage(Message $message): void
    {
        $message->delete();

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'message',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'soft_deleted',
            'description' => 'Message soft deleted by admin',
            // Safe projection — never write message body (PHI) to the audit log
            'old_values' => [
                'message_id' => $message->id,
                'conversation_id' => $message->conversation_id,
                'sender_id' => $message->sender_id,
                'body_length' => mb_strlen($message->body ?? ''),
                'created_at' => $message->created_at?->toISOString(),
            ],
            'metadata' => [
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Access a message attachment and log the access event.
     *
     * Every time someone downloads an attachment, a HIPAA audit log entry is
     * written recording who accessed which document and when. This is required
     * for healthcare data access traceability.
     *
     * @param  Message  $message  The message that owns the attachment
     * @param  int  $documentId  The ID of the document to access
     * @param  User  $user  The user accessing the attachment
     *
     * @throws \Illuminate\Database\Eloquent\ModelNotFoundException If document not found
     */
    public function accessAttachment(Message $message, int $documentId, User $user)
    {
        // Verify the document belongs to this message (prevents horizontal privilege escalation)
        $document = $message->attachments()->findOrFail($documentId);

        // Log the attachment access — required for HIPAA audit trail
        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'message_attachment',
            'auditable_type' => Message::class,
            'auditable_id' => $message->id,
            'action' => 'accessed',
            'description' => "Attachment {$documentId} accessed on message {$message->id}",
            'metadata' => [
                'document_id' => $documentId,
                'conversation_id' => $message->conversation_id,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $document;
    }
}
