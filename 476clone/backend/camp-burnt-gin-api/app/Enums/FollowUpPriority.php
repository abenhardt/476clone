<?php

namespace App\Enums;

/**
 * FollowUpPriority — sets how urgently a medical follow-up needs to be done.
 *
 * Not every follow-up is equally important. This enum lets medical staff quickly
 * communicate to each other which tasks need to happen first, helping them
 * manage their workload and make sure the most critical campers are seen first.
 */
enum FollowUpPriority: string
{
    // Can wait — handle it when there is available time.
    case Low = 'low';

    // Should be done soon, but not immediately.
    case Medium = 'medium';

    // Needs attention before the end of the day.
    case High = 'high';

    // Must be handled right away — do not delay.
    case Urgent = 'urgent';

    /**
     * Returns a friendly label for the priority level to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Low => 'Low',
            self::Medium => 'Medium',
            self::High => 'High',
            self::Urgent => 'Urgent',
        };
    }
}
