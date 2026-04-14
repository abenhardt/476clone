<?php

namespace App\Enums;

/**
 * TreatmentType — describes what kind of care was given during a medical visit.
 *
 * Every time a camper comes to the health office, medical staff log what they did.
 * This enum makes sure the type of treatment is always recorded using the same
 * consistent categories, which makes reports and statistics more reliable.
 */
enum TreatmentType: string
{
    // A scheduled or as-needed medicine was given to the camper.
    case MedicationAdministered = 'medication_administered';

    // Basic care was provided — bandages, ice packs, wound cleaning, etc.
    case FirstAid = 'first_aid';

    // The camper was watched for a period of time to see how they were doing.
    case Observation = 'observation';

    // A serious or urgent situation that required immediate action.
    case Emergency = 'emergency';

    // Any type of care that doesn't fit the categories above.
    case Other = 'other';

    /**
     * Returns a friendly label for each treatment type to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::MedicationAdministered => 'Medication Administered',
            self::FirstAid => 'First Aid',
            self::Observation => 'Observation',
            self::Emergency => 'Emergency',
            self::Other => 'Other',
        };
    }
}
