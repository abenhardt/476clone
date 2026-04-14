<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Announcement model — system-wide and session-specific notices posted by admins.
 *
 * Announcements can be targeted at different audiences (all users, accepted camper families,
 * staff only, or a specific session). They support scheduled publishing (published_at in the
 * future means "draft"), urgent flagging, and pinning to keep important items at the top.
 *
 * Relationships:
 *   - belongs to User (author)
 *   - optionally belongs to CampSession (target_session_id)
 *
 * Scopes: published(), ordered(), forAudience()
 */
class Announcement extends Model
{
    protected $fillable = [
        'author_id',
        'title',
        'body',
        'is_pinned',
        'is_urgent',
        'audience',
        'target_session_id',
        'published_at',
    ];

    /**
     * Cast types for Announcement fields.
     *
     * "published_at" becomes a Carbon date object so we can call ->isPast(), ->format(), etc.
     */
    protected function casts(): array
    {
        return [
            'is_pinned' => 'boolean',
            'is_urgent' => 'boolean',
            // Carbon instance — enables date comparison in the published() scope
            'published_at' => 'datetime',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the admin user who authored this announcement.
     *
     * Uses the non-default foreign key "author_id" instead of "user_id".
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Get the specific camp session this announcement targets (if any).
     *
     * Returns null for announcements that target all sessions ("all" audience).
     */
    public function targetSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'target_session_id');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: only return announcements that have been published (published_at is set and in the past).
     *
     * Announcements with a future published_at are treated as scheduled drafts and stay hidden.
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /**
     * Scope: order results so pinned announcements appear first, then by most recent published_at.
     *
     * This ensures pinned urgent items always float to the top of the list.
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderByDesc('is_pinned')->orderByDesc('published_at');
    }

    /**
     * Scope: filter announcements visible to a given audience segment.
     *
     * Returns announcements targeted at "all" users OR announcements specifically
     * targeting the provided audience string (e.g., "accepted", "staff").
     */
    public function scopeForAudience(Builder $query, string $audience): Builder
    {
        return $query->where(function (Builder $q) use ($audience) {
            // "all" audience announcements are visible to everyone
            $q->where('audience', 'all')->orWhere('audience', $audience);
        });
    }
}
