<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Prescription extends Model
{
    protected $fillable = [
        'customer_id',
        'pharmacist_id',
        'status',
        'notes',
        'flagged_reason',
        'flagged_at',
        'reviewed_by',
        'reviewed_at',
        'prescription_type',
        'nhs_charge',
        'dispatched_at',
        'dispatched_by',
        'approved_at',
        'approved_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'flagged_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'dispatched_at' => 'datetime',
            'approved_at' => 'datetime',
            'nhs_charge' => 'decimal:2',
        ];
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function dispatcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispatched_by');
    }

    /**
     * @return HasMany<PrescriptionItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(PrescriptionItem::class);
    }

    /**
     * @return HasOne<Bill, $this>
     */
    public function bill(): HasOne
    {
        return $this->hasOne(Bill::class);
    }

    public function isDispatched(): bool
    {
        return $this->status === 'dispatched';
    }

    public function isFlagged(): bool
    {
        return $this->flagged_reason !== null && trim((string) $this->flagged_reason) !== '';
    }

    public function canBeDispatched(): bool
    {
        return $this->status === 'approved' || ($this->status === 'draft' && ! $this->isFlagged());
    }

    public function canGenerateBill(): bool
    {
        return $this->isDispatched() && ! $this->bill()->exists();
    }

    public function needsManagerApproval(): bool
    {
        return $this->status === 'pending_review';
    }
}
