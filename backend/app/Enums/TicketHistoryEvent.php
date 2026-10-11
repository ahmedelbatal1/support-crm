<?php

namespace App\Enums;

enum TicketHistoryEvent: string
{
    case Created = 'created';
    case Assigned = 'assigned';
    case StatusChanged = 'status_changed';
    case NoteAdded = 'note_added';

    public function label(): string
    {
        return match ($this) {
            self::Created => 'Created',
            self::Assigned => 'Assigned',
            self::StatusChanged => 'Status Changed',
            self::NoteAdded => 'Note Added',
        };
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $event) => ['value' => $event->value, 'label' => $event->label()],
            self::cases(),
        );
    }
}
