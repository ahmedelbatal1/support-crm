<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CreateTicketTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return [
            'customer_name' => 'Sara Ali',
            'customer_email' => 'sara@example.com',
            'customer_phone' => '+966500000000',
            'subject' => 'Refund not received',
            'description' => 'Paid twice in September.',
            'category' => 'billing',
            'priority' => 'high',
            ...$overrides,
        ];
    }

    public function test_us1_as1_creates_an_open_unassigned_ticket(): void
    {
        $this->postJson('/api/tickets', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.number', 'TCK-0001')
            ->assertJsonPath('data.status', ['value' => 'open', 'label' => 'Open'])
            ->assertJsonPath('data.agent', null)
            ->assertJsonPath('data.customer.email', 'sara@example.com')
            ->assertJsonPath('data.subject', 'Refund not received')
            ->assertJsonPath('data.category.value', 'billing')
            ->assertJsonPath('data.priority.value', 'high')
            ->assertJsonPath('data.notes', [])
            ->assertJsonCount(1, 'data.history')
            ->assertJsonPath('data.history.0.event', 'created')
            ->assertJsonPath('data.history.0.description', 'Ticket TCK-0001 created');

        $this->assertSame(1, Ticket::count());
    }

    public function test_us1_as2_upper_case_email_reuses_the_existing_customer(): void
    {
        $customer = Customer::factory()->create(['email' => 'sara@example.com']);

        $this->postJson('/api/tickets', $this->payload(['customer_email' => '  Sara@Example.COM ']))
            ->assertCreated()
            ->assertJsonPath('data.customer.id', $customer->id)
            ->assertJsonPath('data.customer.email', 'sara@example.com');

        $this->assertSame(1, Customer::count());
    }

    public function test_us1_as2_new_customer_email_is_stored_lower_cased(): void
    {
        $this->postJson('/api/tickets', $this->payload(['customer_email' => 'New.Person@Example.com']))
            ->assertCreated()
            ->assertJsonPath('data.customer.email', 'new.person@example.com');
    }

    public static function invalidFields(): array
    {
        return [
            'missing customer name' => ['customer_name', ['customer_name' => null]],
            'blank customer name' => ['customer_name', ['customer_name' => '   ']],
            'missing customer email' => ['customer_email', ['customer_email' => null]],
            'invalid customer email' => ['customer_email', ['customer_email' => 'not-an-email']],
            'missing subject' => ['subject', ['subject' => null]],
            'missing category' => ['category', ['category' => null]],
            'missing priority' => ['priority', ['priority' => null]],
            'customer name too long' => ['customer_name', ['customer_name' => str_repeat('a', 256)]],
            'subject too long' => ['subject', ['subject' => str_repeat('a', 256)]],
            'phone too long' => ['customer_phone', ['customer_phone' => str_repeat('1', 31)]],
            'description too long' => ['description', ['description' => str_repeat('a', 5001)]],
        ];
    }

    #[DataProvider('invalidFields')]
    public function test_us1_as3_invalid_field_is_rejected(string $field, array $overrides): void
    {
        $this->postJson('/api/tickets', $this->payload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);

        $this->assertSame(0, Ticket::count());
        $this->assertSame(0, Customer::count());
    }

    public function test_us1_as3_optional_fields_can_be_omitted(): void
    {
        $payload = $this->payload();
        unset($payload['customer_phone'], $payload['description']);

        $this->postJson('/api/tickets', $payload)
            ->assertCreated()
            ->assertJsonPath('data.description', null)
            ->assertJsonPath('data.customer.phone', null);
    }

    public static function outOfListValues(): array
    {
        return [
            'unknown category' => ['category', ['category' => 'shipping']],
            'unknown priority' => ['priority', ['priority' => 'critical']],
        ];
    }

    #[DataProvider('outOfListValues')]
    public function test_us1_as4_category_or_priority_outside_the_list_is_rejected(string $field, array $overrides): void
    {
        $this->postJson('/api/tickets', $this->payload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([$field]);

        $this->assertSame(0, Ticket::count());
    }

    public function test_us1_as5_numbers_are_sequential(): void
    {
        foreach (range(1, 7) as $_) {
            $this->postJson('/api/tickets', $this->payload())->assertCreated();
        }

        $this->postJson('/api/tickets', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.number', 'TCK-0008');
    }

    public function test_ec_status_and_agent_in_the_body_are_ignored(): void
    {
        $this->postJson('/api/tickets', $this->payload(['status' => 'closed', 'agent_id' => 1]))
            ->assertCreated()
            ->assertJsonPath('data.status.value', 'open')
            ->assertJsonPath('data.agent', null);
    }
}
