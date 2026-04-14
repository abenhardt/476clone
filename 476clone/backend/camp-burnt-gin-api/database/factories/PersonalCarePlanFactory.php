<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\PersonalCarePlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PersonalCarePlan>
 *
 * ADL assistance levels used throughout this factory:
 *   'independent'     — camper completes independently with no staff involvement
 *   'verbal_cue'      — staff provides prompts; camper does the physical task
 *   'physical_assist' — staff assists but camper participates
 *   'full_assist'     — staff performs the entire task for the camper
 *
 * All notes fields are encrypted at rest (PHI) — the factory generates
 * realistic placeholder text that exercises the encrypted cast path in tests.
 */
class PersonalCarePlanFactory extends Factory
{
    protected $model = PersonalCarePlan::class;

    /** Assistance level distribution weighted toward independence (realistic camp population). */
    private function assistLevel(): string
    {
        return fake()->randomElement([
            'independent', 'independent', 'independent',
            'verbal_cue', 'verbal_cue',
            'physical_assist',
            'full_assist',
        ]);
    }

    public function definition(): array
    {
        $urinaryCatheter = fake()->boolean(10);

        return [
            'camper_id' => Camper::factory(),
            // Bathing
            'bathing_level' => $this->assistLevel(),
            'bathing_notes' => fake()->optional(0.4)->sentence(),
            // Toileting
            'toileting_level' => $this->assistLevel(),
            'toileting_notes' => fake()->optional(0.4)->sentence(),
            'nighttime_toileting' => fake()->boolean(30),
            'nighttime_notes' => fake()->optional(0.3)->sentence(),
            // Dressing
            'dressing_level' => $this->assistLevel(),
            'dressing_notes' => fake()->optional(0.4)->sentence(),
            // Oral hygiene
            'oral_hygiene_level' => $this->assistLevel(),
            'oral_hygiene_notes' => fake()->optional(0.3)->sentence(),
            // Positioning
            'positioning_notes' => fake()->optional(0.3)->sentence(),
            // Sleep
            'sleep_notes' => fake()->optional(0.3)->sentence(),
            'falling_asleep_issues' => fake()->boolean(20),
            'sleep_walking' => fake()->boolean(8),
            'night_wandering' => fake()->boolean(15),
            // Continence / catheter
            'bowel_control_notes' => fake()->optional(0.3)->sentence(),
            'urinary_catheter' => $urinaryCatheter,
            // Irregular bowel
            'irregular_bowel' => fake()->boolean(15),
            'irregular_bowel_notes' => fake()->optional(0.15)->sentence(),
            // Menstruation
            'menstruation_support' => fake()->boolean(20),
        ];
    }

    /** Camper who needs full assistance with most ADLs. */
    public function fullAssist(): static
    {
        return $this->state(fn () => [
            'bathing_level' => 'full_assist',
            'toileting_level' => 'full_assist',
            'dressing_level' => 'full_assist',
            'oral_hygiene_level' => 'full_assist',
        ]);
    }

    /** Camper who is fully independent across all ADLs. */
    public function independent(): static
    {
        return $this->state(fn () => [
            'bathing_level' => 'independent',
            'toileting_level' => 'independent',
            'dressing_level' => 'independent',
            'oral_hygiene_level' => 'independent',
        ]);
    }

    /** Camper with urinary catheter in place. */
    public function withCatheter(): static
    {
        return $this->state(fn () => [
            'urinary_catheter' => true,
            'toileting_level' => 'full_assist',
            'toileting_notes' => 'CIC required; staff-assisted q4h.',
        ]);
    }

    /** Attach to a specific camper. */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn () => ['camper_id' => $camper->id]);
    }
}
