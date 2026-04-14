<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds a submission_source field to the applications table so the system can
 * distinguish between digitally-submitted applications, applicant-uploaded paper
 * packets, and admin-digitized paper packets — without fragmenting the review workflow.
 *
 * All three source types resolve into the same canonical ApplicationReviewPage
 * experience; the field only affects which UI cues and checklists are shown.
 *
 * Values:
 *   digital        — Applicant completed the interactive digital form (default; all existing records)
 *   paper_self     — Applicant downloaded paper forms, completed them offline, and uploaded the scanned packet
 *   paper_admin    — Staff received a mailed/in-person packet and uploaded it on the applicant's behalf
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('submission_source')
                ->default('digital')
                ->after('is_incomplete_at_approval')
                ->comment('How the application entered the system: digital | paper_self | paper_admin');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('submission_source');
        });
    }
};
