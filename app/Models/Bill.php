<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bill extends Model
{
    protected $fillable = [
        'prescription_id',
        'bill_number',
        'prescription_type',
        'subtotal',
        'nhs_charge_per_item',
        'nhs_item_count',
        'total_amount',
        'vat_amount',
        'payment_status',
        'paid_at',
        'generated_by',
        'generated_at',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'nhs_charge_per_item' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'vat_amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'generated_at' => 'datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'generated_by');
    }

    public static function generateBillNumber(): string
    {
        $count = self::query()->whereDate('created_at', today())->count() + 1;

        return 'BILL-'.date('Ymd').'-'.str_pad((string) $count, 5, '0', STR_PAD_LEFT);
    }
}
