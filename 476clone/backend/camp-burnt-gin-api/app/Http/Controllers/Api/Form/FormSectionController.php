<?php

namespace App\Http\Controllers\Api\Form;

use App\Http\Controllers\Controller;
use App\Http\Requests\Form\ReorderFormItemsRequest;
use App\Http\Requests\Form\StoreFormSectionRequest;
use App\Http\Requests\Form\UpdateFormSectionRequest;
use App\Models\FormDefinition;
use App\Models\FormSection;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * FormSectionController — manages sections within a form definition.
 *
 * All mutation routes require super_admin AND the parent definition must be 'draft'.
 *
 * GET    /api/form/definitions/{form}/sections           → list sections
 * POST   /api/form/definitions/{form}/sections           → create section
 * PUT    /api/form/definitions/{form}/sections/{section} → update section
 * DELETE /api/form/definitions/{form}/sections/{section} → delete section
 * POST   /api/form/definitions/{form}/sections/reorder   → batch reorder
 */
class FormSectionController extends Controller
{
    public function index(FormDefinition $form): JsonResponse
    {
        $this->authorize('view', $form);

        $sections = $form->sections->map(fn ($s) => $this->sectionPayload($s));

        return response()->json(['data' => $sections->values()]);
    }

    public function store(StoreFormSectionRequest $request, FormDefinition $form): JsonResponse
    {
        // Build a transient section to authorize against FormSectionPolicy::create().
        $transient = new FormSection(['form_definition_id' => $form->id]);
        $transient->setRelation('formDefinition', $form);
        $this->authorize('create', $transient);

        $data = $request->validated();
        $data['form_definition_id'] = $form->id;

        if (! isset($data['sort_order'])) {
            $data['sort_order'] = $form->sections()->max('sort_order') + 1;
        }

        $section = FormSection::create($data);

        return response()->json(['data' => $this->sectionPayload($section)], 201);
    }

    public function update(UpdateFormSectionRequest $request, FormDefinition $form, FormSection $section): JsonResponse
    {
        // Verify the section actually belongs to the form in the URL.
        // Without this check a super_admin could edit a section from a different
        // definition by crafting the URL (e.g. PUT /definitions/1/sections/99
        // where section 99 belongs to definition 5).
        abort_if($section->form_definition_id !== $form->id, 404);

        $this->authorize('update', $section);

        $section->update($request->validated());

        return response()->json(['data' => $this->sectionPayload($section->fresh())]);
    }

    public function destroy(FormDefinition $form, FormSection $section): JsonResponse
    {
        // Verify the section actually belongs to the form in the URL.
        abort_if($section->form_definition_id !== $form->id, 404);

        $this->authorize('delete', $section);

        $section->delete();

        return response()->json(['message' => 'Section deleted.']);
    }

    /**
     * Batch-update sort_order for a set of section IDs.
     * Body: { ids: [3, 1, 2] } — the array position becomes the new sort_order.
     *
     * Authorized against the form definition (super_admin + editable) since
     * reordering is a definition-level structural change.
     */
    public function reorder(ReorderFormItemsRequest $request, FormDefinition $form): JsonResponse
    {
        // Authorize as a definition update (requires super_admin + draft status).
        $this->authorize('update', $form);

        $ids = $request->validated()['ids'];

        DB::transaction(function () use ($form, $ids) {
            foreach ($ids as $order => $id) {
                // Scope the update to sections belonging to this definition only.
                FormSection::where('id', $id)
                    ->where('form_definition_id', $form->id)
                    ->update(['sort_order' => $order]);
            }
        });

        return response()->json(['message' => 'Sections reordered.']);
    }

    private function sectionPayload(FormSection $section): array
    {
        return [
            'id' => $section->id,
            'title' => $section->title,
            'short_title' => $section->short_title,
            'description' => $section->description,
            'icon_name' => $section->icon_name,
            'sort_order' => $section->sort_order,
            'is_active' => $section->is_active,
            'field_count' => $section->fields()->count(),
        ];
    }
}
