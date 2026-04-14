<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the form_fields table.
 *
 * Each form_section contains one or more fields. A field represents a single
 * input element (text box, dropdown, file upload, etc.) shown to the applicant.
 *
 * Key design choices:
 *  - field_key: stable machine-readable identifier. Even if the label changes,
 *    field_key stays the same. This is the key used by application answer storage.
 *    Changing a field_key after answers exist is a breaking operation.
 *  - field_type: controls which renderer is used. 'repeater' covers complex
 *    array-valued sections (allergies, medications, devices).
 *  - validation_rules: JSON — flexible per-field rules like {min, max, pattern}.
 *    Repeater sub-field schemas are also stored here as {subfields: [...]}.
 *  - conditional_logic: JSON — e.g. {show_if: {field_key: "has_seizures", equals: true}}.
 *    The frontend renderer evaluates this client-side to show/hide fields dynamically.
 *  - is_active: set to false to hide a field from new applicants without deleting it.
 *    Existing submitted answers are never touched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_section_id')
                ->constrained('form_sections')
                ->cascadeOnDelete();
            $table->string('field_key', 100);                // e.g. "camper_first_name" — stable identifier
            $table->string('label', 255);                    // "First Name" — shown to applicant
            $table->string('placeholder', 255)->nullable();
            $table->text('help_text')->nullable();           // hint shown below the field
            $table->enum('field_type', [
                'text', 'textarea', 'number', 'date', 'select',
                'radio', 'checkbox', 'checkbox_group', 'file',
                'email', 'phone', 'yesno', 'repeater',
            ]);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->json('validation_rules')->nullable();    // {min, max, pattern, subfields: [...]}
            $table->json('conditional_logic')->nullable();   // {show_if: {field_key: string, equals: any}}
            $table->string('default_value', 500)->nullable();
            $table->enum('width', ['full', 'half', 'third'])->default('full');
            $table->timestamps();

            $table->index(['form_section_id', 'sort_order']);
            $table->index(['form_section_id', 'is_active']);
            $table->unique(['form_section_id', 'field_key']); // field_key unique per section
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_fields');
    }
};
