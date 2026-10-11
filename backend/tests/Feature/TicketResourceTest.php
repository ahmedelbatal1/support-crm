<?php

namespace Tests\Feature;

use App\Enums\TicketCategory;
use App\Enums\TicketHistoryEvent;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Http\Resources\TicketResource;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TicketResourceTest extends TestCase
{
    use RefreshDatabase;

    private function resolve(Ticket $ticket): array
    {
        return json_decode(TicketResource::make($ticket)->toJson(), true);
    }

    private function makeTicket(array $state = []): Ticket
    {
        Carbon::setTestNow('2026-10-07 06:00:00');

        $customer = Customer::factory()->create([
            'name' => 'Sara Ali',
            'email' => 'sara@example.com',
            'phone' => null,
        ]);

        return Ticket::factory()->for($customer)->create([
            'subject' => 'Refund not received',
            'description' => 'Paid twice in September.',
            'category' => TicketCategory::Billing,
            'priority' => TicketPriority::High,
            ...$state,
        ]);
    }

    public function test_single_ticket_matches_the_contract_shape(): void
    {
        $ticket = $this->makeTicket();
        $agent = Agent::factory()->create(['name' => 'Omar Hassan', 'email' => 'omar@example.com']);
        $ticket->agent()->associate($agent)->save();
        $note = $ticket->notes()->create(['body' => 'Called customer.']);
        $history = $ticket->histories()->create([
            'event' => TicketHistoryEvent::Created,
            'description' => "Ticket {$ticket->number} created",
        ]);

        $data = $this->resolve($ticket->fresh()->load(['customer', 'agent', 'notes', 'histories']));

        $this->assertSame([
            'id' => $ticket->id,
            'number' => $ticket->number,
            'subject' => 'Refund not received',
            'description' => 'Paid twice in September.',
            'status' => ['value' => 'open', 'label' => 'Open'],
            'priority' => ['value' => 'high', 'label' => 'High'],
            'category' => ['value' => 'billing', 'label' => 'Billing'],
            'is_closed' => false,
            'allowed_transitions' => [
                ['value' => 'in_progress', 'label' => 'In Progress', 'action_label' => 'In Progress'],
            ],
            'customer' => [
                'id' => $ticket->customer_id,
                'name' => 'Sara Ali',
                'email' => 'sara@example.com',
                'phone' => null,
            ],
            'agent' => ['id' => $agent->id, 'name' => 'Omar Hassan', 'email' => 'omar@example.com'],
            'notes' => [
                ['id' => $note->id, 'body' => 'Called customer.', 'created_at' => '2026-10-07T06:00:00.000000Z'],
            ],
            'history' => [[
                'id' => $history->id,
                'event' => 'created',
                'description' => "Ticket {$ticket->number} created",
                'old_value' => null,
                'new_value' => null,
                'created_at' => '2026-10-07T06:00:00.000000Z',
            ]],
            'created_at' => '2026-10-07T06:00:00.000000Z',
            'updated_at' => '2026-10-07T06:00:00.000000Z',
        ], $data);
    }

    public function test_unassigned_ticket_has_null_agent(): void
    {
        $data = $this->resolve($this->makeTicket()->load(['customer', 'agent']));

        $this->assertArrayHasKey('agent', $data);
        $this->assertNull($data['agent']);
    }

    public function test_list_shape_omits_notes_and_history_when_not_loaded(): void
    {
        $data = $this->resolve($this->makeTicket()->load(['customer', 'agent']));

        $this->assertArrayNotHasKey('notes', $data);
        $this->assertArrayNotHasKey('history', $data);
        $this->assertArrayHasKey('customer', $data);
    }

    public function test_closed_ticket_is_closed_with_no_transitions(): void
    {
        $data = $this->resolve($this->makeTicket(['status' => TicketStatus::Closed]));

        $this->assertTrue($data['is_closed']);
        $this->assertSame([], $data['allowed_transitions']);
    }

    public function test_resolved_ticket_offers_reopen_action_label(): void
    {
        $data = $this->resolve($this->makeTicket(['status' => TicketStatus::Resolved]));

        $this->assertSame([
            ['value' => 'closed', 'label' => 'Closed', 'action_label' => 'Closed'],
            ['value' => 'in_progress', 'label' => 'In Progress', 'action_label' => 'Reopen'],
        ], $data['allowed_transitions']);
    }

    public function test_response_is_wrapped_in_data(): void
    {
        $ticket = $this->makeTicket();

        $response = TicketResource::make($ticket)->toResponse(Request::create('/api/tickets/1'));

        $this->assertSame($ticket->id, $response->getData(true)['data']['id']);
    }
}
