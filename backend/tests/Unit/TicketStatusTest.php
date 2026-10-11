<?php

namespace Tests\Unit;

use App\Enums\TicketStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class TicketStatusTest extends TestCase
{
    private const ALLOWED = [
        'open' => ['in_progress'],
        'in_progress' => ['resolved'],
        'resolved' => ['closed', 'in_progress'],
        'closed' => [],
    ];

    public static function allPairs(): array
    {
        $pairs = [];

        foreach (TicketStatus::cases() as $from) {
            foreach (TicketStatus::cases() as $to) {
                $pairs["{$from->value} -> {$to->value}"] = [
                    $from,
                    $to,
                    in_array($to->value, self::ALLOWED[$from->value], true),
                ];
            }
        }

        return $pairs;
    }

    #[DataProvider('allPairs')]
    public function test_can_transition_to_matches_the_rules(TicketStatus $from, TicketStatus $to, bool $expected): void
    {
        $this->assertSame($expected, $from->canTransitionTo($to));
    }

    public function test_all_sixteen_pairs_are_covered_and_exactly_four_are_allowed(): void
    {
        $pairs = self::allPairs();

        $this->assertCount(16, $pairs);
        $this->assertCount(4, array_filter($pairs, fn (array $pair) => $pair[2]));
    }

    public function test_same_status_moves_are_not_allowed(): void
    {
        foreach (TicketStatus::cases() as $status) {
            $this->assertFalse($status->canTransitionTo($status), "{$status->value} -> {$status->value}");
        }
    }

    public function test_allowed_transitions_returns_enum_cases(): void
    {
        $this->assertSame([TicketStatus::InProgress], TicketStatus::Open->allowedTransitions());
        $this->assertSame([TicketStatus::Resolved], TicketStatus::InProgress->allowedTransitions());
        $this->assertSame([TicketStatus::Closed, TicketStatus::InProgress], TicketStatus::Resolved->allowedTransitions());
        $this->assertSame([], TicketStatus::Closed->allowedTransitions());
    }

    public function test_values(): void
    {
        $this->assertSame(
            ['open', 'in_progress', 'resolved', 'closed'],
            array_map(fn (TicketStatus $s) => $s->value, TicketStatus::cases()),
        );
    }

    public function test_labels(): void
    {
        $this->assertSame('Open', TicketStatus::Open->label());
        $this->assertSame('In Progress', TicketStatus::InProgress->label());
        $this->assertSame('Resolved', TicketStatus::Resolved->label());
        $this->assertSame('Closed', TicketStatus::Closed->label());
    }

    public function test_is_closed(): void
    {
        $this->assertTrue(TicketStatus::Closed->isClosed());
        $this->assertFalse(TicketStatus::Open->isClosed());
        $this->assertFalse(TicketStatus::InProgress->isClosed());
        $this->assertFalse(TicketStatus::Resolved->isClosed());
    }

    public function test_action_labels_for_allowed_moves(): void
    {
        $this->assertSame('In Progress', TicketStatus::Open->actionLabel(TicketStatus::InProgress));
        $this->assertSame('Resolved', TicketStatus::InProgress->actionLabel(TicketStatus::Resolved));
        $this->assertSame('Closed', TicketStatus::Resolved->actionLabel(TicketStatus::Closed));
        $this->assertSame('Reopen', TicketStatus::Resolved->actionLabel(TicketStatus::InProgress));
    }

    public function test_options(): void
    {
        $this->assertSame([
            ['value' => 'open', 'label' => 'Open'],
            ['value' => 'in_progress', 'label' => 'In Progress'],
            ['value' => 'resolved', 'label' => 'Resolved'],
            ['value' => 'closed', 'label' => 'Closed'],
        ], TicketStatus::options());
    }
}
