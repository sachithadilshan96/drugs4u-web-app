<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrescriptionItem extends Model
{
    protected $table = 'prescription_items';

    public $timestamps = false;

    protected $fillable = [
        'prescription_id',
        'package_id',
        'quantity',
        'dispensed_qty',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'dispensed_qty' => 'integer',
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
     * @return BelongsTo<MedicinePackage, $this>
     */
    public function package(): BelongsTo
    {
        return $this->belongsTo(MedicinePackage::class, 'package_id');
    }

    public function resolvedMedicine(): ?Medicine
    {
        $this->loadMissing('package.variant.medicine');

        return $this->package?->variant?->medicine;
    }
}
