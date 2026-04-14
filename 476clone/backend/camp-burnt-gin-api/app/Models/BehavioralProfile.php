<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * BehavioralProfile model — stores behavioral characteristics and supervision needs for a camper.
 *
 * Each camper has exactly one behavioral profile. It captures safety-relevant flags
 * (aggression, self-harm risk, wandering) and supervision requirements that affect
 * staff-to-camper ratios and activity planning.
 *
 * PHI sensitivity: The "notes" field contains Protected Health Information and is
 * encrypted at rest using Laravel's built-in "encrypted" cast (AES-256-CBC via APP_KEY).
 *
 * Relationships: belongs to Camper (one-to-one from the camper side)
 */
class BehavioralProfile extends Model
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
        'aggression',
        'self_abuse',
        'wandering_risk',
        'one_to_one_supervision',
        'developmental_delay',
        'functioning_age_level',
        'communication_methods',
        'notes',
        // Section 3 functional assessment (Phase 2)
        'functional_reading',    // Can read at a functional level.
        'functional_writing',    // Can write at a functional level.
        'independent_mobility',  // Can move independently without assistance.
        'verbal_communication',  // Can communicate verbally.
        'social_skills',         // Demonstrates appropriate peer social interaction.
        'behavior_plan',         // A formal behavior intervention plan is currently in place.
        // Form parity flags (2026_03_26_000001) — from PDF Section 5
        'sexual_behaviors',              // Exhibits problematic sexual behaviours.
        'interpersonal_behavior',        // Exhibits other problematic interpersonal behaviour.
        'social_emotional',              // Social or emotional condition affecting behaviour (distinct from social_skills).
        'follows_instructions',          // Has difficulty understanding or following instructions.
        'group_participation',           // Can participate in group activities (positive flag).
        'attends_school',                // Currently attends school (nullable — parent may not answer).
        'classroom_type',                // Type of classroom when attends_school = true.
        // Per-item "if YES describe" fields (encrypted — behavioural details are PHI)
        'aggression_description',
        'self_abuse_description',
        'one_to_one_description',
        'wandering_description',
        'sexual_behaviors_description',
        'interpersonal_behavior_description',
        'social_emotional_description',
        'follows_instructions_description',
        'group_participation_description',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * Boolean flags are stored as tinyint in MySQL; casting ensures PHP sees true/false.
     * "communication_methods" is a JSON array (e.g., ["verbal", "sign language"]).
     * "notes" is encrypted so raw database values are unreadable without the APP_KEY.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'aggression' => 'boolean',
            'self_abuse' => 'boolean',
            'wandering_risk' => 'boolean',
            'one_to_one_supervision' => 'boolean',
            'developmental_delay' => 'boolean',
            'functional_reading' => 'boolean',
            'functional_writing' => 'boolean',
            'independent_mobility' => 'boolean',
            'verbal_communication' => 'boolean',
            'social_skills' => 'boolean',
            'behavior_plan' => 'boolean',
            // Form parity booleans (2026_03_26_000001)
            'sexual_behaviors' => 'boolean',
            'interpersonal_behavior' => 'boolean',
            'social_emotional' => 'boolean',
            'follows_instructions' => 'boolean',
            'group_participation' => 'boolean',
            'attends_school' => 'boolean',
            // Stored as JSON in the database; auto-decoded to PHP array on read
            'communication_methods' => 'array',
            // PHI fields — encrypted at rest for HIPAA compliance
            'notes' => 'encrypted',
            'aggression_description' => 'encrypted',
            'self_abuse_description' => 'encrypted',
            'one_to_one_description' => 'encrypted',
            'wandering_description' => 'encrypted',
            'sexual_behaviors_description' => 'encrypted',
            'interpersonal_behavior_description' => 'encrypted',
            'social_emotional_description' => 'encrypted',
            'follows_instructions_description' => 'encrypted',
            'group_participation_description' => 'encrypted',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this behavioral profile belongs to.
     *
     * The inverse of Camper::behavioralProfile() (hasOne).
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this profile indicates high-risk behaviors.
     *
     * High-risk behaviors (aggression, self-abuse, or wandering) trigger enhanced
     * supervision protocols and must be flagged on activity rosters and incident forms.
     */
    public function hasHighRiskBehaviors(): bool
    {
        // Any single true flag qualifies as high-risk
        return $this->aggression
            || $this->self_abuse
            || $this->wandering_risk;
    }

    /**
     * Determine if this profile requires one-to-one supervision.
     *
     * When true, this camper must have a dedicated staff member at all times.
     * This directly affects staffing ratios for any session the camper attends.
     */
    public function requiresOneToOne(): bool
    {
        // Strict comparison ensures a null/missing value doesn't accidentally return true
        return $this->one_to_one_supervision === true;
    }
}
