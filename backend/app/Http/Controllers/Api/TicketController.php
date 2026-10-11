<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListTicketsRequest;
use App\Http\Requests\StoreTicketRequest;
use App\Http\Resources\TicketResource;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TicketController extends Controller
{
    public function __construct(private readonly TicketService $tickets)
    {
    }

    public function index(ListTicketsRequest $request): AnonymousResourceCollection
    {
        return TicketResource::collection($this->tickets->listTickets($request->validated()));
    }

    public function store(StoreTicketRequest $request): JsonResponse
    {
        $ticket = $this->tickets->createTicket($request->validated());

        return TicketResource::make($ticket->load(['customer', 'agent', 'notes', 'histories']))
            ->response()
            ->setStatusCode(201);
    }
}
