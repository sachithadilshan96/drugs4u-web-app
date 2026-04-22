<?php

namespace App\Http\Resources;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'address' => $this->address,
            'dob' => $this->dob?->format('Y-m-d'),
            'age' => $this->age,
            'phone' => $this->phone,
            'email' => $this->email,
            'health' => $this->whenLoaded('customerHealth', function () {
                if ($this->customerHealth === null) {
                    return null;
                }

                return [
                    'id' => $this->customerHealth->id,
                    'allergy_list' => $this->customerHealth->allergy_list,
                    'medical_conditions' => $this->customerHealth->medical_conditions,
                    'notes' => $this->customerHealth->notes,
                ];
            }),
            'recent_medication_history' => $this->whenLoaded('recentMedicationHistory', function () {
                return $this->recentMedicationHistory->map(function ($row) {
                    return [
                        'id' => $row->id,
                        'prescription_id' => $row->prescription_id,
                        'medicine_id' => $row->medicine_id,
                        'medicine_name' => $row->relationLoaded('medicine') ? $row->medicine?->name : null,
                        'qty' => $row->qty,
                        'dispensed_at' => $row->dispensed_at?->toIso8601String(),
                    ];
                });
            }),
        ];
    }
}
