<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Medication model — records a single medication taken by a camper.
 *
 * Camp medical staff need a complete and accurate medication list to
 * administer doses correctly during the session and to avoid dangerous
 * drug interactions or allergy conflicts.
 *
 * All fields except camper_id are encrypted at rest because medication
 * names, dosages, and prescribing physicians are PHI under HIPAA.
 *
 * The isPrescribed() helper lets staff quickly distinguish physician-ordered
 * medications from parent-supplied over-the-counter items, which may have
 * different administration protocols.
 */
class Medication extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',             // Links to the camper who takes this medication.
        'name',                  // Medication name (e.g. "Metformin").
        'dosage',                // Amount per dose (e.g. "500mg").
        'frequency',             // How often it is taken (e.g. "Twice daily with meals").
        'purpose',               // Why it is taken — helps staff understand medical context.
        'prescribing_physician', // Doctor who prescribed it; null for OTC medications.
        'notes',                 // Any extra instructions for camp medical staff.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * All text fields are encrypted via Laravel's AES-256 encrypted cast
     * so raw medication details cannot be read from the database directly.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => 'encrypted',
            'dosage' => 'encrypted',
            'frequency' => 'encrypted',
            'purpose' => 'encrypted',
            'prescribing_physician' => 'encrypted',
            'notes' => 'encrypted',
        ];
    }

    /**
     * Get the camper this medication belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Determine if this medication was ordered by a physician.
     *
     * Prescription medications may require stricter administration protocols
     * (e.g. witnessed administration, signed log entry) compared to OTC items.
     */
    public function isPrescribed(): bool
    {
        // If prescribing_physician is null, no doctor ordered it — treat as OTC.
        return $this->prescribing_physician !== null;
    }
}
