<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('age_verification_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->nullable()->constrained('prescriptions')->nullOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->restrictOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->foreignId('pharmacist_id')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('customer_age');
            $table->unsignedInteger('min_age_required');
            $table->string('id_type_presented', 100)->nullable();
            $table->enum('outcome', ['verified', 'rejected', 'exempted']);
            $table->text('pharmacist_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('age_verification_log');
    }
};
