<?php

namespace App\Services;

use App\Enums\TicketHistoryEvent;
use App\Enums\TicketStatus;
use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;

/**
 * All ticket writes go through this service so every change is saved together with its history
 * entry in one transaction (research R6, FR-023).
 */
class TicketService
{
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
