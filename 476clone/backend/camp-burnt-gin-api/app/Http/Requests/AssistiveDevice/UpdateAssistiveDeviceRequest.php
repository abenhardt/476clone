<?php

namespace App\Http\Requests\AssistiveDevice;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Form request for updating an existing assistive device record.
 *
 * All fields are optional to allow partial updates. Changes to
 * transfer assistance requirements trigger automatic risk reassessment.
 */
class UpdateAssistiveDeviceRequest extends FormRequest
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
            'device_type' => ['sometimes', 'required', 'string', 'max:255'],
            'requires_transfer_assistance' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:2000'],
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
            'device_type.required' => 'Device type is required.',
        ];
    }
}
