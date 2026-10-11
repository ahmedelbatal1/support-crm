<?php

namespace App\Models;

use App\Enums\TicketHistoryEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class TicketHistory extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['event', 'description', 'old_value', 'new_value'];

    protected function casts(): array
    {
        return [
            'event' => TicketHistoryEvent::class,
        ];
    }

    /**
     * History is append-only (FR-022). Deleting a ticket still removes its rows through the
     * database foreign-key cascade, which does not fire model events.
     */
    protected static function booted(): void
    {
        static::updating(function () {
            throw new LogicException('Ticket history is append-only.');
        });

        static::deleting(function () {
            throw new LogicException('Ticket history is append-only.');
        });
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
