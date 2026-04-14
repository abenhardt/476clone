<?php

namespace Database\Factories;

use App\Models\Role;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        // Default to applicant role — the most common user type.
        // Looks up the seeded role so tests don't need manual role setup.
        $applicantRole = Role::where('name', 'applicant')->first();

        return [
            'name' => fake()->name(),
            'preferred_name' => fake()->optional(0.4)->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'role_id' => $applicantRole?->id ?? Role::factory()->applicant(),
            'is_active' => true,
            'phone' => fake()->numerify('803#######'),
            'address_line_1' => fake()->streetAddress(),
            'address_line_2' => fake()->optional(0.2)->secondaryAddress(),
            'city' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'postal_code' => fake()->numerify('#####'),
            'country' => 'US',
            'mfa_enabled' => false,
            'mfa_secret' => null,
            'mfa_verified_at' => null,
            'failed_login_attempts' => 0,
            'lockout_until' => null,
            'last_failed_login_at' => null,
            'notification_preferences' => [
                'email_application_updates' => true,
                'email_messages' => true,
                'email_announcements' => true,
            ],
        ];
    }

    /** Applicant (parent/guardian) — the default role; explicit state for clarity. */
    public function applicant(): static
    {
        return $this->state(function () {
            $role = Role::where('name', 'applicant')->first();

            return ['role_id' => $role?->id ?? Role::factory()->applicant()];
        });
    }

    /** Admin user. */
    public function admin(): static
    {
        return $this->state(function () {
            $role = Role::where('name', 'admin')->first();

            return ['role_id' => $role?->id ?? Role::factory()->admin()];
        });
    }

    /** Super-admin user. */
    public function superAdmin(): static
    {
        return $this->state(function () {
            $role = Role::where('name', 'super_admin')->first();

            return ['role_id' => $role?->id ?? Role::factory()->superAdmin()];
        });
    }

    /** Medical provider user. */
    public function medical(): static
    {
        return $this->state(function () {
            $role = Role::where('name', 'medical')->first();

            return ['role_id' => $role?->id ?? Role::factory()->medical()];
        });
    }

    /** User with MFA fully configured and verified. */
    public function withMfa(): static
    {
        return $this->state(fn () => [
            'mfa_enabled' => true,
            'mfa_secret' => Str::random(32),
            'mfa_verified_at' => now()->subHours(2),
        ]);
    }

    /** Locked account — 5 failed attempts, still within lockout window. */
    public function locked(): static
    {
        return $this->state(fn () => [
            'failed_login_attempts' => 5,
            'lockout_until' => now()->addMinutes(3),
            'last_failed_login_at' => now()->subMinutes(2),
        ]);
    }

    /** Deactivated user — cannot log in regardless of password. */
    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /** Unverified email (for registration flow tests). */
    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }
}
