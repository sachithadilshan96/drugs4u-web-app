<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MedicinePackage;
use App\Models\MedicineVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MedicinePackageController extends Controller
{
    public function store(Request $request, int $variantId): JsonResponse
    {
        $variant = MedicineVariant::query()->findOrFail($variantId);

        $validated = $request->validate([
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'package_description' => ['required', 'string', 'max:255'],
            'package_size' => ['required', 'integer', 'min:1'],
            'package_unit' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('medicine_packages', 'barcode')],
        ]);

        $validated['variant_id'] = $variant->id;
        $validated['supplier_id'] = $this->resolveSupplierIdForVariant($variant, $validated['supplier_id'] ?? null);
        $package = MedicinePackage::query()->create($validated);
        $package->load('supplier');

        return response()->json(['data' => $this->serializePackage($package)], 201);
    }

    public function update(Request $request, int $packageId): JsonResponse
    {
        $package = MedicinePackage::query()->findOrFail($packageId);

        $validated = $request->validate([
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'package_description' => ['required', 'string', 'max:255'],
            'package_size' => ['required', 'integer', 'min:1'],
            'package_unit' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('medicine_packages', 'barcode')->ignore($package->id)],
        ]);

        $package->loadMissing('variant');
        $validated['supplier_id'] = $this->resolveSupplierIdForVariant($package->variant, $validated['supplier_id'] ?? null);
        $package->update($validated);

        return response()->json(['data' => $this->serializePackage($package->fresh()->load('supplier'))]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePackage(MedicinePackage $p): array
    {
        return [
            'id' => $p->id,
            'variant_id' => $p->variant_id,
            'supplier_id' => $p->supplier_id,
            'supplier_name' => $p->supplier?->name,
            'package_description' => $p->package_description,
            'package_size' => $p->package_size,
            'package_unit' => $p->package_unit,
            'barcode' => $p->barcode,
            'full_description' => $p->full_description,
        ];
    }

    private function resolveSupplierIdForVariant(MedicineVariant $variant, ?int $supplierId): int
    {
        $variantSupplierId = $variant->supplier_id;
        if ($variantSupplierId === null) {
            throw ValidationException::withMessages([
                'supplier_id' => 'Variant must have a supplier before adding packages.',
            ]);
        }

        if ($supplierId !== null && (int) $supplierId !== (int) $variantSupplierId) {
            throw ValidationException::withMessages([
                'supplier_id' => 'Package supplier must match the variant supplier.',
            ]);
        }

        return (int) $variantSupplierId;
    }
}
