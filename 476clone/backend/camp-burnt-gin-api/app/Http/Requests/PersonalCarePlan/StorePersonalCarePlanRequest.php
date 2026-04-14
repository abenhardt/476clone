<?php

namespace App\Http\Requests\PersonalCarePlan;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the personal care plan payload from the application form (Section 6).
 *
 * All fields are nullable — the form captures these on a best-effort basis;
 * not every camper will have information in every category.
 *
 * Level fields accept the four ADL assistance levels or null:
 *   independent | verbal_cue | physical_assist | full_assist
 */
class StorePersonalCarePlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Authorization is handled in the controller via Policy.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $levels = 'nullable|string|in:independent,verbal_cue,physical_assist,full_assist';

        return [
            'bathing_level' => $levels,
            'bathing_notes' => 'nullable|string|max:2000',
            'toileting_level' => $levels,
            'toileting_notes' => 'nullable|string|max:2000',
            'nighttime_toileting' => 'nullable|boolean',
            'nighttime_notes' => 'nullable|string|max:2000',
            'dressing_level' => $levels,
            'dressing_notes' => 'nullable|string|max:2000',
            'oral_hygiene_level' => $levels,
            'oral_hygiene_notes' => 'nullable|string|max:2000',
            'positioning_notes' => 'nullable|string|max:2000',
            'sleep_notes' => 'nullable|string|max:2000',
            'falling_asleep_issues' => 'nullable|boolean',
            'sleep_walking' => 'nullable|boolean',
            'night_wandering' => 'nullable|boolean',
            'bowel_control_notes' => 'nullable|string|max:2000',
            'urinary_catheter' => 'nullable|boolean',
            // Form parity (2026_03_26_000005)
            'irregular_bowel' => 'nullable|boolean',
            'irregular_bowel_notes' => 'nullable|string|max:2000',
            'menstruation_support' => 'nullable|boolean',
        ];
    }
}
