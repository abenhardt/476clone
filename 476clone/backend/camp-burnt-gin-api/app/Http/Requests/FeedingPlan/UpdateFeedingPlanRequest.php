<?php

namespace App\Http\Requests\FeedingPlan;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing feeding plan.
 *
 * All fields are optional to allow partial updates. Changes to
 * G-tube status trigger automatic risk reassessment.
 */
class UpdateFeedingPlanRequest extends FormRequest
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
            'special_diet' => ['boolean'],
            'diet_description' => ['nullable', 'string', 'max:5000'],
            'g_tube' => ['boolean'],
            'formula' => ['nullable', 'string', 'max:255'],
            'amount_per_feeding' => ['nullable', 'string', 'max:255'],
            'feedings_per_day' => ['nullable', 'integer', 'min:1', 'max:24'],
            'feeding_times' => ['nullable', 'array'],
            'feeding_times.*' => ['string', 'max:50'],
            'bolus_only' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:5000'],
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
            'feedings_per_day.min' => 'Feedings per day must be at least 1.',
            'feedings_per_day.max' => 'Feedings per day cannot exceed 24.',
        ];
    }
}
