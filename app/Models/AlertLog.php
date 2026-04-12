<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AlertLog extends Model
{
    protected $table = 'alerts_log';

    protected $fillable = [
        'alert_type',
        'reference_id',
        'message',
        'dismissed',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reference_id' => 'integer',
            'dismissed' => 'boolean',
        ];
    }
}
