<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AgeVerificationController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\CustomerHealthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\MedicineController;
use App\Http\Controllers\Api\MedicinePackageController;
use App\Http\Controllers\Api\MedicineVariantController;
use App\Http\Controllers\Api\PrescriptionController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RxNormController;
use App\Http\Controllers\Api\SupplierController;
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
    Route::post('alerts/{alert}/dismiss', [AlertController::class, 'dismiss']);

    Route::post('age-verifications', [AgeVerificationController::class, 'store']);
    Route::patch('age-verifications/link-prescription', [AgeVerificationController::class, 'updatePrescription']);
    Route::get('age-verifications', [AgeVerificationController::class, 'index'])
        ->middleware('role.manager_or_admin');

    Route::get('rxnorm/search', [RxNormController::class, 'search']);
    Route::post('rxnorm/import', [RxNormController::class, 'import']);

    Route::get('medicines', [MedicineController::class, 'index']);
    Route::get('medicines/{medicine}', [MedicineController::class, 'show']);

    Route::middleware('role:manager,admin')->group(function (): void {
        Route::post('medicines', [MedicineController::class, 'store']);
        Route::put('medicines/{medicine}', [MedicineController::class, 'update']);
        Route::post('medicines/{medicine}/suppliers', [MedicineController::class, 'attachSupplier']);
        Route::delete('medicines/{medicine}/suppliers/{supplier}', [MedicineController::class, 'detachSupplier']);
        Route::post('medicines/{medicine}/variants', [MedicineVariantController::class, 'store']);
        Route::put('medicines/{medicine}/variants/{variant}', [MedicineVariantController::class, 'update']);
        Route::post('variants/{variant}/packages', [MedicinePackageController::class, 'store']);
        Route::put('packages/{package}', [MedicinePackageController::class, 'update']);

        Route::apiResource('suppliers', SupplierController::class);
        Route::patch('suppliers/{supplier}/deactivate', [SupplierController::class, 'deactivate']);

        Route::get('dashboard/analytics', [DashboardController::class, 'analytics']);
        Route::get('reports/prescriptions-by-date', [ReportController::class, 'prescriptionsByDate']);
        Route::get('reports/prescriptions-by-customer', [ReportController::class, 'prescriptionsByCustomer']);
        Route::get('reports/stock', [ReportController::class, 'stockReport']);
    });

    Route::middleware('role.admin')->group(function (): void {
        Route::apiResource('users', UserController::class)->only(['index', 'store', 'destroy']);
    });
});
