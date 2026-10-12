<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AssignTicketTest extends TestCase
{
    use RefreshDatabase;

    private function createTicket(): Ticket
    {
        return app(TicketService::class)->createTicket([
            'customer_name' => 'Sara Ali',
            'customer_email' => 'sara@example.com',
            'subject' => 'Refund not received',
            'category' => 'billing',
            'priority' => 'high',
        ]);
    }

    public function test_us4_as1_assigns_an_agent(): void
    {
        $ticket = $this->createTicket();
        $omar = Agent::factory()->create(['name' => 'Omar']);

        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $omar->id])
            ->assertOk()
            ->assertJsonPath('data.id', $ticket->id)
            ->assertJsonPath('data.agent.id', $omar->id)
            ->assertJsonPath('data.agent.name', 'Omar')
            ->assertJsonPath('data.status.value', 'open')
            ->assertJsonPath('data.customer.email', 'sara@example.com')
            ->assertJsonPath('data.notes', [])
            ->assertJsonCount(2, 'data.history')
            ->assertJsonPath('data.history.1.event', 'assigned')
            ->assertJsonPath('data.history.1.description', 'Assigned to Omar')
            ->assertJsonPath('data.history.1.old_value', null)
            ->assertJsonPath('data.history.1.new_value', 'Omar');

        $this->assertSame($omar->id, $ticket->fresh()->agent_id);
    }

    public function test_us4_as2_reassigns_to_another_agent(): void
    {
        $ticket = $this->createTicket();
        $omar = Agent::factory()->create(['name' => 'Omar']);
        $lina = Agent::factory()->create(['name' => 'Lina']);
        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $omar->id])->assertOk();

        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $lina->id])
            ->assertOk()
            ->assertJsonPath('data.agent.id', $lina->id)
            ->assertJsonCount(3, 'data.history')
            ->assertJsonPath('data.history.2.description', 'Reassigned from Omar to Lina')
            ->assertJsonPath('data.history.2.old_value', 'Omar')
            ->assertJsonPath('data.history.2.new_value', 'Lina');

        $this->assertSame($lina->id, $ticket->fresh()->agent_id);
    }

    public function test_us4_as3_same_agent_is_rejected_and_history_unchanged(): void
    {
        $ticket = $this->createTicket();
        $omar = Agent::factory()->create(['name' => 'Omar Hassan']);
        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $omar->id])->assertOk();

        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $omar->id])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Ticket is already assigned to Omar Hassan.',
                'errors' => ['agent_id' => ['Ticket is already assigned to Omar Hassan.']],
            ]);

        $this->assertSame(2, $ticket->histories()->count());
    }

    public static function invalidAgentIds(): array
    {
        return [
            'unknown agent' => [['agent_id' => 999]],
            'missing agent_id' => [[]],
            'null agent_id' => [['agent_id' => null]],
            'non-numeric agent_id' => [['agent_id' => 'omar']],
        ];
    }

    #[DataProvider('invalidAgentIds')]
    public function test_us4_as4_invalid_agent_is_rejected(array $body): void
    {
        $ticket = $this->createTicket();

        $this->patchJson("/api/tickets/{$ticket->id}/assign", $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['agent_id']);

        $this->assertNull($ticket->fresh()->agent_id);
        $this->assertSame(1, $ticket->histories()->count());
    }

    public function test_us4_as5_closed_ticket_cannot_be_assigned(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Closed]);
        $omar = Agent::factory()->create();

        $this->patchJson("/api/tickets/{$ticket->id}/assign", ['agent_id' => $omar->id])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Closed tickets cannot be changed.',
                'errors' => ['agent_id' => ['Closed tickets cannot be changed.']],
            ]);

        $this->assertNull($ticket->fresh()->agent_id);
        $this->assertSame(0, $ticket->histories()->count());
    }

    public function test_missing_ticket_returns_404(): void
    {
        $omar = Agent::factory()->create();

        $this->patchJson('/api/tickets/999999/assign', ['agent_id' => $omar->id])
            ->assertNotFound()
            ->assertExactJson(['message' => 'Ticket not found.']);
    }
}
