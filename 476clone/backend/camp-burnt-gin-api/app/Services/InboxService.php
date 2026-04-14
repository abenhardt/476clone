<?php

namespace App\Services;

use App\Jobs\SendNotificationJob;
use App\Models\AuditLog;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\User;
use App\Notifications\NewConversationNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * InboxService — Conversation Lifecycle Management
 *
 * This service is the business logic layer for the Camp Burnt Gin internal
 * messaging system. Think of it as the post office for the application —
 * it creates conversations, manages who is in them, and organises them into
 * folders (inbox, sent, starred, trash, etc.).
 *
 * Every operation that modifies a conversation is:
 *  1. Validated before touching the database
 *  2. Executed inside a DB transaction (so partial failures roll back cleanly)
 *  3. Logged to the audit trail for HIPAA compliance
 *  4. Accompanied by a notification to affected users where appropriate
 *
 * Folder system (mirrors Gmail-style organisation):
 *  - inbox:     Active non-archived conversations the user participates in
 *  - starred:   Conversations the user has marked with a star
 *  - important: Conversations the user has flagged as important
 *  - sent:      Conversations created by the user
 *  - archive:   Archived conversations (hidden from inbox but not deleted)
 *  - trash:     Conversations the user has moved to trash (trashed_at is set)
 *  - system:    Auto-generated system notifications (no human sender)
 *  - all:       Everything not in trash (backward-compatible catch-all)
 *
 * Called by: ConversationController, MessageService (for timestamp updates)
 */
