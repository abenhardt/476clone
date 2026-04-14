<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migration to create the applications table.
 *
 * Applications represent a camper's registration request for a specific
 * camp session. Each application tracks its status through the review
 * and approval workflow.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')
                ->constrained('campers')
                ->onDelete('cascade');
            $table->foreignId('camp_session_id')
                ->constrained('camp_sessions')
                ->onDelete('cascade');
            $table->string('status')->default('pending');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')
                ->nullable()
                ->constrained('users')
                ->onDelete('set null');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('submitted_at');
            $table->unique(['camper_id', 'camp_session_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};
