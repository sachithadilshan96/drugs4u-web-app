<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AgeVerificationLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgeVerificationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'pharmacist_id' => ['required', 'integer', 'exists:users,id'],
            'customer_age' => ['required', 'integer', 'min:0', 'max:130'],
            'min_age_required' => ['required', 'integer', 'min:16', 'max:25'],
            'id_type_presented' => ['nullable', 'string', 'max:100'],
            'outcome' => ['required', 'in:verified,rejected,exempted'],
            'pharmacist_notes' => ['nullable', 'string', 'max:5000'],
            'prescription_id' => ['nullable', 'integer', 'exists:prescriptions,id'],
        ]);

        if ((int) $validated['pharmacist_id'] !== (int) $request->user()->id) {
            abort(403, 'Pharmacist mismatch.');
        }

        $log = AgeVerificationLog::query()->create([
            'prescription_id' => $validated['prescription_id'] ?? null,
            'medicine_id' => $validated['medicine_id'],
            'customer_id' => $validated['customer_id'],
            'pharmacist_id' => $validated['pharmacist_id'],
            'customer_age' => $validated['customer_age'],
            'min_age_required' => $validated['min_age_required'],
            'id_type_presented' => $validated['id_type_presented'] ?? null,
            'outcome' => $validated['outcome'],
            'pharmacist_notes' => $validated['pharmacist_notes'] ?? null,
        ]);

        return response()->json(['data' => $this->serializeLog($log)], 201);
    }

    public function updatePrescription(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'verification_ids' => ['required', 'array', 'min:1'],
            'verification_ids.*' => ['integer', 'exists:age_verification_log,id'],
            'prescription_id' => ['required', 'integer', 'exists:prescriptions,id'],
        ]);

        AgeVerificationLog::query()
            ->whereIn('id', $validated['verification_ids'])
            ->update(['prescription_id' => $validated['prescription_id']]);

        return response()->json(['message' => 'OK']);
    }

    public function index(Request $request): JsonResponse
    {
        $query = AgeVerificationLog::query()
            ->with(['medicine:id,name', 'customer:id,full_name', 'pharmacist:id,name'])
            ->orderByDesc('created_at');

        if ($request->filled('outcome')) {
            $query->where('outcome', $request->string('outcome')->toString());
        }
        if ($request->filled('medicine_id')) {
            $query->where('medicine_id', (int) $request->input('medicine_id'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }

        $rows = $query->limit(500)->get()->map(fn (AgeVerificationLog $l) => $this->serializeLog($l));

        return response()->json(['data' => $rows]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLog(AgeVerificationLog $l): array
    {
        return [
            'id' => $l->id,
            'prescription_id' => $l->prescription_id,
            'medicine_id' => $l->medicine_id,
            'customer_id' => $l->customer_id,
            'pharmacist_id' => $l->pharmacist_id,
            'customer_age' => $l->customer_age,
            'min_age_required' => $l->min_age_required,
            'id_type_presented' => $l->id_type_presented,
            'outcome' => $l->outcome,
            'pharmacist_notes' => $l->pharmacist_notes,
            'created_at' => $l->created_at?->toIso8601String(),
            'medicine' => $l->relationLoaded('medicine') && $l->medicine ? ['id' => $l->medicine->id, 'name' => $l->medicine->name] : null,
            'customer' => $l->relationLoaded('customer') && $l->customer ? ['id' => $l->customer->id, 'full_name' => $l->customer->full_name] : null,
            'pharmacist' => $l->relationLoaded('pharmacist') && $l->pharmacist ? ['id' => $l->pharmacist->id, 'name' => $l->pharmacist->name] : null,
        ];
    }
}
