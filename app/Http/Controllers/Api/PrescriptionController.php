<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Inventory;
use App\Models\MedicationHistory;
use App\Models\Medicine;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PrescriptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Prescription::query()
            ->with([
                'customer:id,full_name',
                'pharmacist:id,name',
            ])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('customer_id')) {
            $query->where('customer_id', (int) $request->input('customer_id'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date('date_to'));
        }

        $paginator = $query->paginate(15)->withQueryString();

        $paginator->getCollection()->transform(function (Prescription $p) {
            return [
                'id' => $p->id,
                'customer_id' => $p->customer_id,
                'customer_name' => $p->customer?->full_name,
                'pharmacist_id' => $p->pharmacist_id,
                'pharmacist_name' => $p->pharmacist?->name,
                'status' => $p->status,
                'notes' => $p->notes,
                'created_at' => $p->created_at?->toIso8601String(),
                'updated_at' => $p->updated_at?->toIso8601String(),
            ];
        });

        return response()->json($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(['pending', 'dispensed'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['required', 'integer', 'exists:medicines,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
        ]);

        $status = $validated['status'] ?? 'pending';

        $customer = Customer::query()
            ->with('customerHealth')
            ->findOrFail($validated['customer_id']);

        $medicineIds = collect($validated['items'])->pluck('medicine_id')->unique()->values()->all();
        $medicines = Medicine::query()->whereIn('id', $medicineIds)->get()->keyBy('id');

        $allergyConflicts = $this->detectAllergyConflicts($customer, $validated['items'], $medicines);
        if ($allergyConflicts !== []) {
            return response()->json([
                'message' => 'Potential allergy conflict for one or more medicines.',
                'conflicts' => $allergyConflicts,
            ], 422);
        }

        $ageWarnings = $this->collectAgeRestrictionWarnings($customer, $validated['items'], $medicines);

        $prescription = DB::transaction(function () use ($request, $validated, $status) {
            $rx = Prescription::query()->create([
                'customer_id' => $validated['customer_id'],
                'pharmacist_id' => $request->user()->id,
                'status' => $status,
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($validated['items'] as $row) {
                PrescriptionItem::query()->create([
                    'prescription_id' => $rx->id,
                    'medicine_id' => $row['medicine_id'],
                    'quantity' => $row['quantity'],
                    'dispensed_qty' => $status === 'dispensed' ? $row['quantity'] : 0,
                ]);
            }

            if ($status === 'dispensed') {
                $rx->load('items');
                $this->fulfillDispensedPrescription($rx);
            }

            return $rx->fresh(['items.medicine', 'customer', 'pharmacist']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription),
            'age_warnings' => $ageWarnings,
        ], 201);
    }

    public function show(Prescription $prescription): JsonResponse
    {
        $prescription->load(['items.medicine', 'customer', 'pharmacist']);

        return response()->json(['data' => $this->serializePrescriptionDetail($prescription)]);
    }

    public function updateStatus(Request $request, Prescription $prescription): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['dispensed', 'rejected'])],
        ]);

        $new = $validated['status'];

        if ($prescription->status !== 'pending') {
            return response()->json(['message' => 'Only pending prescriptions can change status this way.'], 422);
        }

        if ($new === 'rejected') {
            $prescription->update(['status' => 'rejected']);

            return response()->json(['data' => $this->serializePrescriptionDetail($prescription->fresh(['items.medicine', 'customer', 'pharmacist']))]);
        }

        $prescription->load('items');
        $customerForWarnings = Customer::query()
            ->with('customerHealth')
            ->findOrFail($prescription->customer_id);
        $medicinesForWarnings = Medicine::query()
            ->whereIn('id', $prescription->items->pluck('medicine_id'))
            ->get()
            ->keyBy('id');
        $ageWarnings = $this->collectAgeRestrictionWarnings(
            $customerForWarnings,
            $prescription->items
                ->map(fn (PrescriptionItem $i) => ['medicine_id' => (int) $i->medicine_id, 'quantity' => (int) $i->quantity])
                ->all(),
            $medicinesForWarnings
        );

        DB::transaction(function () use ($prescription) {
            $prescription->load('items');
            $this->fulfillDispensedPrescription($prescription);
            $prescription->update(['status' => 'dispensed']);
        });

        return response()->json([
            'data' => $this->serializePrescriptionDetail($prescription->fresh(['items.medicine', 'customer', 'pharmacist'])),
            'age_warnings' => $ageWarnings,
        ]);
    }

    public function destroy(Prescription $prescription): Response|JsonResponse
    {
        if ($prescription->status === 'dispensed') {
            return response()->json(['message' => 'Dispensed prescriptions cannot be deleted.'], 422);
        }

        $prescription->delete();

        return response()->noContent();
    }

    /**
     * @param  array<int, array{medicine_id: int, quantity: int}>  $items
     * @param  Collection<int, Medicine>  $medicines
     * @return list<array{medicine_id: int, medicine_name: string, matched_allergen: string}>
     */
    private function detectAllergyConflicts(Customer $customer, array $items, $medicines): array
    {
        $raw = $customer->customerHealth?->allergy_list;
        if (! is_string($raw) || trim($raw) === '') {
            return [];
        }

        $tokens = collect(preg_split('/[,;\n]+/', $raw) ?? [])
            ->map(fn (string $t) => trim($t))
            ->filter(fn (string $t) => mb_strlen($t) >= 3)
            ->values();

        if ($tokens->isEmpty()) {
            return [];
        }

        $conflicts = [];
        foreach ($items as $row) {
            $med = $medicines->get($row['medicine_id']);
            if (! $med instanceof Medicine) {
                continue;
            }
            $name = mb_strtolower($med->name);
            foreach ($tokens as $token) {
                $t = mb_strtolower($token);
                if ($t === '' || mb_strlen($t) < 3) {
                    continue;
                }
                if (str_contains($name, $t) || str_contains($t, $name)) {
                    $conflicts[] = [
                        'medicine_id' => $med->id,
                        'medicine_name' => $med->name,
                        'matched_allergen' => $token,
                    ];
                    break;
                }
            }
        }

        return $conflicts;
    }

    /**
     * @param  array<int, array{medicine_id: int, quantity: int}>  $items
     * @param  Collection<int, Medicine>  $medicines
     * @return list<array{medicine_id: int, medicine_name: string, min_age: int|null, customer_age: int, message: string}>
     */
    private function collectAgeRestrictionWarnings(Customer $customer, array $items, $medicines): array
    {
        $age = (int) $customer->age;
        $warnings = [];
        foreach ($items as $row) {
            $med = $medicines->get($row['medicine_id']);
            if (! $med instanceof Medicine) {
                continue;
            }
            if (! $med->requires_age_check) {
                continue;
            }
            $min = (int) ($med->min_age ?? 18);
            if ($age < $min) {
                $warnings[] = [
                    'medicine_id' => $med->id,
                    'medicine_name' => $med->name,
                    'min_age' => $min,
                    'customer_age' => $age,
                    'message' => "Customer is {$age}; this medicine is restricted below age {$min}. Pharmacist must acknowledge before supply.",
                ];
            }
        }

        return $warnings;
    }

    private function fulfillDispensedPrescription(Prescription $prescription): void
    {
        $prescription->loadMissing('items');
        $customerId = $prescription->customer_id;

        foreach ($prescription->items as $item) {
            $qty = (int) $item->quantity;
            $this->assertSufficientStock((int) $item->medicine_id, $qty);
            $this->decrementInventoryFefo((int) $item->medicine_id, $qty);

            MedicationHistory::query()->create([
                'customer_id' => $customerId,
                'prescription_id' => $prescription->id,
                'medicine_id' => $item->medicine_id,
                'dispensed_at' => now(),
                'qty' => $qty,
            ]);

            $item->update(['dispensed_qty' => $qty]);
        }
    }

    private function assertSufficientStock(int $medicineId, int $qtyNeeded): void
    {
        $today = Carbon::today()->toDateString();
        $available = (int) Inventory::query()
            ->where('medicine_id', $medicineId)
            ->whereDate('expiry_date', '>=', $today)
            ->sum('quantity');

        if ($available < $qtyNeeded) {
            throw new HttpResponseException(response()->json([
                'message' => 'Insufficient non-expired stock for one or more line items.',
                'medicine_id' => $medicineId,
            ], 422));
        }
    }

    private function decrementInventoryFefo(int $medicineId, int $qtyNeeded): void
    {
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

    /**
     * @return array<string, mixed>
     */
    private function serializePrescriptionDetail(Prescription $p): array
    {
        return [
            'id' => $p->id,
            'customer_id' => $p->customer_id,
            'customer' => $p->relationLoaded('customer') && $p->customer ? [
                'id' => $p->customer->id,
                'full_name' => $p->customer->full_name,
            ] : null,
            'pharmacist_id' => $p->pharmacist_id,
            'pharmacist' => $p->relationLoaded('pharmacist') && $p->pharmacist ? [
                'id' => $p->pharmacist->id,
                'name' => $p->pharmacist->name,
            ] : null,
            'status' => $p->status,
            'notes' => $p->notes,
            'items' => $p->relationLoaded('items')
                ? $p->items->map(fn (PrescriptionItem $i) => [
                    'id' => $i->id,
                    'medicine_id' => $i->medicine_id,
                    'medicine_name' => $i->relationLoaded('medicine') ? $i->medicine?->name : null,
                    'quantity' => $i->quantity,
                    'dispensed_qty' => $i->dispensed_qty,
                ])->values()->all()
                : [],
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }
}
