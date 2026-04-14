<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * EmergencyContact model — stores emergency contacts and guardians for a camper.
 *
 * Guardian model (Phase 2):
 *  - is_guardian = true  marks this row as a legal guardian record.
 *  - is_primary  = true  → Guardian 1 (primary caregiver, always submitted from the form).
 *  - is_primary  = false → Guardian 2 (secondary guardian, submitted when g2_name is filled).
 *  - Plain emergency contacts have is_guardian = false.
 *
 * Guardian 1 includes a full residential address (address, city, state, zip).
 * Guardian 2 and plain emergency contacts leave address fields null.
 *
 * PHI encryption:
 *  - All personal details (name, phone numbers, email, relationship, address) are
 *    encrypted at rest to protect the privacy of both the contact and the camper.
 */
class EmergencyContact extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'name',
        'relationship',
        'phone_primary',
        'phone_secondary',
        'email',
        'is_primary',
        'is_authorized_pickup',
        'is_guardian',          // True for guardian rows (Guardian 1 or 2); false for plain EC rows.
        'address',              // Street address — only populated for Guardian 1.
        'city',
        'state',
        'zip',
        // Form parity fields (2026_03_26_000003)
        'phone_work',           // Work phone — third number per the official CYSHCN application.
        'primary_language',     // Primary language of this contact (e.g. "Spanish", "ASL").
        'interpreter_needed',   // True if a language interpreter is required to communicate.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * PHI fields are AES-256 encrypted at rest using Laravel's encrypted cast.
     * Boolean flags are cast from database 0/1 integers to PHP true/false.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Contact details are PHI — encrypted so they cannot be read from the raw DB.
            'name' => 'encrypted',
            'relationship' => 'encrypted',
            'phone_primary' => 'encrypted',
            'phone_secondary' => 'encrypted',
            'email' => 'encrypted',
            'address' => 'encrypted',  // Full street address is PHI.
            'city' => 'encrypted',
            'state' => 'encrypted',
            'zip' => 'encrypted',
            'phone_work' => 'encrypted',  // Work phone is PHI.
            // Boolean flags stored as tiny integers in MySQL.
            'is_primary' => 'boolean',
            'is_authorized_pickup' => 'boolean',
            'is_guardian' => 'boolean',
            'interpreter_needed' => 'boolean',
        ];
    }

    /**
     * Get the camper this emergency contact belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }
}
