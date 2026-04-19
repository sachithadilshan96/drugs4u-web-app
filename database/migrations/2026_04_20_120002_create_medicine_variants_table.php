<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicine_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medicine_id')->constrained('medicines')->cascadeOnDelete();
            $table->string('brand_name')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('strength', 50);
            $table->string('form', 100);
            $table->string('route', 100)->nullable();
            $table->string('rxcui_variant', 50)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_variants');
    }
};
