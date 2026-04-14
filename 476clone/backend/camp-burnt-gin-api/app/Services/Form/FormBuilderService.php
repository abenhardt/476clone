<?php

namespace App\Services\Form;

use App\Exceptions\FormFieldKeyChangeException;
use App\Models\Application;
use App\Models\FormDefinition;
use App\Models\FormField;
use App\Models\FormSection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * FormBuilderService — core business logic for the dynamic form management system.
 *
 * Responsibilities:
 *  1. publish()              — archives the current active form, activates a new draft
 *  2. duplicate()            — deep-copies a definition into a new draft
 *  3. seedFromHardcodedForm()— creates the initial v1 definition from the current hard-coded form
 *  4. validateKeyChange()    — guards against renaming a field_key that has submitted answers
 *  5. invalidateCache()      — clears the cached active form schema after structural changes
 *
 * Cache key: form.active.v{version} with a 10-minute TTL.
 * Cache is automatically invalidated when a new version is published.
 */
class FormBuilderService
{
    /**
     * Publish a draft FormDefinition, making it the live active form.
     *
     * Wraps the operation in a DB transaction:
     *  1. Archive the currently active definition (if any).
     *  2. Set the draft's status to 'active' and record the published_at timestamp.
     *  3. Invalidate the form schema cache so applicants immediately get the new version.
     *
     * @throws \RuntimeException if the given definition is not in 'draft' status.
     */
    public function publish(FormDefinition $draft): void
    {
        if ($draft->status !== 'draft') {
            throw new \RuntimeException("Only draft definitions can be published. Status is '{$draft->status}'.");
        }

        DB::transaction(function () use ($draft) {
            // Archive whichever definition is currently active.
            FormDefinition::where('status', 'active')->update(['status' => 'archived']);

            // Activate the draft.
            $draft->update([
                'status' => 'active',
                'published_at' => now(),
            ]);

            // Invalidate inside the transaction so the cache is cleared atomically
            // with the status change — prevents a race where a stale cache is
            // served between the commit and a later invalidation call.
            $this->invalidateCache();
        });
    }

    /**
     * Deep-copy an existing definition into a new draft.
     *
     * Copies: definition metadata → sections → fields → options.
     * The new draft gets version = source.version + 1 and status = 'draft'.
     *
     * @param  FormDefinition  $source  The definition to copy (any status).
     * @param  int|null  $userId  The admin creating the duplicate.
     */
    public function duplicate(FormDefinition $source, ?int $userId = null): FormDefinition
    {
        // Eager-load the full tree before entering the transaction to avoid
        // N+1 queries inside the loop (one SELECT per section/field otherwise).
        $source->load('sections.fields.options');

        return DB::transaction(function () use ($source, $userId) {
            $maxVersion = FormDefinition::max('version') ?? 0;

            $newDef = FormDefinition::create([
                'name' => $source->name.' (copy)',
                'slug' => Str::slug($source->name).'-v'.($maxVersion + 1),
                'version' => $maxVersion + 1,
                'status' => 'draft',
                'description' => $source->description,
                'created_by_user_id' => $userId,
            ]);

            // Deep copy sections and their fields/options using pre-loaded relations.
            foreach ($source->sections as $section) {
                $newSection = $newDef->sections()->create([
                    'title' => $section->title,
                    'short_title' => $section->short_title,
                    'description' => $section->description,
                    'icon_name' => $section->icon_name,
                    'sort_order' => $section->sort_order,
                    'is_active' => $section->is_active,
                ]);

                foreach ($section->fields as $field) {
                    $newField = $newSection->fields()->create([
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
                    ]);

                    foreach ($field->options as $option) {
                        $newField->options()->create([
                            'label' => $option->label,
                            'value' => $option->value,
                            'sort_order' => $option->sort_order,
                            'is_active' => $option->is_active,
                        ]);
                    }
                }
            }

            return $newDef;
        });
    }

    /**
     * Guard against changing a field_key when submitted applications already reference it.
     *
     * field_key is the stable identifier used as the bridge between form schema and
     * application answer storage. Renaming it would silently orphan all existing answers
     * for that field. This method checks whether any non-draft applications exist for
     * the definition this field belongs to; if so, it throws an exception.
     *
     * @throws FormFieldKeyChangeException
     */
    public function validateKeyChange(FormField $field, string $newKey): void
    {
        if ($field->field_key === $newKey) {
            return; // No change — always safe.
        }

        $definitionId = $field->formSection->form_definition_id;

        $applicationCount = Application::where('form_definition_id', $definitionId)
            ->where('is_draft', false)
            ->count();

        if ($applicationCount > 0) {
            throw new FormFieldKeyChangeException($field->field_key, $applicationCount);
        }
    }

