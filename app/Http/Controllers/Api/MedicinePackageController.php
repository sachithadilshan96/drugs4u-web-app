<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MedicinePackage;
use App\Models\MedicineVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicinePackageController extends Controller
{
    public function store(Request $request, int $variantId): JsonResponse
    {
        $variant = MedicineVariant::query()->findOrFail($variantId);

        $validated = $request->validate([
            'package_description' => ['required', 'string', 'max:255'],
            'package_size' => ['required', 'integer', 'min:1'],
            'package_unit' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('medicine_packages', 'barcode')],
        ]);

        $validated['variant_id'] = $variant->id;
        $package = MedicinePackage::query()->create($validated);

        return response()->json(['data' => $this->serializePackage($package)], 201);
    }

    public function update(Request $request, int $packageId): JsonResponse
    {
        $package = MedicinePackage::query()->findOrFail($packageId);

        $validated = $request->validate([
            'package_description' => ['required', 'string', 'max:255'],
            'package_size' => ['required', 'integer', 'min:1'],
            'package_unit' => ['required', 'string', 'max:50'],
            'barcode' => ['nullable', 'string', 'max:100', Rule::unique('medicine_packages', 'barcode')->ignore($package->id)],
        ]);

        $package->update($validated);

        return response()->json(['data' => $this->serializePackage($package->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePackage(MedicinePackage $p): array
    {
        return [
            'id' => $p->id,
            'variant_id' => $p->variant_id,
            'package_description' => $p->package_description,
            'package_size' => $p->package_size,
            'package_unit' => $p->package_unit,
            'barcode' => $p->barcode,
            'full_description' => $p->full_description,
        ];
    }
}
