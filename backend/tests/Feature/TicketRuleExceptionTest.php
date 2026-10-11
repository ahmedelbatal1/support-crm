<?php

namespace Tests\Feature;

use App\Enums\TicketStatus;
use App\Exceptions\TicketRuleException;
use App\Models\Agent;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TicketRuleExceptionTest extends TestCase
{
    public static function cases(): array
    {
        return [
            'invalid transition' => [
                fn () => TicketRuleException::invalidTransition(TicketStatus::Open, TicketStatus::Resolved),
                'status',
                'Cannot change status from Open to Resolved.',
            ],
            'agent required' => [
                fn () => TicketRuleException::agentRequired(),
                'status',
                'Assign an agent before moving the ticket to In Progress.',
            ],
            'closed (status)' => [
                fn () => TicketRuleException::closed('status'),
                'status',
                'Closed tickets cannot be changed.',
            ],
            'closed (agent_id)' => [
                fn () => TicketRuleException::closed('agent_id'),
                'agent_id',
                'Closed tickets cannot be changed.',
            ],
            'already assigned' => [
                fn () => TicketRuleException::alreadyAssigned(new Agent(['name' => 'Omar Hassan'])),
                'agent_id',
                'Ticket is already assigned to Omar Hassan.',
            ],
        ];
    }

    #[DataProvider('cases')]
    public function test_renders_as_422_with_field_error(callable $make, string $field, string $message): void
    {
        $exception = $make();

        $this->assertSame($field, $exception->field);
        $this->assertSame($message, $exception->getMessage());

        Route::get('/api/_test/rule', fn () => throw $exception);

        $this->get('/api/_test/rule')
            ->assertStatus(422)
            ->assertExactJson([
                'message' => $message,
                'errors' => [$field => [$message]],
            ]);
    }
}
