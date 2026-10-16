<?php

namespace Database\Seeders;

use App\Enums\TicketCategory;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Models\Agent;
use App\Models\Customer;
use App\Models\Ticket;
use App\Services\TicketService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Every ticket is created and changed through TicketService, so each history matches its ticket
 * exactly as it would after real use.
 */
class TicketSeeder extends Seeder
{
    private const SUBJECTS = [
        'Refund not received',
        'Charged twice this month',
        'Cannot log in after password reset',
        'Invoice shows the wrong address',
        'App crashes when uploading a file',
        'How do I change my plan?',
        'Two-factor code never arrives',
        'Export to CSV is empty',
        'Please close my account',
        'Payment card declined at checkout',
        'Slow dashboard in the afternoon',
        'Update the email on my account',
    ];

    private const NOTES = [
        'Called customer, awaiting invoice copy.',
        'Asked the customer for a screenshot.',
        'Escalated to the billing team.',
        'Reproduced the issue on staging.',
        'Customer confirmed the fix works.',
        'Waiting for the payment provider to reply.',
    ];

    /**
     * The final status for each ticket, cycled so every status (and a reopen) appears.
     * "reopened" ends In Progress after a Resolved → In Progress move.
     */
    private const TARGETS = ['open', 'in_progress', 'resolved', 'closed', 'reopened'];

    public function __construct(private readonly TicketService $tickets)
    {
    }

    public function run(): void
    {
        $customers = Customer::all();
        $agents = Agent::all();

        for ($i = 0; $i < 30; $i++) {
            $this->seedTicket($customers->random(), $agents, self::TARGETS[$i % count(self::TARGETS)]);
        }
    }

    /**
     * @param  Collection<int, Agent>  $agents
     */
    private function seedTicket(Customer $customer, Collection $agents, string $target): void
    {
        $ticket = $this->tickets->createTicket([
            'customer_name' => $customer->name,
            'customer_email' => $customer->email,
            'customer_phone' => $customer->phone,
            'subject' => fake()->randomElement(self::SUBJECTS),
            'description' => fake()->optional(0.7)->paragraph(),
            'category' => fake()->randomElement(TicketCategory::cases())->value,
            'priority' => fake()->randomElement(TicketPriority::cases())->value,
        ]);

        // About half of the open tickets stay unassigned; every other ticket needs an agent.
        if ($target !== 'open' || fake()->boolean()) {
            $this->assignRandomAgent($ticket, $agents);
        }

        $this->maybeAddNote($ticket);

        $path = match ($target) {
            'open' => [],
            'in_progress' => [TicketStatus::InProgress],
            'resolved' => [TicketStatus::InProgress, TicketStatus::Resolved],
            'closed' => [TicketStatus::InProgress, TicketStatus::Resolved, TicketStatus::Closed],
            'reopened' => [TicketStatus::InProgress, TicketStatus::Resolved, TicketStatus::InProgress],
        };

        foreach ($path as $status) {
            // Notes go in before each move, so none are attempted after the ticket is closed.
            $this->maybeAddNote($ticket);
            $this->tickets->changeStatus($ticket, $status);

            if ($status === TicketStatus::InProgress && fake()->boolean(20)) {
                $this->assignRandomAgent($ticket, $agents);
            }
        }
    }

    /**
     * @param  Collection<int, Agent>  $agents
     */
    private function assignRandomAgent(Ticket $ticket, Collection $agents): void
    {
        $current = $ticket->fresh()->agent_id;

        $this->tickets->assign($ticket, $agents->where('id', '!=', $current)->random());
    }

    private function maybeAddNote(Ticket $ticket): void
    {
        if (fake()->boolean(40)) {
            $this->tickets->addNote($ticket, fake()->randomElement(self::NOTES));
        }
    }
}
