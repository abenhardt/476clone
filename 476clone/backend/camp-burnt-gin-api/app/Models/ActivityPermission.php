<?php

namespace App\Models;

use App\Enums\ActivityPermissionLevel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * ActivityPermission model — tracks whether a camper may participate in a specific camp activity.
 *
 * Each record links one camper to one activity name and stores a permission level (Yes, No, or Restricted).
 * If a camper has restrictions, staff must also read the restriction_notes before allowing participation.
 * This model is read by medical and admin staff when planning activity rosters and safety protocols.
 *
 * Relationships: belongs to Camper
 * Enum: ActivityPermissionLevel (Yes | No | Restricted)
 */
class ActivityPermission extends Model
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
        'activity_name',
        'permission_level',
        'restriction_notes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * Casting permission_level to the enum automatically converts the raw database
     * string into a type-safe ActivityPermissionLevel enum instance.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Convert the stored string value into the ActivityPermissionLevel enum on read
            'permission_level' => ActivityPermissionLevel::class,
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get the camper this activity permission belongs to.
     *
     * A camper can have many activity permissions — one per activity.
     */
    public function camper(): BelongsTo
    {
        return $this->belongsTo(Camper::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine if this activity is fully permitted (no conditions).
     *
     * Returns true when the permission level is "Yes" — the camper
     * may participate without any special accommodations.
     */
    public function isPermitted(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::Yes;
    }

    /**
     * Determine if this activity is not permitted at all.
     *
     * Returns true when the permission level is "No" — staff should
     * prevent the camper from participating in this activity.
     */
    public function isNotPermitted(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::No;
    }

    /**
     * Determine if this activity has restrictions that must be followed.
     *
     * Returns true when the permission level is "Restricted" — the camper
     * may participate, but staff must review the restriction_notes first.
     */
    public function hasRestrictions(): bool
    {
        return $this->permission_level === ActivityPermissionLevel::Restricted;
    }

    /**
     * Determine if restriction notes are required for this permission level.
     *
     * Restricted activities must document specific limitations or accommodations
     * for safe participation. The check is delegated to the enum so the rule
     * lives in one place.
     */
    public function requiresRestrictionNotes(): bool
    {
        // The enum method encapsulates the business rule about when notes are mandatory
        return $this->permission_level->requiresNotes();
    }
}
