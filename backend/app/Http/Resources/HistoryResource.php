<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\TicketHistory
 */
class HistoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event->value,
            'description' => $this->description,
            'old_value' => $this->old_value,
            'new_value' => $this->new_value,
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
