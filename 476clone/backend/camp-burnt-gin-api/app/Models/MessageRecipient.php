<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * MessageRecipient — per-message TO/CC/BCC recipient record.
 *
 * Each row represents one user's receipt type for one specific message.
 * A user may appear at most once per message (enforced by UNIQUE constraint).
 *
 * Key invariant:
 *   BCC rows in this table must NEVER be included in API responses to any user
 *   other than the original sender of that message. All response shaping that
 *   exposes recipients must call Message::getRecipientsForUser() to enforce this.
 *
 * Relationship to conversation_participants:
 *   - conversation_participants = who can ACCESS the thread (access control layer)
 *   - message_recipients = what TYPE each person was in a specific message (display layer)
 *   These are separate concerns. A participant may have no row here for older messages
 *   that predate the TO/CC/BCC feature; those messages treat everyone as implicit TO.
 */
class MessageRecipient extends Model
{
    protected $fillable = [
        'message_id',
        'user_id',
        'recipient_type', // 'to' | 'cc' | 'bcc'
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    /**
     * The message this recipient entry belongs to.
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * The user who received this message as TO/CC/BCC.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    // ── Scopes ────────────────────────────────────────────────────────────────

    /** Filter to only TO recipients. */
    public function scopeTo($query)
    {
        return $query->where('recipient_type', 'to');
    }

    /** Filter to only CC recipients. */
    public function scopeCc($query)
    {
        return $query->where('recipient_type', 'cc');
    }

    /** Filter to only BCC recipients. */
    public function scopeBcc($query)
    {
        return $query->where('recipient_type', 'bcc');
    }

    /** Filter to only visible (non-BCC) recipients — safe for non-sender API responses. */
    public function scopeVisible($query)
    {
        return $query->whereIn('recipient_type', ['to', 'cc']);
    }

    /** Filter to unread recipient entries. */
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }
}
