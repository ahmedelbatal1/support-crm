<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AddTicketNoteTest extends TestCase
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

    public function test_us6_as1_adds_a_note_and_records_history(): void
    {
        Carbon::setTestNow('2026-10-16 09:30:00');
        $ticket = $this->createTicket();

        $response = $this->postJson("/api/tickets/{$ticket->id}/notes", [
            'body' => 'Called customer, awaiting invoice copy.',
        ]);

        $note = $ticket->notes()->sole();
        $response->assertCreated()
            ->assertExactJson([
                'data' => [
                    'id' => $note->id,
                    'body' => 'Called customer, awaiting invoice copy.',
                    'created_at' => '2026-10-16T09:30:00.000000Z',
                ],
            ]);

        $this->getJson("/api/tickets/{$ticket->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data.notes')
            ->assertJsonPath('data.notes.0.body', 'Called customer, awaiting invoice copy.')
            ->assertJsonCount(2, 'data.history')
            ->assertJsonPath('data.history.1.event', 'note_added')
            ->assertJsonPath('data.history.1.description', 'Note added');
    }

    public function test_ec_html_in_a_note_is_stored_and_returned_as_text(): void
    {
        $ticket = $this->createTicket();

        $this->postJson("/api/tickets/{$ticket->id}/notes", ['body' => '<b>hi</b>'])
            ->assertCreated()
            ->assertJsonPath('data.body', '<b>hi</b>');
    }

    public static function emptyBodies(): array
    {
        return [
            'missing body' => [[]],
            'null body' => [['body' => null]],
            'empty body' => [['body' => '']],
            'whitespace-only body' => [['body' => "   \n\t  "]],
            'non-string body' => [['body' => ['a note']]],
        ];
    }

    #[DataProvider('emptyBodies')]
    public function test_us6_as2_empty_note_is_rejected(array $body): void
    {
        $ticket = $this->createTicket();

        $this->postJson("/api/tickets/{$ticket->id}/notes", $body)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body']);

        $this->assertSame(0, $ticket->notes()->count());
        $this->assertSame(1, $ticket->histories()->count());
    }

    public function test_note_of_2000_characters_is_accepted(): void
    {
        $ticket = $this->createTicket();

        $this->postJson("/api/tickets/{$ticket->id}/notes", ['body' => str_repeat('a', 2000)])
            ->assertCreated();
    }

    public function test_note_over_2000_characters_is_rejected(): void
    {
        $ticket = $this->createTicket();

        $this->postJson("/api/tickets/{$ticket->id}/notes", ['body' => str_repeat('a', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body']);

        $this->assertSame(0, $ticket->notes()->count());
    }

    public function test_us6_as3_closed_ticket_cannot_get_notes(): void
    {
        $ticket = Ticket::factory()->create(['status' => TicketStatus::Closed]);

        $this->postJson("/api/tickets/{$ticket->id}/notes", ['body' => 'Too late.'])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Closed tickets cannot be changed.',
                'errors' => ['body' => ['Closed tickets cannot be changed.']],
            ]);

        $this->assertSame(0, $ticket->notes()->count());
        $this->assertSame(0, $ticket->histories()->count());
    }

    public function test_ec_missing_ticket_returns_404(): void
    {
        $this->postJson('/api/tickets/999999/notes', ['body' => 'Hello'])
            ->assertNotFound()
            ->assertExactJson(['message' => 'Ticket not found.']);
    }
}
