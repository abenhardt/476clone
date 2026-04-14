<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the form_definitions table.
 *
 * A form_definition represents a versioned snapshot of the application form.
 * Only one definition may be 'active' at a time; others are 'draft' or 'archived'.
 *
 * Versioning strategy: when an admin publishes a new form version, the current
 * active definition is archived and the new draft becomes active. Submitted
 * applications retain a FK to the definition version that was active when they
 * were submitted, so historical applications can always be re-rendered correctly.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 255);                                      // e.g. "Camp Burnt Gin Application 2026"
            $table->string('slug', 255)->unique();                            // e.g. "cbg-application-v1" — used for cache keys
            $table->unsignedSmallInteger('version')->default(1);             // monotonically increasing version number
            $table->enum('status', ['draft', 'active', 'archived'])->default('draft');
            $table->text('description')->nullable();
            $table->foreignId('created_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('published_at')->nullable();                    // set when status flips to 'active'
            $table->timestamps();

            $table->index('status');
            $table->index('version');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_definitions');
    }
};
