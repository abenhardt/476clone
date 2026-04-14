<?php

namespace Database\Factories;

use App\Enums\ActivityPermissionLevel;
use App\Models\ActivityPermission;
use App\Models\Camper;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating ActivityPermission model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ActivityPermission>
 */
class ActivityPermissionFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = ActivityPermission::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $activities = [
            'Sports',
            'Swimming',
            'Boating',
            'Camp Out',
            'Arts & Crafts',
            'Nature',
            'Fine Arts',
        ];

        $permissionLevel = fake()->randomElement(ActivityPermissionLevel::cases());

        return [
            'camper_id' => Camper::factory(),
            'activity_name' => fake()->randomElement($activities),
            'permission_level' => $permissionLevel,
            'restriction_notes' => $permissionLevel === ActivityPermissionLevel::Restricted
                ? fake()->sentence()
                : null,
        ];
    }

    /**
     * Create a permission that is fully permitted.
     */
    public function permitted(): static
    {
        return $this->state(fn (array $attributes) => [
            'permission_level' => ActivityPermissionLevel::Yes,
            'restriction_notes' => null,
        ]);
    }

    /**
     * Create a permission that is not permitted.
     */
    public function notPermitted(): static
    {
        return $this->state(fn (array $attributes) => [
            'permission_level' => ActivityPermissionLevel::No,
            'restriction_notes' => null,
        ]);
    }

    /**
     * Create a permission with restrictions.
     */
    public function restricted(): static
    {
        return $this->state(fn (array $attributes) => [
            'permission_level' => ActivityPermissionLevel::Restricted,
            'restriction_notes' => fake()->sentence(),
        ]);
    }

    /**
     * Create a permission for a specific activity.
     */
    public function forActivity(string $activityName): static
    {
        return $this->state(fn (array $attributes) => [
            'activity_name' => $activityName,
        ]);
    }

    /**
     * Create a permission for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
