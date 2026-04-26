<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->unique()->constrained('prescriptions')->cascadeOnDelete();
            $table->string('bill_number', 20)->unique();
            $table->enum('prescription_type', ['nhs', 'private']);
            $table->decimal('subtotal', 8, 2);
            $table->decimal('nhs_charge_per_item', 8, 2)->nullable();
            $table->unsignedInteger('nhs_item_count')->nullable();
            $table->decimal('total_amount', 8, 2);
            $table->decimal('vat_amount', 8, 2)->default(0);
            $table->enum('payment_status', ['unpaid', 'paid', 'waived'])->default('unpaid');
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('generated_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('generated_at');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bills');
    }
};
