<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicine_packages', function (Blueprint $table) {
            $table->decimal('unit_price', 8, 2)->nullable()->after('barcode');
            $table->decimal('nhs_reimbursement_price', 8, 2)->nullable()->after('unit_price');
        });
    }

    public function down(): void
    {
        Schema::table('medicine_packages', function (Blueprint $table) {
            $table->dropColumn(['unit_price', 'nhs_reimbursement_price']);
        });
    }
};
