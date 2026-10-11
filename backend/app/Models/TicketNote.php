<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketNote extends Model
{
    protected $fillable = ['body'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }
}
