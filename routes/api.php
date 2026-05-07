<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerHealthController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MedicineController;
use App\Http\Controllers\Api\PrescriptionController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('customers/search/{query}', [CustomerController::class, 'search'])
        ->where('query', '[^/]*');
    Route::post('customers/{customer}/health', [CustomerHealthController::class, 'upsert']);
    Route::apiResource('customers', CustomerController::class);

    Route::get('prescriptions/pending-review', [PrescriptionController::class, 'pendingReview']);
    Route::patch('prescriptions/{prescription}/review', [PrescriptionController::class, 'review'])
        ->middleware('role.manager_or_admin');
    Route::patch('prescriptions/{prescription}/status', [PrescriptionController::class, 'updateStatus']);
    Route::apiResource('prescriptions', PrescriptionController::class)->only(['index', 'store', 'show', 'destroy']);

    Route::get('inventory/low-stock', [InventoryController::class, 'lowStock']);
    Route::apiResource('inventory', InventoryController::class);

    Route::get('medicines', [MedicineController::class, 'index']);

    Route::middleware('role.admin')->group(function (): void {
        Route::apiResource('users', UserController::class)->only(['index', 'store', 'destroy']);
    });
});
