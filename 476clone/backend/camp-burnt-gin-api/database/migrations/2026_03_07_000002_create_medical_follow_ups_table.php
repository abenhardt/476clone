<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medical_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('camper_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('treatment_log_id')->nullable()->constrained('treatment_logs')->nullOnDelete();
            $table->string('title');
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('pending'); // pending, in_progress, completed, cancelled
            $table->string('priority', 20)->default('medium'); // low, medium, high, urgent
            $table->date('due_date');
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('camper_id');
            $table->index('assigned_to');
            $table->index(['status', 'due_date']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medical_follow_ups');
    }
};
