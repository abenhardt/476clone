<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * MedicalRestriction model — documents medical restrictions placed on a camper's activities or diet.
 *
 * A restriction is a formal medical directive (e.g., "no swimming — seizure risk", "modified diet only")
 * created by medical staff and associated with a specific camper. Restrictions have optional start/end
 * dates to accommodate temporary conditions (like post-surgery recovery), and an is_active flag for
 * manual deactivation independent of date expiry.
 *
 * PHI sensitivity: Both "description" and "notes" fields are encrypted at rest because they
 * contain medical information subject to HIPAA. Decryption is transparent via Eloquent casting.
 *
 * Relationships:
 *   - belongs to Camper
 *   - belongs to User (creator via created_by — the medical staff member who entered the restriction)
 *
 * Scopes: active()
 */
class MedicalRestriction extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'camper_id',
        'created_by',
        'restriction_type',
        'description',
        'start_date',
        'end_date',
        'is_active',
        'notes',
    ];

    /**
     * Cast field types for correct PHP representations.
     *
     * Dates use the 'date:Y-m-d' format to strip time components — these are calendar
     * dates, not timestamps. PHI text fields are encrypted at rest.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            // PHI field — encrypted at rest; decrypted automatically by Eloquent on read
            'description' => 'encrypted',
            // PHI field — encrypted at rest; decrypted automatically by Eloquent on read
            'notes' => 'encrypted',
            // Date-only format (no time) so end_date->isPast() compares calendar days correctly
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this restriction applies to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    /**
     * Get the medical staff member who recorded this restriction.
     *
     * Uses the non-default foreign key "created_by" instead of "user_id".
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this restriction's defined date window has passed.
     *
     * An open-ended restriction (end_date = null) never expires by date — only
     * by manual deactivation via the is_active flag.
     */
    public function isExpired(): bool
    {
        // A null end_date means "no expiry date set" — the restriction stays active indefinitely
        return $this->end_date !== null && $this->end_date->isPast();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Query Scopes
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Scope: return only restrictions that are currently marked active.
     *
     * Note: this scope filters by the is_active flag only, not by date expiry.
     * Callers that need to exclude expired records should also call isExpired() checks
     * or add their own date conditions.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
