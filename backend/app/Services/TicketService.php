<?php

namespace App\Services;

use App\Enums\TicketHistoryEvent;
use App\Enums\TicketStatus;
use App\Exceptions\TicketRuleException;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * All ticket writes go through this service so every change is saved together with its history
 * entry in one transaction (research R6, FR-023).
 */
class TicketService
{
    /**
     * "!" is used as the LIKE escape character because a backslash needs different quoting in
     * MySQL and SQLite. With it, "%", "_" and "\" in the search text all match literally.
     */
    private const LIKE_ESCAPE = '!';

    /**
     * @param  array{customer_name: string, customer_email: string, customer_phone?: ?string, subject: string, description?: ?string, category: string, priority: string}  $data
     */
    public function createTicket(array $data): Ticket
    {
        return DB::transaction(function () use ($data) {
            // An existing customer is reused as-is; their stored name and phone are never overwritten.
            $customer = Customer::firstOrCreate(
                ['email' => $data['customer_email']],
                ['name' => $data['customer_name'], 'phone' => $data['customer_phone'] ?? null],
            );

            $ticket = new Ticket([
                'subject' => $data['subject'],
                'description' => $data['description'] ?? null,
                'category' => $data['category'],
                'priority' => $data['priority'],
            ]);
            $ticket->customer()->associate($customer);
            $ticket->status = TicketStatus::Open;
            $ticket->save();

            $ticket->number = Ticket::formatNumber($ticket->id);
            $ticket->save();

            $this->recordHistory($ticket, TicketHistoryEvent::Created, "Ticket {$ticket->number} created");

            return $ticket;
        });
    }

    /**
     * The row is locked and re-read so the checks and the "from" agent in history use the current
     * state, not whatever the caller loaded earlier.
     */
    public function assign(Ticket $ticket, Agent $agent): Ticket
    {
        return DB::transaction(function () use ($ticket, $agent) {
            $locked = Ticket::query()->with('agent')->lockForUpdate()->findOrFail($ticket->id);

            if ($locked->status->isClosed()) {
                throw TicketRuleException::closed('agent_id');
            }

            $previous = $locked->agent;

            if ($previous?->is($agent)) {
                throw TicketRuleException::alreadyAssigned($agent);
            }

            $locked->agent()->associate($agent);
            $locked->save();

            $this->recordHistory(
                $locked,
                TicketHistoryEvent::Assigned,
                $previous ? "Reassigned from {$previous->name} to {$agent->name}" : "Assigned to {$agent->name}",
                $previous?->name,
                $agent->name,
            );

            return $locked;
        });
    }

    /**
     * Guards run in a fixed order so a closed ticket always reports "closed" and an invalid move
     * is reported before a missing agent.
     */
    public function changeStatus(Ticket $ticket, TicketStatus $to): Ticket
    {
        return DB::transaction(function () use ($ticket, $to) {
            $locked = Ticket::query()->lockForUpdate()->findOrFail($ticket->id);
            $from = $locked->status;

            if ($from->isClosed()) {
                throw TicketRuleException::closed('status');
            }

            if (! $from->canTransitionTo($to)) {
                throw TicketRuleException::invalidTransition($from, $to);
            }

            if ($to === TicketStatus::InProgress && $locked->agent_id === null) {
                throw TicketRuleException::agentRequired();
            }

            $locked->status = $to;
            $locked->save();

            $this->recordHistory(
                $locked,
                TicketHistoryEvent::StatusChanged,
                $from === TicketStatus::Resolved && $to === TicketStatus::InProgress
                    ? 'Ticket reopened (Resolved → In Progress)'
                    : "Status changed from {$from->label()} to {$to->label()}",
                $from->value,
                $to->value,
            );

            return $locked;
        });
    }

    /**
     * Filters are combined with AND; agent_id "none" means unassigned (research R8).
     *
     * @param  array{status?: ?string, priority?: ?string, category?: ?string, agent_id?: int|string|null, search?: ?string}  $filters
     */
    public function listTickets(array $filters): LengthAwarePaginator
    {
        return Ticket::query()
            ->with(['customer', 'agent'])
            ->when($filters['status'] ?? null, fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($filters['priority'] ?? null, fn (Builder $q, string $priority) => $q->where('priority', $priority))
            ->when($filters['category'] ?? null, fn (Builder $q, string $category) => $q->where('category', $category))
            ->when($filters['agent_id'] ?? null, fn (Builder $q, int|string $agentId) => $agentId === 'none'
                ? $q->whereNull('agent_id')
                : $q->where('agent_id', $agentId))
            ->when($filters['search'] ?? null, function (Builder $q, string $search) {
                $pattern = '%'.$this->escapeLike($search).'%';

                $q->where(fn (Builder $q) => $q
                    ->whereRaw("subject LIKE ? ESCAPE '".self::LIKE_ESCAPE."'", [$pattern])
                    ->orWhereRaw("number LIKE ? ESCAPE '".self::LIKE_ESCAPE."'", [$pattern]));
            })
            ->orderByDesc('id')
            ->paginate(15);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(
            [self::LIKE_ESCAPE, '%', '_'],
            [self::LIKE_ESCAPE.self::LIKE_ESCAPE, self::LIKE_ESCAPE.'%', self::LIKE_ESCAPE.'_'],
            $value,
        );
    }

    private function recordHistory(
        Ticket $ticket,
        TicketHistoryEvent $event,
        string $description,
        ?string $old = null,
        ?string $new = null,
    ): void {
        $ticket->histories()->create([
            'event' => $event,
            'description' => $description,
            'old_value' => $old,
            'new_value' => $new,
        ]);
    }
}
