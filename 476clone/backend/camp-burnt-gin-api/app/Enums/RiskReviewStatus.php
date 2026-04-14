<?php

namespace App\Enums;

/**
 * RiskReviewStatus — tracks whether a clinician has reviewed the system-calculated risk.
 *
 * The risk assessment engine produces a score automatically from medical data.
 * Medical staff should review this score and either validate it (confirming the
 * system's recommendation is clinically appropriate) or override it (adjusting
 * the supervision level with a documented clinical reason).
 *
 * This enum represents the state of that review process for a given assessment.
 */
enum RiskReviewStatus: string
{
    // Assessment produced by the scoring engine; no medical staff review yet.
    case SystemCalculated = 'system_calculated';

    // A clinician has reviewed the assessment and confirmed it is appropriate.
    // Clinical notes may be attached.
    case Reviewed = 'reviewed';

    // A clinician has overridden the system-calculated supervision level.
    // An override_reason is required and stored with the assessment.
    case Overridden = 'overridden';

    /**
     * Returns a human-readable label for display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::SystemCalculated => 'System Calculated',
            self::Reviewed => 'Clinically Reviewed',
            self::Overridden => 'Clinician Override',
        };
    }

    /**
     * A short descriptor for badge/pill display.
     */
    public function shortLabel(): string
    {
        return match ($this) {
            self::SystemCalculated => 'Auto',
            self::Reviewed => 'Reviewed',
            self::Overridden => 'Override',
        };
    }

    /**
     * Whether a staff member has manually acted on this assessment.
     *
     * Used to decide whether to show the "Awaiting clinical review" prompt.
     */
    public function isReviewedByStaff(): bool
    {
        return match ($this) {
            self::SystemCalculated => false,
            self::Reviewed, self::Overridden => true,
        };
    }
}
