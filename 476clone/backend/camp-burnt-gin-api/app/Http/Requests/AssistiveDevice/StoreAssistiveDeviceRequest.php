<?php

namespace App\Http\Requests\AssistiveDevice;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new assistive device record.
 *
 * Validates device information including type and transfer
 * assistance requirements for appropriate accessibility planning.
 */
class StoreAssistiveDeviceRequest extends FormRequest
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
            'device_type' => ['required', 'string', 'max:255'],
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
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'device_type.required' => 'Device type is required.',
        ];
    }
}
