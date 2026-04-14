<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * ConversationParticipant model — the join table between users and conversations.
 *
 * Instead of a simple many-to-many pivot, this is a full Eloquent model because it carries
 * user-specific per-conversation state: whether the user has starred, marked as important,
 * or trashed the conversation. This means two users in the same conversation can each have
 * their own independent starred/trash state — just like a real email inbox.
 *
 * Lifecycle of a participant:
 *   1. Added (joined_at set, left_at null, trashed_at null)
 *   2. Can be starred / marked important independently per user
 *   3. Can be trashed by the user (trashed_at set) without affecting others in the thread
 *   4. Can leave the conversation (left_at set)
 *   5. Can rejoin (left_at cleared to null)
 *
 * Relationships:
 *   - belongs to Conversation
 *   - belongs to User
 *
 * Scopes: trashed(), notTrashed(), active(), left(), forConversation(), forUser()
 */
class ConversationParticipant extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'conversation_id',
        'user_id',
        'joined_at',
        'left_at',
        'is_starred',
        'is_important',
        'trashed_at',
    ];

    /**
     * Cast types for participant fields.
     *
     * All timestamps become Carbon instances for readable comparisons.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
            'left_at' => 'datetime',
            'is_starred' => 'boolean',
            'is_important' => 'boolean',
            // User-level soft-trash; does NOT delete the conversation for other participants
            'trashed_at' => 'datetime',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the conversation this participant record belongs to.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user who is a participant in the conversation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State Checks
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this participant has left the conversation.
     *
     * Left participants should not receive new message notifications.
     */
    public function hasLeft(): bool
    {
        return $this->left_at !== null;
    }

    /**
     * Determine if this participant is currently active in the conversation.
     *
     * Active means they are still a member and receiving messages.
     */
    public function isActive(): bool
    {
        return $this->left_at === null;
    }

    /**
     * Determine if this conversation is in the user's trash folder.
     *
     * Trashing is per-user — it does not affect other participants.
     */
    public function isTrashed(): bool
    {
        return $this->trashed_at !== null;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State Mutations
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Record that this participant has left the conversation.
     *
     * Sets left_at to now; they no longer appear in the conversation's active participant list.
     */
    public function markAsLeft(): void
    {
        $this->update(['left_at' => now()]);
    }

    /**
     * Rejoin the conversation after having previously left.
     *
     * Clears left_at so the participant is active again.
     */
    public function rejoin(): void
    {
        $this->update(['left_at' => null]);
    }

    /**
     * Toggle the starred flag and return the resulting new value.
     *
     * Used by the star/unstar inbox action; the boolean return allows
     * the controller to include the new state in the API response immediately.
     */
    public function toggleStar(): bool
    {
        $newValue = ! $this->is_starred;
        $this->update(['is_starred' => $newValue]);

        return $newValue;
    }

    /**
     * Toggle the important flag and return the resulting new value.
     *
     * Works identically to toggleStar() — flip the flag and report back.
     */
    public function toggleImportant(): bool
    {
        $newValue = ! $this->is_important;
        $this->update(['is_important' => $newValue]);

        return $newValue;
    }

    /**
     * Move this conversation to the user's trash folder.
     *
     * Sets trashed_at to now. The conversation is still in the database and
     * visible to other participants — this only affects this user's folder view.
     */
    public function trash(): void
    {
        $this->update(['trashed_at' => now()]);
    }

    /**
     * Restore this conversation from the user's trash folder.
     *
     * Clears trashed_at so the conversation reappears in the inbox.
     */
    public function restore(): void
    {
        $this->update(['trashed_at' => null]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: only participant records where the user has trashed the conversation.
     */
    public function scopeTrashed($query)
    {
        return $query->whereNotNull('trashed_at');
    }

    /**
     * Scope: only participant records where the conversation is NOT trashed for this user.
     */
    public function scopeNotTrashed($query)
    {
        return $query->whereNull('trashed_at');
    }

    /**
     * Scope: only participants who are currently active (have not left).
     */
    public function scopeActive($query)
    {
        return $query->whereNull('left_at');
    }

    /**
     * Scope: only participants who have left the conversation.
     */
    public function scopeLeft($query)
    {
        return $query->whereNotNull('left_at');
    }

    /**
     * Scope: filter to a specific conversation by ID.
     *
     * Useful when building queries like "all active participants in conversation 42".
     */
    public function scopeForConversation($query, int $conversationId)
    {
        return $query->where('conversation_id', $conversationId);
    }

    /**
     * Scope: filter to a specific user by ID.
     *
     * Useful when building queries like "all conversations this user is part of".
     */
    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
