<?php

namespace Database\Factories;

use App\Enums\DiagnosisSeverity;
use App\Models\Camper;
use App\Models\Diagnosis;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating Diagnosis model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Diagnosis>
 */
class DiagnosisFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = Diagnosis::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $diagnoses = [
            'Epilepsy',
            'Cerebral Palsy',
            'Autism Spectrum Disorder',
            'ADHD',
            'Type 1 Diabetes',
            'Asthma',
            'Spina Bifida',
            'Down Syndrome',
            'Muscular Dystrophy',
            'Cystic Fibrosis',
        ];

        return [
            'camper_id' => Camper::factory(),
            'name' => fake()->randomElement($diagnoses),
            'description' => fake()->optional()->paragraph(),
            'severity_level' => fake()->randomElement(DiagnosisSeverity::cases()),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Create a mild diagnosis.
     */
    public function mild(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity_level' => DiagnosisSeverity::Mild,
        ]);
    }

    /**
     * Create a moderate diagnosis.
     */
    public function moderate(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity_level' => DiagnosisSeverity::Moderate,
        ]);
    }

    /**
     * Create a severe diagnosis.
     */
    public function severe(): static
    {
        return $this->state(fn (array $attributes) => [
            'severity_level' => DiagnosisSeverity::Severe,
        ]);
    }

    /**
     * Create a diagnosis for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
