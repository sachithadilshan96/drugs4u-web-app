<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\MedicineSupplier;
use App\Models\MedicineVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class MedicineVariantController extends Controller
{
    public function store(Request $request, Medicine $medicine): JsonResponse
    {
        $validated = $request->validate([
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'brand_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'strength' => ['required', 'string', 'max:50'],
            'form' => ['required', 'string', 'max:100'],
            'route' => ['nullable', 'string', 'max:100'],
            'rxcui_variant' => ['nullable', 'string', 'max:50'],
        ]);

        $validated['medicine_id'] = $medicine->id;
        $validated['supplier_id'] = $this->resolveSupplierIdForMedicine($medicine, $validated['supplier_id'] ?? null);
        $variant = MedicineVariant::query()->create($validated);
        $variant->load(['medicine', 'supplier']);

        return response()->json(['data' => $this->serializeVariant($variant)], 201);
    }

    public function update(Request $request, Medicine $medicine, int $variantId): JsonResponse
    {
        $variant = MedicineVariant::query()
            ->where('medicine_id', $medicine->id)
            ->whereKey($variantId)
            ->firstOrFail();

        $validated = $request->validate([
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'brand_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'strength' => ['required', 'string', 'max:50'],
            'form' => ['required', 'string', 'max:100'],
            'route' => ['nullable', 'string', 'max:100'],
            'rxcui_variant' => ['nullable', 'string', 'max:50'],
        ]);

        $validated['supplier_id'] = $this->resolveSupplierIdForMedicine($medicine, $validated['supplier_id'] ?? null);
        $variant->update($validated);
        $variant->load(['medicine', 'supplier']);

        return response()->json(['data' => $this->serializeVariant($variant->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeVariant(MedicineVariant $v): array
    {
        return [
            'id' => $v->id,
            'medicine_id' => $v->medicine_id,
            'supplier_id' => $v->supplier_id,
            'supplier_name' => $v->supplier?->name,
            'brand_name' => $v->brand_name,
            'manufacturer' => $v->manufacturer,
            'strength' => $v->strength,
            'form' => $v->form,
            'route' => $v->route,
            'rxcui_variant' => $v->rxcui_variant,
            'display_name' => $v->display_name,
        ];
    }

    private function resolveSupplierIdForMedicine(Medicine $medicine, ?int $supplierId): int
    {
        if ($supplierId !== null) {
            return $supplierId;
        }

        $resolved = MedicineSupplier::query()
            ->where('medicine_id', $medicine->id)
            ->orderByDesc('is_preferred')
            ->orderBy('id')
            ->value('supplier_id');

        if ($resolved !== null) {
            return (int) $resolved;
        }

        throw ValidationException::withMessages([
            'supplier_id' => 'Link a supplier to this medicine before adding a variant.',
        ]);
    }
}
