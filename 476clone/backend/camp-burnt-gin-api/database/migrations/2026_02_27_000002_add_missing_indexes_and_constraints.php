<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds missing unique constraints and performance indexes.
 *
 * required_document_rules:
 *   - Unique constraint on (medical_complexity_tier, supervision_level,
 *     condition_flag, document_type) to prevent duplicate rule rows and
 *     make the seeder reliably idempotent.
 *
 * camp_sessions:
 *   - Index on (registration_opens_at, registration_closes_at) for the
 *     common query "find sessions currently open for registration":
 *     WHERE registration_opens_at <= NOW() AND registration_closes_at >= NOW()
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = \Illuminate\Support\Facades\DB::connection()->getDriverName();

        if ($driver === 'mysql') {
            // MySQL with utf8mb4: 4 × varchar(255) × 4 bytes = 4080 bytes > 3072 limit.
            // Use prefix lengths (100 chars each) → 4 × 100 × 4 = 1600 bytes.
            \Illuminate\Support\Facades\DB::statement(
                'ALTER TABLE required_document_rules '
                .'ADD UNIQUE INDEX rdr_unique_rule ('
                .'medical_complexity_tier(100), supervision_level(100), '
                .'condition_flag(100), document_type(100))'
            );
        } else {
            // SQLite (tests) and other drivers have no key-length limit.
            Schema::table('required_document_rules', function (Blueprint $table) {
                $table->unique(
                    ['medical_complexity_tier', 'supervision_level', 'condition_flag', 'document_type'],
                    'rdr_unique_rule'
                );
            });
        }

        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->index(
                ['registration_opens_at', 'registration_closes_at'],
                'camp_sessions_registration_window'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('required_document_rules', function (Blueprint $table) {
            $table->dropUnique('rdr_unique_rule');
        });

        Schema::table('camp_sessions', function (Blueprint $table) {
            $table->dropIndex('camp_sessions_registration_window');
        });
    }
};
