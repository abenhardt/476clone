<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * StoreUserRequest — Validation for super-admin direct user account creation.
 *
 * Super admins can create admin and medical staff accounts directly rather than
 * requiring those users to self-register and then have their role elevated.
 * This endpoint is NOT for creating applicant accounts — applicants self-register
 * via the public /api/auth/register endpoint.
 *
 * Allowed roles for creation: admin, medical, super_admin.
 * Applicant accounts must always self-register.
 */
class StoreUserRequest extends FormRequest
{
    /**
     * Authorization is enforced at the route level via role:super_admin middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for creating a new staff user account.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
            // Only staff roles — applicants must self-register
            'role' => ['required', 'string', 'in:admin,medical,super_admin', 'exists:roles,name'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.unique' => 'An account with this email address already exists.',
            'role.in' => 'Role must be one of: admin, medical, super_admin.',
            'password.confirmed' => 'Password confirmation does not match.',
        ];
    }
}
