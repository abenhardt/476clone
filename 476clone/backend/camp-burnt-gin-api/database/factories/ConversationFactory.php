<?php

namespace Database\Factories;

use App\Models\Application;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Conversation>
 */
class ConversationFactory extends Factory
{
    protected $model = Conversation::class;

    public function definition(): array
    {
        return [
            'created_by_id' => User::factory(),
            'subject' => fake()->sentence(),
            'category' => fake()->randomElement(['General', 'Medical', 'Application']),
            'application_id' => null,
            'camper_id' => null,
            'camp_session_id' => null,
            'last_message_at' => now(),
            'is_archived' => false,
        ];
    }

    /** Conversation about a specific application. */
    public function forApplication(?int $applicationId = null): static
    {
        return $this->state(fn () => [
            'application_id' => $applicationId ?? Application::factory(),
            'category' => 'Application',
        ]);
    }

    /** Conversation linked to a specific camper. */
    public function forCamper(?int $camperId = null): static
    {
        return $this->state(fn () => [
            'camper_id' => $camperId ?? Camper::factory(),
        ]);
    }

    /** Conversation linked to a camp session (e.g., broadcast messages). */
    public function forCampSession(?int $campSessionId = null): static
    {
        return $this->state(fn () => [
            'camp_session_id' => $campSessionId ?? CampSession::factory(),
        ]);
    }

    /** Archived conversation — moved out of primary inbox. */
    public function archived(): static
    {
        return $this->state(fn () => ['is_archived' => true]);
    }

    /** Conversation created by a specific user. */
    public function createdBy(User $user): static
    {
        return $this->state(fn () => ['created_by_id' => $user->id]);
    }

    /** Medical category conversation. */
    public function medical(): static
    {
        return $this->state(fn () => ['category' => 'Medical']);
    }
}
