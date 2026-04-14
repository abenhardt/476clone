<?php

namespace Database\Seeders;

use App\Services\Form\FormBuilderService;
use Illuminate\Database\Seeder;

/**
 * FormDefinitionSeeder — seeds the v1 form definition into the database.
 *
 * This seeder calls FormBuilderService::seedFromHardcodedForm() which creates
 * the exact 10-section form currently hard-coded in ApplicationFormPage.tsx,
 * translated into the form_definitions / form_sections / form_fields / form_field_options tables.
 *
 * The operation is idempotent — running it multiple times is safe. It skips
 * creation if a form_definition with slug 'cbg-application-v1' already exists.
 *
 * Run:
 *   php artisan db:seed --class=FormDefinitionSeeder
 */
class FormDefinitionSeeder extends Seeder
{
    public function run(): void
    {
        $service = app(FormBuilderService::class);
        $def = $service->seedFromHardcodedForm();

        $sectionCount = $def->sections()->count();
        $fieldCount = $def->sections()->withCount('fields')->get()->sum('fields_count');

        $this->command->info("Form definition seeded: '{$def->name}' v{$def->version} ({$sectionCount} sections, {$fieldCount} fields)");
    }
}
