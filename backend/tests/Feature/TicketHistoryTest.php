<?php

namespace Tests\Feature;

use App\Enums\TicketHistoryEvent;
use App\Models\Ticket;
use App\Models\TicketHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class TicketHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function makeHistory(): TicketHistory
    {
        return Ticket::factory()->create()->histories()->create([
            'event' => TicketHistoryEvent::Created,
            'description' => 'Ticket created',
        ]);
    }

    public function test_fr022_history_row_is_stored_without_updated_at(): void
    {
        $history = $this->makeHistory()->fresh();

        $this->assertSame(TicketHistoryEvent::Created, $history->event);
        $this->assertNotNull($history->created_at);
        $this->assertArrayNotHasKey('updated_at', $history->getAttributes());
    }

    public function test_fr022_updating_a_history_row_throws(): void
    {
        $history = $this->makeHistory();

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Ticket history is append-only.');

        $history->update(['description' => 'Changed']);
    }

    public function test_fr022_updating_does_not_change_the_stored_row(): void
    {
        $history = $this->makeHistory();

        try {
            $history->update(['description' => 'Changed']);
        } catch (LogicException) {
        }

        $this->assertSame('Ticket created', $history->fresh()->description);
    }

    public function test_fr022_deleting_a_history_row_throws(): void
    {
        $history = $this->makeHistory();

        try {
            $history->delete();
            $this->fail('Expected LogicException.');
        } catch (LogicException $e) {
            $this->assertSame('Ticket history is append-only.', $e->getMessage());
        }

        $this->assertDatabaseHas('ticket_histories', ['id' => $history->id]);
    }

    public function test_fr022_deleting_the_ticket_removes_its_history_and_notes(): void
    {
        $history = $this->makeHistory();
        $ticket = $history->ticket;
        $ticket->notes()->create(['body' => 'A note']);

        $ticket->delete();

        $this->assertDatabaseMissing('ticket_histories', ['ticket_id' => $ticket->id]);
        $this->assertDatabaseMissing('ticket_notes', ['ticket_id' => $ticket->id]);
    }
}
