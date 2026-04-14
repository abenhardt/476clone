<?php

namespace App\Enums;

/**
 * AllergySeverity — describes how dangerous a camper's allergy can be.
 *
 * Knowing how serious an allergy is helps medical staff respond correctly.
 * A mild reaction might just need some antihistamine, while a life-threatening
 * one could require an EpiPen and a 911 call.
 */
enum AllergySeverity: string
{
    // Minor reaction — sneezing, itchy eyes, slight rash. Not dangerous.
    case Mild = 'mild';

    // Noticeable reaction that needs attention but is not an emergency.
    case Moderate = 'moderate';

    // Serious reaction requiring prompt medical treatment.
    case Severe = 'severe';

    // Could be fatal — requires immediate emergency response (e.g., EpiPen, 911).
    case LifeThreatening = 'life_threatening';

    /**
     * Returns a friendly label for displaying the severity in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Mild => 'Mild',
            self::Moderate => 'Moderate',
            self::Severe => 'Severe',
            self::LifeThreatening => 'Life-Threatening',
        };
    }

    /**
     * Returns true if this severity level means medical staff should act right away.
     * Severe and life-threatening allergies always require immediate attention.
     */
    public function requiresImmediateAttention(): bool
    {
        return in_array($this, [
            self::Severe,
            self::LifeThreatening,
        ]);
    }
}
