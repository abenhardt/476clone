<?php

namespace App\Models;

use App\Enums\TreatmentType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

/**
 * TreatmentLog model — records a single medical intervention or clinical observation
 * made by camp medical staff for a camper.
 *
 * A treatment log captures what was done (type), why it was done (description),
 * what medication was given, and what the outcome was. Each entry is timestamped
 * and linked to the staff member who recorded it.
 *
 * Relationship to MedicalVisit:
 *  - Treatments can be stand-alone (e.g. a nurse checks a camper's blood sugar mid-day)
 *    OR they can be linked to a formal MedicalVisit encounter (medical_visit_id is not null).
 *
 * PHI encryption:
 *  - All text fields except camper_id, recorded_by, treatment_date/time, and the type
 *    enum are encrypted at rest because they describe a camper's health status.
 *
 * Allergy conflict detection:
 *  - detectAllergyConflicts() is a static utility called before saving a new treatment
 *    to warn staff if the medication they are about to give might trigger a known allergy.
 */
class TreatmentLog extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',          // The camper who received the treatment.
        'medical_visit_id',   // Optional FK — the visit this treatment is part of.
        'recorded_by',        // FK — the medical staff member who wrote this entry.
        'treatment_date',     // Date the treatment was given.
        'treatment_time',     // Time of day the treatment was given (stored as string, e.g. "14:30").
        'type',               // TreatmentType enum — e.g. Medication, FirstAid, Observation.
        'title',              // Short title summarising the intervention — encrypted PHI.
        'description',        // Full clinical notes about what was done — encrypted PHI.
        'outcome',            // Result of the treatment (e.g. "Improved", "No change") — encrypted PHI.
        'medication_given',   // Name of any medication administered — encrypted PHI.
        'dosage_given',       // Dosage administered — encrypted PHI.
        'follow_up_required', // Boolean flag — true if a follow-up task should be created.
        'follow_up_notes',    // Instructions for the follow-up — encrypted PHI.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI text fields are AES-256 encrypted at rest via Laravel's encrypted cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'treatment_date' => 'date',
            'treatment_time' => 'string',            // Kept as a plain string ("HH:MM").
            'type' => TreatmentType::class, // Maps stored string to enum instance.
            'title' => 'encrypted',
            'description' => 'encrypted',
            'outcome' => 'encrypted',
            'medication_given' => 'encrypted',
            'dosage_given' => 'encrypted',
            'follow_up_required' => 'boolean',
            'follow_up_notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this treatment log was recorded for.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the medical staff member who created this log entry.
     *
     * The FK is 'recorded_by' rather than the default 'user_id'.
     */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Get the MedicalVisit this treatment was part of (if any).
     *
     * medical_visit_id is nullable — a treatment can exist independently of a
     * formal visit encounter. When it is set, this links the treatment to the
     * visit that prompted it so both can be reviewed together.
     */
    public function medicalVisit(): BelongsTo
    {
        return $this->belongsTo(MedicalVisit::class);
    }

    /**
     * Check if the medication being recorded conflicts with any of the camper's known allergies.
     *
     * This is a safety check run before saving a new treatment. It uses a case-insensitive
     * substring match in both directions because medication brand names rarely exactly equal
     * the allergen label stored on file (e.g. "Amoxicillin 500mg" should match "Penicillin"
     * since amoxicillin is a penicillin-class antibiotic).
     *
     * Returns an array of conflict objects so the caller can display a specific warning
     * for each matching allergy. An empty array means no conflicts were found.
     *
     * @param  string  $medicationName  The medication about to be given.
     * @param  Collection<int, \App\Models\Allergy>  $allergies  The camper's known allergies.
     * @return array<int, array{allergen: string, severity: string, reaction: string, treatment: string}>
     */
    public static function detectAllergyConflicts(string $medicationName, Collection $allergies): array
    {
        // Lowercase the medication name once so we don't repeat it inside the loop.
        $lowerMed = mb_strtolower($medicationName);
        $conflicts = [];

        foreach ($allergies as $allergy) {
            $lowerAllergen = mb_strtolower($allergy->allergen ?? '');

            // Skip blank allergen entries to avoid false matches.
            if ($lowerAllergen && (
                // Check if the medication name contains the allergen string...
                str_contains($lowerMed, $lowerAllergen) ||
                // ...or if the allergen string contains the medication name.
                str_contains($lowerAllergen, $lowerMed)
            )) {
                // Build a structured conflict entry the controller can send to the frontend.
                $conflicts[] = [
                    'allergen' => $allergy->allergen,
                    'severity' => $allergy->severity->value,
                    'reaction' => $allergy->reaction,
                    'treatment' => $allergy->treatment,
                ];
            }
        }

        return $conflicts;
    }
}
