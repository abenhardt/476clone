<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the form_sections table.
 *
 * Each form_definition has one or more ordered sections. Sections are displayed
 * as numbered steps in the applicant's multi-step form wizard. The sort_order
 * column controls display order; reordering updates this column in batch.
 *
 * Sections cascade-delete when their parent form_definition is deleted.
 * is_active = false hides the section (and all its fields) from new applicants;
 * existing submitted data is never touched by toggling this flag.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_definition_id')
                ->constrained('form_definitions')
                ->cascadeOnDelete();
            $table->string('title', 255);                    // "General Information"
            $table->string('short_title', 100);              // "General" — sidebar step label
            $table->text('description')->nullable();         // optional subheading shown below section title
            $table->string('icon_name', 50)->nullable();     // lucide icon name e.g. "User", "Heart"
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['form_definition_id', 'sort_order']);
            $table->index(['form_definition_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_sections');
    }
};
