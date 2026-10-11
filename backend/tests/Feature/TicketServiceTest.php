<?php

namespace Tests\Feature;

use App\Enums\TicketCategory;
use App\Enums\TicketHistoryEvent;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Customer;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
}
