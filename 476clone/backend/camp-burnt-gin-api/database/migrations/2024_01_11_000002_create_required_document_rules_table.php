<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates required_document_rules table for configurable medical compliance.
 *
 * This table defines which documents are required based on medical complexity
 * tiers, supervision levels, and specific condition flags. Rules are evaluated
 * during application approval to enforce document compliance.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('required_document_rules', function (Blueprint $table) {
            $table->id();
            $table->string('medical_complexity_tier')->nullable();
            $table->string('supervision_level')->nullable();
            $table->string('condition_flag')->nullable();
            $table->string('document_type');
            $table->text('description');
            $table->boolean('is_mandatory')->default(true);
            $table->timestamps();

            $table->index('medical_complexity_tier');
            $table->index('supervision_level');
            $table->index('condition_flag');
            $table->index('document_type');
            $table->index('is_mandatory');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('required_document_rules');
    }
};
