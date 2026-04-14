<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * FeedingPlan model — documents a camper's specialized dietary and tube-feeding requirements.
 *
 * Each camper has exactly one feeding plan. It covers both standard dietary restrictions
 * (e.g., gluten-free) and complex medical feeding needs such as gastrostomy tube (G-tube)
 * administration with per-feeding formulas, amounts, and schedules.
 *
 * PHI sensitivity: "diet_description" and "notes" are encrypted at rest because they
 * may contain medical information subject to HIPAA. Decryption happens automatically
 * when the model is accessed via Eloquent, using Laravel's encrypted cast.
 *
 * Relationships: belongs to Camper (one-to-one from the camper side)
 */
class FeedingPlan extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'camper_id',
        'special_diet',
        'diet_description',
        'g_tube',
        'formula',
        'amount_per_feeding',
        'feedings_per_day',
        'feeding_times',
        'bolus_only',
        'notes',
        // Texture and fluid fields (Phase 2 — Section 5 gaps)
        'texture_modified',  // True if food texture must be modified.
        'texture_level',     // Specific texture level (e.g. minced, puréed, liquidised).
        'fluid_restriction', // True if fluids must be restricted or measured.
        'fluid_details',     // Description of fluid restriction protocol (encrypted — PHI).
    ];

    /**
     * Get the attributes that should be cast.
     *
     * "feeding_times" is a JSON array of time strings (e.g., ["08:00", "12:00", "18:00"]).
     * PHI fields (diet_description, notes) are encrypted; never readable from raw SQL queries.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'special_diet' => 'boolean',
            // PHI field — encrypted at rest for HIPAA compliance
            'diet_description' => 'encrypted',
            'g_tube' => 'boolean',
            'feedings_per_day' => 'integer',
            // Stored as JSON array of scheduled times; decoded to PHP array on read
            'feeding_times' => 'array',
            'bolus_only' => 'boolean',
            // PHI field — encrypted at rest for HIPAA compliance
            'notes' => 'encrypted',
            // Phase 2 texture/fluid fields
            'texture_modified' => 'boolean',
            'fluid_restriction' => 'boolean',
            'fluid_details' => 'encrypted',   // PHI — describes clinical fluid protocol.
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this feeding plan belongs to.
     *
     * The inverse of Camper::feedingPlan() (hasOne).
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this feeding plan requires an enteral (tube) feeding action plan.
     *
     * G-tube campers need a documented action plan on file covering tube-feeding
     * procedures and emergency steps if the tube is dislodged or blocked.
     */
    public function requiresFeedingActionPlan(): bool
    {
        return $this->g_tube === true;
    }

    /**
     * Determine if this feeding plan requires staff with specialized training.
     *
     * G-tube administration is a clinical skill — camp staff must hold certification
     * or be supervised by a licensed nurse before feeding this camper.
     */
    public function requiresSpecializedStaff(): bool
    {
        return $this->g_tube === true;
    }
}
