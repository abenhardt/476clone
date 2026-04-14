<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Conversation model — represents a message thread between one or more users.
 *
 * Conversations are the "folders" that hold Message records. A conversation can
 * optionally be linked to an Application, a Camper, or a CampSession, giving
 * staff context about why the thread was created.
 *
 * Two conversation types exist:
 *  1. User conversations — created by a human, fully replyable.
 *  2. System-generated conversations — created automatically by backend events
 *     (e.g. "Your application status changed to Approved"). These are read-only
 *     notification threads; is_system_generated = true.
 *
 * Soft deletes are used so that deleted conversations can be recovered and
 * so that message history is never physically destroyed.
 *
 * Access control:
 *  - ConversationPolicy enforces RBAC on every action.
 *  - Participants are tracked in the conversation_participants pivot table.
 *    A user is "active" in a conversation while their left_at is NULL.
 */
class Conversation extends Model
{
    // SoftDeletes adds deleted_at; deleted conversations are hidden from queries
    // but retained in the database for audit and recovery purposes.
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'created_by_id',         // FK — the User who opened this thread.
        'subject',               // Thread subject line shown in the inbox.
        'category',              // Optional grouping label (e.g. "Medical", "Registration").
        'application_id',        // Optional FK — links thread to a specific Application.
        'camper_id',             // Optional FK — links thread to a specific Camper.
        'camp_session_id',       // Optional FK — links thread to a specific CampSession.
        'last_message_at',       // Denormalised timestamp updated on each new message for fast sorting.
        'is_archived',           // Soft-archive flag; archived threads are hidden from the inbox.
        // System notification fields (only set when is_system_generated = true):
        'is_system_generated',   // True for auto-created notification threads.
        'system_event_type',     // Machine-readable event identifier (e.g. "application.approved").
        'system_event_category', // Display category for grouping in the notifications panel.
        'related_entity_type',   // Class name of the entity that triggered the event.
        'related_entity_id',     // Primary key of the triggering entity.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'is_archived' => 'boolean',
            'is_system_generated' => 'boolean',
        ];
    }

    /**
     * Get the user who created (started) this conversation.
     *
     * The FK column is 'created_by_id', not the default 'user_id'.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    /**
     * Get the Application this conversation is linked to (if any).
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the Camper this conversation is linked to (if any).
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the CampSession this conversation is linked to (if any).
     */
    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class);
    }

    /**
     * Get all messages in this conversation, ordered chronologically.
     *
     * Messages are ordered oldest-first (ascending created_at) so they display
     * in natural reading order in the thread view.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    /**
     * Get only the most recent message in this conversation.
     *
     * latestOfMany() produces a single-row HasOne using a MAX(created_at) subquery
     * so it works correctly with eager loading across many conversations.
     */
    public function lastMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Get all active participant User models via the pivot table.
     *
     * This is a HasManyThrough that jumps from Conversation → ConversationParticipant → User.
     * The whereNull('left_at') clause filters out users who have left the thread.
     */
    public function participants(): HasManyThrough
    {
        return $this->hasManyThrough(
            User::class,
            ConversationParticipant::class,
            'conversation_id', // FK on conversation_participants pointing to conversations.
            'id',              // PK on users table.
            'id',              // PK on conversations table.
            'user_id'          // FK on conversation_participants pointing to users.
        )->whereNull('conversation_participants.left_at');
    }

    /**
     * Get all ConversationParticipant pivot rows (including those who have left).
     *
     * Use this when you need the full history of who joined the thread, including
     * timestamps for joined_at and left_at.
     */
    public function participantRecords(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    /**
     * Get only ConversationParticipant rows for users still in the thread.
     *
     * left_at being NULL means the user has not left — they are currently active.
     */
    public function activeParticipantRecords(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class)->whereNull('left_at');
    }

    /**
     * Determine if this conversation is associated with an Application.
     */
    public function isLinkedToApplication(): bool
    {
        return $this->application_id !== null;
    }

    /**
     * Determine if this conversation is associated with a Camper.
     */
    public function isLinkedToCamper(): bool
    {
        return $this->camper_id !== null;
    }

    /**
     * Determine if this conversation is associated with a CampSession.
     */
    public function isLinkedToCampSession(): bool
    {
        return $this->camp_session_id !== null;
    }

    /**
     * Determine if a given user is an active participant in this conversation.
     *
     * Checks the pivot table directly rather than loading the full participants
     * collection, so it's efficient even when called many times.
     */
    public function hasParticipant(User $user): bool
    {
        return $this->participantRecords()
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->exists();
    }

    /**
     * Count the number of unread messages for a specific user in this conversation.
     *
     * A message is unread if there is no MessageRead row for the user, and the
     * user did not send the message themselves (you can't "unread" your own post).
     * System messages (sender_id = NULL) count as unread until the user opens them.
     */
    public function getUnreadCountForUser(User $user): int
    {
        return $this->messages()
            // Exclude messages already read by this user.
            ->whereDoesntHave('reads', function ($query) use ($user) {
                $query->where('user_id', $user->id);
            })
            // Also exclude messages the user sent — you can't have unread messages you wrote.
            ->where(function ($q) use ($user) {
                $q->whereNull('sender_id')          // System messages count as unread.
                    ->orWhere('sender_id', '!=', $user->id);
            })
            ->count();
    }

    /**
     * Query scope — filter to conversations where the given user is an active participant.
     *
     * Usage: Conversation::forUser($user)->get()
     */
    public function scopeForUser($query, User $user)
    {
        return $query->whereHas('participantRecords', function ($q) use ($user) {
            $q->where('user_id', $user->id)->whereNull('left_at');
        });
    }

    /**
     * Query scope — filter to non-archived conversations only.
     */
    public function scopeActive($query)
    {
        return $query->where('is_archived', false);
    }

    /**
     * Query scope — filter to archived conversations only.
     */
    public function scopeArchived($query)
    {
        return $query->where('is_archived', true);
    }

    /**
     * Query scope — order results by the most recently active conversation first.
     *
     * Uses the denormalised last_message_at column for performance instead of
     * joining to the messages table on every query.
     */
    public function scopeRecentActivity($query)
    {
        return $query->orderByDesc('last_message_at');
    }

    /**
     * Query scope — filter conversations linked to a specific Application.
     */
    public function scopeForApplication($query, int $applicationId)
    {
        return $query->where('application_id', $applicationId);
    }

    /**
     * Query scope — filter conversations linked to a specific Camper.
     */
    public function scopeForCamper($query, int $camperId)
    {
        return $query->where('camper_id', $camperId);
    }

    /**
     * Query scope — filter conversations linked to a specific CampSession.
     */
    public function scopeForCampSession($query, int $campSessionId)
    {
        return $query->where('camp_session_id', $campSessionId);
    }

    /**
     * Query scope — return only system-generated (automated) notification threads.
     */
    public function scopeSystemGenerated($query)
    {
        return $query->where('is_system_generated', true);
    }

    /**
     * Query scope — return only real user-to-user conversations (not automated).
     */
    public function scopeUserConversations($query)
    {
        return $query->where('is_system_generated', false);
    }

    /**
     * Determine if this is an automated system notification thread.
     *
     * System-generated conversations cannot be replied to by users.
     */
    public function isSystemGenerated(): bool
    {
        return (bool) $this->is_system_generated;
    }
}
