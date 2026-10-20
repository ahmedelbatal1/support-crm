<?php

namespace App\Http\Requests;

use App\Enums\TicketCategory;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListTicketsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Unknown filter values are rejected with 422 instead of being ignored (research R8).
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::enum(TicketStatus::class)],
            'priority' => ['nullable', Rule::enum(TicketPriority::class)],
            'category' => ['nullable', Rule::enum(TicketCategory::class)],
            // "none" lists unassigned tickets; anything else must be an existing agent id.
            'agent_id' => $this->input('agent_id') === 'none'
                ? ['nullable']
                : ['nullable', 'integer', 'exists:agents,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
