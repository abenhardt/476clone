<?php

namespace App\Http\Controllers\Api\Form;

use App\Exceptions\FormFieldKeyChangeException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Form\ReorderFormItemsRequest;
use App\Http\Requests\Form\StoreFormFieldRequest;
use App\Http\Requests\Form\UpdateFormFieldRequest;
use App\Models\FormField;
use App\Models\FormSection;
use App\Services\Form\FormBuilderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * FormFieldController — manages fields within a form section.
 *
 * GET    /api/form/sections/{section}/fields           → list fields
 * POST   /api/form/sections/{section}/fields           → create field
 * PUT    /api/form/sections/{section}/fields/{field}   → update field
 * DELETE /api/form/sections/{section}/fields/{field}   → delete field
 * POST   /api/form/sections/{section}/fields/reorder   → batch reorder
 * POST   /api/form/fields/{field}/activate             → set is_active = true
 * POST   /api/form/fields/{field}/deactivate           → set is_active = false
 */
class FormFieldController extends Controller
{
    public function __construct(
        protected FormBuilderService $builder
    ) {}

    public function index(FormSection $section): JsonResponse
    {
        $this->authorize('viewAny', FormField::class);

        $fields = $section->fields()->with('options')->get()->map(fn ($f) => $this->fieldPayload($f));

        return response()->json(['data' => $fields->values()]);
    }

    public function store(StoreFormFieldRequest $request, FormSection $section): JsonResponse
    {
        // Build a transient field to authorize against FormFieldPolicy::create().
        $section->loadMissing('formDefinition');
        $transient = new FormField(['form_section_id' => $section->id]);
        $transient->setRelation('formSection', $section);
        $this->authorize('create', $transient);

        $data = $request->validated();
        $data['form_section_id'] = $section->id;

        if (! isset($data['sort_order'])) {
            $data['sort_order'] = $section->fields()->max('sort_order') + 1;
        }

        $field = FormField::create($data);
        $field->load('options');

        return response()->json(['data' => $this->fieldPayload($field)], 201);
    }

    public function update(UpdateFormFieldRequest $request, FormSection $section, FormField $field): JsonResponse
    {
        // Verify the field actually belongs to the section in the URL.
        // Prevents cross-section IDOR: a super_admin editing a field from a different
        // section (possibly in a published definition) by crafting the URL.
        abort_if($field->form_section_id !== $section->id, 404);

        $this->authorize('update', $field);

        $validated = $request->validated();

        // Guard against field_key change when submitted applications already reference it.
        if (isset($validated['field_key']) && $validated['field_key'] !== $field->field_key) {
            try {
                $this->builder->validateKeyChange($field, $validated['field_key']);
            } catch (FormFieldKeyChangeException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $field->update($validated);
        $field->load('options');

        return response()->json(['data' => $this->fieldPayload($field->fresh())]);
    }

    public function destroy(FormSection $section, FormField $field): JsonResponse
    {
        // Verify the field actually belongs to the section in the URL.
        abort_if($field->form_section_id !== $section->id, 404);

        $this->authorize('delete', $field);

        $field->delete();

        return response()->json(['message' => 'Field deleted.']);
    }

    /**
     * Batch-update sort_order for fields within a section.
     * Authorized against the parent form definition (super_admin + editable).
     */
    public function reorder(ReorderFormItemsRequest $request, FormSection $section): JsonResponse
    {
        $section->loadMissing('formDefinition');
        $this->authorize('update', $section->formDefinition);

        $ids = $request->validated()['ids'];

        DB::transaction(function () use ($section, $ids) {
            foreach ($ids as $order => $id) {
                // Scope to fields belonging to this section only.
                FormField::where('id', $id)
                    ->where('form_section_id', $section->id)
                    ->update(['sort_order' => $order]);
            }
        });

        return response()->json(['message' => 'Fields reordered.']);
    }

    public function activate(FormField $field): JsonResponse
    {
        $this->authorize('update', $field);

        $field->update(['is_active' => true]);

        return response()->json(['data' => ['id' => $field->id, 'is_active' => true]]);
    }

    public function deactivate(FormField $field): JsonResponse
    {
        $this->authorize('update', $field);

        $field->update(['is_active' => false]);

        return response()->json(['data' => ['id' => $field->id, 'is_active' => false]]);
    }

    private function fieldPayload(FormField $field): array
    {
        return [
            'id' => $field->id,
            'field_key' => $field->field_key,
            'label' => $field->label,
            'placeholder' => $field->placeholder,
            'help_text' => $field->help_text,
            'field_type' => $field->field_type,
            'is_required' => $field->is_required,
            'is_active' => $field->is_active,
            'sort_order' => $field->sort_order,
            'validation_rules' => $field->validation_rules,
            'conditional_logic' => $field->conditional_logic,
            'default_value' => $field->default_value,
            'width' => $field->width,
            'options' => $field->options->map(fn ($opt) => [
                'id' => $opt->id,
                'label' => $opt->label,
                'value' => $opt->value,
                'sort_order' => $opt->sort_order,
                'is_active' => $opt->is_active,
            ])->values(),
        ];
    }
}
