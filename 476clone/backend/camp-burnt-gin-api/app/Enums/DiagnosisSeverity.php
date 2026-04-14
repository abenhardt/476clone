<?php

namespace App\Enums;

/**
 * DiagnosisSeverity — rates how serious a camper's medical diagnosis is.
 *
 * When a doctor diagnoses a camper with a condition (like asthma or epilepsy),
 * this enum captures how severe it is. The severity feeds into the risk scoring
 * system to help figure out how much medical attention the camper will need at camp.
 */
enum DiagnosisSeverity: string
{
    // The condition is manageable and unlikely to disrupt normal camp activities.
    case Mild = 'mild';

    // The condition requires regular monitoring and some extra care.
    case Moderate = 'moderate';

    // The condition significantly affects the camper's daily health and safety.
    case Severe = 'severe';

    /**
     * Returns a friendly label for displaying the severity in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Mild => 'Mild',
            self::Moderate => 'Moderate',
            self::Severe => 'Severe',
        };
    }

    /**
     * Returns a numeric score representing how much this severity adds to the
     * camper's overall medical risk calculation.
     *
     * Higher scores push the camper into a higher complexity tier, which may
     * require more staff support or specialized care planning.
     */
    public function getRiskScore(): int
    {
        return match ($this) {
            self::Mild => 0,       // No added risk — routine management only.
            self::Moderate => 3,   // Moderate risk — needs regular check-ins.
            self::Severe => 5,     // High risk — requires close medical oversight.
        };
    }
}
