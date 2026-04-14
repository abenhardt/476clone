<?php

namespace Database\Factories;

use App\Models\ApplicationDraft;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ApplicationDraft>
 */
class ApplicationDraftFactory extends Factory
{
    protected $model = ApplicationDraft::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'label' => fake()->name(),
            'draft_data' => null,
        ];
    }
}
