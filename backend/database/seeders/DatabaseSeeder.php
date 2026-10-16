<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Model events stay on (no WithoutModelEvents) so the append-only guard on ticket history
     * applies while seeding too.
     */
    public function run(): void
    {
        $this->call([
            AgentSeeder::class,
            CustomerSeeder::class,
            TicketSeeder::class,
        ]);
    }
}
