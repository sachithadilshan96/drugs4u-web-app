<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::post('/login', function (Request $request) {
    $credentials = $request->validate([
        'username' => ['required', 'string'],
        'password' => ['required', 'string'],
    ]);

    if (! Auth::attempt([
        'username' => $credentials['username'],
        'password' => $credentials['password'],
    ], $request->boolean('remember'))) {
        return response()->json(['message' => __('auth.failed')], 422);
    }

    $request->session()->regenerate();

    return response()->json($request->user()->only(['id', 'name', 'username', 'role']));
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/logout', function (Request $request) {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    });

    Route::get('/user', function (Request $request) {
        return response()->json($request->user()->only(['id', 'name', 'username', 'role']));
    });
});
