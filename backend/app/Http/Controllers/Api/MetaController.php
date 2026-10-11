<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MetaResource;

class MetaController extends Controller
{
    public function __invoke(): MetaResource
    {
        return new MetaResource(null);
    }
}
