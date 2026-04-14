<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MedicalRecord model — stores the core health summary for one camper.
 *
 * Every camper has exactly one MedicalRecord row (one-to-one with Camper).
 * It holds physician contact details, insurance information, and critical
 * flags like seizure history and neurostimulator presence that affect how
 * camp staff must respond in an emergency.
 *
 * HIPAA / PHI encryption:
 *  - Every column that could identify a person or reveal a health condition
 *    is stored encrypted in the database using Laravel's 'encrypted' cast.
 *  - Even if the database file were stolen, an attacker could not read the
 *    values without the application encryption key (APP_KEY in .env).
 *
 * Note on relationships:
 *  - allergies, medications, and diagnoses are defined here through the shared
 *    camper_id key so that the ApplicationReviewPage can load all health data
 *    from a single medical_record eager load chain. The canonical source of
 *    truth for these collections is still the Camper model.
 */
class MedicalRecord extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        // Physician
        'physician_name',
        'physician_phone',
        'physician_address',        // Mailing address of the attending physician.
        // Insurance
        'insurance_provider',
        'insurance_policy_number',
        'insurance_group',          // Insurance group or employer number.
        'medicaid_number',          // Medicaid recipient ID (encrypted — PHI).
        // General medical notes
        'special_needs',
        'dietary_restrictions',
        'notes',
        'mobility_notes',           // General mobility and transfer observations (from S4).
        // Immunizations
        'immunizations_current',    // True if immunizations are up to date per the physician.
        'tetanus_date',             // Date of most recent tetanus vaccination.
        // Seizure history
        'has_seizures',             // Boolean flag — triggers mandatory seizure action plan check.
        'last_seizure_date',        // Date of most recent known seizure event.
        'seizure_description',      // Description of typical seizure presentation.
        // Other health flags
        'has_neurostimulator',      // Boolean — some equipment interferes with defibrillators.
        'has_contagious_illness',   // Currently has or recently had a contagious illness.
        'contagious_illness_description',
        'tubes_in_ears',            // Tympanostomy tubes in place.
        'has_recent_illness',       // Significant illness within the past 6 months.
        'recent_illness_description',
        // Operational
        'date_of_medical_exam',     // Date on physician-completed Form 4523; drives the 12-month validity window.
        'is_active',                // True when the camper's application is currently approved.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields use Laravel's 'encrypted' cast, which AES-256 encrypts the
     * value before saving and decrypts transparently on read.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Encrypted PHI columns — unreadable in the raw database.
            'physician_name' => 'encrypted',
            'physician_phone' => 'encrypted',
            'physician_address' => 'encrypted',
            'insurance_provider' => 'encrypted',
            'insurance_policy_number' => 'encrypted',
            'insurance_group' => 'encrypted',
            'medicaid_number' => 'encrypted',
            'special_needs' => 'encrypted',
            'dietary_restrictions' => 'encrypted',
            'notes' => 'encrypted',
            'mobility_notes' => 'encrypted',
            'seizure_description' => 'encrypted',
            'contagious_illness_description' => 'encrypted',
            'recent_illness_description' => 'encrypted',
            // Boolean flags stored as 0/1 in MySQL.
            'has_seizures' => 'boolean',
            'has_neurostimulator' => 'boolean',
            'immunizations_current' => 'boolean',
            'has_contagious_illness' => 'boolean',
            'tubes_in_ears' => 'boolean',
            'has_recent_illness' => 'boolean',
            // Carbon date objects for age/duration calculations.
            'last_seizure_date' => 'date',
            'date_of_medical_exam' => 'date',
            'tetanus_date' => 'date',
            // Operational activation flag — true when associated camper has an approved application.
            'is_active' => 'boolean',
        ];
    }

    /**
     * Virtual attributes appended to the model's JSON/array output.
     *
     * 'primary_diagnosis' gives a quick one-liner diagnosis name without
     * requiring callers to eager-load and traverse the diagnoses collection.
     *
     * @var list<string>
     */
    protected $appends = ['primary_diagnosis'];

    /**
     * Get the camper this medical record belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get allergies for this camper through the shared camper_id column.
     *
     * Allergies live in the allergies table and belong to Camper, but we
     * expose them here (using camper_id as the linking key) so the admin
     * application-review page can load everything off medical_record in one chain.
     * The third argument ('camper_id') tells Laravel which local key to use on
     * MedicalRecord instead of the default primary key.
     */
    public function allergies(): HasMany
    {
        return $this->hasMany(Allergy::class, 'camper_id', 'camper_id');
    }

    /**
     * Get medications for this camper through the shared camper_id column.
     *
     * Same cross-model pattern as allergies() above — camper_id bridges
     * the gap between medical_records and medications tables.
     */
    public function medications(): HasMany
    {
        return $this->hasMany(Medication::class, 'camper_id', 'camper_id');
    }

    /**
     * Get diagnoses for this camper through the shared camper_id column.
     */
    public function diagnoses(): HasMany
    {
        return $this->hasMany(Diagnosis::class, 'camper_id', 'camper_id');
    }

    /**
     * Get the name of the camper's first-listed diagnosis, or null if none exist.
     *
     * "Primary" here means the earliest-inserted row, not a medically prioritised one.
     * If the diagnoses relationship is already loaded (e.g. via with('diagnoses')),
     * the collection is used directly; otherwise a targeted single-column query runs.
     */
    public function getPrimaryDiagnosisAttribute(): ?string
    {
        // Prefer the already-loaded collection to avoid an extra database query.
        if ($this->relationLoaded('diagnoses')) {
            return $this->diagnoses->first()?->name;
        }

        // value('name') is a lightweight query that fetches only the first name column.
        return $this->diagnoses()->value('name');
    }

    /**
     * Determine if this camper has insurance information on file.
     *
     * Both provider AND policy number must be present — one alone is incomplete.
     */
    public function hasInsurance(): bool
    {
        return $this->insurance_provider !== null
            && $this->insurance_policy_number !== null;
    }

    /**
     * Determine if a physician has been recorded for this camper.
     */
    public function hasPhysician(): bool
    {
        return $this->physician_name !== null;
    }

    /**
     * Determine if this camper requires a seizure emergency action plan.
     *
     * When true, camp policy mandates a documented response plan be on file
     * before the camper may attend. Staff are trained to reference this plan
     * during any seizure event.
     */
    public function requiresSeizurePlan(): bool
    {
        return $this->has_seizures === true;
    }

    /**
     * Query scope — filter only operationally active medical records.
     *
     * An active medical record belongs to a camper with at least one approved
     * application. Medical staff operational views (dashboards, rosters, queues)
     * should apply this scope to exclude records for campers whose applications
     * have been reversed or cancelled.
     *
     * Usage: MedicalRecord::active()->with('camper')->paginate(15)
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
