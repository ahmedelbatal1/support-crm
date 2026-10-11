<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AgentResource;
use App\Models\Agent;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AgentController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AgentResource::collection(Agent::orderBy('name')->get());
    }
}
