<?php

namespace Database\Factories;

use App\Models\AssistiveDevice;
use App\Models\Camper;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Factory for creating AssistiveDevice model instances in tests.
 *
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\AssistiveDevice>
 */
class AssistiveDeviceFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var class-string<\Illuminate\Database\Eloquent\Model>
     */
    protected $model = AssistiveDevice::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $devices = [
            'Wheelchair',
            'Walker',
            'Crutches',
            'Cane',
            'Gait Trainer',
            'Communication Device',
            'Hearing Aid',
            'Glasses',
            'Ankle-Foot Orthosis (AFO)',
            'Nebulizer',
        ];

        $deviceType = fake()->randomElement($devices);
        $isMobilityDevice = in_array($deviceType, ['Wheelchair', 'Walker', 'Gait Trainer']);

        return [
            'camper_id' => Camper::factory(),
            'device_type' => $deviceType,
            'requires_transfer_assistance' => $isMobilityDevice ? fake()->boolean(60) : false,
            'notes' => fake()->optional()->sentence(),
        ];
    }

    /**
     * Create an assistive device requiring transfer assistance.
     */
    public function requiresTransfer(): static
    {
        return $this->state(fn (array $attributes) => [
            'device_type' => fake()->randomElement(['Wheelchair', 'Walker', 'Gait Trainer']),
            'requires_transfer_assistance' => true,
        ]);
    }

    /**
     * Create a wheelchair device.
     */
    public function wheelchair(): static
    {
        return $this->state(fn (array $attributes) => [
            'device_type' => 'Wheelchair',
            'requires_transfer_assistance' => fake()->boolean(70),
        ]);
    }

    /**
     * Create a communication device.
     */
    public function communicationDevice(): static
    {
        return $this->state(fn (array $attributes) => [
            'device_type' => 'Communication Device',
            'requires_transfer_assistance' => false,
        ]);
    }

    /**
     * Create an assistive device for a specific camper.
     */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn (array $attributes) => [
            'camper_id' => $camper->id,
        ]);
    }
}
