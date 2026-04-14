<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

/**
 * ConversationPolicy — Authorization rules for the messaging system.
 *
 * Conversations are threads in the camp's internal messaging system.
 * This policy enforces which users can start, view, modify, and leave
 * conversations, following the role-based messaging rules below.
 *
 * Messaging rules:
 *  - Admins        → can message anyone, view all conversations
 *  - Applicants    → can only message admins (not other parents or medical staff)
 *  - Medical staff → can initiate conversations with admins only
 *  - All participants → can view and reply to conversations they are in
 *
 * System-generated conversations (notifications) have special protections —
 * they cannot be archived, left, or force-deleted.
 */
class ConversationPolicy
{
    /**
     * Can the user see the full conversation list for all users?
     *
     * Only admins see every conversation. Other users see only the
     * conversations they are participants in (handled by scoped queries).
     */
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user view a specific conversation?
     *
     * A user can see a conversation if they are one of its participants.
     * Admins bypass this and can see everything.
     */
    public function view(User $user, Conversation $conversation): bool
    {
        // Admins always get through.
        if ($user->isAdmin()) {
            return true;
        }

        // hasParticipant() checks if this user is in the conversation's participant list.
        return $conversation->hasParticipant($user);
    }

    /**
     * Can the user start a new conversation?
     *
     * Medical providers and parents can start conversations with admins only.
     * Admins can start conversations with anyone.
     *
     * Note: The $hasNonAdminParticipants flag must be resolved in the
     * service layer before this policy is called.
     *
     * @param  User  $user  The user attempting to create
     * @param  bool  $hasNonAdminParticipants  Whether non-admin participants are included
     */
    public function create(User $user, bool $hasNonAdminParticipants = false): bool
    {
        // Admins can create conversations with anyone.
        if ($user->isAdmin()) {
            return true;
        }

        // Medical providers and parents can only message admins.
        if ($user->isMedicalProvider() || $user->isApplicant()) {
            return ! $hasNonAdminParticipants;
        }

        return false;
    }

    /**
     * Can the user update the conversation's metadata (subject, etc.)?
     *
     * The creator of the conversation and admins may edit conversation details.
     */
    public function update(User $user, Conversation $conversation): bool
    {
        // created_by_id identifies who started this conversation.
        return $user->isAdmin() || $conversation->created_by_id === $user->id;
    }

    /**
     * Can the user archive (close) the conversation?
     *
     * System-generated notification threads cannot be archived — they serve
     * as a permanent notification history and must remain accessible.
     * The creator and admins may archive regular conversations.
     */
    public function archive(User $user, Conversation $conversation): bool
    {
        // System notification conversations are never archivable.
        if ($conversation->is_system_generated) {
            return false;
        }

        // The creator or any admin can archive the conversation.
        return $user->isAdmin() || $conversation->created_by_id === $user->id;
    }

    /**
     * Can the user soft-delete the conversation?
     *
     * Only admins may delete conversations. This protects communication
     * records which may be needed for compliance investigations.
     */
    public function delete(User $user, Conversation $conversation): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user restore a previously soft-deleted conversation?
     *
     * Only admins may restore deleted conversations.
     */
    public function restore(User $user, Conversation $conversation): bool
    {
        return $user->isAdmin();
    }

    /**
     * Can the user permanently (hard) delete the conversation?
     *
     * Permanent deletion is never allowed. HIPAA requires that records,
     * including communication logs that may reference PHI, be retained.
     */
    public function forceDelete(User $user, Conversation $conversation): bool
    {
        return false;
    }

    /**
     * Can the user add a new participant to the conversation?
     *
     * Only admins may add participants. Before adding, we confirm:
     *  1. The new participant is not already in the conversation.
     *  2. Medical providers can only be added to camper-related conversations.
     */
    public function addParticipant(User $user, Conversation $conversation, User $newParticipant): bool
    {
        // Non-admins cannot add participants.
        if (! $user->isAdmin()) {
            return false;
        }

        // Prevent adding user who is already a participant.
        if ($conversation->hasParticipant($newParticipant)) {
            return false;
        }

        // Ensure role-based restrictions are maintained.
        // Medical providers can only be added to camper-related conversations.
        if ($newParticipant->isMedicalProvider() && ! $conversation->isLinkedToCamper()) {
            return false;
        }

        return true;
    }

    /**
     * Can the user remove a participant from the conversation?
     *
     * Only admins may remove participants. The creator of the conversation
     * can never be removed — they must archive it instead.
     */
    public function removeParticipant(User $user, Conversation $conversation, User $participant): bool
    {
        // Non-admins cannot remove participants.
        if (! $user->isAdmin()) {
            return false;
        }

        // The conversation creator cannot be removed from their own conversation.
        if ($conversation->created_by_id === $participant->id) {
            return false;
        }

        return true;
    }

    /**
     * Can the user leave the conversation themselves?
     *
     * System notification threads cannot be left — the user must always be
     * able to access their notification history. The creator of a regular
     * conversation also cannot leave; they must archive it instead.
     * Exception: if the creator has already moved the conversation to their
     * personal trash, that represents explicit delete intent and leaving is
     * permitted (this allows "Delete permanently" from the Trash folder to work
     * for non-admin users who started the conversation).
     * All other active participants may leave freely.
     */
    public function leave(User $user, Conversation $conversation): bool
    {
        // Users cannot leave system-generated notification threads.
        if ($conversation->is_system_generated) {
            return false;
        }

        // A user must actually be a participant to leave.
        if (! $conversation->hasParticipant($user)) {
            return false;
        }

        // The creator cannot leave unless they have already trashed the conversation.
        // Trashing signals explicit delete intent, so we allow them to remove themselves.
        if ($conversation->created_by_id === $user->id) {
            $hasTrashed = $conversation->participantRecords()
                ->where('user_id', $user->id)
                ->whereNotNull('trashed_at')
                ->exists();

            return $hasTrashed;
        }

        return true;
    }
}
