<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fix required_document_rules to align with actual upload types.
 *
 * Root cause: the seeder used 'physical_examination' as the universal required rule,
 * but every applicant uploads their Form 4523 as 'official_medical_form' through the
 * Official Forms page. Because DocumentEnforcementService uses exact document_type
 * matching, the uploaded document was never found and the application always appeared
 * non-compliant for the physical exam requirement.
 *
 * Changes:
 *   1. Remove the stale 'physical_examination' universal rule.
 *   2. Add 'official_medical_form' as the canonical universal rule (matches upload type).
 *   3. Add 'insurance_card' as a universal rule (was declared required in the frontend
 *      but never seeded — so backend enforcement never checked for it).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Remove the stale physical_examination rule that never matched uploaded docs.
        DB::table('required_document_rules')
            ->whereNull('medical_complexity_tier')
            ->whereNull('supervision_level')
            ->whereNull('condition_flag')
            ->where('document_type', 'physical_examination')
            ->delete();

        $now = now();

        // Add official_medical_form — matches the document_type stored when applicants
        // upload Form 4523-ENG-DPH from the Official Forms page.
        DB::table('required_document_rules')->insertOrIgnore([
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'official_medical_form',
                'description' => 'Medical Examination Form (Form 4523-ENG-DPH) completed and signed by a licensed physician within the past 12 months',
                'is_mandatory' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // Add insurance_card — universally required (health coverage must be on file).
        DB::table('required_document_rules')->insertOrIgnore([
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'insurance_card',
                'description' => 'Current insurance card (or Medicaid/CHIP card) showing active health coverage',
                'is_mandatory' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        // Restore the old physical_examination rule and remove the new ones.
        DB::table('required_document_rules')
            ->whereNull('medical_complexity_tier')
            ->whereNull('supervision_level')
            ->whereNull('condition_flag')
            ->whereIn('document_type', ['official_medical_form', 'insurance_card'])
            ->delete();

        DB::table('required_document_rules')->insertOrIgnore([
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'physical_examination',
                'description' => 'Current physical examination form completed by licensed physician within 12 months',
                'is_mandatory' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
};
