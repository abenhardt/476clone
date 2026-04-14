<?php

namespace App\Enums;

/**
 * SupervisionLevel — defines how closely a camper needs to be watched by staff.
 *
 * Based on a camper's medical complexity and behavioral needs, this enum sets
 * the required staff-to-camper ratio. More complex needs mean more dedicated
 * attention from a staff member, which helps keep every camper safe.
 */
enum SupervisionLevel: string
{
    // Routine supervision — shared across a group of up to six campers per staff member.
    case Standard = 'standard';

    // Extra attention — shared across a smaller group of up to three campers per staff.
    case Enhanced = 'enhanced';

    // A dedicated staff member assigned solely to this one camper at all times.
    case OneToOne = 'one_to_one';

    /**
     * Returns a friendly label for the supervision level to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Standard => 'Standard',
            self::Enhanced => 'Enhanced',
            self::OneToOne => 'One-to-One',
        };
    }

    /**
     * Returns the staff-to-camper ratio string for this supervision level.
     *
     * These ratios are used in staffing reports and care plan documentation
     * to ensure the right number of staff are scheduled for each group.
     */
    public function getStaffingRatio(): string
    {
        return match ($this) {
            self::Standard => '1:6', // One staff member for up to six campers.
            self::Enhanced => '1:3', // One staff member for up to three campers.
            self::OneToOne => '1:1', // One staff member dedicated to one camper.
        };
    }
}
