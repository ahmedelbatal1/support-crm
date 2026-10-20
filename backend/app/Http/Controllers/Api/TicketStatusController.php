<?php

namespace App\Http\Controllers\Api;

use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ChangeStatusRequest;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Services\TicketService;

class TicketStatusController extends Controller
{
    public function __construct(private readonly TicketService $tickets) {}

    public function __invoke(ChangeStatusRequest $request, Ticket $ticket): TicketResource
    {
        // changeStatus() returns the re-read ticket; the bound $ticket is left as it was loaded.
        $ticket = $this->tickets->changeStatus($ticket, $request->enum('status', TicketStatus::class));

        return TicketResource::make($ticket->load(['customer', 'agent', 'notes', 'histories']));
    }
}
