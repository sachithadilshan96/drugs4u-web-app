<?php

namespace Tests\Support;

use App\Models\Inventory;
use App\Models\Medicine;
use App\Models\MedicinePackage;
use App\Models\MedicineVariant;

final class PharmaFixtures
{
    /**
     * @param  array<string, mixed>  $medicineAttrs
     * @param  array<string, mixed>  $variantAttrs
     * @param  array<string, mixed>  $packageAttrs
     * @return array{medicine: Medicine, variant: MedicineVariant, package: MedicinePackage}
     */
    public static function medicineWithPackage(
        array $medicineAttrs = [],
        array $variantAttrs = [],
        array $packageAttrs = [],
    ): array {
        $medicine = Medicine::query()->create(array_merge([
            'name' => 'Test Med',
            'rxcui' => null,
            'requires_age_check' => false,
            'min_age' => null,
            'age_restriction_label' => null,
            'age_restriction_notes' => null,
        ], $medicineAttrs));

        $variant = MedicineVariant::query()->create(array_merge([
            'medicine_id' => $medicine->id,
            'brand_name' => null,
            'manufacturer' => null,
            'strength' => '500 MG',
            'form' => 'Oral Tablet',
            'route' => 'Oral',
            'rxcui_variant' => null,
        ], $variantAttrs));

        $package = MedicinePackage::query()->create(array_merge([
            'variant_id' => $variant->id,
            'package_description' => 'Blister pack of 28 tablets',
            'package_size' => 28,
            'package_unit' => 'Tablets',
            'barcode' => null,
        ], $packageAttrs));

        return ['medicine' => $medicine, 'variant' => $variant, 'package' => $package];
    }

    /**
     * @param  array<string, mixed>  $inventoryAttrs
     */
    public static function inventoryForPackage(
        MedicinePackage $package,
        array $inventoryAttrs = [],
    ): Inventory {
        return Inventory::query()->create(array_merge([
            'package_id' => $package->id,
            'supplier_id' => null,
            'quantity' => 10,
            'expiry_date' => now()->addYear()->toDateString(),
        ], $inventoryAttrs));
    }
}
