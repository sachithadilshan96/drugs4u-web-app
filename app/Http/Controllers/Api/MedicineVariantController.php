<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use App\Models\MedicineVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicineVariantController extends Controller
{
    public function store(Request $request, Medicine $medicine): JsonResponse
    {
        $validated = $request->validate([
            'brand_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'strength' => ['required', 'string', 'max:50'],
            'form' => ['required', 'string', 'max:100'],
            'route' => ['nullable', 'string', 'max:100'],
            'rxcui_variant' => ['nullable', 'string', 'max:50'],
        ]);

        $validated['medicine_id'] = $medicine->id;
        $variant = MedicineVariant::query()->create($validated);
        $variant->load('medicine');

        return response()->json(['data' => $this->serializeVariant($variant)], 201);
    }

    public function update(Request $request, Medicine $medicine, int $variantId): JsonResponse
    {
        $variant = MedicineVariant::query()
            ->where('medicine_id', $medicine->id)
            ->whereKey($variantId)
            ->firstOrFail();

        $validated = $request->validate([
            'brand_name' => ['nullable', 'string', 'max:255'],
            'manufacturer' => ['nullable', 'string', 'max:255'],
            'strength' => ['required', 'string', 'max:50'],
            'form' => ['required', 'string', 'max:100'],
            'route' => ['nullable', 'string', 'max:100'],
            'rxcui_variant' => ['nullable', 'string', 'max:50'],
        ]);

        $variant->update($validated);
        $variant->load('medicine');

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
            'brand_name' => $v->brand_name,
            'manufacturer' => $v->manufacturer,
            'strength' => $v->strength,
            'form' => $v->form,
            'route' => $v->route,
            'rxcui_variant' => $v->rxcui_variant,
            'display_name' => $v->display_name,
        ];
    }
}
