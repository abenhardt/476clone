<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 2 — extend medical_records with remaining Section 2 and Section 4 health fields.
 *
 * PHI classification:
 *   Text/description fields → encrypted (insurancce group, medicaid, addresses,
 *   illness descriptions, mobility notes).
 *   Boolean and date fields → not encrypted (structural, not identifiable on their own).
 *
 * Fields added:
 *   insurance_group              — insurance group/employer number
 *   medicaid_number              — Medicaid recipient ID
 *   physician_address            — mailing address of the attending physician
 *   immunizations_current        — whether immunizations are up to date per physician
 *   tetanus_date                 — date of most recent tetanus vaccination
 *   mobility_notes               — general mobility and transfer notes (from S4)
 *   has_contagious_illness       — currently has or recently had a contagious illness
 *   contagious_illness_description — description of contagious illness if present
 *   tubes_in_ears                — tympanostomy tubes in place
 *   has_recent_illness           — recent significant illness within past 6 months
 *   recent_illness_description   — description of recent illness
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->text('insurance_group')->nullable()->after('insurance_policy_number');
            $table->text('medicaid_number')->nullable()->after('insurance_group');
            $table->text('physician_address')->nullable()->after('physician_phone');
            $table->boolean('immunizations_current')->nullable()->after('date_of_medical_exam');
            $table->date('tetanus_date')->nullable()->after('immunizations_current');
            $table->text('mobility_notes')->nullable()->after('tetanus_date');
            $table->boolean('has_contagious_illness')->nullable()->after('mobility_notes');
            $table->text('contagious_illness_description')->nullable()->after('has_contagious_illness');
            $table->boolean('tubes_in_ears')->nullable()->after('contagious_illness_description');
            $table->boolean('has_recent_illness')->nullable()->after('tubes_in_ears');
            $table->text('recent_illness_description')->nullable()->after('has_recent_illness');
        });
    }

    public function down(): void
    {
        Schema::table('medical_records', function (Blueprint $table) {
            $table->dropColumn([
                'insurance_group', 'medicaid_number', 'physician_address',
                'immunizations_current', 'tetanus_date', 'mobility_notes',
                'has_contagious_illness', 'contagious_illness_description',
                'tubes_in_ears', 'has_recent_illness', 'recent_illness_description',
            ]);
        });
    }
};
