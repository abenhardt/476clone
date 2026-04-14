<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends documents table with verification and expiration tracking.
 *
 * Adds verification workflow fields required for medical compliance
 * document enforcement before application approval.
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('verification_status')->default('pending')->after('document_type');
            $table->foreignId('verified_by')->nullable()->after('verification_status')->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable()->after('verified_by');
            $table->date('expiration_date')->nullable()->after('verified_at');

            $table->index('verification_status');
            $table->index('expiration_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['verified_by']);
            $table->dropIndex(['verification_status']);
            $table->dropIndex(['expiration_date']);
            $table->dropColumn([
                'verification_status',
                'verified_by',
                'verified_at',
                'expiration_date',
            ]);
        });
    }
};