    /**
     * Invalidate all cached form schema entries.
     *
     * Called after publish() so applicants immediately receive the new form version.
     * Cache keys follow the pattern "form.active.v{N}" — we flush by prefix.
     */
    public function invalidateCache(): void
    {
        // Flush all versions — a simple range cover is sufficient since versions
        // grow slowly and cache TTL is only 10 minutes.
        $maxVersion = FormDefinition::max('version') ?? 20;
        for ($v = 1; $v <= $maxVersion + 1; $v++) {
            Cache::forget("form.active.v{$v}");
        }
        Cache::forget('form.active');
    }

    /**
     * Seed the initial form definition from the current hard-coded application form.
     *
     * This method creates the v1 FormDefinition that exactly mirrors what is
     * currently hard-coded in ApplicationFormPage.tsx. Running it again is safe
     * because it checks for an existing definition with slug 'cbg-application-v1'
     * first and skips creation if one already exists.
     *
     * Field keys exactly match the FormState property names in ApplicationFormPage.tsx
     * so that draft hydration from localStorage continues to work correctly.
     */
    public function seedFromHardcodedForm(): FormDefinition
    {
        // Idempotent — do not create a duplicate if already seeded.
        $existing = FormDefinition::where('slug', 'cbg-application-v1')->first();
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () {
            $def = FormDefinition::create([
                'name' => 'Camp Burnt Gin Application',
                'slug' => 'cbg-application-v1',
                'version' => 1,
                'status' => 'active',
                'description' => 'Standard CYSHCN camp application form — all 10 sections.',
                'published_at' => now(),
            ]);

            $this->seedSection1($def);
            $this->seedSection2($def);
            $this->seedSection3($def);
            $this->seedSection4($def);
            $this->seedSection5($def);
            $this->seedSection6($def);
            $this->seedSection7($def);
            $this->seedSection8($def);
            $this->seedSectionNarratives($def);
            $this->seedSection9($def);
            $this->seedSection10($def);

            $this->invalidateCache();

            return $def;
        });
    }

    // ── Private seed helpers ──────────────────────────────────────────────────

    private function makeSection(FormDefinition $def, array $attrs): FormSection
    {
        return $def->sections()->create($attrs);
    }

    private function makeField(FormSection $section, array $attrs): FormField
    {
        return $section->fields()->create(array_merge(['sort_order' => 0], $attrs));
    }

    private function makeOptions(FormField $field, array $options): void
    {
        foreach ($options as $i => [$label, $value]) {
            $field->options()->create([
                'label' => $label,
                'value' => $value,
                'sort_order' => $i,
                'is_active' => true,
            ]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 1 — General Information
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection1(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'General Information',
            'short_title' => 'General',
            'icon_name' => 'User',
            'sort_order' => 0,
        ]);

        $fields = [
            ['camper_first_name',    'First Name',             'text',  true,  'half'],
            ['camper_last_name',     'Last Name',              'text',  true,  'half'],
            ['camper_dob',           'Date of Birth',          'date',  true,  'half'],
            ['camper_preferred_name', 'Preferred Name',         'text',  false, 'half'],
            ['county',               'County',                 'text',  false, 'half'],
        ];

        foreach ($fields as $i => [$key, $label, $type, $req, $width]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $i,
            ]);
        }

        // Gender — select
        $genderField = $this->makeField($s, [
            'field_key' => 'camper_gender',
            'label' => 'Gender',
            'field_type' => 'select',
            'is_required' => true,
            'width' => 'half',
            'sort_order' => 3,
        ]);
        $this->makeOptions($genderField, [
            ['Male', 'male'], ['Female', 'female'],
            ['Non-binary', 'non_binary'], ['Prefer not to say', 'prefer_not_to_say'], ['Other', 'other'],
        ]);

        // Guardian 1
        $g1Fields = [
            ['g1_name',         'Guardian 1 — Full Name', 'text',  true,  'half', 5],
            ['g1_relationship', 'Relationship',           'text',  true,  'half', 6],
            ['g1_phone_home',   'Home Phone',             'phone', false, 'half', 7],
            ['g1_phone_cell',   'Cell Phone',             'phone', true,  'half', 8],
            ['g1_email',        'Email',                  'email', false, 'half', 9],
            ['g1_address',      'Street Address',         'text',  false, 'full', 10],
            ['g1_city',         'City',                   'text',  false, 'third', 11],
            ['g1_zip',          'ZIP Code',               'text',  false, 'third', 12],
        ];
        foreach ($g1Fields as [$key, $label, $type, $req, $width, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $order,
            ]);
        }

        // Guardian 1 State — select
        $g1StateField = $this->makeField($s, [
            'field_key' => 'g1_state',
            'label' => 'State',
            'field_type' => 'select',
            'is_required' => false,
            'width' => 'third',
            'sort_order' => 13,
        ]);
        $this->makeOptions($g1StateField, $this->usStateOptions());

        // Guardian 2
        $g2Fields = [
            ['g2_name',         'Guardian 2 — Full Name', 'text',  false, 'half', 14],
            ['g2_relationship', 'Relationship',           'text',  false, 'half', 15],
            ['g2_phone_cell',   'Cell Phone',             'phone', false, 'half', 16],
            ['g2_email',        'Email',                  'email', false, 'half', 17],
        ];
        foreach ($g2Fields as [$key, $label, $type, $req, $width, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $order,
            ]);
        }

        // Emergency Contact
        $ecFields = [
            ['ec_name',         'Emergency Contact — Name', 'text',  true,  'half', 18],
            ['ec_relationship', 'Relationship',             'text',  false, 'half', 19],
            ['ec_phone',        'Phone',                    'phone', true,  'half', 20],
        ];
        foreach ($ecFields as [$key, $label, $type, $req, $width, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $order,
            ]);
        }

        // Session — select (options populated dynamically from sessions API; stored here as empty)
        $this->makeField($s, [
            'field_key' => 'session_id',
            'label' => 'Camp Session',
            'help_text' => 'Select the session you would like to attend.',
            'field_type' => 'select',
            'is_required' => true,
            'width' => 'full',
            'sort_order' => 21,
        ]);

        // Interpreter
        $this->makeField($s, [
            'field_key' => 'needs_interpreter',
            'label' => 'Interpreter needed',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 22,
        ]);
        $this->makeField($s, [
            'field_key' => 'preferred_language',
            'label' => 'Preferred Language',
            'field_type' => 'text',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 23,
            'conditional_logic' => ['show_if' => ['field_key' => 'needs_interpreter', 'equals' => true]],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 2 — Health & Medical
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection2(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Health & Medical',
            'short_title' => 'Medical',
            'icon_name' => 'Heart',
            'sort_order' => 1,
        ]);

        $fields = [
            ['insurance_provider',  'Insurance Provider',         'text',     true,  'half',  0],
            ['insurance_policy',    'Policy Number',              'text',     false, 'half',  1],
            ['insurance_group',     'Group Number',               'text',     false, 'half',  2],
            ['medicaid_number',     'Medicaid Number (if any)',   'text',     false, 'half',  3],
            ['physician_name',      'Primary Physician Name',     'text',     true,  'half',  4],
            ['physician_phone',     'Physician Phone',            'phone',    false, 'half',  5],
            ['physician_address',   'Physician Address',          'textarea', false, 'full',  6],
        ];
        foreach ($fields as [$key, $label, $type, $req, $width, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $order,
            ]);
        }

        // Diagnoses — repeater
        $this->makeField($s, [
            'field_key' => 'diagnoses',
            'label' => 'Diagnoses',
            'help_text' => 'Add each diagnosis separately.',
            'field_type' => 'repeater',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 7,
            'validation_rules' => ['subfields' => [
                ['field_key' => 'condition', 'label' => 'Condition / Diagnosis', 'field_type' => 'text'],
                ['field_key' => 'notes',     'label' => 'Notes',                'field_type' => 'textarea'],
            ]],
        ]);

        // Allergies — repeater
        $this->makeField($s, [
            'field_key' => 'allergies',
            'label' => 'Allergies',
            'help_text' => 'Add each allergy separately.',
            'field_type' => 'repeater',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 8,
            'validation_rules' => ['subfields' => [
                ['field_key' => 'allergen',  'label' => 'Allergen',         'field_type' => 'text'],
                ['field_key' => 'reaction',  'label' => 'Reaction',         'field_type' => 'text'],
                ['field_key' => 'severity',  'label' => 'Severity',         'field_type' => 'select',
                    'options' => [['Mild', 'mild'], ['Moderate', 'moderate'], ['Severe', 'severe'], ['Life-threatening', 'life_threatening']]],
                ['field_key' => 'epi_pen',   'label' => 'Requires Epi-pen', 'field_type' => 'checkbox'],
            ]],
        ]);

        // Seizures
        $this->makeField($s, [
            'field_key' => 'has_seizures',
            'label' => 'Does your camper have a history of seizures?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 9,
        ]);
        $this->makeField($s, [
            'field_key' => 'last_seizure_date',
            'label' => 'Date of Last Seizure',
            'field_type' => 'date',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 10,
            'conditional_logic' => ['show_if' => ['field_key' => 'has_seizures', 'equals' => true]],
        ]);
        $this->makeField($s, [
            'field_key' => 'seizure_description',
            'label' => 'Describe seizure type and pattern',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 11,
            'conditional_logic' => ['show_if' => ['field_key' => 'has_seizures', 'equals' => true]],
        ]);

        // Neurostimulator
        $this->makeField($s, [
            'field_key' => 'has_neurostimulator',
            'label' => 'Does your camper have a neurostimulator or pacemaker?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 12,
        ]);

        // Immunizations
        $this->makeField($s, [
            'field_key' => 'immunizations_current',
            'label' => 'Is your camper current on required immunizations?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 13,
        ]);
        $this->makeField($s, [
            'field_key' => 'tetanus_date',
            'label' => 'Date of last tetanus / Tdap booster',
            'field_type' => 'date',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 14,
        ]);

        // Date of medical examination (Form 4523) — required to be within 12 months of camp
        $this->makeField($s, [
            'field_key' => 'date_of_medical_exam',
            'label' => 'Date of Medical Examination (Form 4523)',
            'help_text' => 'The physical exam must have been completed within 12 months of the first day of camp.',
            'field_type' => 'date',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 15,
        ]);

        // ── H4 Other Health ────────────────────────────────────────────────────
        // These three items appear in §H4 of the real CYSHCN application form (0717-ENG-DPH)
        // but were missing from v1.

        $this->makeField($s, [
            'field_key' => 'has_contagious_illness',
            'label' => 'Does your camper have any contagious illnesses, infections, or communicable diseases?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 16,
        ]);
        $this->makeField($s, [
            'field_key' => 'contagious_illness_description',
            'label' => 'Please describe the illness or infection',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 17,
            'conditional_logic' => ['show_if' => ['field_key' => 'has_contagious_illness', 'equals' => true]],
        ]);

        $this->makeField($s, [
            'field_key' => 'tubes_in_ears',
            'label' => 'Does your camper have tubes in their ears?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 18,
        ]);

        $this->makeField($s, [
            'field_key' => 'has_recent_illness',
            'label' => 'Has your camper had any illness, injury, or surgery in the past 12 months?',
            'field_type' => 'yesno',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 19,
        ]);
        $this->makeField($s, [
            'field_key' => 'recent_illness_description',
            'label' => 'Please describe the illness, injury, or surgery',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 20,
            'conditional_logic' => ['show_if' => ['field_key' => 'has_recent_illness', 'equals' => true]],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 3 — Development & Behavior
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection3(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Development & Behavior',
            'short_title' => 'Behavior',
            'icon_name' => 'Brain',
            'sort_order' => 2,
        ]);

        $checkboxFields = [
            ['aggression',           'History of aggression toward others',      0],
            ['self_abuse',           'History of self-injurious behavior',       1],
            ['wandering',            'Wandering / elopement risk',               2],
            ['one_to_one',           'Requires 1:1 supervision',                 3],
            ['developmental_delay',  'Developmental delay',                      4],
            ['functional_reading',   'Functional reading skills',                5],
            ['functional_writing',   'Functional writing skills',                6],
            ['independent_mobility', 'Independent mobility (can move on own)',   7],
            ['verbal_communication', 'Verbal communication',                     8],
            ['social_skills',        'Age-appropriate social skills',            9],
            ['behavior_plan',        'Has an active behavior support plan',     10],
        ];
        foreach ($checkboxFields as [$key, $label, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => 'checkbox',
                'is_required' => false,
                'width' => 'full',
                'sort_order' => $order,
            ]);
        }

        // Communication methods — checkbox_group
        $commField = $this->makeField($s, [
            'field_key' => 'communication_methods',
            'label' => 'Communication Methods (select all that apply)',
            'field_type' => 'checkbox_group',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 11,
        ]);
        $this->makeOptions($commField, [
            ['Verbal speech',      'verbal'],
            ['Sign language',      'sign_language'],
            ['AAC device',         'aac_device'],
            ['Picture cards',      'picture_cards'],
            ['Communication board', 'communication_board'],
            ['Written language',   'written'],
            ['Other',              'other'],
        ]);

        $this->makeField($s, [
            'field_key' => 'behavior_notes',
            'label' => 'Additional behavior or communication notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 12,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 4 — Equipment & Mobility
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection4(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Equipment & Mobility',
            'short_title' => 'Equipment',
            'icon_name' => 'Accessibility',
            'sort_order' => 3,
        ]);

        // Devices — repeater
        $this->makeField($s, [
            'field_key' => 'devices',
            'label' => 'Assistive Devices',
            'help_text' => 'List all assistive devices your camper uses.',
            'field_type' => 'repeater',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 0,
            'validation_rules' => ['subfields' => [
                ['field_key' => 'device_type',         'label' => 'Device Type',         'field_type' => 'select',
                    'options' => [
                        ['Wheelchair — Manual', 'wheelchair_manual'],
                        ['Wheelchair — Power',  'wheelchair_power'],
                        ['Walker',              'walker'],
                        ['Crutches',            'crutches'],
                        ['Prosthetic Limb',     'prosthetic'],
                        ['Hearing Aid',         'hearing_aid'],
                        ['Cochlear Implant',    'cochlear_implant'],
                        ['Communication Device', 'communication_device'],
                        ['Feeding Pump',        'feeding_pump'],
                        ['Oxygen',              'oxygen'],
                        ['Hospital Bed',        'hospital_bed'],
                        ['Other',               'other'],
                    ]],
                ['field_key' => 'requires_transfer', 'label' => 'Requires transfer assistance', 'field_type' => 'checkbox'],
                ['field_key' => 'notes',             'label' => 'Notes',                        'field_type' => 'textarea'],
            ]],
        ]);

        $this->makeField($s, [
            'field_key' => 'uses_cpap',
            'label' => 'Uses CPAP / BiPAP',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 1,
        ]);
        $this->makeField($s, [
            'field_key' => 'cpap_notes',
            'label' => 'CPAP / BiPAP notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 2,
            'conditional_logic' => ['show_if' => ['field_key' => 'uses_cpap', 'equals' => true]],
        ]);
        $this->makeField($s, [
            'field_key' => 'mobility_notes',
            'label' => 'Additional mobility or equipment notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 3,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 5 — Diet & Feeding
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection5(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Diet & Feeding',
            'short_title' => 'Diet',
            'icon_name' => 'Utensils',
            'sort_order' => 4,
        ]);

        $this->makeField($s, [
            'field_key' => 'special_diet',
            'label' => 'Requires special diet',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 0,
        ]);
        $this->makeField($s, [
            'field_key' => 'diet_description',
            'label' => 'Diet description',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 1,
            'conditional_logic' => ['show_if' => ['field_key' => 'special_diet', 'equals' => true]],
        ]);

        $this->makeField($s, [
            'field_key' => 'texture_modified',
            'label' => 'Requires texture-modified food',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 2,
        ]);

        $textureLevelField = $this->makeField($s, [
            'field_key' => 'texture_level',
            'label' => 'Texture level',
            'field_type' => 'select',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 3,
            'conditional_logic' => ['show_if' => ['field_key' => 'texture_modified', 'equals' => true]],
        ]);
        $this->makeOptions($textureLevelField, [
            ['Level 3 — Liquidised',          'level_3'],
            ['Level 4 — Pureed',              'level_4'],
            ['Level 5 — Minced & Moist',      'level_5'],
            ['Level 6 — Soft & Bite-Sized',   'level_6'],
            ['Level 7 — Easy to Chew',        'level_7'],
        ]);

        $this->makeField($s, [
            'field_key' => 'fluid_restriction',
            'label' => 'Fluid restriction required',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 4,
        ]);
        $this->makeField($s, [
            'field_key' => 'fluid_details',
            'label' => 'Fluid restriction details',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 5,
            'conditional_logic' => ['show_if' => ['field_key' => 'fluid_restriction', 'equals' => true]],
        ]);

        $this->makeField($s, [
            'field_key' => 'g_tube',
            'label' => 'Uses G-tube / feeding tube',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 6,
        ]);
        $gTubeFields = [
            ['formula',           'Formula name/type',         'text',     false, 'half', 7],
            ['amount_per_feeding', 'Amount per feeding (ml)',    'text',     false, 'half', 8],
            ['feedings_per_day',  'Feedings per day',          'number',   false, 'half', 9],
            ['feeding_times',     'Feeding times',             'text',     false, 'half', 10],
        ];
        foreach ($gTubeFields as [$key, $label, $type, $req, $width, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => $type,
                'is_required' => $req,
                'width' => $width,
                'sort_order' => $order,
                'conditional_logic' => ['show_if' => ['field_key' => 'g_tube', 'equals' => true]],
            ]);
        }
        $this->makeField($s, [
            'field_key' => 'bolus_only',
            'label' => 'Bolus feeding only (no pump)',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => 11,
            'conditional_logic' => ['show_if' => ['field_key' => 'g_tube', 'equals' => true]],
        ]);
        $this->makeField($s, [
            'field_key' => 'feeding_notes',
            'label' => 'Additional feeding notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 12,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 6 — Personal Care
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection6(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Personal Care',
            'short_title' => 'Personal Care',
            'icon_name' => 'ShieldCheck',
            'sort_order' => 5,
        ]);

        $careOptions = [
            ['Full Assistance', 'full'], ['Moderate Assistance', 'moderate'],
            ['Minimal Assistance', 'minimal'], ['Independent', 'independent'],
        ];

        $careFields = [
            ['bathing',    'Bathing',     0],
            ['toileting',  'Toileting',   2],
            ['dressing',   'Dressing',    5],
            ['oral_hygiene', 'Oral Hygiene', 7],
        ];

        $order = 0;
        foreach ($careFields as [$prefix, $area, $_]) {
            $levelField = $this->makeField($s, [
                'field_key' => "{$prefix}_level",
                'label' => "{$area} — Assistance Level",
                'field_type' => 'select',
                'is_required' => true,
                'width' => 'half',
                'sort_order' => $order++,
            ]);
            $this->makeOptions($levelField, $careOptions);

            $this->makeField($s, [
                'field_key' => "{$prefix}_notes",
                'label' => "{$area} — Notes",
                'field_type' => 'textarea',
                'is_required' => false,
                'width' => 'full',
                'sort_order' => $order++,
            ]);

            if ($prefix === 'toileting') {
                $this->makeField($s, [
                    'field_key' => 'nighttime_toileting',
                    'label' => 'Nighttime toileting needs',
                    'field_type' => 'checkbox',
                    'is_required' => false,
                    'width' => 'half',
                    'sort_order' => $order++,
                ]);
                $this->makeField($s, [
                    'field_key' => 'nighttime_notes',
                    'label' => 'Nighttime toileting notes',
                    'field_type' => 'textarea',
                    'is_required' => false,
                    'width' => 'full',
                    'sort_order' => $order++,
                    'conditional_logic' => ['show_if' => ['field_key' => 'nighttime_toileting', 'equals' => true]],
                ]);
            }
        }

        $this->makeField($s, [
            'field_key' => 'positioning_notes',
            'label' => 'Positioning / pressure relief notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'sleep_notes',
            'label' => 'Sleep notes',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => $order++,
        ]);

        // ── Additional Personal Care / Sleep items from PDF §8 ────────────────
        // These were missing from v1 but are on the real CYSHCN paper form.

        $this->makeField($s, [
            'field_key' => 'falling_asleep_issues',
            'label' => 'Difficulty falling or staying asleep',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'sleep_walking',
            'label' => 'Sleep walking',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'night_wandering',
            'label' => 'Night wandering or getting out of bed unsafely',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'bowel_control_notes',
            'label' => 'Bowel / bladder control notes',
            'help_text' => 'Include any details about accidents, schedules, or special equipment.',
            'field_type' => 'textarea',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'urinary_catheter',
            'label' => 'Uses urinary catheter',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => $order++,
        ]);
        $this->makeField($s, [
            'field_key' => 'menstruation_support',
            'label' => 'Requires assistance with menstrual care (female campers)',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'half',
            'sort_order' => $order,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 7 — Activities & Permissions
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection7(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Activities & Permissions',
            'short_title' => 'Activities',
            'icon_name' => 'Activity',
            'sort_order' => 6,
        ]);

        // Activities match the real CYSHCN application form (0717-ENG-DPH §9)
        $activities = [
            ['sports_games', 'Sports & Games'],
            ['arts_crafts',  'Arts & Crafts'],
            ['nature',       'Nature Activities'],
            ['fine_arts',    'Fine Arts'],
            ['swimming',     'Swimming'],
            ['boating',      'Boating'],
            ['camp_out',     'Camp Out'],
        ];

        $levelOptions = [
            ['Permitted',          'permitted'],
            ['Permitted with limits', 'with_limits'],
            ['Not permitted',      'not_permitted'],
        ];

        $order = 0;
        foreach ($activities as [$key, $label]) {
            $levelField = $this->makeField($s, [
                'field_key' => "activity_{$key}_level",
                'label' => "{$label} — Permission Level",
                'field_type' => 'select',
                'is_required' => true,
                'width' => 'half',
                'sort_order' => $order++,
            ]);
            $this->makeOptions($levelField, $levelOptions);

            $this->makeField($s, [
                'field_key' => "activity_{$key}_notes",
                'label' => "{$label} — Notes / Limitations",
                'field_type' => 'textarea',
                'is_required' => false,
                'width' => 'full',
                'sort_order' => $order++,
            ]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 8 — Medications
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection8(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Medications',
            'short_title' => 'Medications',
            'icon_name' => 'Pill',
            'sort_order' => 7,
        ]);

        $this->makeField($s, [
            'field_key' => 'no_medications',
            'label' => 'My camper takes no medications',
            'field_type' => 'checkbox',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 0,
        ]);

        // Medications — repeater
        $this->makeField($s, [
            'field_key' => 'medications',
            'label' => 'Medications',
            'help_text' => 'Add each medication separately.',
            'field_type' => 'repeater',
            'is_required' => false,
            'width' => 'full',
            'sort_order' => 1,
            'conditional_logic' => ['show_if' => ['field_key' => 'no_medications', 'equals' => false]],
            'validation_rules' => ['subfields' => [
                ['field_key' => 'name',              'label' => 'Medication Name',          'field_type' => 'text'],
                ['field_key' => 'dosage',            'label' => 'Dosage',                   'field_type' => 'text'],
                ['field_key' => 'frequency',         'label' => 'Frequency',                'field_type' => 'select',
                    'options' => [
                        ['Once daily', 'once_daily'], ['Twice daily', 'twice_daily'],
                        ['Three times daily', 'three_daily'], ['Four times daily', 'four_daily'],
                        ['Every 4 hours', 'every_4h'], ['Every 6 hours', 'every_6h'],
                        ['Every 8 hours', 'every_8h'], ['As needed (PRN)', 'prn'],
                        ['Weekly', 'weekly'], ['Other', 'other'],
                    ]],
                ['field_key' => 'route',             'label' => 'Route',                    'field_type' => 'select',
                    'options' => [
                        ['Oral (by mouth)', 'oral'], ['Topical (skin)', 'topical'],
                        ['Inhaled', 'inhaled'], ['Injection', 'injection'],
                        ['IV', 'iv'], ['Rectal', 'rectal'], ['Eye drops', 'eye_drops'],
                        ['Ear drops', 'ear_drops'], ['Nasal', 'nasal'], ['Other', 'other'],
                    ]],
                ['field_key' => 'reason',            'label' => 'Reason / Condition',       'field_type' => 'text'],
                ['field_key' => 'prescribing_physician', 'label' => 'Prescribing Physician', 'field_type' => 'text'],
                ['field_key' => 'self_admin',        'label' => 'Can self-administer',       'field_type' => 'checkbox'],
                ['field_key' => 'refrigeration',     'label' => 'Requires refrigeration',   'field_type' => 'checkbox'],
                ['field_key' => 'notes',             'label' => 'Additional notes',          'field_type' => 'textarea'],
            ]],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 9 — Narratives (PDF §10)
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSectionNarratives(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'About Your Camper',
            'short_title' => 'Narratives',
            'icon_name' => 'MessageSquare',
            'sort_order' => 8,
        ]);

        $questions = [
            ['narrative_rustic_environment',
                'Is a rustic outdoor environment (heat, bugs, uneven terrain, limited AC) suitable for your camper? Please explain any concerns.',
                0],
            ['narrative_staff_suggestions',
                'What suggestions do you have for camp staff to best support your camper\'s unique needs during activities and daily routines?',
                1],
            ['narrative_participation_concerns',
                'Are there any specific camp activities or situations that concern you regarding your camper\'s participation? Please describe.',
                2],
            ['narrative_camp_benefit',
                'How do you believe attending camp will benefit your camper? What goals or outcomes are you hoping for?',
                3],
            ['narrative_heat_tolerance',
                'Please describe your camper\'s tolerance for heat and sun exposure, and any precautions staff should take.',
                4],
            ['narrative_transportation',
                'Are there any concerns or special accommodations needed regarding transportation to and from camp?',
                5],
            ['narrative_additional_info',
                'Is there any additional information about your camper that camp staff should know that has not been covered elsewhere in this application?',
                6],
            ['narrative_emergency_protocols',
                'Are there any special emergency procedures or protocols specific to your camper\'s condition that staff must follow?',
                7],
        ];

        foreach ($questions as [$key, $label, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => 'textarea',
                'is_required' => false,
                'width' => 'full',
                'sort_order' => $order,
            ]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 10 — Required Documents
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection9(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Required Documents',
            'short_title' => 'Documents',
            'icon_name' => 'Upload',
            'sort_order' => 9,
        ]);

        $docs = [
            ['doc_immunization',   'Immunization Record',    true,  null,               0],
            ['doc_medical_exam',   'Medical Examination Form', true, null,              1],
            ['doc_insurance_card', 'Insurance Card',         true,  null,               2],
            ['doc_cpap_waiver',    'CPAP / BiPAP Waiver',    false, ['show_if' => ['field_key' => 'uses_cpap', 'equals' => true]], 3],
            ['doc_seizure_plan',   'Seizure Action Plan',    false, ['show_if' => ['field_key' => 'has_seizures', 'equals' => true]], 4],
            ['doc_gtube_plan',     'G-Tube Care Plan',       false, ['show_if' => ['field_key' => 'g_tube', 'equals' => true]], 5],
        ];

        foreach ($docs as [$key, $label, $req, $cond, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => 'file',
                'is_required' => $req,
                'width' => 'full',
                'sort_order' => $order,
                'conditional_logic' => $cond,
            ]);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Section 11 — Consents & Signatures
    // ─────────────────────────────────────────────────────────────────────────

    private function seedSection10(FormDefinition $def): void
    {
        $s = $this->makeSection($def, [
            'title' => 'Consents & Signatures',
            'short_title' => 'Consents',
            'icon_name' => 'PenLine',
            'sort_order' => 10,
        ]);

        $consents = [
            ['consent_medical',    'I authorize emergency medical treatment on behalf of my camper.',                   0],
            ['consent_photo',      'I authorize photos of my camper for camp-related purposes.',                        1],
            ['consent_liability',  'I have read and agree to the liability waiver.',                                    2],
            ['consent_medication', 'I authorize camp staff to administer medications as prescribed.',                   3],
            ['consent_hipaa',      'I understand how my camper\'s health information will be used (HIPAA notice).',     4],
        ];

        foreach ($consents as [$key, $label, $order]) {
            $this->makeField($s, [
                'field_key' => $key,
                'label' => $label,
                'field_type' => 'checkbox',
                'is_required' => true,
                'width' => 'full',
                'sort_order' => $order,
            ]);
        }

        // Signature type
        $sigTypeField = $this->makeField($s, [
            'field_key' => 'signature_type',
            'label' => 'Signature method',
            'field_type' => 'radio',
            'is_required' => true,
            'width' => 'full',
            'sort_order' => 5,
        ]);
        $this->makeOptions($sigTypeField, [['Type my name', 'typed'], ['Draw my signature', 'drawn']]);

        $this->makeField($s, [
            'field_key' => 'signed_name',
            'label' => 'Full legal name',
            'field_type' => 'text',
            'is_required' => true,
            'width' => 'half',
            'sort_order' => 6,
        ]);
        $this->makeField($s, [
            'field_key' => 'signed_date',
            'label' => 'Date',
            'field_type' => 'date',
            'is_required' => true,
            'width' => 'half',
            'sort_order' => 7,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Lookup data
    // ─────────────────────────────────────────────────────────────────────────

    private function usStateOptions(): array
    {
        return [
            ['Alabama', 'AL'], ['Alaska', 'AK'], ['Arizona', 'AZ'], ['Arkansas', 'AR'],
            ['California', 'CA'], ['Colorado', 'CO'], ['Connecticut', 'CT'], ['Delaware', 'DE'],
            ['Florida', 'FL'], ['Georgia', 'GA'], ['Hawaii', 'HI'], ['Idaho', 'ID'],
            ['Illinois', 'IL'], ['Indiana', 'IN'], ['Iowa', 'IA'], ['Kansas', 'KS'],
            ['Kentucky', 'KY'], ['Louisiana', 'LA'], ['Maine', 'ME'], ['Maryland', 'MD'],
            ['Massachusetts', 'MA'], ['Michigan', 'MI'], ['Minnesota', 'MN'], ['Mississippi', 'MS'],
            ['Missouri', 'MO'], ['Montana', 'MT'], ['Nebraska', 'NE'], ['Nevada', 'NV'],
            ['New Hampshire', 'NH'], ['New Jersey', 'NJ'], ['New Mexico', 'NM'], ['New York', 'NY'],
            ['North Carolina', 'NC'], ['North Dakota', 'ND'], ['Ohio', 'OH'], ['Oklahoma', 'OK'],
            ['Oregon', 'OR'], ['Pennsylvania', 'PA'], ['Rhode Island', 'RI'], ['South Carolina', 'SC'],
            ['South Dakota', 'SD'], ['Tennessee', 'TN'], ['Texas', 'TX'], ['Utah', 'UT'],
            ['Vermont', 'VT'], ['Virginia', 'VA'], ['Washington', 'WA'], ['West Virginia', 'WV'],
            ['Wisconsin', 'WI'], ['Wyoming', 'WY'],
        ];
    }
}
