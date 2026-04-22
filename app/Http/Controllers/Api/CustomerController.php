<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CustomerCollection;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Unique;

class CustomerController extends Controller
{
    /**
     * Paginated list with optional ?search= on full_name, phone, and id.
     */
    public function index(Request $request): CustomerCollection
    {
        $query = Customer::query()->orderBy('full_name');

        if ($request->filled('search')) {
            $term = $request->string('search')->trim()->value();
            $query->where(function ($q) use ($term) {
                $q->where('full_name', 'like', '%'.$term.'%')
                    ->orWhere('phone', 'like', '%'.$term.'%');
                if ($term !== '' && ctype_digit($term)) {
                    $q->orWhere('id', (int) $term);
                }
            });
        }

        return new CustomerCollection($query->paginate(20)->withQueryString());
    }

    /**
     * @return array<string, array<int, string|Unique>>
     */
    private function storeRules(?int $ignoreCustomerId = null): array
    {
        $phoneRule = ['required', 'string', 'max:50', 'unique:customers,phone'];
        if ($ignoreCustomerId !== null) {
            $phoneRule = ['required', 'string', 'max:50', Rule::unique('customers', 'phone')->ignore($ignoreCustomerId)];
        }

        return [
            'full_name' => ['required', 'string', 'max:255'],
            'dob' => ['required', 'date'],
            'address' => ['required', 'string', 'max:2000'],
            'phone' => $phoneRule,
            'email' => ['nullable', 'string', 'email', 'max:255'],
        ];
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->storeRules());

        $customer = Customer::query()->create($validated);

        return CustomerResource::make($customer)->response()->setStatusCode(201);
    }

    public function show(Customer $customer): CustomerResource
    {
        $customer->load('customerHealth');

        $history = $customer->medicationHistory()
            ->with('medicine')
            ->orderByDesc('dispensed_at')
            ->limit(5)
            ->get();

        $customer->setRelation('recentMedicationHistory', $history);

        return CustomerResource::make($customer);
    }

    public function update(Request $request, Customer $customer): CustomerResource
    {
        $validated = $request->validate($this->storeRules($customer->id));

        $customer->update($validated);

        return CustomerResource::make($customer->fresh());
    }

    public function destroy(Customer $customer): Response
    {
        $customer->delete();

        return response()->noContent();
    }

    /**
     * Quick lookup for prescription form AJAX (id, full_name, phone, dob).
     */
    public function search(string $query): JsonResponse
    {
        $query = urldecode($query);
        $query = trim($query);

        if ($query === '') {
            return response()->json([]);
        }

        $customers = Customer::query()
            ->where(function ($q) use ($query) {
                $q->where('full_name', 'like', '%'.$query.'%')
                    ->orWhere('phone', 'like', '%'.$query.'%');
                if (ctype_digit($query)) {
                    $q->orWhere('id', (int) $query);
                }
            })
            ->orderBy('full_name')
            ->limit(25)
            ->get(['id', 'full_name', 'phone', 'dob']);

        $payload = $customers->map(fn (Customer $c) => [
            'id' => $c->id,
            'full_name' => $c->full_name,
            'phone' => $c->phone,
            'dob' => $c->dob?->format('Y-m-d'),
        ]);

        return response()->json($payload);
    }
}
