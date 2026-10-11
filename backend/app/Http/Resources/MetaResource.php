<?php

namespace App\Http\Resources;

use App\Enums\TicketCategory;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Reference data built from the enums; it has no underlying model.
 */
class MetaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $transitions = [];
        foreach (TicketStatus::cases() as $status) {
            $transitions[$status->value] = array_map(
                fn (TicketStatus $to) => $to->value,
                $status->allowedTransitions(),
            );
        }

        return [
            'statuses' => TicketStatus::options(),
            'priorities' => TicketPriority::options(),
            'categories' => TicketCategory::options(),
            'transitions' => $transitions,
        ];
    }
}
