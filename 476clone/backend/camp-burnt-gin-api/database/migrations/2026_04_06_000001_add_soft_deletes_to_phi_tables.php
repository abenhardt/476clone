<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add soft deletes to all PHI (Protected Health Information) tables.
 *
 * HIPAA 45 CFR § 164.530(j) requires that medical records be retained for a
 * minimum of 6 years. Hard-deleting any of these records would violate that
 * requirement and the project's own safety gate policy.
 *
 * Tables receiving soft deletes in this migration:
 *   - medications          (prescription lists — highly sensitive PHI)
 *   - diagnoses            (clinical diagnoses — highly sensitive PHI)
 *   - medical_incidents    (incident reports — clinical and safety records)
 *   - medical_visits       (health centre visits — clinical encounter records)
 *   - treatment_logs       (medication administered, interventions — PHI)
 *   - medical_restrictions (activity/diet restrictions — PHI)
 *   - behavioral_profiles  (behavioral/communication descriptions — PHI)
 *   - feeding_plans        (feeding instructions — PHI)
 *   - personal_care_plans  (ADL care instructions — PHI)
 *   - assistive_devices    (device/equipment records — PHI)
 *   - medical_follow_ups   (follow-up care plans — PHI)
 *   - activity_permissions (participation permissions — PHI)
 *
 * Each table gets a nullable `deleted_at` timestamp. The corresponding Eloquent
 * models use the SoftDeletes trait so `->delete()` sets this column rather than
 * removing the row.
 */
return new class extends Migration
{
    public function up(): void
    {
        $tables = [
            'medications',
            'diagnoses',
            'medical_incidents',
            'medical_visits',
            'treatment_logs',
            'medical_restrictions',
            'behavioral_profiles',
            'feeding_plans',
            'personal_care_plans',
            'assistive_devices',
            'medical_follow_ups',
            'activity_permissions',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table) && ! Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->softDeletes();
                });
            }
        }
    }

    public function down(): void
    {
        $tables = [
            'medications',
            'diagnoses',
            'medical_incidents',
            'medical_visits',
            'treatment_logs',
            'medical_restrictions',
            'behavioral_profiles',
            'feeding_plans',
            'personal_care_plans',
            'assistive_devices',
            'medical_follow_ups',
            'activity_permissions',
        ];

        foreach ($tables as $table) {
            if (Schema::hasTable($table) && Schema::hasColumn($table, 'deleted_at')) {
                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->dropSoftDeletes();
                });
            }
        }
    }
};
