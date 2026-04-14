<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFormFieldOptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $option = $this->route('option');

        return $this->user()->isSuperAdmin() && $option->formField->formSection->formDefinition->isEditable();
    }

    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'required', 'string', 'max:255'],
            'value' => ['sometimes', 'required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
