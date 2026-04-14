<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * UserEmergencyContact model — personal emergency contacts stored on a user (applicant) account.
 *
 * These are account-level contacts — they belong to the applicant's user account and can apply
 * across all of their camper applications. This is distinct from camper-specific emergency contacts
 * (EmergencyContact model), which are tied to individual camper records and camp sessions.
 *
 * A user can have multiple emergency contacts; one is designated as primary (is_primary = true).
 * Admins may view these contacts when urgently trying to reach a family during an incident.
 *
 * Relationships:
 *   - belongs to User
 */
class UserEmergencyContact extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'relationship',
        'phone',
        'email',
        'is_primary',
    ];

    /**
     * Cast field types for correct PHP representations.
     *
     * PHI fields are encrypted at rest using Laravel's 'encrypted' cast
     * (AES-256-CBC). name, relationship, phone, and email are PII that
     * must be encrypted consistently with the camper-level EmergencyContact model.
     */
    protected function casts(): array
    {
        return [
            // Stored as tinyint; cast so PHP sees a proper boolean
            'is_primary' => 'boolean',
            // PII fields encrypted at rest
            'name' => 'encrypted',
            'relationship' => 'encrypted',
            'phone' => 'encrypted',
            'email' => 'encrypted',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the applicant user this emergency contact belongs to.
     *
     * Each contact is tied to exactly one user account.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
