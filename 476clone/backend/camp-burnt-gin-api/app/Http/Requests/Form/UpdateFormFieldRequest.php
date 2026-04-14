<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFormFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        $field = $this->route('field');

        return $this->user()->isSuperAdmin() && $field->formSection->formDefinition->isEditable();
    }

    public function rules(): array
    {
        return [
            'field_key' => ['sometimes', 'required', 'string', 'max:100', 'regex:/^[a-z][a-z0-9_]*$/'],
            'label' => ['sometimes', 'required', 'string', 'max:255'],
            'placeholder' => ['nullable', 'string', 'max:255'],
            'help_text' => ['nullable', 'string', 'max:1000'],
            'field_type' => ['sometimes', 'required', Rule::in([
                'text', 'textarea', 'number', 'date', 'select',
                'radio', 'checkbox', 'checkbox_group', 'file',
                'email', 'phone', 'yesno', 'repeater',
            ])],
            'is_required' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'validation_rules' => ['nullable', 'array'],
            'conditional_logic' => ['nullable', 'array'],
            'default_value' => ['nullable', 'string', 'max:500'],
            'width' => ['nullable', Rule::in(['full', 'half', 'third'])],
        ];
    }
}
