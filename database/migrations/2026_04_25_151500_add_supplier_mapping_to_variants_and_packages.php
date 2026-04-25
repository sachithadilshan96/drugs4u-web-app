<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicine_variants', function (Blueprint $table) {
            $table->foreignId('supplier_id')
                ->nullable()
                ->after('medicine_id')
                ->constrained('suppliers')
                ->nullOnDelete();
        });

        Schema::table('medicine_packages', function (Blueprint $table) {
            $table->foreignId('supplier_id')
                ->nullable()
                ->after('variant_id')
                ->constrained('suppliers')
                ->nullOnDelete();
        });

        $fallbackSupplierId = DB::table('suppliers')->orderBy('id')->value('id');

        DB::table('medicine_variants')
            ->select(['id', 'medicine_id'])
            ->orderBy('id')
            ->get()
            ->each(function (object $variant) use ($fallbackSupplierId): void {
                $supplierId = DB::table('medicine_suppliers')
                    ->where('medicine_id', $variant->medicine_id)
                    ->orderByDesc('is_preferred')
                    ->orderBy('id')
                    ->value('supplier_id');

                if ($supplierId === null) {
                    $supplierId = $fallbackSupplierId;
                }

                if ($supplierId !== null) {
                    DB::table('medicine_variants')
                        ->where('id', $variant->id)
                        ->update(['supplier_id' => $supplierId]);
                }
            });

        DB::table('medicine_packages')
            ->select(['id', 'variant_id'])
            ->orderBy('id')
            ->get()
            ->each(function (object $package): void {
                $variantSupplierId = DB::table('medicine_variants')
                    ->where('id', $package->variant_id)
                    ->value('supplier_id');

                if ($variantSupplierId !== null) {
                    DB::table('medicine_packages')
                        ->where('id', $package->id)
                        ->update(['supplier_id' => $variantSupplierId]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('medicine_packages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
        });

        Schema::table('medicine_variants', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
        });
    }
};
