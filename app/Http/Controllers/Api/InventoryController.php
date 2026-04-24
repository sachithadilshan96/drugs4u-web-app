<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use App\Models\Inventory;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Inventory::query()->with('medicine')->orderBy('expiry_date')->orderBy('id');

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $query->whereHas('medicine', fn ($m) => $m->where('name', 'like', '%'.$term.'%'));
        }

        $paginator = $query->paginate(30)->withQueryString();

        $today = Carbon::today();
        $paginator->getCollection()->transform(fn (Inventory $inv) => $this->serializeInventoryRow($inv, $today));

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999'],
            'expiry_date' => ['required', 'date'],
        ]);

        $inventory = Inventory::query()->create($validated);

        return response()->json([
            'data' => $this->serializeInventoryRow($inventory->load('medicine')),
        ], 201);
    }

    public function show(Inventory $inventory): JsonResponse
    {
        return response()->json([
            'data' => $this->serializeInventoryRow($inventory->load('medicine')),
        ]);
    }

    public function update(Request $request, Inventory $inventory): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['receive', 'dispense'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999'],
        ]);

        DB::transaction(function () use ($inventory, $validated) {
            $locked = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();

            if ($validated['type'] === 'dispense') {
                if ($locked->quantity < $validated['quantity']) {
                    throw new HttpResponseException(response()->json([
                        'message' => 'Insufficient stock for this inventory row.',
                    ], 422));
                }
                $locked->decrement('quantity', $validated['quantity']);
            } else {
                $locked->increment('quantity', $validated['quantity']);
            }
        });

        $fresh = $inventory->fresh(['medicine']);
        $this->maybeCreateLowStockAlert($fresh);

        return response()->json([
            'data' => $this->serializeInventoryRow($fresh),
        ]);
    }

    public function destroy(Inventory $inventory): Response
    {
        $inventory->delete();

        return response()->noContent();
    }

    public function lowStock(): JsonResponse
    {
        $today = Carbon::today();
        $rows = Inventory::query()
            ->with('medicine')
            ->where('quantity', '<', 10)
            ->orderBy('quantity')
            ->orderBy('expiry_date')
            ->get()
            ->map(fn (Inventory $inv) => $this->serializeInventoryRow($inv, $today));

        return response()->json(['data' => $rows]);
    }

    private function maybeCreateLowStockAlert(Inventory $inventory): void
    {
        if ($inventory->quantity >= 10) {
            return;
        }

        $inventory->loadMissing('medicine');

        $exists = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $inventory->medicine_id)
            ->where('dismissed', false)
            ->exists();

        if ($exists) {
            return;
        }

        AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $inventory->medicine_id,
            'message' => 'Quantity below threshold ('.(int) $inventory->quantity.' units) for '.($inventory->medicine?->name ?? 'medicine #'.$inventory->medicine_id),
            'dismissed' => false,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeInventoryRow(Inventory $inv, ?Carbon $today = null): array
    {
        $today ??= Carbon::today();
        $exp = $inv->expiry_date;

        return [
            'id' => $inv->id,
            'medicine_id' => $inv->medicine_id,
            'medicine_name' => $inv->medicine?->name,
            'requires_age_check' => (bool) ($inv->medicine?->requires_age_check ?? false),
            'min_age' => (int) ($inv->medicine?->min_age ?? 18),
            'quantity' => $inv->quantity,
            'expiry_date' => $exp?->toDateString(),
            'is_low_stock' => $inv->quantity < 10,
            'is_expired' => $exp !== null && $exp->lt($today),
            'updated_at' => $inv->updated_at?->toIso8601String(),
        ];
    }
}
