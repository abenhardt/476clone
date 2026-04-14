<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\EmergencyContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\EmergencyContact>
 */
class EmergencyContactFactory extends Factory
{
    protected $model = EmergencyContact::class;

    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'name' => fake()->name(),
            'relationship' => fake()->randomElement(['Mother', 'Father', 'Grandparent', 'Aunt', 'Uncle', 'Guardian', 'Stepparent']),
            'phone_primary' => fake()->numerify('803#######'),
            'phone_secondary' => fake()->optional(0.5)->numerify('803#######'),
            'phone_work' => fake()->optional(0.4)->numerify('803#######'),
            'email' => fake()->optional(0.7)->safeEmail(),
            'is_primary' => false, // use .primary() state explicitly
            'is_authorized_pickup' => fake()->boolean(60),
            'is_guardian' => false,
            // Address for pickup logistics
            'address' => fake()->optional(0.5)->streetAddress(),
            'city' => fake()->optional(0.5)->city(),
            'state' => fake()->optional(0.5)->stateAbbr(),
            'zip' => fake()->optional(0.5)->numerify('#####'),
            // Language
            'primary_language' => 'English',
            'interpreter_needed' => false,
        ];
    }

    /** The primary emergency contact for this camper. */
    public function primary(): static
    {
        return $this->state(fn () => ['is_primary' => true]);
    }

    /** Contact authorized to pick up the camper. */
    public function authorizedPickup(): static
    {
        return $this->state(fn () => ['is_authorized_pickup' => true]);
    }

    /** Contact is a legal guardian — also primary and authorized pickup by default. */
    public function guardian(): static
    {
        return $this->state(fn () => [
            'is_guardian' => true,
            'is_primary' => true,
            'is_authorized_pickup' => true,
        ]);
    }

    /** Spanish-speaking contact requiring interpreter services. */
    public function spanishWithInterpreter(): static
    {
        return $this->state(fn () => [
            'primary_language' => 'Spanish',
            'interpreter_needed' => true,
        ]);
    }

    /** Attach to a specific camper. */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn () => ['camper_id' => $camper->id]);
    }
}
