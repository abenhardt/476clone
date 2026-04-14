<?php

namespace App\Http\Requests\ActivityPermission;

use App\Enums\ActivityPermissionLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for updating an existing activity permission record.
 *
 * All fields are optional to allow partial updates. Restriction notes
 * are required when changing permission level to restricted.
 */
class UpdateActivityPermissionRequest extends FormRequest
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
            'activity_name' => ['sometimes', 'required', 'string', 'max:255'],
            'permission_level' => ['sometimes', 'required', Rule::enum(ActivityPermissionLevel::class)],
            'restriction_notes' => [
                Rule::requiredIf(function () {
                    return $this->input('permission_level') === ActivityPermissionLevel::Restricted->value;
                }),
                'nullable',
                'string',
                'max:2000',
            ],
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
            'permission_level.enum' => 'The selected permission level is invalid.',
            'restriction_notes.required' => 'Restriction notes are required when permission level is restricted.',
        ];
    }
}
