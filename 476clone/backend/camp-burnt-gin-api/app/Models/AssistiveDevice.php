<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * AssistiveDevice model — records mobility aids and assistive equipment used by a camper.
 *
 * A camper can have multiple assistive devices (e.g., a wheelchair plus a communication device).
 * Each record stores the device type, whether staff assistance is needed for transfers,
 * and any usage notes. This information drives accessibility planning and staff training decisions.
 *
 * Relationships: belongs to Camper
 */
class AssistiveDevice extends Model
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
        'device_type',
        'requires_transfer_assistance',
        'notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Stored as tinyint in MySQL; cast so PHP sees a proper boolean
            'requires_transfer_assistance' => 'boolean',
            'notes' => 'encrypted',
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this assistive device belongs to.
     *
     * A camper may have many devices; each device points back to its camper.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this device requires specialized staff training.
     *
     * Transfer assistance (lifting, pivoting, repositioning a camper between a wheelchair
     * and another surface) carries an injury risk, so staff must be trained before helping.
     */
    public function requiresTraining(): bool
    {
        return $this->requires_transfer_assistance === true;
    }

    /**
     * Determine if this device affects the camper's physical mobility around camp.
     *
     * Mobility devices like wheelchairs and walkers require accessible pathways,
     * ramps, and adapted facilities — checked when evaluating venue accessibility.
     */
    public function isMobilityDevice(): bool
    {
        // Known mobility-related device type strings (case-insensitive comparison)
        $mobilityDevices = [
            'wheelchair',
            'walker',
            'crutches',
            'cane',
            'gait trainer',
            'stander',
        ];

        // strtolower normalises any casing staff may have entered (e.g. "Wheelchair")
        return in_array(strtolower($this->device_type), $mobilityDevices);
    }
}
