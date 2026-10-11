<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTicketRequest;
use App\Http\Resources\TicketResource;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;

class TicketController extends Controller
{
    public function __construct(private readonly TicketService $tickets)
    {
    }

    public function store(StoreTicketRequest $request): JsonResponse
    {
        $ticket = $this->tickets->createTicket($request->validated());

        return TicketResource::make($ticket->load(['customer', 'agent', 'notes', 'histories']))
            ->response()
            ->setStatusCode(201);
    }
}
