<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('picker')) {
            $q = Medicine::query()
                ->select(['medicines.id', 'medicines.name'])
                ->orderBy('name');

            if (! $request->boolean('catalog')) {
                $q->whereHas('inventoryItems');
            }

            if ($request->filled('search')) {
                $term = $request->string('search')->trim()->value();
                $q->where('name', 'like', '%'.$term.'%');
            }

            return response()->json(['data' => $q->get()]);
        }

        $query = Medicine::query()
            ->withSum('inventoryItems as stock_quantity', 'quantity');

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $query->where('name', 'like', '%'.$term.'%');
        }

        $paginator = $query->orderBy('name')->paginate(30)->withQueryString();

        $paginator->getCollection()->transform(fn (Medicine $m) => $this->serializeListRow($m));

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $validated = $this->validatedMedicinePayload($request);

        $medicine = Medicine::query()->create($validated);
        $fresh = Medicine::query()->withSum('inventoryItems as stock_quantity', 'quantity')->findOrFail($medicine->id);

        return response()->json([
            'data' => $this->serializeListRow($fresh),
        ], 201);
    }

    public function show(Request $request, Medicine $medicine): JsonResponse
    {
        $medicine->loadSum('inventoryItems as stock_quantity', 'quantity');

        return response()->json([
            'data' => $this->serializeDetail($medicine),
        ]);
    }

    public function update(Request $request, Medicine $medicine): JsonResponse
    {
        $this->assertAdmin($request);

        $validated = $this->validatedMedicinePayload($request, $medicine->id);

        $medicine->update($validated);
        $fresh = Medicine::query()->withSum('inventoryItems as stock_quantity', 'quantity')->findOrFail($medicine->id);

        return response()->json([
            'data' => $this->serializeListRow($fresh),
        ]);
    }

    private function assertAdmin(Request $request): void
    {
        if ($request->user()?->role !== 'admin') {
            abort(403, 'Forbidden');
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedMedicinePayload(Request $request, ?int $ignoreId = null): array
    {
        $uniqueName = Rule::unique('medicines', 'name');
        if ($ignoreId !== null) {
            $uniqueName = $uniqueName->ignore($ignoreId);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', $uniqueName],
            'description' => ['nullable', 'string'],
            'requires_age_check' => ['required', 'boolean'],
            'min_age' => ['nullable', 'integer', 'min:16', 'max:25', 'required_if:requires_age_check,true'],
            'age_restriction_label' => ['nullable', 'string', 'max:100', 'required_if:requires_age_check,true'],
            'age_restriction_notes' => ['nullable', 'string', 'required_if:requires_age_check,true'],
        ]);

        if (! $validated['requires_age_check']) {
            $validated['min_age'] = null;
            $validated['age_restriction_label'] = null;
            $validated['age_restriction_notes'] = null;
        }

        return $validated;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeListRow(Medicine $m): array
    {
        return [
            'id' => $m->id,
            'name' => $m->name,
            'description' => $m->description,
            'requires_age_check' => (bool) $m->requires_age_check,
            'is_age_restricted' => (bool) $m->requires_age_check,
            'min_age' => $m->min_age,
            'age_restriction_label' => $m->age_restriction_label,
            'age_restriction_notes' => $m->age_restriction_notes,
            'stock_quantity' => (int) ($m->stock_quantity ?? 0),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeDetail(Medicine $m): array
    {
        $row = $this->serializeListRow($m);

        return $row;
    }
}
