<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\SubmissionSource;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Application model — records a camper's request to attend a specific camp session.
 *
 * The lifecycle of an application moves through several states:
 *   draft → submitted → under_review → approved / waitlisted / denied
 *
 * Key design points:
 *  - is_draft lets parents save progress before final submission.
 *  - signature_data stores the legal consent signature and is hidden from API
 *    responses to avoid exposing the raw image/base64 blob unnecessarily.
 *  - Documents (medical forms, permission slips) attach to an application via a
 *    polymorphic relationship so one Document model serves multiple owner types.
 *  - 'session' is exposed as a virtual attribute alias of campSession so the
 *    frontend can use application.session everywhere consistently.
 *
 * @property ApplicationStatus $status
 * @property SubmissionSource|null $submission_source
 * @property Camper|null $camper
 */
class Application extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',            // Which camper this application is for.
        'camp_session_id',      // Which specific session they want to attend.
        'form_definition_id',   // FK to the form version active at submission time (nullable; null = pre-Phase 14).
        'status',               // Current workflow state (ApplicationStatus enum).
        'is_draft',                    // True while the parent is still filling it out.
        'is_incomplete_at_approval',  // True when admin overrode missing-data warning on approval.
        'submitted_at',         // Timestamp when the parent officially submitted.
        'reviewed_at',          // Timestamp when an admin completed their review.
        'reviewed_by',          // FK to the User who performed the review.
        'notes',                // Admin notes visible only internally.
        'signature_data',       // Raw signature image/data — hidden from API output.
        'signature_name',       // Typed name accompanying the signature.
        'signed_at',            // When the signature was captured.
        'signed_ip_address',    // IP address for legal proof of consent.
        'reapplied_from_id',    // FK to the application this was cloned from (null for new applications).
        // Narrative responses from Section "About Your Camper" (Phase 2)
        'narrative_rustic_environment',
        'narrative_staff_suggestions',
        'narrative_participation_concerns',
        'narrative_camp_benefit',
        'narrative_heat_tolerance',
        'narrative_transportation',
        'narrative_additional_info',
        'narrative_emergency_protocols',
        // Form parity fields (2026_03_26_000002)
        'first_application',
        'attended_before',
        'camp_session_id_second',
        // Submission provenance (2026_04_10_000001)
        'submission_source',    // SubmissionSource enum: digital | paper_self | paper_admin
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Automatically resolves the stored string to an ApplicationStatus enum value.
            'status' => ApplicationStatus::class,
            'submission_source' => SubmissionSource::class,
            'is_draft' => 'boolean',
            'is_incomplete_at_approval' => 'boolean',
            'first_application' => 'boolean',
            'attended_before' => 'boolean',
            // Carbon datetime objects for easy comparison and formatting.
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'signed_at' => 'datetime',
        ];
    }

    /**
     * The attributes that should be hidden for serialization.
     *
     * signature_data is hidden so the raw consent image is never leaked in an
     * API response. It can be accessed directly on the model when truly needed.
     *
     * @var list<string>
     */
    protected $hidden = [
        'signature_data',
    ];

    /**
     * Virtual attributes appended to JSON/array output.
     *
     * 'session'            — alias for campSession so the frontend uses application.session everywhere.
     * 'application_number' — human-readable public identifier (CBG-YYYY-NNN); never exposes the DB id.
     *
     * 'queue_position' is intentionally NOT listed here — it executes two COUNT queries per call
     * and would create an N+1 problem on the list endpoint. Append it explicitly only in show().
     *
     * @var list<string>
     */
    protected $appends = ['session', 'application_number'];

    /**
     * Get documents attached to this application (polymorphic).
     *
     * MorphMany means Document rows can belong to ANY model type, not just Application.
     * The 'documentable' morph name is stored as documentable_type + documentable_id
     * in the documents table.
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'documentable');
    }

    /**
     * Get the guardian consent records for this application.
     *
     * Each submitted application has 7 consent records, one per type:
     * general, photos, liability, activity, authorization, medication, hipaa.
     */
    public function consents(): HasMany
    {
        return $this->hasMany(ApplicationConsent::class);
    }

    /**
     * Get the application this was cloned from, if any.
     *
     * Returns null for applications that were not created via the reapplication flow.
     */
    public function originalApplication(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'reapplied_from_id');
    }

    /**
     * Get the camper this application was submitted for.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the camp session this application is requesting enrollment in.
     */
    public function campSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class);
    }

    /**
     * Expose campSession data under the key 'session' in JSON output.
     *
     * getRelationValue() returns the already-loaded relation without triggering
     * a new query, keeping this accessor safe to call inside loops.
     */
    public function getSessionAttribute(): mixed
    {
        return $this->getRelationValue('campSession');
    }

    /**
     * Human-readable public application identifier.
     *
     * Format: CBG-{YEAR}-{NNN}
     *   CBG  — Camp Burnt Gin prefix; distinguishes this system from others.
     *   YEAR — 4-digit year from submitted_at, or created_at for drafts.
     *   NNN  — Zero-padded database id (minimum 3 digits; auto-extends for larger ids).
     *
     * This is the identifier shown in all user-facing UI. The DB primary key (id)
     * is never surfaced directly — it is only used internally for routing and foreign keys.
     *
     * Safe to include in $appends: zero DB queries, pure in-memory computation.
     */
    public function getApplicationNumberAttribute(): string
    {
        $year = ($this->submitted_at ?? $this->created_at)->format('Y');

        return sprintf('CBG-%s-%03d', $year, $this->id);
    }

    /**
     * Dynamic queue position within the current camp session.
     *
     * Returns the application's ordinal position among all active (non-final) submitted
     * applications in the same session, ordered by submission timestamp with id as tiebreaker.
     * Also returns the total active queue size so the UI can display "3 of 47 pending".
     *
     * Returns null for drafts and un-submitted applications (they are not in the queue).
     *
     * ⚠ NOT in $appends — executes 2 COUNT queries. Call via ->append('queue_position')
     *   only on single-record detail fetches (show()), never on list endpoints.
     *
     * Active statuses: submitted, under_review, waitlisted (approved/rejected/cancelled/withdrawn
     * are terminal — those applications have left the queue).
     */
    public function getQueuePositionAttribute(): ?array
    {
        if ($this->is_draft || ! $this->submitted_at) {
            return null;
        }

        $activeStatuses = ['submitted', 'under_review', 'waitlisted'];

        // Count how many active applications in this session were submitted before this one.
        // Tie-break by id ASC so the result is deterministic when two apps share a timestamp.
        $ahead = Application::where('camp_session_id', $this->camp_session_id)
            ->whereIn('status', $activeStatuses)
            ->where('is_draft', false)
            ->where(function ($q) {
                $q->where('submitted_at', '<', $this->submitted_at)
                    ->orWhere(function ($inner) {
                        $inner->where('submitted_at', $this->submitted_at)
                            ->where('id', '<', $this->id);
                    });
            })
            ->count();

        $total = Application::where('camp_session_id', $this->camp_session_id)
            ->whereIn('status', $activeStatuses)
            ->where('is_draft', false)
            ->count();

        return [
            'position' => $ahead + 1,
            'total' => $total,
        ];
    }

    /**
     * Get the admin user who reviewed this application.
     *
     * Uses 'reviewed_by' as the foreign key instead of the default 'user_id'.
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Get the second-choice camp session for this application.
     *
     * Populated by the application form when the parent selects a fallback session.
     * Null when no second choice was provided. The foreign key (camp_session_id_second)
     * uses nullOnDelete so this becomes null if that session is ever deleted.
     */
    public function secondSession(): BelongsTo
    {
        return $this->belongsTo(CampSession::class, 'camp_session_id_second');
    }

    /**
     * Get the form definition version that was active when this application was submitted.
     *
     * Null means the application predates the dynamic form system (Phase 14).
     * Those applications are rendered using the current active definition for display.
     */
    public function formDefinition(): BelongsTo
    {
        return $this->belongsTo(FormDefinition::class);
    }

    /**
     * Determine if an admin has already reviewed this application.
     */
    public function isReviewed(): bool
    {
        // reviewed_at is only set once the admin records a decision.
        return $this->reviewed_at !== null;
    }

    /**
     * Determine if the application status is terminal (cannot change further).
     *
     * Delegates to the ApplicationStatus enum so the business rule lives in one place.
     */
    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    /**
     * Determine if the application can still be edited by the parent.
     *
     * Returns true when the application is in any of these states:
     *   - Draft (is_draft = true): parent is still filling out the form
     *   - Pending: submitted but awaiting admin review
     *   - UnderReview: actively being reviewed by camp staff
     *
     * Allowing edits during Pending and UnderReview is intentional — parents
     * may need to correct or add information while awaiting a decision.
     * Once a final status is set (Approved, Rejected, Waitlisted, Cancelled,
     * Withdrawn) the application is locked and returns false.
     */
    public function isEditable(): bool
    {
        return $this->is_draft || $this->status->isEditable();
    }

    /**
     * Determine if this application is still a draft (not yet submitted).
     */
    public function isDraft(): bool
    {
        return $this->is_draft === true;
    }

    /**
     * Determine if the legal consent signature has been collected.
     */
    public function isSigned(): bool
    {
        return $this->signed_at !== null;
    }

    /**
     * Query scope — filter only draft (unsubmitted) applications.
     *
     * Usage: Application::draft()->get()
     */
    public function scopeDraft($query)
    {
        return $query->where('is_draft', true);
    }

    /**
     * Query scope — filter only formally submitted applications.
     *
     * Both conditions are required: is_draft must be false AND
     * submitted_at must be set (guards against partially-updated rows).
     */
    public function scopeSubmitted($query)
    {
        return $query->where('is_draft', false)->whereNotNull('submitted_at');
    }

    /**
     * Query scope — filter applications by a specific status value.
     *
     * Accepts either the enum instance or a raw string value so callers
     * are not forced to import the enum when building dynamic queries.
     */
    public function scopeWithStatus($query, ApplicationStatus|string $status)
    {
        // Normalise enum to its raw database string before passing to the query.
        $statusValue = $status instanceof ApplicationStatus ? $status->value : $status;

        return $query->where('status', $statusValue);
    }
}
