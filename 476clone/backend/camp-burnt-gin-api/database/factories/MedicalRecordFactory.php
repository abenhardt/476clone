<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\MedicalRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MedicalRecord>
 */
class MedicalRecordFactory extends Factory
{
    protected $model = MedicalRecord::class;

    public function definition(): array
    {
        $hasSeizures = fake()->boolean(15);

        return [
            'camper_id' => Camper::factory(),
            // is_active mirrors the camper's enrollment status — false by default
            'is_active' => false,
            'date_of_medical_exam' => fake()->optional(0.7)->dateTimeBetween('-18 months', 'now')?->format('Y-m-d'),
            // Physician contact
            'physician_name' => 'Dr. '.fake()->lastName(),
            'physician_phone' => fake()->numerify('803#######'),
            'physician_address' => fake()->optional(0.6)->streetAddress(),
            // Insurance
            'insurance_provider' => fake()->randomElement([
                'BlueCross BlueShield SC', 'Medicaid', 'United Healthcare', 'Aetna', 'Cigna', null,
            ]),
            'insurance_policy_number' => fake()->optional(0.8)->regexify('[A-Z]{3}[0-9]{9}'),
            'insurance_group' => fake()->optional(0.6)->numerify('GRP-#####'),
            'medicaid_number' => null,
            // General health
            'special_needs' => fake()->optional(0.4)->paragraph(),
            'dietary_restrictions' => fake()->optional(0.3)->sentence(),
            'immunizations_current' => fake()->boolean(85),
            'tetanus_date' => fake()->optional(0.7)->dateTimeBetween('-5 years', '-6 months')?->format('Y-m-d'),
            'mobility_notes' => fake()->optional(0.3)->sentence(),
            // Seizure disorder
            'has_seizures' => $hasSeizures,
            'last_seizure_date' => $hasSeizures ? fake()->dateTimeBetween('-2 years', '-1 month')?->format('Y-m-d') : null,
            'seizure_description' => $hasSeizures ? fake()->paragraph() : null,
            'has_neurostimulator' => $hasSeizures && fake()->boolean(20),
            // Current health status flags
            'has_contagious_illness' => false,
            'contagious_illness_description' => null,
            'has_recent_illness' => false,
            'recent_illness_description' => null,
            'tubes_in_ears' => fake()->boolean(10),
            'notes' => fake()->optional(0.3)->paragraph(),
        ];
    }

    /** Active record — camper has an approved application this season. */
    public function active(): static
    {
        return $this->state(fn () => ['is_active' => true]);
    }

    /** Inactive record — no current enrollment. */
    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /** Seizure disorder — includes last date and protocol description. */
    public function withSeizures(): static
    {
        return $this->state(fn () => [
            'has_seizures' => true,
            'last_seizure_date' => fake()->dateTimeBetween('-1 year', '-1 month')->format('Y-m-d'),
            'seizure_description' => fake()->paragraph(),
        ]);
    }

    /** Camper covered by Medicaid rather than private insurance. */
    public function withMedicaid(): static
    {
        return $this->state(fn () => [
            'insurance_provider' => 'Medicaid',
            'insurance_policy_number' => null,
            'insurance_group' => null,
            'medicaid_number' => fake()->numerify('MCD-#########'),
        ]);
    }

    /** Attach to a specific camper. */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn () => ['camper_id' => $camper->id]);
    }
}
