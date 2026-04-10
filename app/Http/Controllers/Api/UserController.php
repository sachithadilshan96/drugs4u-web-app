<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * Admin user management (placeholder for future work).
 */
class UserController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['message' => 'Not implemented'], 501);
    }
}
