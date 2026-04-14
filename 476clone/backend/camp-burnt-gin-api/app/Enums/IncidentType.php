<?php

namespace App\Enums;

/**
 * IncidentType — categorizes what kind of incident occurred at camp.
 *
 * When something unexpected happens involving a camper, staff log it as an incident.
 * This enum defines the category of the incident so it can be sorted, filtered,
 * and reported on consistently across the system.
 */
enum IncidentType: string
{
    // A behavioral issue — e.g., conflict with another camper, rule violation.
    case Behavioral = 'behavioral';

    // A health-related situation that required medical attention.
    case Medical = 'medical';

    // The camper got physically hurt — a cut, sprain, bump, etc.
    case Injury = 'injury';

    // Something in the environment caused a problem — heat, insects, weather, etc.
    case Environmental = 'environmental';

    // A life-threatening or urgent situation requiring immediate emergency response.
    case Emergency = 'emergency';

    // Anything that does not fit neatly into the categories above.
    case Other = 'other';

    /**
     * Returns a friendly label for the incident type to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Behavioral => 'Behavioral',
            self::Medical => 'Medical',
            self::Injury => 'Injury',
            self::Environmental => 'Environmental',
            self::Emergency => 'Emergency',
            self::Other => 'Other',
        };
    }
}
