<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Base controller class for the application.
 *
 * Provides authorization capabilities via the AuthorizesRequests trait,
 * enabling policy-based access control in all child controllers.
 */
abstract class Controller
{
    use AuthorizesRequests;
}
