<?php

namespace Database\Factories;

use App\Models\Camper;
use App\Models\FeedingPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\FeedingPlan>
 */
class FeedingPlanFactory extends Factory
{
    protected $model = FeedingPlan::class;

    public function definition(): array
    {
        $specialDiet = fake()->boolean(30);
        $gTube = fake()->boolean(15);
        $textureModified = fake()->boolean(20);

        $diets = ['Gluten-Free', 'Dairy-Free', 'Vegetarian', 'Vegan', 'Nut-Free', 'Low Sugar'];
        $formulas = ['Pediasure', 'Boost', 'Ensure', 'Nutren Junior', 'Compleat Pediatric'];
        $textureLevels = ['Minced & Moist', 'Soft & Bite-Sized', 'Liquidised', 'Pureed', 'Moderately Thick'];

        return [
            'camper_id' => Camper::factory(),
            'special_diet' => $specialDiet,
            'diet_description' => $specialDiet ? fake()->randomElement($diets).' diet' : null,
            'g_tube' => $gTube,
            'formula' => $gTube ? fake()->randomElement($formulas) : null,
            'amount_per_feeding' => $gTube ? fake()->randomElement(['240ml', '300ml', '360ml']) : null,
            'feedings_per_day' => $gTube ? fake()->numberBetween(3, 6) : null,
            'feeding_times' => $gTube ? ['08:00', '12:00', '18:00'] : null,
            'bolus_only' => $gTube ? fake()->boolean(70) : false,
            // Texture modification (IDDSI framework)
            'texture_modified' => $textureModified,
            'texture_level' => $textureModified ? fake()->randomElement($textureLevels) : null,
            // Fluid restriction — rare; typically cardiac or renal conditions
            'fluid_restriction' => fake()->boolean(10),
            'fluid_details' => fake()->optional(0.1)->sentence(),
            'notes' => fake()->optional(0.3)->sentence(),
        ];
    }

    /** Feeding plan with G-tube formula administration. */
    public function withGTube(): static
    {
        return $this->state(fn () => [
            'g_tube' => true,
            'formula' => fake()->randomElement(['Pediasure', 'Boost', 'Ensure']),
            'amount_per_feeding' => fake()->randomElement(['240ml', '300ml', '360ml']),
            'feedings_per_day' => fake()->numberBetween(3, 6),
            'feeding_times' => ['08:00', '12:00', '18:00'],
            'bolus_only' => true,
        ]);
    }

    /** Diet restriction only — no tube feeding or texture modification. */
    public function specialDietOnly(): static
    {
        return $this->state(fn () => [
            'special_diet' => true,
            'diet_description' => fake()->randomElement(['Gluten-Free', 'Dairy-Free', 'Vegetarian']).' diet',
            'g_tube' => false,
            'formula' => null,
            'amount_per_feeding' => null,
            'feedings_per_day' => null,
            'feeding_times' => null,
            'bolus_only' => false,
            'texture_modified' => false,
            'texture_level' => null,
        ]);
    }

    /** Texture-modified diet for dysphagia or swallowing difficulty. */
    public function textureModified(): static
    {
        return $this->state(fn () => [
            'texture_modified' => true,
            'texture_level' => fake()->randomElement(['Pureed', 'Minced & Moist', 'Soft & Bite-Sized']),
        ]);
    }

    /** Attach to a specific camper. */
    public function forCamper(Camper $camper): static
    {
        return $this->state(fn () => ['camper_id' => $camper->id]);
    }
}
