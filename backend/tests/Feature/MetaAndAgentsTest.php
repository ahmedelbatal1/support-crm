<?php

namespace Tests\Feature;

use App\Models\Agent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetaAndAgentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_meta_returns_enum_options_and_transitions(): void
    {
        $this->getJson('/api/meta')
            ->assertOk()
            ->assertExactJson([
                'data' => [
                    'statuses' => [
                        ['value' => 'open', 'label' => 'Open'],
                        ['value' => 'in_progress', 'label' => 'In Progress'],
                        ['value' => 'resolved', 'label' => 'Resolved'],
                        ['value' => 'closed', 'label' => 'Closed'],
                    ],
                    'priorities' => [
                        ['value' => 'low', 'label' => 'Low'],
                        ['value' => 'medium', 'label' => 'Medium'],
                        ['value' => 'high', 'label' => 'High'],
                        ['value' => 'urgent', 'label' => 'Urgent'],
                    ],
                    'categories' => [
                        ['value' => 'billing', 'label' => 'Billing'],
                        ['value' => 'technical', 'label' => 'Technical'],
                        ['value' => 'account', 'label' => 'Account'],
                        ['value' => 'general', 'label' => 'General'],
                    ],
                    'transitions' => [
                        'open' => ['in_progress'],
                        'in_progress' => ['resolved'],
                        'resolved' => ['closed', 'in_progress'],
                        'closed' => [],
                    ],
                ],
            ]);
    }

    public function test_meta_closed_transitions_is_an_empty_json_array(): void
    {
        $body = $this->get('/api/meta')->getContent();

        $this->assertStringContainsString('"closed":[]', $body);
    }

    public function test_agents_are_listed_sorted_by_name(): void
    {
        $zaid = Agent::factory()->create(['name' => 'Zaid Omar', 'email' => 'zaid@example.com']);
        $omar = Agent::factory()->create(['name' => 'Omar Hassan', 'email' => 'omar@example.com']);
        $layla = Agent::factory()->create(['name' => 'Layla Saad', 'email' => 'layla@example.com']);

        $this->getJson('/api/agents')
            ->assertOk()
            ->assertExactJson([
                'data' => [
                    ['id' => $layla->id, 'name' => 'Layla Saad', 'email' => 'layla@example.com'],
                    ['id' => $omar->id, 'name' => 'Omar Hassan', 'email' => 'omar@example.com'],
                    ['id' => $zaid->id, 'name' => 'Zaid Omar', 'email' => 'zaid@example.com'],
                ],
            ]);
    }

    public function test_agents_is_an_empty_list_when_there_are_none(): void
    {
        $this->getJson('/api/agents')
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }
}
