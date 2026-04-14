<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_restrictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('restriction_type'); // activity, dietary, environmental, medication, other
            $table->text('description');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('camper_id');
            $table->index(['camper_id', 'is_active']);
            $table->index('restriction_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_restrictions');
    }
};
