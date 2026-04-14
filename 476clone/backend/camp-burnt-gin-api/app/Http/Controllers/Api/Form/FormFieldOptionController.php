<?php

namespace App\Http\Controllers\Api\Form;

use App\Http\Controllers\Controller;
use App\Http\Requests\Form\ReorderFormItemsRequest;
use App\Http\Requests\Form\StoreFormFieldOptionRequest;
use App\Http\Requests\Form\UpdateFormFieldOptionRequest;
use App\Models\FormField;
use App\Models\FormFieldOption;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * FormFieldOptionController — manages selectable options for select/radio/checkbox_group fields.
 *
 * All read routes require admin. All mutation routes require super_admin AND the
 * grandparent form_definition must be in 'draft' state — enforced via FormFieldPolicy,
 * using the parent field as the authorization target (managing options = editing the field).
 *
 * GET    /api/form/fields/{field}/options           → list options
 * POST   /api/form/fields/{field}/options           → create option
 * PUT    /api/form/fields/{field}/options/{option}  → update option
 * DELETE /api/form/fields/{field}/options/{option}  → delete option
 * POST   /api/form/fields/{field}/options/reorder   → batch reorder
 */
class FormFieldOptionController extends Controller
{
    public function index(FormField $field): JsonResponse
    {
        $this->authorize('view', $field);

        $options = $field->options->map(fn ($opt) => $this->optionPayload($opt));

        return response()->json(['data' => $options->values()]);
    }

    public function store(StoreFormFieldOptionRequest $request, FormField $field): JsonResponse
    {
        // Managing options is treated as editing the parent field.
        $this->authorize('update', $field);

        $data = $request->validated();
        $data['form_field_id'] = $field->id;

        if (! isset($data['sort_order'])) {
            $data['sort_order'] = $field->options()->max('sort_order') + 1;
        }

        $option = FormFieldOption::create($data);

        return response()->json(['data' => $this->optionPayload($option)], 201);
    }

    public function update(UpdateFormFieldOptionRequest $request, FormField $field, FormFieldOption $option): JsonResponse
    {
        // Verify the option actually belongs to the field in the URL.
        // Prevents cross-field IDOR: a super_admin could update an option from a
        // different field (possibly in a published definition) by crafting the URL.
        abort_if($option->form_field_id !== $field->id, 404);

        $this->authorize('update', $field);

        $option->update($request->validated());

        return response()->json(['data' => $this->optionPayload($option->fresh())]);
    }

    public function destroy(FormField $field, FormFieldOption $option): JsonResponse
    {
        // Verify the option actually belongs to the field in the URL.
        abort_if($option->form_field_id !== $field->id, 404);

        $this->authorize('update', $field);

        $option->delete();

        return response()->json(['message' => 'Option deleted.']);
    }

    /**
     * Batch-update sort_order for options belonging to a field.
     * Scoped to the specific field to prevent cross-field reordering.
     */
    public function reorder(ReorderFormItemsRequest $request, FormField $field): JsonResponse
    {
        $this->authorize('update', $field);

        $ids = $request->validated()['ids'];

        DB::transaction(function () use ($field, $ids) {
            foreach ($ids as $order => $id) {
                // Scope to options belonging to this field only.
                FormFieldOption::where('id', $id)
                    ->where('form_field_id', $field->id)
                    ->update(['sort_order' => $order]);
            }
        });

        return response()->json(['message' => 'Options reordered.']);
    }

    private function optionPayload(FormFieldOption $option): array
    {
        return [
            'id' => $option->id,
            'label' => $option->label,
            'value' => $option->value,
            'sort_order' => $option->sort_order,
            'is_active' => $option->is_active,
        ];
    }
}
