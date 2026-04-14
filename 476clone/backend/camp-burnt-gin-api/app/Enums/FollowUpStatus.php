<?php

namespace App\Enums;

/**
 * FollowUpStatus — tracks the progress of a medical follow-up task.
 *
 * After a medical incident, staff may need to check on a camper again. This enum
 * tracks whether that follow-up has been started, completed, or cancelled, so
 * nothing falls through the cracks on the medical team's to-do list.
 */
enum FollowUpStatus: string
{
    // The follow-up has been created but not yet started.
    case Pending = 'pending';

    // Someone is actively working on this follow-up right now.
    case InProgress = 'in_progress';

    // The follow-up has been finished successfully.
    case Completed = 'completed';

    // The follow-up was called off and will not be completed.
    case Cancelled = 'cancelled';

    /**
     * Returns a friendly label for the follow-up status to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::InProgress => 'In Progress',
            self::Completed => 'Completed',
            self::Cancelled => 'Cancelled',
        };
    }
}
