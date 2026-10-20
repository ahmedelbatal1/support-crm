<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ChangeTicketStatusTest extends TestCase
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

    /**
     * An assigned ticket walked through the service to the given status, so its history is real.
     */
    private function ticketIn(TicketStatus $status): Ticket
    {
        $service = app(TicketService::class);
        $ticket = $this->createTicket();
        $service->assign($ticket, Agent::factory()->create(['name' => 'Omar']));

        $path = [TicketStatus::InProgress, TicketStatus::Resolved, TicketStatus::Closed];
        foreach ($path as $step) {
            if ($ticket->fresh()->status === $status) {
                break;
            }
            $service->changeStatus($ticket, $step);
        }

        return $ticket->fresh();
    }

    private function changeStatus(Ticket $ticket, string $status)
    {
        return $this->patchJson("/api/tickets/{$ticket->id}/status", ['status' => $status]);
    }

    private function assertRejected(Ticket $ticket, string $status, string $message): void
    {
        $before = $ticket->status;
        $historyCount = $ticket->histories()->count();

        $this->changeStatus($ticket, $status)
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => $message,
                'errors' => ['status' => [$message]],
            ]);

        $this->assertSame($before, $ticket->fresh()->status);
        $this->assertSame($historyCount, $ticket->histories()->count());
    }

    public function test_us5_as1_assigned_open_ticket_moves_to_in_progress(): void
    {
        $ticket = $this->ticketIn(TicketStatus::Open);

        $this->changeStatus($ticket, 'in_progress')
            ->assertOk()
            ->assertJsonPath('data.id', $ticket->id)
            ->assertJsonPath('data.status.value', 'in_progress')
            ->assertJsonPath('data.status.label', 'In Progress')
            ->assertJsonPath('data.agent.name', 'Omar')
            ->assertJsonPath('data.customer.email', 'sara@example.com')
            ->assertJsonPath('data.notes', [])
            ->assertJsonCount(3, 'data.history')
            ->assertJsonPath('data.history.2.event', 'status_changed')
            ->assertJsonPath('data.history.2.description', 'Status changed from Open to In Progress')
            ->assertJsonPath('data.history.2.old_value', 'open')
            ->assertJsonPath('data.history.2.new_value', 'in_progress');

        $this->assertSame(TicketStatus::InProgress, $ticket->fresh()->status);
    }

    public function test_us5_as2_unassigned_ticket_cannot_move_to_in_progress(): void
    {
        $ticket = $this->createTicket();

        $this->assertRejected($ticket, 'in_progress', 'Assign an agent before moving the ticket to In Progress.');
    }

    public function test_us5_as3_in_progress_ticket_moves_to_resolved(): void
    {
        $ticket = $this->ticketIn(TicketStatus::InProgress);

        $this->changeStatus($ticket, 'resolved')
            ->assertOk()
            ->assertJsonPath('data.status.value', 'resolved')
            ->assertJsonPath('data.history.3.description', 'Status changed from In Progress to Resolved');

        $this->assertSame(TicketStatus::Resolved, $ticket->fresh()->status);
    }

    public function test_us5_as4_resolved_ticket_moves_to_closed(): void
    {
        $ticket = $this->ticketIn(TicketStatus::Resolved);

        $this->changeStatus($ticket, 'closed')
            ->assertOk()
            ->assertJsonPath('data.status.value', 'closed')
            ->assertJsonPath('data.is_closed', true)
            ->assertJsonPath('data.allowed_transitions', [])
            ->assertJsonPath('data.history.4.description', 'Status changed from Resolved to Closed');

        $this->assertSame(TicketStatus::Closed, $ticket->fresh()->status);
    }

    public function test_us5_as5_resolved_ticket_is_reopened(): void
    {
        $ticket = $this->ticketIn(TicketStatus::Resolved);

        $this->changeStatus($ticket, 'in_progress')
            ->assertOk()
            ->assertJsonPath('data.status.value', 'in_progress')
            ->assertJsonPath('data.history.4.event', 'status_changed')
            ->assertJsonPath('data.history.4.description', 'Ticket reopened (Resolved → In Progress)')
            ->assertJsonPath('data.history.4.old_value', 'resolved')
            ->assertJsonPath('data.history.4.new_value', 'in_progress');

        $this->assertSame(TicketStatus::InProgress, $ticket->fresh()->status);
    }

    public static function skipsFromOpen(): array
    {
        return [
            'open to resolved' => ['resolved', 'Cannot change status from Open to Resolved.'],
            'open to closed' => ['closed', 'Cannot change status from Open to Closed.'],
        ];
    }

    #[DataProvider('skipsFromOpen')]
    public function test_us5_as6_open_ticket_cannot_skip_ahead(string $status, string $message): void
    {
        $this->assertRejected($this->ticketIn(TicketStatus::Open), $status, $message);
    }

    public static function movesFromInProgress(): array
    {
        return [
            'in progress to open' => ['open', 'Cannot change status from In Progress to Open.'],
            'in progress to closed' => ['closed', 'Cannot change status from In Progress to Closed.'],
        ];
    }

    #[DataProvider('movesFromInProgress')]
    public function test_us5_as7_in_progress_ticket_cannot_move_to_open_or_closed(string $status, string $message): void
    {
        $this->assertRejected($this->ticketIn(TicketStatus::InProgress), $status, $message);
    }

    public static function sameStatus(): array
    {
        return [
            'open' => [TicketStatus::Open, 'Cannot change status from Open to Open.'],
            'in progress' => [TicketStatus::InProgress, 'Cannot change status from In Progress to In Progress.'],
            'resolved' => [TicketStatus::Resolved, 'Cannot change status from Resolved to Resolved.'],
        ];
    }

    #[DataProvider('sameStatus')]
    public function test_us5_as8_same_status_is_rejected(TicketStatus $status, string $message): void
    {
        $this->assertRejected($this->ticketIn($status), $status->value, $message);
    }

    public static function anyStatus(): array
    {
        return array_combine(
            array_map(fn (TicketStatus $s) => $s->value, TicketStatus::cases()),
            array_map(fn (TicketStatus $s) => [$s->value], TicketStatus::cases()),
        );
    }

    #[DataProvider('anyStatus')]
    public function test_us5_as9_closed_ticket_cannot_change_status(string $status): void
    {
        $this->assertRejected($this->ticketIn(TicketStatus::Closed), $status, 'Closed tickets cannot be changed.');
    }

    public function test_us5_as10_rejected_move_leaves_status_and_history_unchanged(): void
    {
        $ticket = $this->ticketIn(TicketStatus::InProgress);
        $historyCount = $ticket->histories()->count();

        $this->changeStatus($ticket, 'open')->assertUnprocessable();
        $this->changeStatus($ticket, 'pending')->assertUnprocessable();

        $reloaded = $this->getJson("/api/tickets/{$ticket->id}")->assertOk();
        $reloaded->assertJsonPath('data.status.value', 'in_progress')
            ->assertJsonCount($historyCount, 'data.history');
    }

    public function test_ec_stale_screen_shows_the_rule_and_the_latest_state_can_be_reloaded(): void
    {
        $ticket = $this->ticketIn(TicketStatus::Resolved);

        // The first tab loads the ticket and still offers Reopen.
        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertJsonPath('data.allowed_transitions.1.action_label', 'Reopen');

        // Another tab closes it.
        $this->changeStatus($ticket, 'closed')->assertOk();

        // The first tab's Reopen is rejected with the rule's message...
        $this->changeStatus($ticket, 'in_progress')
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Closed tickets cannot be changed.',
                'errors' => ['status' => ['Closed tickets cannot be changed.']],
            ]);

        // ...and reloading shows the latest state.
        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonPath('data.status.value', 'closed')
            ->assertJsonPath('data.is_closed', true)
            ->assertJsonPath('data.allowed_transitions', []);
    }

    public static function invalidBodies(): array
    {
        return [
            'unknown status' => [['status' => 'pending']],
            'missing status' => [[]],
            'null status' => [['status' => null]],
            'label instead of value' => [['status' => 'In Progress']],
        ];
    }

    #[DataProvider('invalidBodies')]
    public function test_unknown_status_value_is_rejected(array $body): void
    {
        $ticket = $this->ticketIn(TicketStatus::Open);

        $this->patchJson("/api/tickets/{$ticket->id}/status", $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->assertSame(TicketStatus::Open, $ticket->fresh()->status);
        $this->assertSame(2, $ticket->histories()->count());
    }

    public function test_ec_missing_ticket_returns_404(): void
    {
        $this->patchJson('/api/tickets/999999/status', ['status' => 'in_progress'])
            ->assertNotFound()
            ->assertExactJson(['message' => 'Ticket not found.']);
    }
}
