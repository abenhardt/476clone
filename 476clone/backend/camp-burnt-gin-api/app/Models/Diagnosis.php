<?php

namespace App\Models;

use App\Enums\DiagnosisSeverity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Diagnosis model — records a single medical condition diagnosed for a camper.
 *
 * Diagnoses help camp admins and medical staff understand each camper's medical
 * background before and during their stay. Multiple diagnoses can be on file
 * for one camper (e.g. "Asthma" + "Type 1 Diabetes").
 *
 * Each diagnosis has a severity level that feeds into the system's risk scoring
 * engine, which calculates how much additional supervision a camper may need.
 *
 * PHI encryption:
 *  - description and notes are encrypted at rest because they may contain
 *    identifiable health details. The name column (e.g. "Asthma") is not
 *    encrypted because it is needed in unencrypted form for listing/searching.
 */
class Diagnosis extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',      // Links this diagnosis to a specific camper.
        'name',           // Short condition name (e.g. "Asthma", "Epilepsy").
        'description',    // Longer clinical description — encrypted PHI.
        'severity_level', // DiagnosisSeverity enum value stored as string.
        'notes',          // Free-form staff notes about this condition — encrypted PHI.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are AES-256 encrypted at rest via Laravel's encrypted cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'description' => 'encrypted',              // PHI — encrypted at rest.
            'notes' => 'encrypted',              // PHI — encrypted at rest.
            // Maps the stored string to a DiagnosisSeverity enum instance on read.
            'severity_level' => DiagnosisSeverity::class,
        ];
    }

    /**
     * Get the camper this diagnosis belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the numeric risk score contribution from this diagnosis.
     *
     * The risk scoring engine sums scores across all of a camper's diagnoses
     * to determine an overall medical complexity rating. Higher scores mean
     * more intensive supervision may be required.
     * The actual score values live in the DiagnosisSeverity enum so they can
     * be adjusted without touching model code.
     */
    public function getRiskScore(): int
    {
        return $this->severity_level->getRiskScore();
    }
}
