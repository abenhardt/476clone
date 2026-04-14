<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes (API-Only Backend)
|--------------------------------------------------------------------------
|
| This backend is API-first. Web routes are intentionally minimal.
| The root route returns a JSON response indicating API availability.
|
*/

Route::get('/', function () {
    return response()->json([
        'name' => config('app.name'),
        'status' => 'operational',
        'message' => 'API is operational. Please use /api endpoints for application access.',
        'documentation' => url('/api'),
    ]);
});
