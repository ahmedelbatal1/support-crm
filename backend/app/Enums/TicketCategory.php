<?php

namespace App\Enums;

enum TicketCategory: string
{
    case Billing = 'billing';
    case Technical = 'technical';
    case Account = 'account';
    case General = 'general';

    public function label(): string
    {
        return match ($this) {
            self::Billing => 'Billing',
            self::Technical => 'Technical',
            self::Account => 'Account',
            self::General => 'General',
        };
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $category) => ['value' => $category->value, 'label' => $category->label()],
            self::cases(),
        );
    }
}
