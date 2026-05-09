<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AlertLog;
use Illuminate\Http\JsonResponse;

class AlertController extends Controller
{
    public function dismiss(AlertLog $alert): JsonResponse
    {
        $alert->update(['dismissed' => true]);

        return response()->json([
            'data' => [
                'id' => $alert->id,
                'dismissed' => true,
            ],
        ]);
    }
}
