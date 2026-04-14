<?php

namespace Database\Factories;

use App\Enums\ApplicationStatus;
use App\Enums\SubmissionSource;
use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Application>
 */
class ApplicationFactory extends Factory
{
    protected $model = Application::class;

    public function definition(): array
    {
        return [
            'camper_id' => Camper::factory(),
            'camp_session_id' => CampSession::factory(),
            'status' => ApplicationStatus::Submitted,
            'submission_source' => SubmissionSource::Digital,
            'is_draft' => false,
            'submitted_at' => now(),
            'reviewed_at' => null,
            'reviewed_by' => null,
            'notes' => fake()->optional(0.3)->sentence(),
            'first_application' => fake()->boolean(60),
            'attended_before' => fake()->boolean(40),
            'camp_session_id_second' => null,
            // Signature block
            'signature_name' => fake()->name(),
            'signature_data' => null, // base64 SVG/PNG; omit in factory to avoid large payloads
            'signed_at' => now()->subMinutes(5),
            'signed_ip_address' => fake()->ipv4(),
            // Narrative fields — free-form long answers on the application form
            'narrative_rustic_environment' => fake()->optional(0.5)->paragraph(),
            'narrative_staff_suggestions' => fake()->optional(0.5)->paragraph(),
            'narrative_participation_concerns' => fake()->optional(0.4)->paragraph(),
            'narrative_camp_benefit' => fake()->optional(0.6)->paragraph(),
            'narrative_heat_tolerance' => fake()->optional(0.5)->paragraph(),
            'narrative_transportation' => fake()->optional(0.3)->paragraph(),
            'narrative_additional_info' => fake()->optional(0.3)->paragraph(),
            'narrative_emergency_protocols' => fake()->optional(0.4)->paragraph(),
        ];
    }

    /** Unsaved draft — not yet submitted; no signature. */
    public function draft(): static
    {
        return $this->state(fn () => [
            'is_draft' => true,
            'status' => ApplicationStatus::Submitted,
            'submitted_at' => null,
            'signed_at' => null,
        ]);
    }

    /** Application placed under admin review. */
    public function underReview(): static
    {
        return $this->state(fn () => ['status' => ApplicationStatus::UnderReview]);
    }

    /**
     * Approved application.
     * Always sets reviewed_by — an approved application without a reviewer is an invalid state.
     */
    public function approved(): static
    {
        return $this->state(function () {
            $reviewer = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))->first();

            return [
                'status' => ApplicationStatus::Approved,
                'reviewed_at' => now(),
                'reviewed_by' => $reviewer?->id ?? User::factory()->admin(),
            ];
        });
    }

    /** Rejected application. */
    public function rejected(): static
    {
        return $this->state(function () {
            $reviewer = User::whereHas('role', fn ($q) => $q->whereIn('name', ['admin', 'super_admin']))->first();

            return [
                'status' => ApplicationStatus::Rejected,
                'reviewed_at' => now(),
                'reviewed_by' => $reviewer?->id ?? User::factory()->admin(),
                'notes' => fake()->sentence(),
            ];
        });
    }

    /** Waitlisted — session at capacity. */
    public function waitlisted(): static
    {
        return $this->state(fn () => [
            'status' => ApplicationStatus::Waitlisted,
            'reviewed_at' => now(),
        ]);
    }

    /** Cancelled — admin terminated the application. */
    public function cancelled(): static
    {
        return $this->state(fn () => [
            'status' => ApplicationStatus::Cancelled,
            'reviewed_at' => now(),
        ]);
    }

    /** Withdrawn — parent voluntarily withdrew before or after review. */
    public function withdrawn(): static
    {
        return $this->state(fn () => ['status' => ApplicationStatus::Withdrawn]);
    }
}
