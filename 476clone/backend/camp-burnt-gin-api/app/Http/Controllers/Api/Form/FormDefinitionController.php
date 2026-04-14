<?php

namespace App\Http\Controllers\Api\Form;

use App\Http\Controllers\Controller;
use App\Http\Requests\Form\StoreFormDefinitionRequest;
use App\Http\Requests\Form\UpdateFormDefinitionRequest;
use App\Models\FormDefinition;
use App\Services\Form\FormBuilderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

/**
 * FormDefinitionController — manages versioned application form definitions.
 *
 * Admin-accessible routes (read):
 *   GET /api/form/definitions         → list all versions
 *   GET /api/form/definitions/{form}  → full definition with sections and fields
 *
 * Super admin only routes (mutations):
 *   POST   /api/form/definitions                     → create new draft
 *   PUT    /api/form/definitions/{form}              → update draft metadata
 *   DELETE /api/form/definitions/{form}              → delete unpublished draft
 *   POST   /api/form/definitions/{form}/publish      → publish draft → active
 *   POST   /api/form/definitions/{form}/duplicate    → copy into new draft
 */
class FormDefinitionController extends Controller
{
    public function __construct(
        protected FormBuilderService $builder
    ) {}

    /**
     * List all form definition versions.
     * Returns lightweight list (no sections/fields loaded).
     */
    public function index(): JsonResponse
    {
        $this->authorize('viewAny', FormDefinition::class);

        $definitions = FormDefinition::with('createdBy:id,name')
            ->withCount('sections')
            ->orderByDesc('version')
            ->get()
            ->map(fn ($def) => [
                'id' => $def->id,
                'name' => $def->name,
                'version' => $def->version,
                'status' => $def->status,
                'description' => $def->description,
                'published_at' => $def->published_at?->toIso8601String(),
                'created_by' => $def->createdBy?->name,
                'created_at' => $def->created_at->toIso8601String(),
                'section_count' => $def->sections_count,
            ]);

        return response()->json(['data' => $definitions]);
    }

    /**
     * Show a specific form definition with all sections and fields.
     */
    public function show(FormDefinition $form): JsonResponse
    {
        $this->authorize('view', $form);

        $form->load(['sections.fields.options', 'createdBy:id,name']);

        $sections = $form->sections->map(function ($section) {
            return [
                'id' => $section->id,
                'title' => $section->title,
                'short_title' => $section->short_title,
                'description' => $section->description,
                'icon_name' => $section->icon_name,
                'sort_order' => $section->sort_order,
                'is_active' => $section->is_active,
                'fields' => $section->fields->map(function ($field) {
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
                })->values(),
            ];
        })->values();

        return response()->json(['data' => [
            'id' => $form->id,
            'name' => $form->name,
            'slug' => $form->slug,
            'version' => $form->version,
            'status' => $form->status,
            'description' => $form->description,
            'published_at' => $form->published_at?->toIso8601String(),
            'created_by' => $form->createdBy?->name,
            'created_at' => $form->created_at->toIso8601String(),
            'is_editable' => $form->isEditable(),
            'sections' => $sections,
        ]]);
    }

    /**
     * Create a new form definition in 'draft' status.
     */
    public function store(StoreFormDefinitionRequest $request): JsonResponse
    {
        $this->authorize('create', FormDefinition::class);

        $maxVersion = FormDefinition::max('version') ?? 0;
        $name = $request->validated()['name'];

        $form = FormDefinition::create([
            'name' => $name,
            'slug' => Str::slug($name).'-v'.($maxVersion + 1),
            'version' => $maxVersion + 1,
            'status' => 'draft',
            'description' => $request->validated()['description'] ?? null,
            'created_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => ['id' => $form->id, 'version' => $form->version, 'status' => $form->status]], 201);
    }

    /**
     * Update a draft definition's metadata (name/description only).
     */
    public function update(UpdateFormDefinitionRequest $request, FormDefinition $form): JsonResponse
    {
        $this->authorize('update', $form);

        $form->update($request->validated());

        return response()->json(['data' => ['id' => $form->id, 'name' => $form->name, 'description' => $form->description]]);
    }

    /**
     * Delete an unpublished draft definition.
     */
    public function destroy(FormDefinition $form): JsonResponse
    {
        $this->authorize('delete', $form);

        $form->delete();

        return response()->json(['message' => 'Form definition deleted.']);
    }

    /**
     * Publish a draft, archiving the current active definition.
     */
    public function publish(FormDefinition $form): JsonResponse
    {
        $this->authorize('publish', $form);

        if ($form->status !== 'draft') {
            return response()->json(['message' => "Only draft definitions can be published. Current status: '{$form->status}'."], 409);
        }

        $this->builder->publish($form);

        return response()->json(['data' => ['id' => $form->id, 'status' => 'active', 'published_at' => $form->fresh()->published_at->toIso8601String()]]);
    }

    /**
     * Deep-copy a definition into a new draft.
     */
    public function duplicate(FormDefinition $form): JsonResponse
    {
        $this->authorize('duplicate', $form);

        $newDef = $this->builder->duplicate($form, request()->user()->id);

        return response()->json(['data' => ['id' => $newDef->id, 'version' => $newDef->version, 'status' => $newDef->status]], 201);
    }
}