class InboxService
{
    /**
     * Create a new conversation with the creator and specified participants.
     *
     * Validates the participant list, then within a database transaction:
     *  1. Creates the Conversation record
     *  2. Adds the creator as a participant
     *  3. Adds each other participant and notifies them
     *  4. Writes an audit log entry
     *
     * Rules enforced:
     *  - Participant list cannot be empty
     *  - Cannot create a conversation with only yourself
     *  - Maximum 10 participants per conversation
     *  - All participant IDs must correspond to existing users
     *
     * @param  User  $creator  The user starting the conversation
     * @param  string|null  $subject  Conversation subject line (can be null)
     * @param  array  $participantIds  User IDs to include (not including creator)
     * @param  int|null  $applicationId  Optional: links conversation to an application
     * @param  int|null  $camperId  Optional: links conversation to a camper
     * @param  int|null  $campSessionId  Optional: links conversation to a session
     * @param  string  $category  Conversation category (default: 'general')
     *
     * @throws \InvalidArgumentException If participant validation fails
     */
    public function createConversation(
        User $creator,
        ?string $subject,
        array $participantIds,
        ?int $applicationId = null,
        ?int $camperId = null,
        ?int $campSessionId = null,
        string $category = 'general'
    ): Conversation {
        // Guard: participant list must not be empty
        if (empty($participantIds)) {
            throw new \InvalidArgumentException('Participant list cannot be empty');
        }

        // Remove the creator from the list if they included themselves — they're added automatically
        $participantIds = array_diff($participantIds, [$creator->id]);

        // Guard: after removing the creator, at least one other person must remain
        if (empty($participantIds)) {
            throw new \InvalidArgumentException('Cannot create conversation with only yourself');
        }

        // Guard: cap conversations at 10 participants to prevent abuse
        if (count($participantIds) > 10) {
            throw new \InvalidArgumentException('Maximum 10 participants allowed per conversation');
        }

        // Wrap everything in a transaction — if any step fails, nothing is committed
        return DB::transaction(function () use (
            $creator,
            $subject,
            $participantIds,
            $applicationId,
            $camperId,
            $campSessionId,
            $category
        ) {
            // Create the parent Conversation record
            $conversation = Conversation::create([
                'created_by_id' => $creator->id,
                'subject' => $subject,
                'category' => $category,
                'application_id' => $applicationId,
                'camper_id' => $camperId,
                'camp_session_id' => $campSessionId,
                'last_message_at' => now(),
                'is_archived' => false,
            ]);

            // Add the creator as the first participant (no notification to self)
            $this->addParticipant($conversation, $creator);

            // Load the participant users in one query to verify they all exist
            $participantUsers = User::whereIn('id', $participantIds)->get();

            // Guard: if any ID in the list doesn't exist in users table, abort
            if ($participantUsers->count() !== count($participantIds)) {
                throw new \InvalidArgumentException('One or more participants do not exist');
            }

            foreach ($participantUsers as $participant) {
                $this->addParticipant($conversation, $participant);
                // Dispatch notification via queued job so a mail failure (e.g. rate-limit)
                // cannot roll back the transaction or block the HTTP response.
                dispatch(new SendNotificationJob($participant, new NewConversationNotification($conversation)));
            }

            // Write an audit log entry for HIPAA compliance and security review
            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => $creator->id,
                'event_type' => 'conversation',
                'auditable_type' => Conversation::class,
                'auditable_id' => $conversation->id,
                'action' => 'created',
                'description' => "Conversation {$conversation->id} created",
                // Safe projection — never write subject (potential PHI) to the audit log
                'new_values' => [
                    'conversation_id' => $conversation->id,
                    'subject_length' => mb_strlen($conversation->subject ?? ''),
                    'participant_count' => count($participantIds) + 1, // +1 for creator
                    'category' => $conversation->category,
                    'application_id' => $conversation->application_id,
                    'camper_id' => $conversation->camper_id,
                ],
                'metadata' => [
                    'participant_ids' => $participantIds,
                    'application_id' => $applicationId,
                    'camper_id' => $camperId,
                ],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);

            // Return the conversation with participants and creator loaded for the API response
            return $conversation->load(['participants.role', 'creator']);
        });
    }

    /**
     * Add a user as a participant in a conversation.
     *
     * If the user was previously in the conversation but left, they are rejoined
     * (their left_at is cleared). If they're already an active participant, the
     * existing record is returned unchanged.
     *
     * Both actions are logged to the audit trail.
     */
    public function addParticipant(Conversation $conversation, User $user): ConversationParticipant
    {
        // Check if a participant record already exists for this user/conversation pair
        $existing = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            // If they previously left, rejoin them (clears the left_at timestamp)
            if ($existing->hasLeft()) {
                $existing->rejoin();

                AuditLog::create([
                    'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                    'user_id' => auth()->id(),
                    'event_type' => 'conversation',
                    'auditable_type' => Conversation::class,
                    'auditable_id' => $conversation->id,
                    'action' => 'participant_rejoined',
                    'description' => "User {$user->id} rejoined conversation {$conversation->id}",
                    'metadata' => ['participant_id' => $user->id],
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                    'created_at' => now(),
                ]);
            }

            // Return the existing participant record (either active or just rejoined)
            return $existing;
        }

        // No existing record — create a fresh participant entry
        $participant = ConversationParticipant::create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            'joined_at' => now(),
        ]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'participant_added',
            'description' => "User {$user->id} added to conversation {$conversation->id}",
            'metadata' => ['participant_id' => $user->id],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $participant;
    }

    /**
     * Remove a user from a conversation by setting their left_at timestamp.
     *
     * This is a soft removal — the participant record stays in the database
     * for the audit trail, but the user no longer sees the conversation.
     * Only active participants (left_at IS NULL) can be removed.
     */
    public function removeParticipant(Conversation $conversation, User $user): void
    {
        // Find the active participant record for this user (left_at must be null)
        $participant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->first();

        if ($participant) {
            // markAsLeft() sets left_at to now(), effectively removing them from the conversation
            $participant->markAsLeft();

            AuditLog::create([
                'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
                'user_id' => auth()->id(),
                'event_type' => 'conversation',
                'auditable_type' => Conversation::class,
                'auditable_id' => $conversation->id,
                'action' => 'participant_removed',
                'description' => "User {$user->id} removed from conversation {$conversation->id}",
                'metadata' => ['participant_id' => $user->id],
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
                'created_at' => now(),
            ]);
        }
    }

    /**
     * Archive a conversation so it moves out of the active inbox.
     *
     * Archived conversations are hidden from the inbox but still accessible
     * via the Archive folder. Returns the refreshed conversation record.
     */
    public function archiveConversation(Conversation $conversation): Conversation
    {
        $conversation->update(['is_archived' => true]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'archived',
            'description' => "Conversation {$conversation->id} archived",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        // Return a fresh copy so the caller has the updated is_archived value
        return $conversation->fresh();
    }

    /**
     * Unarchive a conversation, returning it to the active inbox.
     *
     * Reverses the archiveConversation() operation. Returns the refreshed record.
     */
    public function unarchiveConversation(Conversation $conversation): Conversation
    {
        $conversation->update(['is_archived' => false]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'unarchived',
            'description' => "Conversation {$conversation->id} unarchived",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);

        return $conversation->fresh();
    }

    /**
     * Retrieve a paginated list of conversations for a user, filtered by folder.
     *
     * Each folder case adds a specific WHERE condition to scope the results:
     *  - inbox:     active, not archived, not trashed
     *  - starred:   participant record has is_starred = true
     *  - important: participant record has is_important = true
     *  - sent:      created_by_id matches the user
     *  - archive:   is_archived = true
     *  - trash:     participant record has trashed_at set
     *  - system:    is_system_generated = true
     *  - all:       no additional filter (catch-all / backward compat)
     *
     * @param  User  $user  The user whose conversations to retrieve
     * @param  int  $perPage  Number of results per page (default 25)
     * @param  bool|null  $systemOnly  Deprecated — prefer the 'system' folder instead
     * @param  string  $folder  Which folder to display (default: 'inbox')
     */
    public function getUserConversations(
        User $user,
        int $perPage = 25,
        ?bool $systemOnly = null,
        string $folder = 'inbox'
    ): LengthAwarePaginator {
        // Base query: scope to conversations this user participates in, load all needed relationships
        $query = Conversation::query()
            ->forUser($user)
            ->with(['creator', 'lastMessage.sender.role', 'participants.role', 'activeParticipantRecords'])
            ->recentActivity();  // Order by last_message_at descending

        // Apply the folder-specific filter using a switch statement
        switch ($folder) {
            case 'inbox':
                // Active (not archived), human conversations, not trashed by this user
                $query->active()
                    ->userConversations()
                    ->whereHas('participantRecords', function ($q) use ($user) {
                        $q->where('user_id', $user->id)->whereNull('trashed_at');
                    });
                break;

            case 'starred':
                // This user has starred the conversation and hasn't trashed it
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->where('is_starred', true)
                        ->whereNull('trashed_at');
                });
                break;

            case 'important':
                // This user has flagged the conversation as important and hasn't trashed it
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                        ->where('is_important', true)
                        ->whereNull('trashed_at');
                });
                break;

            case 'sent':
                // Conversations that this user created (regardless of archive status)
                $query->where('created_by_id', $user->id)
                    ->whereHas('participantRecords', function ($q) use ($user) {
                        $q->where('user_id', $user->id)->whereNull('trashed_at');
                    });
                break;

            case 'archive':
                // Archived conversations this user participates in
                $query->archived()
                    ->whereHas('participantRecords', function ($q) use ($user) {
                        $q->where('user_id', $user->id)->whereNull('trashed_at');
                    });
                break;

            case 'trash':
                // Bypass the default forUser scope because trashed users may have left the conversation
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    // trashed_at NOT NULL means the user moved this conversation to their trash
                    $q->where('user_id', $user->id)->whereNotNull('trashed_at');
                });
                break;

            case 'system':
                // System-generated notifications (no human creator or sender)
                $query->active()
                    ->systemGenerated()
                    ->whereHas('participantRecords', function ($q) use ($user) {
                        $q->where('user_id', $user->id)->whereNull('trashed_at');
                    });
                break;

            case 'all':
            default:
                // Show everything not trashed — backward-compatible default
                $query->whereHas('participantRecords', function ($q) use ($user) {
                    $q->where('user_id', $user->id)->whereNull('trashed_at');
                });
                break;
        }

        // Legacy systemOnly filter support (used before the folder system was introduced)
        if ($folder !== 'system' && $systemOnly === true) {
            $query->systemGenerated();
        } elseif ($systemOnly === false) {
            $query->userConversations();
        }

        return $query->paginate($perPage);
    }

    /**
     * Toggle the starred flag for this user's participation in a conversation.
     *
     * Stars are per-user — starring a conversation only affects your own view.
     * Returns the new is_starred value (true = now starred, false = unstarred).
     */
    public function toggleStar(Conversation $conversation, User $user): bool
    {
        $participant = \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        // toggleStar() flips the boolean and saves, returning the new value
        return $participant->toggleStar();
    }

    /**
     * Toggle the important flag for this user's participation in a conversation.
     *
     * Like starring, this is per-user. Returns the new is_important value.
     */
    public function toggleImportant(Conversation $conversation, User $user): bool
    {
        $participant = \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        return $participant->toggleImportant();
    }

    /**
     * Move a conversation to the user's trash by setting trashed_at.
     *
     * Trash is per-user — other participants are not affected.
     * The conversation is hidden from all folders except the Trash folder.
     */
    public function trashConversation(Conversation $conversation, User $user): void
    {
        // Set trashed_at on only this user's active participant record (left_at IS NULL)
        \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['trashed_at' => now()]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'trashed',
            'description' => "User {$user->id} moved conversation {$conversation->id} to trash",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Restore a conversation from the user's trash by clearing trashed_at.
     *
     * The conversation will reappear in the appropriate folder (inbox, archive, etc.)
     * based on its other properties.
     */
    public function restoreFromTrash(Conversation $conversation, User $user): void
    {
        // Clear trashed_at so the conversation reappears in normal folders
        \App\Models\ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->update(['trashed_at' => null]);

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => $user->id,
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'restored_from_trash',
            'description' => "User {$user->id} restored conversation {$conversation->id} from trash",
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }

    /**
     * Get the count of unread conversations for a user.
     *
     * A conversation is "unread" if it has at least one message that:
     *  - Was not sent by this user (own messages don't count as unread)
     *  - Has not been marked as read by this user
     *
     * Implemented as a single optimised query to avoid N+1.
     */
    public function getUnreadConversationCount(User $user): int
    {
        return Conversation::forUser($user)
            ->active()
            ->userConversations()  // Exclude system notifications — they live in the System folder, not Inbox
            ->whereHas('messages', function ($query) use ($user) {
                $query->whereDoesntHave('reads', function ($q) use ($user) {
                    // Exclude messages already read by this user
                    $q->where('user_id', $user->id);
                })->where(function ($q) use ($user) {
                    // Include system messages (sender_id = null) as unread
                    $q->whereNull('sender_id')
                        ->orWhere('sender_id', '!=', $user->id);
                });
            })
            ->count();
    }

    /**
     * Update the conversation's last_message_at timestamp to now.
     *
     * Called by MessageService whenever a new message is sent to this conversation.
     * This timestamp drives the "recent activity" sort order in the inbox list.
     */
    public function updateConversationTimestamp(Conversation $conversation): void
    {
        $conversation->update(['last_message_at' => now()]);
    }

    /**
     * Verify that a user is an active participant in a conversation.
     *
     * Used by MessageService and ConversationController to confirm access
     * before allowing the user to read or send messages.
     */
    public function verifyParticipantStatus(Conversation $conversation, User $user): bool
    {
        // hasParticipant() checks for an active (not left) participant record
        return $conversation->hasParticipant($user);
    }

    /**
     * Get all participants of a conversation except one specific user.
     *
     * Used by MessageService to find who to notify when a message is sent
     * (everyone except the person who just sent the message).
     */
    public function getParticipantsExcept(Conversation $conversation, User $excludeUser): Collection
    {
        // Filter participants at the query level for efficiency
        return $conversation->participants()->where('users.id', '!=', $excludeUser->id)->get();
    }

    /**
     * Soft delete a conversation (admin-only operation).
     *
     * Soft deletion sets deleted_at on the conversation so it disappears from all
     * views but remains in the database for audit purposes.
     * Only administrators are permitted to call this.
     */
    public function deleteConversation(Conversation $conversation): void
    {
        // Laravel's SoftDeletes sets deleted_at automatically
        $conversation->delete();

        AuditLog::create([
            'request_id' => request()->header('X-Request-ID', \Illuminate\Support\Str::uuid()),
            'user_id' => auth()->id(),
            'event_type' => 'conversation',
            'auditable_type' => Conversation::class,
            'auditable_id' => $conversation->id,
            'action' => 'soft_deleted',
            'description' => "Conversation {$conversation->id} soft deleted",
            // Safe projection — never write subject (potential PHI) to the audit log
            'old_values' => [
                'conversation_id' => $conversation->id,
                'subject_length' => mb_strlen($conversation->subject ?? ''),
                'participant_count' => $conversation->participants()->count(),
                'category' => $conversation->category,
                'application_id' => $conversation->application_id,
                'camper_id' => $conversation->camper_id,
                'created_at' => $conversation->created_at?->toISOString(),
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'created_at' => now(),
        ]);
    }
}
