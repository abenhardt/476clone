<?php

namespace App\Models;

use App\Enums\SupervisionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Camper model — represents a child who attends one or more camp sessions.
 *
 * A Camper is always owned by a User (parent or guardian). Campers can have
 * applications, a medical record, allergies, medications, diagnoses, emergency
 * contacts, and more. Each of these is stored in a separate table and linked
 * back here via the camper_id foreign key.
 *
 * HIPAA / record retention:
 *  - SoftDeletes is used so a "deleted" camper is only flagged with deleted_at
 *    and never physically removed from the database. This satisfies medical
 *    record retention regulations (records must be kept for years after camp).
 *  - The record_retention_until date marks when it is finally safe to purge.
 */
class Camper extends Model
{
    // SoftDeletes adds the deleted_at timestamp and scopes all queries to
    // exclude soft-deleted rows automatically, keeping PHI intact.
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',             // Foreign key — the parent/guardian account that owns this camper.
        'first_name',
        'last_name',
        'preferred_name',      // Nickname or preferred first name used at camp.
        'date_of_birth',
        'gender',
        'tshirt_size',
        'county',              // County of residence — used for CYSHCN program eligibility tracking.
        'needs_interpreter',   // True if a language interpreter is required during camp.
        'preferred_language',  // Primary language when needs_interpreter is true.
        // Form parity fields (2026_03_26_000004) — applicant mailing address
        'applicant_address',   // Applicant's own mailing address (may differ from guardian — encrypted PHI).
        'applicant_city',
        'applicant_state',
        'applicant_zip',
        'supervision_level',   // Enum — how much extra supervision this camper needs.
        'record_retention_until', // Date after which the record may be permanently deleted.
        'is_active',           // True when camper has at least one approved application and is operationally active.
    ];

    /**
     * Attributes hidden from array/JSON serialization.
     *
     * PHI fields that are encrypted at rest are excluded from list responses
     * to prevent DecryptException when rows contain plain-text values (e.g.
     * from seeders that bypass Eloquent) and to avoid exposing address PHI
     * in endpoints that never need it.
     *
     * @var list<string>
     */
    protected $hidden = ['applicant_address'];

    /**
     * Virtual attributes appended to the model's array/JSON representation.
     *
     * 'full_name' is computed from first_name + last_name and added automatically
     * whenever this model is serialized to JSON (e.g. in an API response).
     *
     * @var list<string>
     */
    protected $appends = ['full_name'];

    /**
     * Get the attributes that should be cast.
     *
     * Casting converts raw database column values to the correct PHP types.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Carbon date objects make age calculations easy (e.g. diffInYears).
            'date_of_birth' => 'date',
            'record_retention_until' => 'date',
            // Maps the stored string to a SupervisionLevel enum instance.
            'supervision_level' => SupervisionLevel::class,
            // Operational activation flag — true when camper has an approved application.
            'is_active' => 'boolean',
            'needs_interpreter' => 'boolean',
            // Applicant mailing address is PHI — encrypted at rest.
            'applicant_address' => 'encrypted',
        ];
    }

    /**
     * Get the user (parent/guardian) who manages this camper.
     *
     * Every camper must be owned by exactly one User account.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all applications submitted for this camper.
     *
     * One camper can apply to many camp sessions over the years.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get the camper's full name as a single concatenated string.
     *
     * Appended as 'full_name' in JSON, so the frontend never has to combine
     * the two fields itself. E.g. "Jane Doe".
     */
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Calculate the camper's age as of a specific date.
     *
     * Useful for checking whether a camper meets the min/max age requirements
     * of a particular camp session at the time the session starts.
     */
    public function ageAsOf(\DateTimeInterface $date): int
    {
        // diffInYears counts only complete years between two dates.
        return $this->date_of_birth->diffInYears($date);
    }

    /**
     * Get the camper's single medical record.
     *
     * Each camper has at most one MedicalRecord row (HasOne = one-to-one).
     * Access via $camper->medicalRecord.
     */
    public function medicalRecord(): HasOne
    {
        return $this->hasOne(MedicalRecord::class);
    }

    /**
     * Get all emergency contacts for this camper.
     *
     * These are the people to call if something goes wrong at camp.
     */
    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmergencyContact::class);
    }

    /**
     * Get all allergies recorded for this camper.
     */
    public function allergies(): HasMany
    {
        return $this->hasMany(Allergy::class);
    }

    /**
     * Get all medications this camper takes.
     */
    public function medications(): HasMany
    {
        return $this->hasMany(Medication::class);
    }

    /**
     * Get all medical diagnoses for this camper.
     */
    public function diagnoses(): HasMany
    {
        return $this->hasMany(Diagnosis::class);
    }

    /**
     * Get the behavioral profile for this camper.
     *
     * A behavioral profile captures communication styles, triggers, and
     * de-escalation strategies for campers with behavioral support needs.
     */
    public function behavioralProfile(): HasOne
    {
        return $this->hasOne(BehavioralProfile::class);
    }

    /**
     * Get the feeding plan for this camper.
     *
     * A feeding plan documents dietary instructions and mealtime assistance
     * requirements for campers with special feeding needs.
     */
    public function feedingPlan(): HasOne
    {
        return $this->hasOne(FeedingPlan::class);
    }

    /**
     * Get the personal care plan for this camper (ADL assistance levels).
     *
     * One record per camper — created during the application form submission.
     */
    public function personalCarePlan(): HasOne
    {
        return $this->hasOne(PersonalCarePlan::class);
    }

    /**
     * Get all documents uploaded for this camper (immunization records, physical exam, etc.).
     *
     * Documents are uploaded via the polymorphic documentable relationship during
     * the application form submission. They are attached to the Camper (not the Application)
     * so that DocumentEnforcementService can find them for compliance checking.
     */
    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'documentable');
    }

    /**
     * Get all assistive devices used by this camper (wheelchairs, hearing aids, etc.).
     */
    public function assistiveDevices(): HasMany
    {
        return $this->hasMany(AssistiveDevice::class);
    }

    /**
     * Get all activity-specific permissions granted for this camper.
     *
     * Activity permissions record which camp activities a camper may or may
     * not participate in, based on medical or parental restrictions.
     */
    public function activityPermissions(): HasMany
    {
        return $this->hasMany(ActivityPermission::class);
    }

    /**
     * Determine whether any of this camper's allergies need immediate medical attention.
     *
     * Returns true if at least one allergy is classified as severe or life-threatening,
     * which should trigger a warning on dashboards and during application review.
     *
     * PERFORMANCE: If the allergies relationship is already eager-loaded (e.g. via
     * Camper::with('allergies')->get()), this avoids an extra database query. Always
     * eager-load allergies when checking this across a list of campers.
     */
    public function requiresImmediateAttention(): bool
    {
        // Use the already-loaded collection to avoid an extra query (N+1 prevention).
        $allergies = $this->relationLoaded('allergies')
            ? $this->allergies
            : $this->allergies()->get();

        // contains() iterates the collection and returns true if any item matches.
        return $allergies->contains(
            fn ($allergy) => $allergy->requiresImmediateAttention()
        );
    }

    /**
     * Get all medical incidents recorded for this camper (injuries, allergic reactions, etc.).
     */
    public function incidents(): HasMany
    {
        return $this->hasMany(MedicalIncident::class);
    }

    /**
     * Get all medical follow-up tasks assigned for this camper.
     */
    public function followUps(): HasMany
    {
        return $this->hasMany(MedicalFollowUp::class);
    }

    /**
     * Get all medical visits (sick bay encounters) for this camper.
     */
    public function visits(): HasMany
    {
        return $this->hasMany(MedicalVisit::class);
    }

    /**
     * Get all active medical restrictions for this camper.
     *
     * Restrictions limit participation in specific activities or environments
     * (e.g. "no swimming", "must stay in shade") based on medical need.
     */
    public function restrictions(): HasMany
    {
        return $this->hasMany(MedicalRestriction::class);
    }

    /**
     * Query scope — filter only operationally active campers.
     *
     * An active camper has at least one approved application and should appear
     * in admin rosters, medical queues, and all operational views.
     *
     * Usage: Camper::active()->get()
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
