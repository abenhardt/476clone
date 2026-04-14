<?php

namespace App\Http\Requests\Allergy;

use App\Enums\AllergySeverity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new allergy record.
 *
 * Validates allergy information including allergen, severity,
 * reaction details, and treatment protocols.
 */
class StoreAllergyRequest extends FormRequest
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
            'allergen' => ['required', 'string', 'max:255'],
            'severity' => ['required', Rule::enum(AllergySeverity::class)],
            'reaction' => ['nullable', 'string', 'max:2000'],
            'treatment' => ['nullable', 'string', 'max:2000'],
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
            'severity.enum' => 'The selected severity level is invalid.',
        ];
    }
}
