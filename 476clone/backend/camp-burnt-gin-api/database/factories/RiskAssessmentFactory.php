<?php

namespace Database\Factories;

use App\Enums\MedicalComplexityTier;
use App\Enums\RiskReviewStatus;
use App\Enums\SupervisionLevel;
use App\Models\Camper;
use App\Models\RiskAssessment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating RiskAssessment model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RiskAssessment>
 */
class RiskAssessmentFactory extends Factory
{
    protected $model = RiskAssessment::class;

    public function definition(): array
    {
        $score = fake()->numberBetween(0, 60);

        $supervisionLevel = match (true) {
            $score > 40 => SupervisionLevel::OneToOne,
            $score > 20 => SupervisionLevel::Enhanced,
            default => SupervisionLevel::Standard,
        };

        $complexityTier = match (true) {
            $score > 50 => MedicalComplexityTier::High,
            $score > 25 => MedicalComplexityTier::Moderate,
            default => MedicalComplexityTier::Low,
        };

        return [
            'camper_id' => Camper::factory(),
            'calculated_at' => now(),
            'risk_score' => $score,
            'supervision_level' => $supervisionLevel,
            'medical_complexity_tier' => $complexityTier,
            'flags' => [],
            'factor_breakdown' => [],
            'is_current' => true,
            'review_status' => RiskReviewStatus::SystemCalculated,
        ];
    }
}
