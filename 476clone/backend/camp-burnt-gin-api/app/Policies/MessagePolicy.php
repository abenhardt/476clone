<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;

/**
 * MessagePolicy — Authorization rules for individual Messages.
 *
 * A Message is a single post inside a Conversation thread. This policy
 * controls who can read, send, delete, and attach files to messages.
 *
 * Key design decisions:
 *  - Messages are immutable once sent (no editing) to preserve integrity.
 *  - Only admins can soft-delete messages for content moderation.
 *  - Permanent deletion is never allowed (HIPAA audit trail requirement).
 *  - System-generated conversations are read-only; nobody can reply.
 *  - Archived conversations are also locked; no new messages allowed.
 */
class MessagePolicy
{
    /**
     * Can the user view all messages in a conversation?
     *
     * Participants in the conversation may browse its messages.
     * Admins can read any conversation's messages.
     */
    public function viewAny(User $user, Conversation $conversation): bool
    {
        // hasParticipant() checks membership in the conversation.
        return $conversation->hasParticipant($user) || $user->isAdmin();
    }

    /**
     * Can the user view a specific message?
     *
     * The user must be a participant in the conversation the message belongs to.
     * Admins bypass the participant check.
     */
    public function view(User $user, Message $message): bool
    {
        // Check participation in the conversation this message belongs to.
        return $message->conversation->hasParticipant($user) || $user->isAdmin();
    }

    /**
     * Can the user send a new message in this conversation?
     *
     * Three conditions must all be true before a message can be sent:
     *  1. The conversation is not a system-generated notification thread.
     *  2. The user is an active participant.
     *  3. The conversation has not been archived.
     */
    public function create(User $user, Conversation $conversation): bool
    {
        // System-generated conversations are read-only — no replies allowed.
        if ($conversation->is_system_generated) {
            return false;
        }

        // User must be an active participant to send messages.
        if (! $conversation->hasParticipant($user)) {
            return false;
        }

        // Archived conversations cannot receive new messages.
        if ($conversation->is_archived) {
            return false;
        }

        return true;
    }

    /**
     * Can the user edit a message after it has been sent?
     *
     * Messages are immutable. No edits are allowed by any role — this ensures
     * that the conversation history is a reliable audit record.
     */
    public function update(User $user, Message $message): bool
    {
        return false;
    }

    /**
     * Can the user delete (soft-delete) a message?
     *
     * Only admins may soft-delete messages for content moderation purposes.
     * Even the sender of a message cannot delete what they wrote.
     */
    public function delete(User $user, Message $message): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user restore a previously soft-deleted message?
     *
     * Only admins can restore soft-deleted messages.
     */
    public function restore(User $user, Message $message): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user permanently (hard) delete a message?
     *
     * Permanent deletion is never allowed. Messages may reference PHI
     * and must be retained to satisfy HIPAA record-keeping requirements.
     */
    public function forceDelete(User $user, Message $message): bool
    {
        return false;
    }

    /**
     * Can the user attach files to a message in this conversation?
     *
     * Attaching files follows the same rules as sending a message —
     * we reuse the create() check to avoid duplicating logic.
     */
    public function attachFiles(User $user, Conversation $conversation): bool
    {
        // Delegates to create() — same participation and state rules apply.
        return $this->create($user, $conversation);
    }

    /**
     * Can the user view attachments on this message?
     *
     * Viewing attachments follows the same rules as viewing the message itself.
     */
    public function viewAttachments(User $user, Message $message): bool
    {
        // Delegates to view() — same participant check applies.
        return $this->view($user, $message);
    }
}
