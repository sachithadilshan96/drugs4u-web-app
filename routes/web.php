<?php

use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Controllers\CsrfCookieController;

Route::get('/sanctum/csrf-cookie', [CsrfCookieController::class, 'show'])
    ->middleware('web');

Route::get('/', fn () => view('app'));

Route::get('/{any}', fn () => view('app'))->where('any', '.*');
