<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiErrorHandlingTest extends TestCase
{
    public function test_unknown_api_route_returns_json_404_without_accept_header(): void
    {
        $response = $this->get('/api/does-not-exist');

        $response->assertNotFound()
            ->assertHeader('Content-Type', 'application/json')
            ->assertExactJson(['message' => 'Resource not found.']);
    }
}
