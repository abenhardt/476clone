<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * DatabaseSeeder — mode router for Camp Burnt Gin.
 *
 * Reads the SEED_MODE environment variable and delegates to the appropriate
 * seeder. This class contains no seeding logic of its own.
 *
 * ─── MODES ───────────────────────────────────────────────────────────────────
 *
 *   SEED_MODE=minimal  →  MinimalSeeder
 *     Clean-slate bootstrap. Creates system configuration and one super_admin
 *     account. No families, campers, applications, or simulation data.
 *     Use for: first deployment, controlled testing, clean demos.
 *
 *   SEED_MODE=full     →  FullSimulationSeeder  (default when unset)
 *     Complete scenario simulation. All 37 seeders across 5 tiers. ~76 campers,
 *     all application statuses, all medical complexity tiers, 14 edge cases.
 *     Use for: development, QA, feature demonstration.
 *
 * ─── COMMANDS ────────────────────────────────────────────────────────────────
 *
 *   Minimal mode:
 *     SEED_MODE=minimal php artisan migrate:fresh --seed
 *
 *   Full simulation mode (default):
 *     php artisan migrate:fresh --seed
 *     SEED_MODE=full php artisan migrate:fresh --seed
 *
 *   Run a specific mode directly (bypasses this router):
 *     php artisan db:seed --class=MinimalSeeder
 *     php artisan db:seed --class=FullSimulationSeeder
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Default to 'minimal' — developers must explicitly opt in to full simulation
        // data. This prevents accidentally seeding test credentials into staging.
        $mode = env('SEED_MODE', 'minimal');

        if ($mode === 'minimal') {
            $this->command->info('Seed mode: minimal');
            $this->call(MinimalSeeder::class);
        } else {
            $this->command->info('Seed mode: full simulation');
            $this->call(FullSimulationSeeder::class);
        }
    }
}
