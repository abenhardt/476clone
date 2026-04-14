<?php

namespace App\Http\Requests\BehavioralProfile;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing behavioral profile.
 *
 * All fields are optional to allow partial updates. Changes to
 * behavioral indicators trigger automatic risk reassessment.
 */
class UpdateBehavioralProfileRequest extends FormRequest
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
        return [
            'aggression' => ['boolean'],
            'self_abuse' => ['boolean'],
            'wandering_risk' => ['boolean'],
            'one_to_one_supervision' => ['boolean'],
            'developmental_delay' => ['boolean'],
            'functioning_age_level' => ['nullable', 'string', 'max:255'],
            'communication_methods' => ['nullable', 'array'],
            'communication_methods.*' => ['string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            // Admin-editable narrative/clinical fields
            'triggers' => ['nullable', 'string', 'max:5000'],
            'de_escalation_strategies' => ['nullable', 'string', 'max:5000'],
            'communication_style' => ['nullable', 'string', 'max:5000'],
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
            'communication_methods.array' => 'Communication methods must be an array.',
        ];
    }
}
