<?php

namespace App\Enums;

/**
 * ActivityPermissionLevel — controls whether a camper can join a specific activity.
 *
 * Some campers have medical or safety reasons that affect which activities they
 * can participate in. This enum captures the three possible outcomes: fully allowed,
 * not allowed at all, or allowed with special conditions attached.
 */
enum ActivityPermissionLevel: string
{
    // The camper is not allowed to participate in this activity.
    case No = 'no';

    // The camper is fully cleared to participate without any special conditions.
    case Yes = 'yes';

    // The camper can participate, but only with specific accommodations or limitations.
    case Restricted = 'restricted';

    /**
     * Returns a friendly label for the permission level to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::No => 'Not Permitted',
            self::Yes => 'Permitted',
            self::Restricted => 'Restricted',
        };
    }

    /**
     * Returns true if this permission level requires extra notes explaining the restrictions.
     * When a camper can participate but with conditions, those conditions must be documented.
     */
    public function requiresNotes(): bool
    {
        return $this === self::Restricted;
    }
}
