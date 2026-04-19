<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicine_packages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('medicine_variants')->cascadeOnDelete();
            $table->string('package_description');
            $table->unsignedInteger('package_size');
            $table->string('package_unit', 50);
            $table->string('barcode', 100)->nullable()->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_packages');
    }
};
