<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\Medication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Medication model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Medication>
 */
class MedicationFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Medication::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $medications = ['Ibuprofen', 'Acetaminophen', 'Albuterol', 'EpiPen', 'Benadryl', 'Insulin', 'Amoxicillin'];

        return [
            'camper_id' => Camper::factory(),
            'name' => fake()->randomElement($medications),
            'dosage' => fake()->numberBetween(5, 500).'mg',
            'frequency' => fake()->randomElement(['Once daily', 'Twice daily', 'As needed', 'Every 4-6 hours']),
            'purpose' => fake()->sentence(),
            'prescribing_physician' => fake()->optional()->name(),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Create a prescribed medication.
     */
    public function prescribed(): static
    {
        return $this->state(fn (array $attributes) => [
            'prescribing_physician' => 'Dr. '.fake()->name(),
        ]);
    }

    /**
     * Create a medication for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
