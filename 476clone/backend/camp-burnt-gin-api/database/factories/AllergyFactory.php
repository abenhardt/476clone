<?php

namespace Database\Factories;

use App\Enums\AllergySeverity;
use App\Models\Allergy;
use App\Models\Camper;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Allergy model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Allergy>
 */
class AllergyFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Allergy::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $allergens = ['Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 'Soy', 'Fish', 'Shellfish', 'Bee Stings', 'Penicillin'];

        return [
            'camper_id' => Camper::factory(),
            'allergen' => fake()->randomElement($allergens),
            'severity' => fake()->randomElement(AllergySeverity::cases()),
            'reaction' => fake()->sentence(),
            'treatment' => fake()->sentence(),
        ];
    }

    /**
     * Create a severe allergy.
     */
    public function severe(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity' => AllergySeverity::Severe,
        ]);
    }

    /**
     * Create a life-threatening allergy.
     */
    public function lifeThreatening(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity' => AllergySeverity::LifeThreatening,
        ]);
    }

    /**
     * Create an allergy for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
