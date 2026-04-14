<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Form Parity — personal_care_plans irregular bowel field.
 *
 * The official CYSHCN application (Section 8) asks separately:
 *   "Bowel control problems"  (already stored in bowel_control_notes)
 *   "Irregular bowel movements" — a separate distinct condition
 *
 * Adding irregular_bowel as a boolean flag plus a notes field to capture
 * the description required when the answer is Yes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personal_care_plans', function (Blueprint $table) {
            $table->boolean('irregular_bowel')->default(false)->after('bowel_control_notes');
            $table->text('irregular_bowel_notes')->nullable()->after('irregular_bowel'); // encrypted
        });
    }

    public function down(): void
    {
        Schema::table('personal_care_plans', function (Blueprint $table) {
            $table->dropColumn(['irregular_bowel', 'irregular_bowel_notes']);
        });
    }
};
