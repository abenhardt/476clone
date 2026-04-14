<?php

namespace App\Http\Requests\Application;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates digital signature requests for applications.
 *
 * Ensures signature data and acknowledgment are properly provided.
 * Implements FR-9: Digital signature requirements.
 */
class SignApplicationRequest extends FormRequest
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
            'signature_data' => ['required', 'string'],
            'signature_name' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * Get custom error messages for validation rules.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'signature_data.required' => 'Signature is required.',
            'signature_name.required' => 'Please type your full legal name.',
        ];
    }
}
