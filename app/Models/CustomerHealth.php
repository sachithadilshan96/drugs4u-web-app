<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerHealth extends Model
{
    protected $table = 'customer_health';

    protected $fillable = [
        'customer_id',
        'medication_allergies',
        'other_allergies',
        'medical_conditions',
        'notes',
    ];

    public function hasMedicationAllergies(): bool
    {
        return is_string($this->medication_allergies) && trim($this->medication_allergies) !== '';
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
