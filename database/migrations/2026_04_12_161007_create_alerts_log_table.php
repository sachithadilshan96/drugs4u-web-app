<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts_log', function (Blueprint $table) {
            $table->id();
            $table->enum('alert_type', ['low_stock', 'age_restriction']);
            $table->unsignedBigInteger('reference_id');
            $table->text('message');
            $table->boolean('dismissed')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts_log');
    }
};
