<?php

namespace App\Http\Requests\Form;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFormDefinitionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $form = $this->route('form');

        return $this->user()->isSuperAdmin() && $form->isEditable();
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
