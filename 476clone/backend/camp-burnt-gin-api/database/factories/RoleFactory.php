<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Role>
 */
class RoleFactory extends Factory
{
    protected $model = Role::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
            'description' => fake()->sentence(),
        ];
    }

    /** Applicant (parent/guardian) role — the actual system role name is 'applicant', not 'parent'. */
    public function applicant(): static
    {
        return $this->state(fn () => [
            'name' => 'applicant',
            'description' => 'Parent or guardian of campers',
        ]);
    }

    public function admin(): static
    {
        return $this->state(fn () => [
            'name' => 'admin',
            'description' => 'Camp administrator with full access',
        ]);
    }

    public function superAdmin(): static
    {
        return $this->state(fn () => [
            'name' => 'super_admin',
            'description' => 'Super administrator — full system access including user management',
        ]);
    }

    public function medical(): static
    {
        return $this->state(fn () => [
            'name' => 'medical',
            'description' => 'Medical provider with read-only access to active camper records',
        ]);
    }
}
