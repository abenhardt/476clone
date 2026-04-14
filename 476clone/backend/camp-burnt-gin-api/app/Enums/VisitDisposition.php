<?php

namespace App\Enums;

/**
 * VisitDisposition — records what happened at the end of a health office visit.
 *
 * When a camper leaves the health office, staff record the outcome of the visit.
 * This tells administrators and parents whether the camper went back to activities,
 * was kept for observation, sent home, or needed emergency services.
 */
enum VisitDisposition: string
{
    // The camper was cleared and went back to normal camp activities.
    case ReturnedToActivity = 'returned_to_activity';

    // The camper is staying in the health office to be watched for a while.
    case Monitoring = 'monitoring';

    // The camper's condition was serious enough that they needed to go home.
    case SentHome = 'sent_home';

    // The camper needed emergency care — ambulance or hospital transfer.
    case EmergencyTransfer = 'emergency_transfer';

    // An outcome that does not fit the standard categories above.
    case Other = 'other';

    /**
     * Returns a friendly label for the disposition to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::ReturnedToActivity => 'Returned to Activity',
            self::Monitoring => 'Monitoring in Health Office',
            self::SentHome => 'Sent Home',
            self::EmergencyTransfer => 'Emergency Transfer',
            self::Other => 'Other',
        };
    }
}
