<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerHealth extends Model
{
    protected $table = 'customer_health';

    protected $fillable = [
        'customer_id',
        'allergy_list',
        'medical_conditions',
        'notes',
    ];

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
