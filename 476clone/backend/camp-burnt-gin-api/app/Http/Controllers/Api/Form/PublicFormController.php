<?php

namespace App\Http\Controllers\Api\Form;

use App\Http\Controllers\Controller;
use App\Models\FormDefinition;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * PublicFormController — serves the form schema to all authenticated users.
 *
 * The active() endpoint is called by applicants on the ApplicationFormPage to
 * fetch the current form structure. Results are cached for 10 minutes per version
 * to avoid hitting the database on every page load.
 *
 * GET /api/form/active      → active form schema with all sections and fields
 * GET /api/form/{form}      → specific version by ID (admin use — reviewing old apps)
 */
class PublicFormController extends Controller
{
    /**
     * Return the currently active form definition.
     *
     * Any authenticated user may call this (applicants need it to render the form).
     * Result is cached under "form.active.v{version}" for 10 minutes.
     */
    public function active(): JsonResponse
    {
        $definition = FormDefinition::active()->first();

        if (! $definition) {
            return response()->json(['message' => 'No active form definition found.'], 404);
        }

        $cacheKey = "form.active.v{$definition->version}";

        $payload = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($definition) {
            return $this->buildPayload($definition);
        });

        return response()->json(['data' => $payload]);
    }

    /**
     * Return a specific form definition by ID (used to render historical applications).
     *
     * Admin-readable — allows reviewing what the form looked like when an old
     * application was submitted.
     */
    public function version(FormDefinition $form): JsonResponse
    {
        $this->authorize('view', $form);

        return response()->json(['data' => $this->buildPayload($form)]);
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private function buildPayload(FormDefinition $form): array
    {
        $form->load(['activeSections.activeFields.activeOptions']);

        return [
            'id' => $form->id,
            'name' => $form->name,
            'version' => $form->version,
            'status' => $form->status,
            'sections' => $form->activeSections->map(function ($section) {
                return [
                    'id' => $section->id,
                    'title' => $section->title,
                    'short_title' => $section->short_title,
                    'description' => $section->description,
                    'icon_name' => $section->icon_name,
                    'sort_order' => $section->sort_order,
                    'fields' => $section->activeFields->map(function ($field) {
                        return [
                            'id' => $field->id,
                            'field_key' => $field->field_key,
                            'label' => $field->label,
                            'placeholder' => $field->placeholder,
                            'help_text' => $field->help_text,
                            'field_type' => $field->field_type,
                            'is_required' => $field->is_required,
                            'sort_order' => $field->sort_order,
                            'validation_rules' => $field->validation_rules,
                            'conditional_logic' => $field->conditional_logic,
                            'default_value' => $field->default_value,
                            'width' => $field->width,
                            'options' => $field->activeOptions->map(fn ($opt) => [
                                'id' => $opt->id,
                                'label' => $opt->label,
                                'value' => $opt->value,
                                'sort_order' => $opt->sort_order,
                            ])->values(),
                        ];
                    })->values(),
                ];
            })->values(),
        ];
    }
}
