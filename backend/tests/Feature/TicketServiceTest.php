<?php

namespace Tests\Feature;

use App\Enums\TicketCategory;
use App\Enums\TicketHistoryEvent;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Exceptions\TicketRuleException;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use App\Models\TicketHistory;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class TicketServiceTest extends TestCase
{
    use RefreshDatabase;

    private TicketService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(TicketService::class);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'customer_name' => 'Sara Ali',
            'customer_email' => 'sara@example.com',
            'customer_phone' => '+966500000000',
            'subject' => 'Refund not received',
            'description' => 'Paid twice in September.',
            'category' => 'billing',
            'priority' => 'high',
            ...$overrides,
        ];
    }

    public function test_us1_as1_creates_an_open_unassigned_ticket(): void
    {
        $ticket = $this->service->createTicket($this->payload())->fresh();

        $this->assertSame('TCK-0001', $ticket->number);
        $this->assertSame(TicketStatus::Open, $ticket->status);
        $this->assertNull($ticket->agent_id);
        $this->assertSame('Refund not received', $ticket->subject);
        $this->assertSame('Paid twice in September.', $ticket->description);
        $this->assertSame(TicketCategory::Billing, $ticket->category);
        $this->assertSame(TicketPriority::High, $ticket->priority);
        $this->assertSame('sara@example.com', $ticket->customer->email);
        $this->assertSame('Sara Ali', $ticket->customer->name);
        $this->assertSame('+966500000000', $ticket->customer->phone);
    }

    public function test_us1_as5_numbers_follow_the_id_sequence(): void
    {
        $numbers = [];
        for ($i = 0; $i < 8; $i++) {
            $numbers[] = $this->service->createTicket($this->payload())->number;
        }

        $this->assertSame('TCK-0007', $numbers[6]);
        $this->assertSame('TCK-0008', $numbers[7]);
        $this->assertSame($numbers, Ticket::orderBy('id')->pluck('number')->all());
    }

    public function test_ec_number_continues_past_9999(): void
    {
        $customer = Customer::factory()->create();
        DB::table('tickets')->insert([
            'id' => 9999,
            'number' => 'TCK-9999',
            'customer_id' => $customer->id,
            'subject' => 'Older ticket',
            'category' => 'general',
            'priority' => 'low',
        ]);

        $ticket = $this->service->createTicket($this->payload());

        $this->assertSame(10000, $ticket->id);
        $this->assertSame('TCK-10000', $ticket->number);
    }

    public function test_us1_as2_reuses_customer_by_email_without_changing_it(): void
    {
        $existing = Customer::factory()->create([
            'name' => 'Sara Ali',
            'email' => 'sara@example.com',
            'phone' => '+966511111111',
        ]);

        $ticket = $this->service->createTicket($this->payload([
            'customer_name' => 'Sara A.',
            'customer_phone' => '+966522222222',
        ]));

        $this->assertSame($existing->id, $ticket->customer_id);
        $this->assertSame(1, Customer::count());
        $this->assertSame('Sara Ali', $existing->fresh()->name);
        $this->assertSame('+966511111111', $existing->fresh()->phone);
    }

    public function test_us1_as1_records_a_single_created_history_entry(): void
    {
        $ticket = $this->service->createTicket($this->payload());

        $histories = $ticket->histories()->get();

        $this->assertCount(1, $histories);
        $this->assertSame(TicketHistoryEvent::Created, $histories[0]->event);
        $this->assertSame('Ticket TCK-0001 created', $histories[0]->description);
        $this->assertNull($histories[0]->old_value);
        $this->assertNull($histories[0]->new_value);
    }

    public function test_ec_ignores_status_and_agent_in_the_input(): void
    {
        $ticket = $this->service->createTicket($this->payload([
            'status' => 'closed',
            'agent_id' => 99,
            'number' => 'TCK-9999',
        ]))->fresh();

        $this->assertSame(TicketStatus::Open, $ticket->status);
        $this->assertNull($ticket->agent_id);
        $this->assertSame('TCK-0001', $ticket->number);
    }

    public function test_us4_as1_assigns_an_unassigned_ticket(): void
    {
        $ticket = $this->service->createTicket($this->payload());
        $omar = Agent::factory()->create(['name' => 'Omar']);

        $assigned = $this->service->assign($ticket, $omar);

        $this->assertSame($omar->id, $assigned->agent_id);
        $this->assertSame($omar->id, $ticket->fresh()->agent_id);
        $this->assertSame(TicketStatus::Open, $ticket->fresh()->status);

        $history = $ticket->histories()->get();
        $this->assertCount(2, $history);
        $this->assertSame(TicketHistoryEvent::Assigned, $history[1]->event);
        $this->assertSame('Assigned to Omar', $history[1]->description);
        $this->assertNull($history[1]->old_value);
        $this->assertSame('Omar', $history[1]->new_value);
    }

    public function test_us4_as2_reassigns_to_another_agent(): void
    {
        $ticket = $this->service->createTicket($this->payload());
        $omar = Agent::factory()->create(['name' => 'Omar']);
        $lina = Agent::factory()->create(['name' => 'Lina']);

        $this->service->assign($ticket, $omar);
        $reassigned = $this->service->assign($ticket, $lina);

        $this->assertSame($lina->id, $reassigned->agent_id);
        $this->assertSame($lina->id, $ticket->fresh()->agent_id);

        $last = $ticket->histories()->get()->last();
        $this->assertSame(TicketHistoryEvent::Assigned, $last->event);
        $this->assertSame('Reassigned from Omar to Lina', $last->description);
        $this->assertSame('Omar', $last->old_value);
        $this->assertSame('Lina', $last->new_value);
        $this->assertSame(3, $ticket->histories()->count());
    }

    public function test_us4_as2_reassigns_even_when_the_caller_holds_a_stale_model(): void
    {
        $ticket = $this->service->createTicket($this->payload());
        $omar = Agent::factory()->create(['name' => 'Omar']);
        $lina = Agent::factory()->create(['name' => 'Lina']);
        $stale = Ticket::find($ticket->id);

        $this->service->assign($ticket, $omar);
        $this->service->assign($stale, $lina);

        $this->assertSame('Reassigned from Omar to Lina', $ticket->histories()->get()->last()->description);
    }

    public function test_us4_as3_same_agent_is_rejected_without_history(): void
    {
        $ticket = $this->service->createTicket($this->payload());
        $omar = Agent::factory()->create(['name' => 'Omar Hassan']);
        $this->service->assign($ticket, $omar);

        try {
            $this->service->assign($ticket, $omar);
            $this->fail('Expected TicketRuleException.');
        } catch (TicketRuleException $e) {
            $this->assertSame('agent_id', $e->field);
            $this->assertSame('Ticket is already assigned to Omar Hassan.', $e->getMessage());
        }

        $this->assertSame(2, $ticket->histories()->count());
    }

    public function test_us4_as5_closed_ticket_cannot_be_assigned(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Closed]);
        $omar = Agent::factory()->create();

        try {
            $this->service->assign($ticket, $omar);
            $this->fail('Expected TicketRuleException.');
        } catch (TicketRuleException $e) {
            $this->assertSame('agent_id', $e->field);
            $this->assertSame('Closed tickets cannot be changed.', $e->getMessage());
        }

        $this->assertNull($ticket->fresh()->agent_id);
        $this->assertSame(0, $ticket->histories()->count());
    }

    public function test_fr023_assignment_rolls_back_when_history_fails(): void
    {
        $ticket = $this->service->createTicket($this->payload());
        $omar = Agent::factory()->create(['name' => 'Omar']);
        $lina = Agent::factory()->create(['name' => 'Lina']);
        $this->service->assign($ticket, $omar);

        TicketHistory::creating(fn () => throw new RuntimeException('History write failed.'));

        try {
            $this->service->assign($ticket, $lina);
            $this->fail('Expected RuntimeException.');
        } catch (RuntimeException $e) {
            $this->assertSame('History write failed.', $e->getMessage());
        }

        $this->assertSame($omar->id, $ticket->fresh()->agent_id);
        $this->assertSame(2, $ticket->histories()->count());
    }

    private function assignedTicket(): Ticket
    {
        $ticket = $this->service->createTicket($this->payload());
        $this->service->assign($ticket, Agent::factory()->create(['name' => 'Omar']));

        return $ticket;
    }

    private function assertRuleRejected(Ticket $ticket, TicketStatus $to, string $message): void
    {
        $before = $ticket->histories()->count();

        try {
            $this->service->changeStatus($ticket, $to);
            $this->fail('Expected TicketRuleException.');
        } catch (TicketRuleException $e) {
            $this->assertSame('status', $e->field);
            $this->assertSame($message, $e->getMessage());
        }

        $this->assertSame($before, $ticket->histories()->count());
    }

    public function test_us5_as1_moves_an_assigned_open_ticket_to_in_progress(): void
    {
        $ticket = $this->assignedTicket();

        $changed = $this->service->changeStatus($ticket, TicketStatus::InProgress);

        $this->assertSame(TicketStatus::InProgress, $changed->status);
        $this->assertSame(TicketStatus::InProgress, $ticket->fresh()->status);

        $last = $ticket->histories()->get()->last();
        $this->assertSame(TicketHistoryEvent::StatusChanged, $last->event);
        $this->assertSame('Status changed from Open to In Progress', $last->description);
        $this->assertSame('open', $last->old_value);
        $this->assertSame('in_progress', $last->new_value);
    }

    public function test_us5_as2_in_progress_requires_an_agent(): void
    {
        $ticket = $this->service->createTicket($this->payload());

        $this->assertRuleRejected($ticket, TicketStatus::InProgress, 'Assign an agent before moving the ticket to In Progress.');
        $this->assertSame(TicketStatus::Open, $ticket->fresh()->status);
    }

    public function test_us5_as5_reopen_is_recorded_as_a_reopen(): void
    {
        $ticket = $this->assignedTicket();
        $this->service->changeStatus($ticket, TicketStatus::InProgress);
        $this->service->changeStatus($ticket, TicketStatus::Resolved);

        $this->service->changeStatus($ticket, TicketStatus::InProgress);

        $last = $ticket->histories()->get()->last();
        $this->assertSame('Ticket reopened (Resolved → In Progress)', $last->description);
        $this->assertSame('resolved', $last->old_value);
        $this->assertSame('in_progress', $last->new_value);
        $this->assertSame(TicketStatus::InProgress, $ticket->fresh()->status);
    }

    public function test_us5_as6_invalid_move_is_checked_before_the_agent(): void
    {
        $ticket = $this->service->createTicket($this->payload());

        $this->assertRuleRejected($ticket, TicketStatus::Resolved, 'Cannot change status from Open to Resolved.');
    }

    public function test_us5_as9_closed_is_checked_before_the_transition(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Closed]);

        $this->assertRuleRejected($ticket, TicketStatus::InProgress, 'Closed tickets cannot be changed.');
        $this->assertSame(TicketStatus::Closed, $ticket->fresh()->status);
    }

    public function test_us5_as10_status_change_rolls_back_when_history_fails(): void
    {
        $ticket = $this->assignedTicket();

        TicketHistory::creating(fn () => throw new RuntimeException('History write failed.'));

        try {
            $this->service->changeStatus($ticket, TicketStatus::InProgress);
            $this->fail('Expected RuntimeException.');
        } catch (RuntimeException $e) {
            $this->assertSame('History write failed.', $e->getMessage());
        }

        $this->assertSame(TicketStatus::Open, $ticket->fresh()->status);
        $this->assertSame(2, $ticket->histories()->count());
    }

    public function test_us6_as1_adds_a_note_with_history(): void
    {
        $ticket = $this->service->createTicket($this->payload());

        $note = $this->service->addNote($ticket, 'Called customer, awaiting invoice copy.');

        $this->assertSame($ticket->id, $note->ticket_id);
        $this->assertSame('Called customer, awaiting invoice copy.', $note->body);
        $this->assertSame([$note->id], $ticket->notes()->pluck('id')->all());

        $last = $ticket->histories()->get()->last();
        $this->assertSame(2, $ticket->histories()->count());
        $this->assertSame(TicketHistoryEvent::NoteAdded, $last->event);
        $this->assertSame('Note added', $last->description);
        $this->assertNull($last->old_value);
        $this->assertNull($last->new_value);
    }

    public function test_us6_as1_notes_keep_their_order_and_leave_the_ticket_unchanged(): void
    {
        $ticket = $this->assignedTicket();
        $this->service->changeStatus($ticket, TicketStatus::InProgress);

        $this->service->addNote($ticket, 'First');
        $this->service->addNote($ticket, 'Second');

        $this->assertSame(['First', 'Second'], $ticket->notes()->pluck('body')->all());
        $this->assertSame(TicketStatus::InProgress, $ticket->fresh()->status);
        $this->assertNotNull($ticket->fresh()->agent_id);
    }

    public function test_us6_as3_closed_ticket_cannot_get_notes(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Closed]);

        try {
            $this->service->addNote($ticket, 'Too late.');
            $this->fail('Expected TicketRuleException.');
        } catch (TicketRuleException $e) {
            $this->assertSame('body', $e->field);
            $this->assertSame('Closed tickets cannot be changed.', $e->getMessage());
        }

        $this->assertSame(0, $ticket->notes()->count());
        $this->assertSame(0, $ticket->histories()->count());
    }

    public function test_us6_as3_closed_check_uses_the_current_status_not_a_stale_model(): void
    {
        $ticket = $this->assignedTicket();
        $stale = Ticket::find($ticket->id);
        $this->service->changeStatus($ticket, TicketStatus::InProgress);
        $this->service->changeStatus($ticket, TicketStatus::Resolved);
        $this->service->changeStatus($ticket, TicketStatus::Closed);

        $this->expectException(TicketRuleException::class);

        $this->service->addNote($stale, 'Written from an old tab.');
    }

    public function test_fr023_note_rolls_back_when_history_fails(): void
    {
        $ticket = $this->service->createTicket($this->payload());

        TicketHistory::creating(fn () => throw new RuntimeException('History write failed.'));

        try {
            $this->service->addNote($ticket, 'Called customer.');
            $this->fail('Expected RuntimeException.');
        } catch (RuntimeException $e) {
            $this->assertSame('History write failed.', $e->getMessage());
        }

        $this->assertSame(0, $ticket->notes()->count());
        $this->assertSame(1, $ticket->histories()->count());
    }
}
