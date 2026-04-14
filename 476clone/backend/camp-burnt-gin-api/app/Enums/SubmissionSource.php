<?php

namespace App\Enums;

/**
 * How the application entered the system.
 *
 * All sources resolve into the same ApplicationReviewPage workflow.
 * The value informs which UI cues are shown (e.g. paper badge, adapted checklist)
 * and provides traceability in the audit log.
 */
enum SubmissionSource: string
{
    /** Applicant completed the interactive digital form online. Default for all existing records. */
    case Digital = 'digital';

    /** Applicant downloaded paper forms, completed them offline, and uploaded the scanned packet themselves. */
    case PaperSelf = 'paper_self';

    /** Staff received a mailed or in-person packet and uploaded it on the applicant's behalf. */
    case PaperAdmin = 'paper_admin';

    public function label(): string
    {
        return match ($this) {
            self::Digital => 'Digital',
            self::PaperSelf => 'Paper (Self-Uploaded)',
            self::PaperAdmin => 'Paper (Admin-Uploaded)',
        };
    }

    public function isPaper(): bool
    {
        return $this !== self::Digital;
    }
}
