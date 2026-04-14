<?php

namespace App\Http\Requests\Allergy;

use App\Enums\AllergySeverity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for updating an existing allergy record.
 *
 * Validates updates to allergy information. All fields are
 * optional to allow partial updates.
 */
class UpdateAllergyRequest extends FormRequest
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
            'allergen' => ['sometimes', 'required', 'string', 'max:255'],
            'severity' => ['sometimes', 'required', Rule::enum(AllergySeverity::class)],
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
            'severity.enum' => 'The selected severity level is invalid.',
        ];
    }
}
