<?php

namespace App\Enums;

/**
 * MedicalComplexityTier — summarizes how medically complex a camper's needs are.
 *
 * After the risk scoring engine adds up all of a camper's diagnoses, allergies,
 * medications, and other health factors, it assigns them a tier. This tier helps
 * camp staff quickly understand how much medical attention a camper is likely to need.
 */
enum MedicalComplexityTier: string
{
    // Minimal health needs — the camper can likely participate with standard care.
    case Low = 'low';

    // Some ongoing health needs that require regular check-ins and planning.
    case Moderate = 'moderate';

    // Significant health needs requiring detailed care plans and close monitoring.
    case High = 'high';

    /**
     * Returns a friendly label for the complexity tier to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low Complexity',
            self::Moderate => 'Moderate Complexity',
            self::High => 'High Complexity',
        };
    }

    /**
     * Returns the minimum cumulative risk score needed to reach this tier.
     *
     * Scores below 26 = Low, 26–50 = Moderate, 51+ = High.
     * The risk score engine uses these thresholds to assign tiers automatically.
     */
    public function getThreshold(): int
    {
        return match ($this) {
            self::Low => 0,       // Any score from 0 upward starts here.
            self::Moderate => 26, // Score of 26 or more enters moderate tier.
            self::High => 51,     // Score of 51 or more enters high tier.
        };
    }
}
