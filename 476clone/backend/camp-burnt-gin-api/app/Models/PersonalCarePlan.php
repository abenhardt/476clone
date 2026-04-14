<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * PersonalCarePlan model — Activities of Daily Living (ADL) care assessment.
 *
 * One record per camper, created during the application form submission.
 * Follows the same 1:1 per-camper pattern as BehavioralProfile and FeedingPlan.
 *
 * Assistance levels use string values matching the form's options:
 *   'independent', 'verbal_cue', 'physical_assist', 'full_assist'
 *
 * PHI encryption:
 *   All notes and description fields are encrypted at rest. They describe
 *   personal hygiene protocols and clinical care routines for a child with
 *   disabilities — unambiguously PHI under HIPAA.
 */
class PersonalCarePlan extends Model
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
        // Bathing
        'bathing_level',
        'bathing_notes',
        // Toileting (daytime)
        'toileting_level',
        'toileting_notes',
        // Nighttime toileting
        'nighttime_toileting',
        'nighttime_notes',
        // Dressing
        'dressing_level',
        'dressing_notes',
        // Oral hygiene
        'oral_hygiene_level',
        'oral_hygiene_notes',
        // Positioning & transfers
        'positioning_notes',
        // Sleep routine
        'sleep_notes',
        'falling_asleep_issues',
        'sleep_walking',
        'night_wandering',
        // Bowel & continence
        'bowel_control_notes',
        'urinary_catheter',
        // Form parity (2026_03_26_000005) — irregular bowel (separate condition from bowel control)
        'irregular_bowel',
        'irregular_bowel_notes',
        // Menstruation
        'menstruation_support',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * All notes/description fields are encrypted at rest (PHI).
     * Boolean flags are cast from 0/1 integers.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Encrypted PHI — clinical care descriptions for a child with disabilities.
            'bathing_notes' => 'encrypted',
            'toileting_notes' => 'encrypted',
            'nighttime_notes' => 'encrypted',
            'dressing_notes' => 'encrypted',
            'oral_hygiene_notes' => 'encrypted',
            'positioning_notes' => 'encrypted',
            'sleep_notes' => 'encrypted',
            'bowel_control_notes' => 'encrypted',
            'irregular_bowel_notes' => 'encrypted',
            // Boolean flags.
            'nighttime_toileting' => 'boolean',
            'falling_asleep_issues' => 'boolean',
            'sleep_walking' => 'boolean',
            'night_wandering' => 'boolean',
            'urinary_catheter' => 'boolean',
            'irregular_bowel' => 'boolean',
            'menstruation_support' => 'boolean',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this personal care plan belongs to.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }
}
