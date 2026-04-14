<?php

namespace App\Http\Requests\BehavioralProfile;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new behavioral profile.
 *
 * Validates behavioral characteristics, developmental status, and
 * supervision requirements. High-risk behaviors trigger enhanced
 * supervision levels automatically.
 */
class StoreBehavioralProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();

        $camperRule = $user->isAdmin() || $user->isMedicalProvider()
            ? ['required', 'integer', 'exists:campers,id']
            : ['required', 'integer', Rule::exists('campers', 'id')->where('user_id', $user->id)];

        return [
            'camper_id' => $camperRule,
            'aggression' => ['boolean'],
            'self_abuse' => ['boolean'],
            'wandering_risk' => ['boolean'],
            'one_to_one_supervision' => ['boolean'],
            'developmental_delay' => ['boolean'],
            'functional_reading' => ['nullable', 'boolean'],
            'functional_writing' => ['nullable', 'boolean'],
            'independent_mobility' => ['nullable', 'boolean'],
            'verbal_communication' => ['nullable', 'boolean'],
            'social_skills' => ['nullable', 'boolean'],
            'behavior_plan' => ['nullable', 'boolean'],
            'functioning_age_level' => ['nullable', 'string', 'max:255'],
            'communication_methods' => ['nullable', 'array'],
            'communication_methods.*' => ['string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            // Form parity flags (2026_03_26_000001)
            'sexual_behaviors' => ['nullable', 'boolean'],
            'interpersonal_behavior' => ['nullable', 'boolean'],
            'social_emotional' => ['nullable', 'boolean'],
            'follows_instructions' => ['nullable', 'boolean'],
            'group_participation' => ['nullable', 'boolean'],
            'attends_school' => ['nullable', 'boolean'],
            'classroom_type' => ['nullable', 'string', 'max:200'],
            // Per-item descriptions
            'aggression_description' => ['nullable', 'string', 'max:2000'],
            'self_abuse_description' => ['nullable', 'string', 'max:2000'],
            'one_to_one_description' => ['nullable', 'string', 'max:2000'],
            'wandering_description' => ['nullable', 'string', 'max:2000'],
            'sexual_behaviors_description' => ['nullable', 'string', 'max:2000'],
            'interpersonal_behavior_description' => ['nullable', 'string', 'max:2000'],
            'social_emotional_description' => ['nullable', 'string', 'max:2000'],
            'follows_instructions_description' => ['nullable', 'string', 'max:2000'],
            'group_participation_description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'communication_methods.array' => 'Communication methods must be an array.',
        ];
    }
}
