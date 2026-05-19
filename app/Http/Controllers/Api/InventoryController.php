<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use App\Models\Inventory;
use App\Services\InventoryStockAllocator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryStockAllocator $inventoryStockAllocator,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $today = Carbon::today();

        $query = Inventory::query()
            ->with('medicine')
            ->select('inventory.*')
            ->selectSub(
                Inventory::query()
                    ->from('inventory as i2')
                    ->whereColumn('i2.medicine_id', 'inventory.medicine_id')
                    ->whereDate('i2.expiry_date', '>=', $today)
                    ->selectRaw('coalesce(sum(i2.quantity), 0)'),
                'medicine_non_expired_total'
            )
            ->orderBy('expiry_date')
            ->orderBy('id');

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $query->whereHas('medicine', fn ($m) => $m->where('name', 'like', '%'.$term.'%'));
        }

        $paginator = $query->paginate(30)->withQueryString();

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
        $inventory->load('medicine');
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForMedicine((int) $inventory->medicine_id);

        return response()->json([
            'data' => $this->serializeInventoryRow($inventory, null, $nonExpiredTotal),
        ], 201);
    }

    public function show(Inventory $inventory): JsonResponse
    {
        $inventory->load('medicine');
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForMedicine((int) $inventory->medicine_id);

        return response()->json([
            'data' => $this->serializeInventoryRow($inventory, null, $nonExpiredTotal),
        ]);
    }

    public function update(Request $request, Inventory $inventory): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(['receive', 'dispense'])],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999'],
        ]);

        DB::transaction(function () use ($inventory, $validated) {
            if ($validated['type'] === 'dispense') {
                $medicineId = (int) $inventory->medicine_id;
                $qty = (int) $validated['quantity'];
                $this->inventoryStockAllocator->assertSufficientNonExpiredStock($medicineId, $qty);
                $this->inventoryStockAllocator->decrementNonExpiredByFefo($medicineId, $qty);

                return;
            }

            $locked = Inventory::query()->whereKey($inventory->id)->lockForUpdate()->firstOrFail();
            $locked->increment('quantity', $validated['quantity']);
        });

        $fresh = $inventory->fresh(['medicine']);
        $medicineId = (int) $inventory->medicine_id;
        $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForMedicine($medicineId);

        foreach (Inventory::query()->where('medicine_id', $medicineId)->get() as $row) {
            $this->maybeCreateLowStockAlert($row);
        }

        return response()->json([
            'data' => $this->serializeInventoryRow($fresh, null, $nonExpiredTotal),
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
            ->map(function (Inventory $inv) use ($today) {
                $nonExpiredTotal = $this->inventoryStockAllocator->sumNonExpiredForMedicine((int) $inv->medicine_id);
                $payload = $this->serializeInventoryRow($inv, $today, $nonExpiredTotal);
                $payload['alert_id'] = $this->openLowStockAlertIdForMedicine($inv);

                return $payload;
            });

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

    private function openLowStockAlertIdForMedicine(Inventory $inventory): ?int
    {
        $inventory->loadMissing('medicine');

        $existing = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $inventory->medicine_id)
            ->where('dismissed', false)
            ->latest('id')
            ->first();

        if ($existing) {
            return (int) $existing->id;
        }

        $hasAnyPriorAlert = AlertLog::query()
            ->where('alert_type', 'low_stock')
            ->where('reference_id', $inventory->medicine_id)
            ->exists();

        if ($hasAnyPriorAlert) {
            return null;
        }

        $created = AlertLog::query()->create([
            'alert_type' => 'low_stock',
            'reference_id' => $inventory->medicine_id,
            'message' => 'Quantity below threshold ('.(int) $inventory->quantity.' units) for '.($inventory->medicine?->name ?? 'medicine #'.$inventory->medicine_id),
            'dismissed' => false,
        ]);

        return (int) $created->id;
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * @param  ?int  $medicineNonExpiredTotalOverride  Total non-expired qty for this medicine (all batches); used when the model row is not from the list subquery.
     */
    private function serializeInventoryRow(Inventory $inv, ?Carbon $today = null, ?int $medicineNonExpiredTotalOverride = null): array
    {
        $today ??= Carbon::today();
        $exp = $inv->expiry_date;

        $medicineNonExpiredTotal = $medicineNonExpiredTotalOverride;
        if ($medicineNonExpiredTotal === null && array_key_exists('medicine_non_expired_total', $inv->getAttributes())) {
            $medicineNonExpiredTotal = (int) $inv->medicine_non_expired_total;
        }
        if ($medicineNonExpiredTotal === null) {
            $medicineNonExpiredTotal = (int) $inv->quantity;
        }

        return [
            'id' => $inv->id,
            'medicine_id' => $inv->medicine_id,
            'medicine_name' => $inv->medicine?->name,
            'requires_age_check' => (bool) ($inv->medicine?->requires_age_check ?? false),
            'min_age' => (int) ($inv->medicine?->min_age ?? 18),
            'quantity' => $inv->quantity,
            'medicine_non_expired_total' => $medicineNonExpiredTotal,
            'expiry_date' => $exp?->toDateString(),
            'is_low_stock' => $inv->quantity < 10,
            'is_expired' => $exp !== null && $exp->lt($today),
            'updated_at' => $inv->updated_at?->toIso8601String(),
        ];
    }
}
