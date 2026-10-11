<?php

namespace App\Exceptions;

use App\Enums\TicketStatus;
use App\Models\Agent;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class TicketRuleException extends RuntimeException
{
    public function __construct(public readonly string $field, string $message)
    {
        parent::__construct($message);
    }

    public static function invalidTransition(TicketStatus $from, TicketStatus $to): self
    {
        return new self('status', "Cannot change status from {$from->label()} to {$to->label()}.");
    }

    public static function agentRequired(): self
    {
        return new self('status', 'Assign an agent before moving the ticket to In Progress.');
    }

    public static function closed(string $field): self
    {
        return new self($field, 'Closed tickets cannot be changed.');
    }

    public static function alreadyAssigned(Agent $agent): self
    {
        return new self('agent_id', "Ticket is already assigned to {$agent->name}.");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'errors' => [$this->field => [$this->getMessage()]],
        ], 422);
    }
}
