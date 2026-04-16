<?php

namespace App\Services;

use App\Models\Inventory;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Non-expired stock allocation by FEFO (first expiry, first out), stable by row id.
 */
final class InventoryStockAllocator
{
    public function sumNonExpiredForMedicine(int $medicineId): int
    {
        $today = Carbon::today()->toDateString();

        return (int) Inventory::query()
            ->where('medicine_id', $medicineId)
            ->whereDate('expiry_date', '>=', $today)
            ->sum('quantity');
    }

    public function assertSufficientNonExpiredStock(int $medicineId, int $qtyNeeded): void
    {
        $available = $this->sumNonExpiredForMedicine($medicineId);

        if ($available < $qtyNeeded) {
            throw new HttpResponseException(response()->json([
                'message' => 'Insufficient non-expired stock for one or more line items.',
                'medicine_id' => $medicineId,
            ], 422));
        }
    }

    /**
     * Decrement quantity across all non-expired batches for the medicine, earliest expiry first.
     */
    public function decrementNonExpiredByFefo(int $medicineId, int $qtyNeeded): void
    {
        if ($qtyNeeded <= 0) {
            return;
        }

        $today = Carbon::today()->toDateString();
        $remaining = $qtyNeeded;

        $rows = Inventory::query()
            ->where('medicine_id', $medicineId)
            ->whereDate('expiry_date', '>=', $today)
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($rows as $row) {
            if ($remaining <= 0) {
                break;
            }
            $take = min((int) $row->quantity, $remaining);
            if ($take <= 0) {
                continue;
            }
            $row->decrement('quantity', $take);
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw new HttpResponseException(response()->json(['message' => 'Stock allocation failed.'], 422));
        }
    }
}
