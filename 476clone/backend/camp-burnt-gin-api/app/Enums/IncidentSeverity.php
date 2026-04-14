<?php

namespace App\Enums;

/**
 * IncidentSeverity — rates how serious an incident was.
 *
 * After an incident is logged, this severity level tells staff and administrators
 * at a glance how urgent it was. More severe incidents may trigger escalation steps
 * like notifying parents, contacting external medical services, or filing reports.
 */
enum IncidentSeverity: string
{
    // Small issue, handled easily on-site — no lasting concern.
    case Minor = 'minor';

    // Noticeable situation that required some care and follow-up.
    case Moderate = 'moderate';

    // A serious situation with potential lasting impact on the camper.
    case Severe = 'severe';

    // A dangerous or life-threatening situation requiring immediate escalation.
    case Critical = 'critical';

    /**
     * Returns a friendly label for the severity to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Minor => 'Minor',
            self::Moderate => 'Moderate',
            self::Severe => 'Severe',
            self::Critical => 'Critical',
        };
    }

    /**
     * Returns true if this severity level requires escalation to administrators
     * or external services. Severe and critical incidents must be escalated.
     */
    public function requiresEscalation(): bool
    {
        return match ($this) {
            self::Severe, self::Critical => true,
            default => false,
        };
    }
}
