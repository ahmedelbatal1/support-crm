<?php

namespace Tests\Unit;

use App\Enums\TicketCategory;
use App\Enums\TicketHistoryEvent;
use App\Enums\TicketPriority;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class TicketEnumsTest extends TestCase
{
    public static function enums(): array
    {
        return [
            'priority' => [TicketPriority::class, [
                'low' => 'Low',
                'medium' => 'Medium',
                'high' => 'High',
                'urgent' => 'Urgent',
            ]],
            'category' => [TicketCategory::class, [
                'billing' => 'Billing',
                'technical' => 'Technical',
                'account' => 'Account',
                'general' => 'General',
            ]],
            'history event' => [TicketHistoryEvent::class, [
                'created' => 'Created',
                'assigned' => 'Assigned',
                'status_changed' => 'Status Changed',
                'note_added' => 'Note Added',
            ]],
        ];
    }

    #[DataProvider('enums')]
    public function test_values(string $enum, array $expected): void
    {
        $this->assertSame(
            array_keys($expected),
            array_map(fn ($case) => $case->value, $enum::cases()),
        );
    }

    #[DataProvider('enums')]
    public function test_labels(string $enum, array $expected): void
    {
        foreach ($expected as $value => $label) {
            $this->assertSame($label, $enum::from($value)->label());
        }
    }

    #[DataProvider('enums')]
    public function test_options(string $enum, array $expected): void
    {
        $options = [];
        foreach ($expected as $value => $label) {
            $options[] = ['value' => $value, 'label' => $label];
        }

        $this->assertSame($options, $enum::options());
    }
}
