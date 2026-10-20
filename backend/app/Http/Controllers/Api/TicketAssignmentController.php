<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignTicketRequest;
use App\Http\Resources\TicketResource;
use App\Models\Agent;
use App\Models\Ticket;
use App\Services\TicketService;

class TicketAssignmentController extends Controller
{
    public function __construct(private readonly TicketService $tickets) {}

    public function __invoke(AssignTicketRequest $request, Ticket $ticket): TicketResource
    {
        $agent = Agent::findOrFail($request->validated('agent_id'));

        // assign() returns the re-read ticket; the bound $ticket is left as it was loaded.
        $ticket = $this->tickets->assign($ticket, $agent);

        return TicketResource::make($ticket->load(['customer', 'agent', 'notes', 'histories']));
    }
}
