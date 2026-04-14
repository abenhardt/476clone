<?php

namespace App\Enums;

enum ApplicantDocumentStatus: string
{
    case Pending = 'pending';
    case Submitted = 'submitted';
    case Reviewed = 'reviewed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending Applicant Completion',
            self::Submitted => 'Submitted by Applicant',
            self::Reviewed => 'Reviewed',
        };
    }
}
