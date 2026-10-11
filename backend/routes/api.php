<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\TicketController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/meta', MetaController::class);
Route::get('/agents', [AgentController::class, 'index']);

Route::post('/tickets', [TicketController::class, 'store']);
