<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerHealth;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerHealthController extends Controller
{
    /**
     * Create or update the single health record for a customer.
     */
    public function upsert(Request $request, Customer $customer): JsonResponse
    {
        $validated = $request->validate([
            'medication_allergies' => ['nullable', 'string', 'max:65535'],
            'other_allergies' => ['nullable', 'string', 'max:65535'],
            'medical_conditions' => ['nullable', 'string', 'max:65535'],
            'notes' => ['nullable', 'string', 'max:65535'],
        ]);

        $health = CustomerHealth::query()->updateOrCreate(
            ['customer_id' => $customer->id],
            $validated
        );

        return response()->json([
            'id' => $health->id,
            'customer_id' => $health->customer_id,
            'medication_allergies' => $health->medication_allergies,
            'other_allergies' => $health->other_allergies,
            'medical_conditions' => $health->medical_conditions,
            'notes' => $health->notes,
            'updated_at' => $health->updated_at?->toIso8601String(),
        ]);
    }
}
