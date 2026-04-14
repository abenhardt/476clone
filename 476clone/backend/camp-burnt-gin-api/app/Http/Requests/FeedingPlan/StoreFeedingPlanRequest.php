<?php

namespace App\Http\Requests\FeedingPlan;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new feeding plan.
 *
 * Validates dietary requirements and tube feeding protocols.
 * G-tube feeding requires specialized staff training and
 * enteral feeding action plan documentation.
 */
class StoreFeedingPlanRequest extends FormRequest
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
            'special_diet' => ['boolean'],
            'diet_description' => ['nullable', 'string', 'max:5000'],
            'texture_modified' => ['nullable', 'boolean'],
            'texture_level' => ['nullable', 'string', 'max:100'],
            'fluid_restriction' => ['nullable', 'boolean'],
            'fluid_details' => ['nullable', 'string', 'max:2000'],
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
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'feedings_per_day.min' => 'Feedings per day must be at least 1.',
            'feedings_per_day.max' => 'Feedings per day cannot exceed 24.',
        ];
    }
}
