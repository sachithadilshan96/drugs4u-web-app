<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| SPA session auth (web middleware: session + cookie CSRF)
|--------------------------------------------------------------------------
*/
Route::middleware(['web'])->group(function (): void {
    Route::post('/login', function (Request $request) {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            return response()->json(['message' => __('auth.failed')], 422);
        }

        $request->session()->regenerate();

        return response()->json($request->user()->only(['id', 'name', 'email']));
    });

    Route::post('/logout', function (Request $request) {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    })->middleware('auth');

    Route::get('/user', function (Request $request) {
        if (! $request->user()) {
            return response()->json(['message' => __('Unauthenticated.')], 401);
        }

        return response()->json($request->user()->only(['id', 'name', 'email']));
    });
});
