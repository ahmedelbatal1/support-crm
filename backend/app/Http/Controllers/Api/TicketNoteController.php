<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreNoteRequest;
use App\Http\Resources\NoteResource;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Http\JsonResponse;

class TicketNoteController extends Controller
{
    public function __construct(private readonly TicketService $tickets)
    {
    }

    public function store(StoreNoteRequest $request, Ticket $ticket): JsonResponse
    {
        $note = $this->tickets->addNote($ticket, $request->validated('body'));

        return NoteResource::make($note)->response()->setStatusCode(201);
    }
}
