<?php

namespace App\Http\Requests\ActivityPermission;

use App\Enums\ActivityPermissionLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new activity permission record.
 *
 * Validates activity participation restrictions. Restricted activities
 * require detailed notes explaining specific limitations or accommodations.
 */
class StoreActivityPermissionRequest extends FormRequest
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
            'activity_name' => ['required', 'string', 'max:255'],
            'permission_level' => ['required', Rule::enum(ActivityPermissionLevel::class)],
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
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'permission_level.enum' => 'The selected permission level is invalid.',
            'restriction_notes.required' => 'Restriction notes are required when permission level is restricted.',
        ];
    }
}
