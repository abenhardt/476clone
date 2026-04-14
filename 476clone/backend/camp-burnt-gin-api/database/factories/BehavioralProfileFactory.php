<?php

namespace Database\Factories;

use App\Models\BehavioralProfile;
use App\Models\Camper;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BehavioralProfile>
 */
class BehavioralProfileFactory extends Factory
{
    protected $model = BehavioralProfile::class;

    public function definition(): array
    {
        $aggression = fake()->boolean(20);
        $selfAbuse = fake()->boolean(15);
        $wandering = fake()->boolean(25);
        $oneToOne = fake()->boolean(10);
        $sexualBehaviors = fake()->boolean(8);
        $interpersonal = fake()->boolean(15);
        $socialEmotional = fake()->boolean(20);
        $followsInstructions = fake()->boolean(30);
        $groupParticipation = fake()->boolean(25);

        $communicationMethods = ['Verbal', 'Sign Language', 'Picture Cards', 'Communication Device', 'Written', 'Gestures'];

        return [
            'camper_id' => Camper::factory(),

            // ── Original behavioral flags ─────────────────────────────────────────
            'aggression' => $aggression,
            'aggression_description' => $aggression ? fake()->sentence() : null,
            'self_abuse' => $selfAbuse,
            'self_abuse_description' => $selfAbuse ? fake()->sentence() : null,
            'wandering_risk' => $wandering,
            'wandering_description' => $wandering ? fake()->sentence() : null,
            'one_to_one_supervision' => $oneToOne,
            'one_to_one_description' => $oneToOne ? fake()->sentence() : null,
            'developmental_delay' => fake()->boolean(30),
            'functioning_age_level' => fake()->optional(0.5)->randomElement(['3-5 years', '6-8 years', '9-12 years']),
            'communication_methods' => fake()->optional(0.7)->randomElements($communicationMethods, fake()->numberBetween(1, 3)),

            // ── Extended behavioral flags (2026-03-26) ────────────────────────────
            'sexual_behaviors' => $sexualBehaviors,
            'sexual_behaviors_description' => $sexualBehaviors ? fake()->sentence() : null,
            'interpersonal_behavior' => $interpersonal,
            'interpersonal_behavior_description' => $interpersonal ? fake()->sentence() : null,
            'social_emotional' => $socialEmotional,
            'social_emotional_description' => $socialEmotional ? fake()->sentence() : null,
            'follows_instructions' => $followsInstructions,
            'follows_instructions_description' => $followsInstructions ? fake()->sentence() : null,
            'group_participation' => $groupParticipation,
            'group_participation_description' => $groupParticipation ? fake()->sentence() : null,

            // ── Functional ability flags (2026-03-25) ─────────────────────────────
            // These represent positive abilities present — higher base rates than risk flags
            'functional_reading' => fake()->boolean(65),
            'functional_writing' => fake()->boolean(55),
            'independent_mobility' => fake()->boolean(70),
            'verbal_communication' => fake()->boolean(75),
            'social_skills' => fake()->boolean(60),
            'behavior_plan' => fake()->boolean(35),

            // ── School attendance ──────────────────────────────────────────────────
            'attends_school' => fake()->boolean(85),
            'classroom_type' => fake()->optional(0.7)->randomElement([
                'General Education', 'Resource Room', 'Self-Contained', 'Life Skills', 'Homebound',
            ]),

            'notes' => fake()->optional(0.3)->paragraph(),
        ];
    }

    /** Profile with multiple concurrent risk flags active — useful for staffing ratio tests. */
    public function highRisk(): static
    {
        return $this->state(fn () => [
            'aggression' => true,
            'aggression_description' => fake()->sentence(),
            'wandering_risk' => true,
            'wandering_description' => fake()->sentence(),
            'self_abuse' => true,
            'self_abuse_description' => fake()->sentence(),
        ]);
    }

    /** 1:1 supervision required. */
    public function oneToOne(): static
    {
        return $this->state(fn () => [
            'one_to_one_supervision' => true,
            'one_to_one_description' => fake()->sentence(),
        ]);
    }

    /** Wandering risk flagged with description. */
    public function wanderingRisk(): static
    {
        return $this->state(fn () => [
            'wandering_risk' => true,
            'wandering_description' => fake()->sentence(),
        ]);
    }

    /** Developmental delay with age-appropriate functioning level. */
    public function developmentalDelay(): static
    {
        return $this->state(fn () => [
            'developmental_delay' => true,
            'functioning_age_level' => fake()->randomElement(['3-5 years', '6-8 years']),
        ]);
    }

    /** Attach to a specific camper. */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn () => ['camper_id' => $camper->id]);
    }
}
