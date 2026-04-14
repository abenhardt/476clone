<?php

namespace Database\Seeders;

use App\Models\Camp;
use App\Models\CampSession;
use Illuminate\Database\Seeder;

/**
 * Seeder — camp and sessions.
 *
 * Creates the main Camp Burnt Gin record and three sessions:
 *   - Session 1 — Summer 2025 (past / inactive)
 *   - Session 1 — Summer 2026 (upcoming / active)
 *   - Session 2 — Summer 2026 (upcoming / active)
 */
class CampSeeder extends Seeder
{
    public function run(): void
    {
        Camp::firstOrCreate(
            ['name' => 'Camp Burnt Gin'],
            [
                'description' => 'A residential camp for children and youth with special health care needs (CYSHCN). Located in the beautiful South Carolina Lowcountry, we provide a fully accessible, medically supervised camp experience.',
                'location' => 'Orangeburg, SC',
                'is_active' => true,
            ]
        );

        $camp = Camp::where('name', 'Camp Burnt Gin')->firstOrFail();

        CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 1 — Summer 2025'],
            [
                'start_date' => '2025-06-09',
                'end_date' => '2025-06-13',
                'capacity' => 60,
                'min_age' => 6,
                'max_age' => 17,
                'registration_opens_at' => '2025-01-15 00:00:00',
                'registration_closes_at' => '2025-05-15 23:59:59',
                'is_active' => false,
            ]
        );

        CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 1 — Summer 2026'],
            [
                'start_date' => '2026-06-08',
                'end_date' => '2026-06-12',
                'capacity' => 60,
                'min_age' => 6,
                'max_age' => 17,
                'registration_opens_at' => '2026-01-15 00:00:00',
                'registration_closes_at' => '2026-05-15 23:59:59',
                'is_active' => true,
            ]
        );

        CampSession::firstOrCreate(
            ['camp_id' => $camp->id, 'name' => 'Session 2 — Summer 2026'],
            [
                'start_date' => '2026-06-22',
                'end_date' => '2026-06-26',
                'capacity' => 60,
                'min_age' => 6,
                'max_age' => 17,
                'registration_opens_at' => '2026-01-15 00:00:00',
                'registration_closes_at' => '2026-05-29 23:59:59',
                'is_active' => true,
            ]
        );
    }
}
