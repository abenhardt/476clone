<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('body');
            $table->boolean('is_pinned')->default(false);
            $table->boolean('is_urgent')->default(false);
            // audience: all | accepted | staff (admin+medical) | session
            $table->string('audience', 20)->default('all');
            $table->foreignId('target_session_id')->nullable()->constrained('camp_sessions')->nullOnDelete();
            $table->timestamp('published_at')->nullable(); // null = draft
            $table->timestamps();

            $table->index(['published_at', 'audience']);
            $table->index('is_pinned');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
