<?php

namespace App\Enums;

/**
 * DocumentVerificationStatus — tracks whether an uploaded document has been reviewed.
 *
 * Parents upload medical and compliance documents as part of the registration process.
 * Before an application can be fully approved, administrators must review each document.
 * This enum tracks where each document is in that review process.
 */
enum DocumentVerificationStatus: string
{
    // The document has been uploaded but has not been reviewed by staff yet.
    case Pending = 'pending';

    // Staff reviewed the document and it meets requirements — all good!
    case Approved = 'approved';

    // Staff reviewed the document and it was not acceptable — resubmission may be needed.
    case Rejected = 'rejected';

    /**
     * Returns a friendly label for the verification status to display in the UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending Verification',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }

    /**
     * Returns true if the document has passed review and is fully accepted.
     */
    public function isApproved(): bool
    {
        return $this === self::Approved;
    }

    /**
     * Returns true if the document is still waiting to be reviewed by staff.
     */
    public function isPending(): bool
    {
        return $this === self::Pending;
    }

    /**
     * Returns true if the document was reviewed and found to be unacceptable.
     */
    public function isRejected(): bool
    {
        return $this === self::Rejected;
    }
}
