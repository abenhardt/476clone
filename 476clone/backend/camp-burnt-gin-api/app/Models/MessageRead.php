<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * MessageRead model — read receipts that track when each user first views a message.
 *
 * Every time a user opens a message for the first time, one MessageRead record is
 * created linking that user to that message. The absence of a MessageRead record
 * means the message is "unread" for that user.
 *
 * This model only records the first read — subsequent views do not create new records.
 * The unread count for an inbox or conversation is derived by counting messages that
 * lack a corresponding MessageRead for the requesting user.
 *
 * Relationships:
 *   - belongs to Message
 *   - belongs to User
 *
 * Scopes: forMessage(), byUser()
 */
class MessageRead extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'message_id',
        'user_id',
        'read_at',
    ];

    /**
     * Cast field types for correct PHP representations.
     *
     * "read_at" becomes a Carbon instance so it can be formatted for API responses
     * (e.g., "Read 2 hours ago").
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Carbon instance — enables human-readable relative timestamps
            'read_at' => 'datetime',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the message this read receipt is for.
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * Get the user who read this message.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: filter read receipts to a specific message.
     *
     * Useful for listing all users who have read a given message.
     */
    public function scopeForMessage($query, int $messageId)
    {
        return $query->where('message_id', $messageId);
    }

    /**
     * Scope: filter read receipts to a specific user.
     *
     * Useful for checking whether a particular user has read a set of messages.
     */
    public function scopeByUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }
}
