<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Deadline — single source of truth for all time-based enforcement in the system.
 *
 * Every deadline is session-scoped and optionally entity-scoped:
 *   entity_id = null         → applies to ALL entities of entity_type in this session
 *   entity_id = <some id>    → applies ONLY to that specific record
 *
 * Enforcement flow:
 *   1. DeadlineService::resolveEnforcement() finds the most specific deadline for an entity.
 *   2. It calls isBlocked() on that deadline.
 *   3. Based on enforcement_mode, the caller either returns HTTP 422 (hard) or a warning flag (soft).
 *
 * Calendar sync:
 *   Every write (create/update/softDelete) fires DeadlineObserver, which calls
 *   DeadlineCalendarSyncService to maintain an exactly-corresponding CalendarEvent.
 *
 * Status column:
 *   Updated by the daily SyncDeadlineStatuses artisan command.
 *   Do NOT rely on status for real-time enforcement — use isOverdue() instead,
 *   which computes directly from due_date and grace_period_days.
 */
class Deadline extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'camp_session_id',
        'entity_type',
        'entity_id',
        'title',
        'description',
        'due_date',
        'grace_period_days',
        'status',
        'is_enforced',
        'enforcement_mode',
        'is_visible_to_applicants',
        'override_note',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'datetime',
            'grace_period_days' => 'integer',
            'is_enforced' => 'boolean',
            'is_visible_to_applicants' => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────────────────

    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'camp_session_id');
    }

    /** The auto-managed calendar event that mirrors this deadline. */
    public function calendarEvent(): HasOne
    {
        return $this->hasOne(CalendarEvent::class, 'deadline_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // ── Core Deadline Logic ────────────────────────────────────────────────────

    /**
     * The date at which enforcement actually kicks in.
     * Adds the grace period on top of the raw due_date.
     */
    public function effectiveDueDate(): Carbon
    {
        return $this->due_date->copy()->addDays($this->grace_period_days);
    }

    /**
     * Returns true when the effective due date has passed AND the deadline is not completed.
     *
     * Uses real-time calculation — do not use $this->status for enforcement.
     */
    public function isOverdue(): bool
    {
        return $this->status !== 'completed'
            && now()->isAfter($this->effectiveDueDate());
    }

    /**
     * Returns true when an enforced deadline is overdue.
     * This is the gate used by DeadlineService::resolveEnforcement().
     */
    public function isBlocked(): bool
    {
        return $this->is_enforced && $this->isOverdue();
    }

    /**
     * Days remaining until the effective due date.
     * Negative when overdue.
     */
    public function daysUntilDue(): int
    {
        return (int) now()->diffInDays($this->effectiveDueDate(), false);
    }

    /**
     * Three-level urgency used by the frontend color system and dashboard widgets.
     *
     * Returns:
     *   'overdue'    → red    (past effectiveDueDate)
     *   'approaching' → yellow (within 7 days)
     *   'safe'        → green  (more than 7 days away)
     *   'completed'   → gray
     */
    public function urgencyLevel(): string
    {
        if ($this->status === 'completed') {
            return 'completed';
        }

        $days = $this->daysUntilDue();

        if ($days < 0) {
            return 'overdue';
        }

        if ($days <= 7) {
            return 'approaching';
        }

        return 'safe';
    }

    // ── Query Scopes ───────────────────────────────────────────────────────────

    /** Deadlines visible to applicants (not internal-only). */
    public function scopeVisible(Builder $query): Builder
    {
        return $query->where('is_visible_to_applicants', true);
    }

    /** Deadlines for a specific camp session. */
    public function scopeForSession(Builder $query, int $sessionId): Builder
    {
        return $query->where('camp_session_id', $sessionId);
    }

    /** Session-wide deadlines (no specific entity target). */
    public function scopeSessionWide(Builder $query): Builder
    {
        return $query->whereNull('entity_id');
    }

    /** Deadlines targeting a specific entity. */
    public function scopeForEntity(Builder $query, string $type, int $id): Builder
    {
        return $query->where('entity_type', $type)->where('entity_id', $id);
    }

    /** Active (non-completed, non-deleted) deadlines. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed');
    }

    /** Deadlines that are currently past their effective due date. */
    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed')
            ->where(fn (Builder $q) => $q
                ->whereRaw('DATE_ADD(due_date, INTERVAL grace_period_days DAY) < NOW()')
            );
    }

    /** Deadlines due within the next N days. */
    public function scopeUpcoming(Builder $query, int $days = 30): Builder
    {
        return $query
            ->where('status', '!=', 'completed')
            ->where('due_date', '>=', now())
            ->where('due_date', '<=', now()->addDays($days));
    }

    // ── API Shape ──────────────────────────────────────────────────────────────

    /**
     * Serialises the deadline into the standard API response array.
     * Used by DeadlineController to keep response shape consistent.
     *
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'camp_session_id' => $this->camp_session_id,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'title' => $this->title,
            'description' => $this->description,
            'due_date' => $this->due_date->toIso8601String(),
            'effective_due_date' => $this->effectiveDueDate()->toIso8601String(),
            'grace_period_days' => $this->grace_period_days,
            'days_until_due' => $this->daysUntilDue(),
            'urgency_level' => $this->urgencyLevel(),
            'status' => $this->status,
            'is_enforced' => $this->is_enforced,
            'enforcement_mode' => $this->enforcement_mode,
            'is_visible_to_applicants' => $this->is_visible_to_applicants,
            'override_note' => $this->override_note,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
