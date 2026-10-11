<?php

namespace Tests\Feature;

use App\Enums\TicketCategory;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ListTicketsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<int, string>
     */
    private function numbers(string $query = ''): array
    {
        return collect($this->getJson('/api/tickets'.$query)->assertOk()->json('data'))
            ->pluck('number')
            ->all();
    }

    public function test_us2_as1_lists_15_per_page_newest_first(): void
    {
        Ticket::factory()->count(20)->create();

        $this->getJson('/api/tickets')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonPath('data.0.number', 'TCK-0020')
            ->assertJsonPath('data.14.number', 'TCK-0006')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 20);

        $this->getJson('/api/tickets?page=2')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.number', 'TCK-0005')
            ->assertJsonPath('data.4.number', 'TCK-0001');
    }

    public function test_us2_as2_filters_by_status(): void
    {
        $open = Ticket::factory()->create();
        $resolved = Ticket::factory()->create(['status' => TicketStatus::Resolved]);

        $this->assertSame([$resolved->number], $this->numbers('?status=resolved'));
        $this->assertSame([$open->number], $this->numbers('?status=open'));
    }

    public function test_us2_as2_filters_by_priority(): void
    {
        $urgent = Ticket::factory()->create(['priority' => TicketPriority::Urgent]);
        Ticket::factory()->create(['priority' => TicketPriority::Low]);

        $this->assertSame([$urgent->number], $this->numbers('?priority=urgent'));
    }

    public function test_us2_as2_filters_by_category(): void
    {
        Ticket::factory()->create(['category' => TicketCategory::Billing]);
        $technical = Ticket::factory()->create(['category' => TicketCategory::Technical]);

        $this->assertSame([$technical->number], $this->numbers('?category=technical'));
    }

    public function test_us2_as3_filters_by_agent(): void
    {
        [$omar, $lina] = Agent::factory()->count(2)->create();
        $omarTicket = Ticket::factory()->create();
        $omarTicket->agent()->associate($omar)->save();
        Ticket::factory()->create()->agent()->associate($lina)->save();
        Ticket::factory()->create();

        $this->getJson("/api/tickets?agent_id={$omar->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number', $omarTicket->number)
            ->assertJsonPath('data.0.agent.id', $omar->id);
    }

    public function test_us2_as3_agent_none_lists_unassigned_tickets(): void
    {
        $agent = Agent::factory()->create();
        Ticket::factory()->create()->agent()->associate($agent)->save();
        $unassigned = Ticket::factory()->create();

        $this->getJson('/api/tickets?agent_id=none')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number', $unassigned->number)
            ->assertJsonPath('data.0.agent', null);
    }

    public function test_us2_as4_filters_are_combined_with_and(): void
    {
        $match = Ticket::factory()->create([
            'status' => TicketStatus::Open,
            'priority' => TicketPriority::High,
            'category' => TicketCategory::Billing,
            'subject' => 'Refund not received',
        ]);
        Ticket::factory()->create([
            'status' => TicketStatus::Open,
            'priority' => TicketPriority::Low,
            'category' => TicketCategory::Billing,
            'subject' => 'Refund not received',
        ]);
        Ticket::factory()->create([
            'status' => TicketStatus::Closed,
            'priority' => TicketPriority::High,
            'category' => TicketCategory::Billing,
            'subject' => 'Refund not received',
        ]);
        Ticket::factory()->create([
            'status' => TicketStatus::Open,
            'priority' => TicketPriority::High,
            'category' => TicketCategory::Billing,
            'subject' => 'Cannot log in',
        ]);

        $this->assertSame(
            [$match->number],
            $this->numbers('?status=open&priority=high&category=billing&agent_id=none&search=refund'),
        );
    }

    public function test_us2_as5_search_matches_part_of_the_subject_ignoring_case(): void
    {
        $match = Ticket::factory()->create(['subject' => 'Refund not received']);
        Ticket::factory()->create(['subject' => 'Cannot log in']);

        $this->assertSame([$match->number], $this->numbers('?search=REFUND'));
        $this->assertSame([$match->number], $this->numbers('?search=not%20rec'));
    }

    public function test_us2_as6_search_matches_the_ticket_number(): void
    {
        Ticket::factory()->count(12)->create(['subject' => 'Printer jam']);

        $this->assertSame(['TCK-0012'], $this->numbers('?search=TCK-0012'));
        $this->assertSame(['TCK-0012'], $this->numbers('?search=0012'));
        $this->assertSame(['TCK-0012'], $this->numbers('?search=tck-0012'));
    }

    public function test_us2_as7_no_match_returns_empty_data(): void
    {
        Ticket::factory()->create(['subject' => 'Refund not received']);

        $this->getJson('/api/tickets?search=nothing-like-this')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.total', 0);
    }

    public static function invalidFilters(): array
    {
        return [
            'unknown status' => ['status', '?status=pending'],
            'unknown priority' => ['priority', '?priority=critical'],
            'unknown category' => ['category', '?category=shipping'],
            'unknown agent' => ['agent_id', '?agent_id=999'],
            'non-numeric agent' => ['agent_id', '?agent_id=omar'],
            'search too long' => ['search', '?search='.str_repeat('a', 101)],
            'page zero' => ['page', '?page=0'],
            'non-numeric page' => ['page', '?page=abc'],
        ];
    }

    #[DataProvider('invalidFilters')]
    public function test_ec_invalid_filter_value_is_rejected(string $field, string $query): void
    {
        $this->getJson('/api/tickets'.$query)
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);
    }

    public function test_ec_percent_and_underscore_in_search_are_literal(): void
    {
        $percent = Ticket::factory()->create(['subject' => 'Charged 100% twice']);
        $underscore = Ticket::factory()->create(['subject' => 'Error in user_id field']);
        Ticket::factory()->create(['subject' => 'Charged 1000 twice']);
        Ticket::factory()->create(['subject' => 'Error in userXid field']);

        $this->assertSame([$percent->number], $this->numbers('?search=100%25'));
        $this->assertSame([$underscore->number], $this->numbers('?search=user_id'));
        $this->assertSame([], $this->numbers('?search=%25'.'%25'.'%25'));
    }

    public function test_ec_backslash_in_search_is_literal(): void
    {
        $match = Ticket::factory()->create(['subject' => 'Path C:\temp is full']);
        Ticket::factory()->create(['subject' => 'Path C:temp is full']);

        $this->assertSame([$match->number], $this->numbers('?search='.urlencode('C:\temp')));
    }

    public function test_ec_page_past_the_last_returns_empty_data(): void
    {
        Ticket::factory()->count(3)->create();

        $this->getJson('/api/tickets?page=5')
            ->assertOk()
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.total', 3);
    }

    public function test_ec_list_items_have_no_notes_or_history(): void
    {
        Ticket::factory()->create();

        $item = $this->getJson('/api/tickets')->assertOk()->json('data.0');

        $this->assertArrayNotHasKey('notes', $item);
        $this->assertArrayNotHasKey('history', $item);
        $this->assertArrayHasKey('customer', $item);
        $this->assertArrayHasKey('agent', $item);
    }
}
