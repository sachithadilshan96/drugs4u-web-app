<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    use SoftDeletes;

    protected $fillable = [
        'full_name',
        'address',
        'dob',
        'phone',
        'email',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dob' => 'date',
        ];
    }

    /**
     * @return HasOne<CustomerHealth, $this>
     */
    public function customerHealth(): HasOne
    {
        return $this->hasOne(CustomerHealth::class);
    }

    /**
     * @return HasMany<Prescription, $this>
     */
    public function prescriptions(): HasMany
    {
        return $this->hasMany(Prescription::class);
    }

    /**
     * @return HasMany<MedicationHistory, $this>
     */
    public function medicationHistory(): HasMany
    {
        return $this->hasMany(MedicationHistory::class);
    }

    /**
     * Age in full years from date of birth.
     *
     * @return Attribute<int, never>
     */
    protected function age(): Attribute
    {
        return Attribute::get(fn (): int => (int) $this->dob->diffInYears(now()));
    }
}
