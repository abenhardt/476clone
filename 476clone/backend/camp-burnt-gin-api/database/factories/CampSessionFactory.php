<?php

namespace Database\Factories;

use App\Models\Camp;
use App\Models\CampSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating CampSession model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CampSession>
 */
class CampSessionFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = CampSession::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $startDate = fake()->dateTimeBetween('+1 month', '+6 months');
        $endDate = (clone $startDate)->modify('+1 week');

        return [
            'camp_id' => Camp::factory(),
            'name' => 'Session '.fake()->numberBetween(1, 10),
            'start_date' => $startDate,
            'end_date' => $endDate,
            'capacity' => fake()->numberBetween(20, 100),
            'min_age' => fake()->numberBetween(6, 10),
            'max_age' => fake()->numberBetween(14, 18),
            'registration_opens_at' => now()->subMonth(),
            'registration_closes_at' => $startDate,
            'is_active' => true,
            'portal_open' => true,
        ];
    }

    /**
     * Create an inactive session.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }

    /**
     * Create a session with the registration portal closed.
     */
    public function portalClosed(): static
    {
        return $this->state(fn (array $attributes) => [
            'portal_open' => false,
        ]);
    }
}
