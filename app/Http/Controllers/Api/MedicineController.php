<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Medicine;
use Illuminate\Http\JsonResponse;

class MedicineController extends Controller
{
    /**
     * Distinct medicines that have at least one inventory row (store catalogue in stock).
     * Used for allergy pickers; free-text still allowed for unlisted allergens.
     */
    public function index(): JsonResponse
    {
        $rows = Medicine::query()
            ->whereHas('inventoryItems')
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['data' => $rows]);
    }
}
