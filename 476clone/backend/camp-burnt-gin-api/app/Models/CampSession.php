<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * CampSession model — a specific, scheduled run of a Camp program.
 *
 * While Camp is the program (e.g. "Burnt Gin Summer Camp"), a CampSession is a
 * concrete occurrence with real dates and limits (e.g. "Session A — June 9-15, 2026").
 * Parents browse sessions, pick one, and submit an Application for their camper.
 *
 * Key session constraints:
 *  - capacity      : Maximum number of enrolled campers.
 *  - min_age/max_age: Age window checked at session start_date via Camper::ageAsOf().
 *  - registration_opens_at / registration_closes_at: The window when applicants can apply.
 *  - is_active: Admins can take a session off the portal without deleting it.
 */
class CampSession extends Model
{
    use HasFactory;

    /**
     * Append computed attributes to every serialized response.
     * `status` is computed (upcoming/open/in_session/closed/completed) and has no DB column.
     *
     * @var list<string>
     */
    protected $appends = ['status'];

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camp_id',                  // The parent Camp this session belongs to.
        'name',                     // Human-readable label (e.g. "Session A").
        'start_date',               // First day of the session.
        'end_date',                 // Last day of the session.
        'capacity',                 // Total spots available.
        'min_age',                  // Minimum camper age (inclusive) at session start.
        'max_age',                  // Maximum camper age (inclusive) at session start.
        'registration_opens_at',    // Date/time applications begin being accepted.
        'registration_closes_at',   // Date/time after which no new applications are accepted.
        'is_active',                // Controls whether the session shows in the portal (archive flag).
        'portal_open',              // Admin-controlled: true = session is accepting applications.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Carbon date objects for start/end enable easy duration and overlap checks.
            'start_date' => 'date',
            'end_date' => 'date',
            // Integer casts ensure arithmetic (e.g. capacity - enrolled) works correctly.
            'capacity' => 'integer',
            'min_age' => 'integer',
            'max_age' => 'integer',
            // Full datetime objects for the registration window (includes time-of-day).
            'registration_opens_at' => 'datetime',
            'registration_closes_at' => 'datetime',
            'is_active' => 'boolean',
            'portal_open' => 'boolean',
        ];
    }

    /**
     * Get the Camp program this session is an instance of.
     */
    public function camp(): BelongsTo
    {
        return $this->belongsTo(Camp::class);
    }

    /**
     * Get all applications submitted for this session.
     *
     * Applications across all status values (draft, submitted, approved, etc.)
     * are returned here. Filter by status using Application scopes as needed.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Scope to only approved (enrolled) applications for this session.
     */
    public function enrolledApplications(): HasMany
    {
        return $this->hasMany(Application::class)->where('status', ApplicationStatus::Approved->value);
    }

    /**
     * Count of approved (enrolled) campers for this session.
     *
     * Uses the already-eager-loaded withCount result when available (set by
     * CampController::index() via withCount(['applications as enrolled_count'])).
     * Falls back to a direct COUNT query only when not pre-loaded.
     */
    public function getEnrolledCountAttribute(): int
    {
        // withCount attaches the result as an integer attribute named enrolled_count.
        // Use it when present to avoid an extra query.
        if (array_key_exists('enrolled_count', $this->attributes)) {
            return (int) $this->attributes['enrolled_count'];
        }

        return $this->applications()
            ->where('status', ApplicationStatus::Approved->value)
            ->count();
    }

    /**
     * Remaining spots available in this session.
     */
    public function getRemainingCapacityAttribute(): int
    {
        return max(0, $this->capacity - $this->enrolled_count);
    }

    /**
     * Whether this session has reached its maximum capacity.
     */
    public function isAtCapacity(): bool
    {
        return $this->enrolled_count >= $this->capacity;
    }

    /**
     * Deterministic session status — combines camp schedule (ground truth) with
     * the admin-controlled application window.
     *
     * Priority order (highest → lowest):
     *   1. completed  — today is after end_date (immutable, cannot be overridden)
     *   2. in_session — today is on or after start_date (camp is happening; apps blocked)
     *   3. open       — portal_open=true and registration window has not closed
     *   4. closed     — portal_open=true but registration_closes_at has passed
     *   5. upcoming   — default; portal not open, camp hasn't started
     *
     * This is independent of `is_active` (which controls portal visibility / archival).
     * start_date and end_date are NEVER modified by application-window actions.
     */
    public function getStatusAttribute(): string
    {
        $today = today();   // Date-only — matches the 'date' cast on start_date / end_date.
        $now = now();     // Full datetime — used for registration_closes_at comparison.

        // ── Camp schedule: ground truth, no override possible ─────────────────
        if ($today->gt($this->end_date)) {
            return 'completed';
        }

        if ($today->greaterThanOrEqualTo($this->start_date)) {
            return 'in_session';
        }

        // ── Admin-controlled application window ───────────────────────────────
        if ($this->portal_open) {
            if ($this->registration_closes_at !== null && $now->gt($this->registration_closes_at)) {
                return 'closed';
            }

            return 'open';
        }

        return 'upcoming';
    }
}
