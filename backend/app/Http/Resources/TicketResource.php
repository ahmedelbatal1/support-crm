<?php

namespace App\Http\Resources;

use App\Enums\TicketStatus;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Ticket
 */
class TicketResource extends JsonResource
{
    /**
     * notes and history are included only when loaded (single-ticket responses).
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'subject' => $this->subject,
            'description' => $this->description,
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'priority' => ['value' => $this->priority->value, 'label' => $this->priority->label()],
            'category' => ['value' => $this->category->value, 'label' => $this->category->label()],
            'is_closed' => $this->status->isClosed(),
            'allowed_transitions' => array_map(fn (TicketStatus $to) => [
                'value' => $to->value,
                'label' => $to->label(),
                'action_label' => $this->status->actionLabel($to),
            ], $this->status->allowedTransitions()),
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'agent' => new AgentResource($this->whenLoaded('agent')),
            'notes' => NoteResource::collection($this->whenLoaded('notes')),
            'history' => HistoryResource::collection($this->whenLoaded('histories')),
            'created_at' => $this->created_at?->toJSON(),
            'updated_at' => $this->updated_at?->toJSON(),
        ];
    }
}
