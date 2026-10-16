<?php

use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\TicketAssignmentController;
use App\Http\Controllers\Api\TicketController;
use App\Http\Controllers\Api\TicketStatusController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/meta', MetaController::class);
Route::get('/agents', [AgentController::class, 'index']);

Route::get('/tickets', [TicketController::class, 'index']);
Route::post('/tickets', [TicketController::class, 'store']);
Route::get('/tickets/{ticket}', [TicketController::class, 'show']);
Route::patch('/tickets/{ticket}/assign', TicketAssignmentController::class);
Route::patch('/tickets/{ticket}/status', TicketStatusController::class);
