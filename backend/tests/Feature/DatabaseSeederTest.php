<?php

namespace Tests\Feature;

use App\Enums\TicketHistoryEvent;
use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();
    }

    public function test_seeds_5_agents_10_customers_and_30_tickets(): void
    {
        $this->assertSame(5, Agent::count());
        $this->assertSame(10, Customer::count());
        $this->assertSame(30, Ticket::count());
    }

    public function test_every_ticket_has_a_number_and_a_created_entry_first(): void
    {
        foreach (Ticket::with('histories')->get() as $ticket) {
            $this->assertSame(Ticket::formatNumber($ticket->id), $ticket->number);
            $this->assertSame(TicketHistoryEvent::Created, $ticket->histories->first()->event);
            $this->assertSame(
                1,
                $ticket->histories->where('event', TicketHistoryEvent::Created)->count(),
                "{$ticket->number} has more than one created entry.",
            );
        }
    }

    public function test_every_non_open_ticket_has_an_agent(): void
    {
        $unassigned = Ticket::where('status', '!=', TicketStatus::Open)->whereNull('agent_id')->count();

        $this->assertSame(0, $unassigned);
    }

    public function test_every_status_appears(): void
    {
        $statuses = Ticket::pluck('status')->map(fn (TicketStatus $s) => $s->value)->unique()->sort()->values();

        $this->assertSame(['closed', 'in_progress', 'open', 'resolved'], $statuses->all());
    }

    public function test_unassigned_tickets_also_appear(): void
    {
        $this->assertGreaterThan(0, Ticket::whereNull('agent_id')->count());
    }

    public function test_history_matches_each_ticket(): void
    {
        foreach (Ticket::with(['agent', 'notes', 'histories'])->get() as $ticket) {
            $statusChanges = $ticket->histories->where('event', TicketHistoryEvent::StatusChanged);
            $assignments = $ticket->histories->where('event', TicketHistoryEvent::Assigned);
            $notesAdded = $ticket->histories->where('event', TicketHistoryEvent::NoteAdded);

            $this->assertSame(
                $statusChanges->last()?->new_value ?? TicketStatus::Open->value,
                $ticket->status->value,
                "{$ticket->number} status does not match its history.",
            );
            $this->assertSame(
                $assignments->last()?->new_value,
                $ticket->agent?->name,
                "{$ticket->number} agent does not match its history.",
            );
            $this->assertSame($ticket->notes->count(), $notesAdded->count());
        }
    }

    public function test_notes_are_seeded(): void
    {
        $this->assertGreaterThan(0, Ticket::has('notes')->count());
    }
}
