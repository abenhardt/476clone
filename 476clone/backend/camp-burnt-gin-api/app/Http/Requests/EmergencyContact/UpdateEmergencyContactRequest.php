<?php

namespace App\Http\Requests\EmergencyContact;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing emergency contact.
 *
 * Validates updates to contact information. All fields are
 * optional to allow partial updates.
 */
class UpdateEmergencyContactRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'relationship' => ['sometimes', 'required', 'string', 'max:100'],
            'phone_primary' => ['sometimes', 'required', 'string', 'max:20'],
            'phone_secondary' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'is_primary' => ['boolean'],
            'is_authorized_pickup' => ['boolean'],
            // Form parity fields — added to match StoreEmergencyContactRequest (2026_03_26_000003)
            // Uses 'sometimes' for PATCH semantics: only validated when present in the request
            'phone_work' => ['sometimes', 'nullable', 'string', 'max:20'],
            'primary_language' => ['sometimes', 'nullable', 'string', 'max:100'],
            'interpreter_needed' => ['sometimes', 'nullable', 'boolean'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'state' => ['sometimes', 'nullable', 'string', 'max:50'],
            'zip' => ['sometimes', 'nullable', 'string', 'max:20'],
        ];
    }
}
