<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgeVerificationLog extends Model
{
    protected $table = 'age_verification_log';

    protected $fillable = [
        'prescription_id',
        'medicine_id',
        'customer_id',
        'pharmacist_id',
        'customer_age',
        'min_age_required',
        'id_type_presented',
        'outcome',
        'pharmacist_notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'prescription_id' => 'integer',
            'medicine_id' => 'integer',
            'customer_id' => 'integer',
            'pharmacist_id' => 'integer',
            'customer_age' => 'integer',
            'min_age_required' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Prescription, $this>
     */
    public function prescription(): BelongsTo
    {
        return $this->belongsTo(Prescription::class);
    }

    /**
     * @return BelongsTo<Medicine, $this>
     */
    public function medicine(): BelongsTo
    {
        return $this->belongsTo(Medicine::class);
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function pharmacist(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pharmacist_id');
    }
}
