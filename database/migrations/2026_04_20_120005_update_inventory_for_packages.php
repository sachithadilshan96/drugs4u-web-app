<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropForeign(['medicine_id']);
            $table->dropColumn('medicine_id');
            $table->foreignId('package_id')->nullable()->after('id')->constrained('medicine_packages')->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->after('package_id')->constrained('suppliers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('inventory', function (Blueprint $table) {
            $table->dropForeign(['package_id']);
            $table->dropForeign(['supplier_id']);
            $table->dropColumn(['package_id', 'supplier_id']);
            $table->foreignId('medicine_id')->after('id')->constrained('medicines')->cascadeOnDelete();
        });
    }
};
