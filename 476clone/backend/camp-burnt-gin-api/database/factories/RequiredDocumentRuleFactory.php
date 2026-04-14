<?php

namespace Database\Factories;

use App\Enums\MedicalComplexityTier;
use App\Enums\SupervisionLevel;
use App\Models\RequiredDocumentRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for generating RequiredDocumentRule test data.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RequiredDocumentRule>
 */
class RequiredDocumentRuleFactory extends Factory
{
    protected $model = RequiredDocumentRule::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'medical_complexity_tier' => null,
            'supervision_level' => null,
            'condition_flag' => null,
            'document_type' => fake()->randomElement([
                'seizure_action_plan',
                'feeding_action_plan',
                'medication_authorization',
                'physical_examination',
                'immunization_record',
            ]),
            'description' => fake()->sentence(),
            'is_mandatory' => true,
        ];
    }

    /**
     * Indicate the rule is for a specific complexity tier.
     */
    public function forComplexityTier(MedicalComplexityTier $tier): static
    {
        return $this->state(fn (array $attributes) => [
            'medical_complexity_tier' => $tier,
        ]);
    }

    /**
     * Indicate the rule is for a specific supervision level.
     */
    public function forSupervisionLevel(SupervisionLevel $level): static
    {
        return $this->state(fn (array $attributes) => [
            'supervision_level' => $level,
        ]);
    }

    /**
     * Indicate the rule is for a specific condition flag.
     */
    public function forConditionFlag(string $flag): static
    {
        return $this->state(fn (array $attributes) => [
            'condition_flag' => $flag,
        ]);
    }

    /**
     * Indicate the rule is optional (not mandatory).
     */
    public function optional(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_mandatory' => false,
        ]);
    }
}
