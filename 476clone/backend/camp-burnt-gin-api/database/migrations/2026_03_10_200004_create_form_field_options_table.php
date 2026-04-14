<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the form_field_options table.
 *
 * Stores the selectable options for select, radio, and checkbox_group fields.
 * Each option has a human-readable label (shown to applicant) and a machine value
 * (stored in the application answer). sort_order controls display order.
 *
 * Options cascade-delete when their parent form_field is deleted.
 * is_active = false hides the option without deleting it; useful for retiring
 * a choice that was previously available but should no longer appear.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_field_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('form_field_id')
                ->constrained('form_fields')
                ->cascadeOnDelete();
            $table->string('label', 255);         // "Male" — shown to applicant
            $table->string('value', 255);         // "male" — stored in answer
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['form_field_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_field_options');
    }
};
