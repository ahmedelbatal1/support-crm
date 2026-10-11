<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\MetaController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/meta', MetaController::class);
Route::get('/agents', [AgentController::class, 'index']);
