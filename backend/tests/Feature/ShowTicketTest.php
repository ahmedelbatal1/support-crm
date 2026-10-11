<?php

namespace Tests\Feature;

use App\Enums\TicketHistoryEvent;
use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ShowTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_us3_as1_shows_agent_notes_and_history_oldest_first(): void
    {
        $this->travelTo(Carbon::parse('2026-10-07 06:00:00', 'UTC'));

        $customer = Customer::factory()->create([
            'name' => 'Sara Ali',
            'email' => 'sara@example.com',
            'phone' => '+966500000000',
        ]);
        $agent = Agent::factory()->create(['name' => 'Omar Hassan', 'email' => 'omar@example.com']);
        $ticket = Ticket::factory()->for($customer)->create([
            'subject' => 'Refund not received',
            'status' => TicketStatus::InProgress,
        ]);
        $ticket->agent()->associate($agent)->save();

        $ticket->histories()->create(['event' => TicketHistoryEvent::Created, 'description' => "Ticket {$ticket->number} created"]);
        $this->travel(5)->minutes();
        $ticket->histories()->create(['event' => TicketHistoryEvent::Assigned, 'description' => 'Assigned to Omar Hassan', 'new_value' => 'Omar Hassan']);
        $this->travel(5)->minutes();
        $ticket->histories()->create(['event' => TicketHistoryEvent::StatusChanged, 'description' => 'Status changed from Open to In Progress', 'old_value' => 'open', 'new_value' => 'in_progress']);
        $this->travel(5)->minutes();
        $ticket->notes()->create(['body' => 'Called customer.']);
        $ticket->histories()->create(['event' => TicketHistoryEvent::NoteAdded, 'description' => 'Note added']);
        $this->travel(5)->minutes();
        $ticket->notes()->create(['body' => 'Refund issued.']);

        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $ticket->id)
            ->assertJsonPath('data.number', $ticket->number)
            ->assertJsonPath('data.subject', 'Refund not received')
            ->assertJsonPath('data.status', ['value' => 'in_progress', 'label' => 'In Progress'])
            ->assertJsonPath('data.created_at', '2026-10-07T06:00:00.000000Z')
            ->assertJsonPath('data.customer', [
                'id' => $customer->id,
                'name' => 'Sara Ali',
                'email' => 'sara@example.com',
                'phone' => '+966500000000',
            ])
            ->assertJsonPath('data.agent', ['id' => $agent->id, 'name' => 'Omar Hassan', 'email' => 'omar@example.com'])
            ->assertJsonCount(2, 'data.notes')
            ->assertJsonPath('data.notes.0.body', 'Called customer.')
            ->assertJsonPath('data.notes.0.created_at', '2026-10-07T06:15:00.000000Z')
            ->assertJsonPath('data.notes.1.body', 'Refund issued.')
            ->assertJsonPath('data.notes.1.created_at', '2026-10-07T06:20:00.000000Z')
            ->assertJsonCount(4, 'data.history')
            ->assertJsonPath('data.history.*.event', ['created', 'assigned', 'status_changed', 'note_added'])
            ->assertJsonPath('data.history.*.created_at', [
                '2026-10-07T06:00:00.000000Z',
                '2026-10-07T06:05:00.000000Z',
                '2026-10-07T06:10:00.000000Z',
                '2026-10-07T06:15:00.000000Z',
            ])
            ->assertJsonPath('data.history.2.old_value', 'open')
            ->assertJsonPath('data.history.2.new_value', 'in_progress');
    }

    public function test_us3_as2_unassigned_ticket_without_notes(): void
    {
        $ticket = Ticket::factory()->create();

        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonPath('data.agent', null)
            ->assertJsonPath('data.notes', [])
            ->assertJsonPath('data.history', []);
    }

    public function test_us3_as3_unknown_ticket_returns_404(): void
    {
        $this->getJson('/api/tickets/999999')
            ->assertNotFound()
            ->assertExactJson(['message' => 'Ticket not found.']);
    }

    public function test_ec_html_in_subject_and_description_is_returned_unchanged(): void
    {
        $ticket = Ticket::factory()->create([
            'subject' => '<script>alert("x")</script>',
            'description' => 'Hi <b>team</b> <script>alert(1)</script>',
        ]);

        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonPath('data.subject', '<script>alert("x")</script>')
            ->assertJsonPath('data.description', 'Hi <b>team</b> <script>alert(1)</script>');
    }
}
