<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\Prescription;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    /**
     * Manager/admin analytics: last 7 days prescription volume and top dispensed medicines.
     */
    public function analytics(): JsonResponse
    {
        $today = Carbon::today();
        $weekStart = $today->copy()->subDays(6);

        $trend = [];
        for ($i = 0; $i < 7; $i++) {
            $day = $weekStart->copy()->addDays($i);
            $trend[] = [
                'date' => $day->toDateString(),
                'label' => $day->format('D j M'),
                'total' => Prescription::query()->whereDate('created_at', $day)->count(),
            ];
        }

        $topRows = MedicationHistory::query()
            ->where('dispensed_at', '>=', $weekStart->copy()->startOfDay())
            ->selectRaw('medicine_id, sum(qty) as total_qty')
            ->groupBy('medicine_id')
            ->orderByDesc('total_qty')
            ->limit(5)
            ->get();

        $ids = $topRows->pluck('medicine_id')->filter()->map(fn ($id) => (int) $id)->values()->all();
        $names = $ids === []
            ? collect()
            : Medicine::query()->whereIn('id', $ids)->pluck('name', 'id');

        $topDispensed = $topRows->map(function ($row) use ($names) {
            $mid = (int) $row->medicine_id;

            return [
                'medicine_id' => $mid,
                'medicine_name' => $names[$mid] ?? 'Unknown',
                'quantity' => (int) $row->total_qty,
            ];
        })->values()->all();

        return response()->json([
            'data' => [
                'weekly_prescription_trend' => $trend,
                'top_dispensed_medicines' => $topDispensed,
            ],
        ]);
    }
}
