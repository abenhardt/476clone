<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * CalendarEvent model — camp deadlines, sessions, orientations, and internal events.
 *
 * Events have a type (from TYPES constant), an optional end time, an all-day flag,
 * and an audience that controls which user roles can see them. Admins see everything;
 * non-admin users only see "all"-audience events.
 *
 * IMPORTANT — deadline events are managed exclusively by DeadlineCalendarSyncService.
 * Calendar events with a deadline_id set:
 *   - Are created/updated/deleted automatically via DeadlineObserver
 *   - Cannot be created manually (CalendarEventController::store() rejects event_type='deadline')
 *   - Cannot be edited or deleted directly through the calendar API
 *
 * Relationships:
 *   - belongs to User (creator via created_by)
 *   - optionally belongs to CampSession (target_session_id)
 *   - optionally belongs to Deadline (deadline_id — set only for deadline-type events)
 *
 * Scopes: upcoming(), inRange(), forAudience()
 */
class CalendarEvent extends Model
{
    protected $fillable = [
        'created_by',
        'title',
        'description',
        'event_type',
        'color',
        'starts_at',
        'ends_at',
        'all_day',
        'audience',
        'target_session_id',
        'deadline_id',
    ];

    /**
     * Cast field types so PHP receives usable objects instead of raw strings.
     *
     * "starts_at" and "ends_at" become Carbon instances for date arithmetic.
     */
    protected function casts(): array
    {
        return [
            // Carbon instances — enables comparison, formatting, and diff calculations
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'all_day' => 'boolean',
        ];
    }

    /**
     * The allowed event type values — enforced at the controller validation layer.
     *
     * This constant is referenced in CalendarEventController to keep validation
     * and the model's domain in sync.
     */
    public const TYPES = ['deadline', 'session', 'orientation', 'staff', 'internal'];

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the user who created this calendar event.
     *
     * Uses the non-default foreign key "created_by" instead of "user_id".
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the camp session this event is associated with (if any).
     *
     * Only session-specific events (audience = "session") will have this set.
     */
    public function targetSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'target_session_id');
    }

    /**
     * The deadline that owns this calendar event.
     *
     * Only present when event_type = 'deadline'. Null for manually-created events
     * of other types (session, orientation, staff, internal).
     */
    public function deadline(): BelongsTo
    {
        return $this->belongsTo(Deadline::class, 'deadline_id');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: return only events starting on or after a given date (defaults to today).
     *
     * Used for "upcoming events" widgets that show what's coming up next.
     */
    public function scopeUpcoming(Builder $query, ?string $from = null): Builder
    {
        // Default to the very start of today so all-day events today are included
        return $query->where('starts_at', '>=', $from ?? now()->startOfDay());
    }

    /**
     * Scope: return events whose start falls within a given date range.
     *
     * Drives month and week calendar views where a specific window is requested.
     */
    public function scopeInRange(Builder $query, string $start, string $end): Builder
    {
        return $query->where('starts_at', '>=', $start)
            ->where('starts_at', '<=', $end);
    }

    /**
     * Scope: filter events visible to a given audience segment.
     *
     * Works identically to Announcement::scopeForAudience — events tagged "all"
     * are visible to everyone, while segment-specific events are filtered.
     */
    public function scopeForAudience(Builder $query, string $audience): Builder
    {
        return $query->where(function (Builder $q) use ($audience) {
            // "all" means every audience can see it; otherwise match the exact segment
            $q->where('audience', 'all')->orWhere('audience', $audience);
        });
    }
}
