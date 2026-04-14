<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;

class StoreFormFieldOptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $field = $this->route('field');

        return $this->user()->isSuperAdmin() && $field->formSection->formDefinition->isEditable();
    }

    public function rules(): array
    {
        return [
            'label' => ['required', 'string', 'max:255'],
            'value' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
