<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFormFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        $section = $this->route('section');

        return $this->user()->isSuperAdmin() && $section->formDefinition->isEditable();
    }

    public function rules(): array
    {
        return [
            'field_key' => ['required', 'string', 'max:100', 'regex:/^[a-z][a-z0-9_]*$/'],
            'label' => ['required', 'string', 'max:255'],
            'placeholder' => ['nullable', 'string', 'max:255'],
            'help_text' => ['nullable', 'string', 'max:1000'],
            'field_type' => ['required', Rule::in([
                'text', 'textarea', 'number', 'date', 'select',
                'radio', 'checkbox', 'checkbox_group', 'file',
                'email', 'phone', 'yesno', 'repeater',
            ])],
            'is_required' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'validation_rules' => ['nullable', 'array'],
            'conditional_logic' => ['nullable', 'array'],
            'default_value' => ['nullable', 'string', 'max:500'],
            'width' => ['nullable', Rule::in(['full', 'half', 'third'])],
        ];
    }

    public function messages(): array
    {
        return [
            'field_key.regex' => 'field_key must be snake_case (lowercase letters, digits, underscores, starting with a letter).',
        ];
    }
}
