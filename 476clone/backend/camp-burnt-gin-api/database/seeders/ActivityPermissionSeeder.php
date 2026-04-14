<?php

namespace Database\Seeders;

use App\Enums\ActivityPermissionLevel;
use App\Models\ActivityPermission;
use App\Models\Camper;
use Illuminate\Database\Seeder;

/**
 * Seeder for default activity permission records.
 *
 * This seeder creates default activity permissions for all campers
 * without existing permissions, ensuring complete activity matrices
 * for participation planning and risk assessment.
 */
class ActivityPermissionSeeder extends Seeder
{
    /**
     * Default camp activity types.
     *
     * @var array<string>
     */
    protected array $defaultActivities = [
        'Sports',
        'Swimming',
        'Boating',
        'Camp Out',
        'Arts & Crafts',
        'Nature',
        'Fine Arts',
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Seeding default activity permissions...');

        $campers = Camper::all();
        $createdCount = 0;

        foreach ($campers as $camper) {
            foreach ($this->defaultActivities as $activity) {
                // Only create if permission doesn't already exist for this camper-activity pair
                $exists = ActivityPermission::where('camper_id', $camper->id)
                    ->where('activity_name', $activity)
                    ->exists();

                if (! $exists) {
                    ActivityPermission::create([
                        'camper_id' => $camper->id,
                        'activity_name' => $activity,
                        'permission_level' => ActivityPermissionLevel::Yes,
                        'restriction_notes' => null,
                    ]);

                    $createdCount++;
                }
            }
        }

        $this->command->info("Created {$createdCount} default activity permissions.");
    }
}
