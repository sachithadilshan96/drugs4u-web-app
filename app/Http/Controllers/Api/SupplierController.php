<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Inventory;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query()->withCount('medicines');

        if ($request->filled('search')) {
            $term = '%'.$request->string('search')->trim()->value().'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('city', 'like', $term)
                    ->orWhere('contact_person', 'like', $term);
            });
        }

        $rows = $query->orderBy('name')->get()->map(fn (Supplier $s) => $this->serializeList($s));

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatedPayload($request);
        $supplier = Supplier::query()->create($validated);

        return response()->json(['data' => $this->serializeDetail($supplier)], 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load([
            'medicines' => fn ($q) => $q->orderBy('name')->with(['variants' => fn ($vq) => $vq->orderBy('id')]),
        ]);

        return response()->json(['data' => $this->serializeShow($supplier)]);
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $validated = $this->validatedPayload($request);
        $supplier->update($validated);

        return response()->json(['data' => $this->serializeDetail($supplier->fresh())]);
    }

    public function destroy(Supplier $supplier): JsonResponse|Response
    {
        $hasStock = Inventory::query()
            ->where('supplier_id', $supplier->id)
            ->where('quantity', '>', 0)
            ->exists();

        if ($hasStock) {
            return response()->json([
                'message' => 'Cannot delete supplier with active inventory. Deactivate instead.',
            ], 422);
        }

        $supplier->update(['is_active' => false]);

        return response()->json(['data' => $this->serializeDetail($supplier->fresh())]);
    }

    public function deactivate(Supplier $supplier): JsonResponse
    {
        $supplier->update(['is_active' => false]);

        return response()->json(['data' => $this->serializeDetail($supplier->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedPayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address_line1' => ['nullable', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'postcode' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeList(Supplier $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'contact_person' => $s->contact_person,
            'phone' => $s->phone,
            'email' => $s->email,
            'city' => $s->city,
            'medicines_count' => (int) ($s->medicines_count ?? 0),
            'is_active' => (bool) $s->is_active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDetail(Supplier $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'contact_person' => $s->contact_person,
            'phone' => $s->phone,
            'email' => $s->email,
            'address_line1' => $s->address_line1,
            'address_line2' => $s->address_line2,
            'city' => $s->city,
            'postcode' => $s->postcode,
            'full_address' => $s->full_address,
            'notes' => $s->notes,
            'is_active' => (bool) $s->is_active,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeShow(Supplier $s): array
    {
        $detail = $this->serializeDetail($s);
        $detail['medicines'] = $s->medicines->map(function ($m) {
            $firstVariant = $m->relationLoaded('variants') ? $m->variants->first() : null;

            return [
                'id' => $m->id,
                'name' => $m->name,
                'variant_display' => $firstVariant?->display_name,
                'unit_cost' => $m->pivot->unit_cost,
                'lead_time_days' => $m->pivot->lead_time_days,
                'is_preferred' => (bool) $m->pivot->is_preferred,
            ];
        })->values()->all();

        return $detail;
    }
}
