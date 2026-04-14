<?php

namespace App\Enums;

/**
 * ApplicationStatus — tracks where a camp application is in the review process.
 *
 * Think of it like a checklist: a parent submits an application, staff review it,
 * and it moves through stages until a final decision is made. This enum lists
 * every possible stage so the rest of the app always uses the same exact words.
 */
enum ApplicationStatus: string
{
    // The parent has fully submitted the application; nobody has looked at it yet.
    case Submitted = 'submitted';

    // Staff are actively reviewing the application right now.
    case UnderReview = 'under_review';

    // The camper has been accepted — they can attend camp!
    case Approved = 'approved';

    // The application was not accepted after review.
    case Rejected = 'rejected';

    // The application was cancelled by an administrator.
    case Cancelled = 'cancelled';

    // The session is full; the camper is queued and may be promoted if space opens.
    case Waitlisted = 'waitlisted';

    // The application was voluntarily withdrawn by the parent before or after approval.
    // This is a parent-initiated action only — use Cancelled for admin-initiated termination.
    case Withdrawn = 'withdrawn';

    /**
     * Returns a friendly, readable version of the status for display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Submitted => 'Submitted',
            self::UnderReview => 'Under Review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
            self::Cancelled => 'Cancelled',
            self::Waitlisted => 'Waitlisted',
            self::Withdrawn => 'Withdrawn',
        };
    }

    /**
     * Returns true if the application has reached a permanent end state.
     * Final statuses cannot be changed back — the decision is done.
     */
    public function isFinal(): bool
    {
        return in_array($this, [
            self::Approved,
            self::Rejected,
            self::Cancelled,
            self::Withdrawn,
        ]);
    }

    /**
     * Returns true if the application can still be promoted off the waitlist.
     * Waitlisted applications are not final — staff can approve them when capacity opens.
     */
    public function isPromotable(): bool
    {
        return $this === self::Waitlisted;
    }

    /**
     * Returns true if the application can still be edited by the parent.
     * Once a final decision is made, editing is locked.
     */
    public function isEditable(): bool
    {
        return in_array($this, [
            self::Submitted,
            self::UnderReview,
        ]);
    }

    /**
     * Returns true if the given status is a valid next state from this status.
     *
     * This method encodes the authoritative ADMIN-level state transition rules.
     * It is evaluated by ApplicationService before any review action is persisted.
     * Parent-initiated withdrawal uses the separate withdrawApplication() service
     * method and is NOT routed through canTransitionTo().
     *
     * Transition table (admin review endpoint only):
     *   Submitted    → UnderReview, Approved, Rejected, Waitlisted, Cancelled
     *   UnderReview  → Approved, Rejected, Waitlisted, Cancelled, Submitted
     *   Approved     → Rejected (reversal), Cancelled (admin cancellation)
     *   Rejected     → Approved (re-approval only — cannot re-open to Pending/UnderReview)
     *   Waitlisted   → Approved, Rejected, Cancelled
     *   Cancelled    → no valid transitions (irreversible)
     *   Withdrawn    → no valid transitions (irreversible, parent-initiated)
     *
     * Self-transitions (same → same) are always invalid.
     */
    public function canTransitionTo(ApplicationStatus $new): bool
    {
        // Self-transitions are meaningless — no state should transition to itself.
        if ($this === $new) {
            return false;
        }

        return match ($this) {
            self::Submitted => in_array($new, [
                self::UnderReview,
                self::Approved,
                self::Rejected,
                self::Waitlisted,
                self::Cancelled,
            ]),
            self::UnderReview => in_array($new, [
                self::Approved,
                self::Rejected,
                self::Waitlisted,
                self::Cancelled,
                self::Submitted,
            ]),
            // Reversal: an approved application may only move to rejected (reversal)
            // or cancelled (admin-initiated cancellation of enrollment).
            self::Approved => in_array($new, [
                self::Rejected,
                self::Cancelled,
            ]),
            // Re-approval only: a rejected application may only be directly re-approved.
            // It cannot be reset to Pending or UnderReview — those transitions would allow
            // silently bypassing the rejection record without a new formal decision.
            self::Rejected => $new === self::Approved,
            // Waitlisted applications may be promoted, declined, or cancelled.
            self::Waitlisted => in_array($new, [
                self::Approved,
                self::Rejected,
                self::Cancelled,
            ]),
            // Terminal states — no further admin transitions permitted.
            self::Cancelled, self::Withdrawn => false,
        };
    }
}
