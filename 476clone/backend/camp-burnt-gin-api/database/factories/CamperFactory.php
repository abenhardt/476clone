<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Camper>
 */
class CamperFactory extends Factory
{
    protected $model = Camper::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory()->applicant(),
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'preferred_name' => fake()->optional(0.3)->firstName(),
            'date_of_birth' => fake()->dateTimeBetween('-17 years', '-6 years')->format('Y-m-d'),
            'gender' => fake()->randomElement(['male', 'female', 'other', null]),
            'tshirt_size' => fake()->randomElement(['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL']),
            // Standard supervision is the most common; enhanced and one_to_one are deliberately rare
            'supervision_level' => fake()->randomElement(['standard', 'standard', 'standard', 'enhanced', 'one_to_one']),
            // is_active is false by default — set to true only when an application is approved
            'is_active' => false,
            'county' => fake()->optional(0.6)->randomElement([
                'Richland', 'Lexington', 'Greenville', 'Horry', 'Charleston', 'Spartanburg', 'York',
            ]),
            'needs_interpreter' => false,
            'preferred_language' => 'English',
            'applicant_address' => fake()->streetAddress(),
            'applicant_city' => fake()->city(),
            'applicant_state' => 'SC',
            'applicant_zip' => fake()->numerify('#####'),
        ];
    }

    /** Camper owned by a specific user. */
    public function forUser(User $user): static
    {
        return $this->state(fn () => ['user_id' => $user->id]);
    }

    /** Active camper — has an approved application for the current season. */
    public function active(): static
    {
        return $this->state(fn () => ['is_active' => true]);
    }

    /** Inactive — no current approved application. */
    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /** Camper requiring enhanced (not 1:1) supervision level. */
    public function enhanced(): static
    {
        return $this->state(fn () => ['supervision_level' => 'enhanced']);
    }

    /** Camper requiring 1:1 dedicated supervision. */
    public function oneToOne(): static
    {
        return $this->state(fn () => ['supervision_level' => 'one_to_one']);
    }

    /** Camper from a non-English-speaking family that needs an interpreter. */
    public function withInterpreter(): static
    {
        return $this->state(fn () => [
            'needs_interpreter' => true,
            'preferred_language' => 'Spanish',
        ]);
    }
}
