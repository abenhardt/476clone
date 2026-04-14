<?php

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rules\Password;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // In tests, skip the HaveIBeenPwned breach check (`->uncompromised()`)
        // to avoid network calls and allow predictable test passwords.
        // Production code retains the full policy via StoreUserRequest.
        Password::defaults(fn () => Password::min(8)->mixedCase()->numbers()->symbols());
    }

    /**
     * Seed a step-up MFA grant in the cache for the given user.
     *
     * Call this in tests that exercise routes protected by the mfa.step_up
     * middleware: application review, application delete, user deactivation/
     * reactivation, role changes, and audit log export.
     *
     * Mimics the user having recently completed POST /api/mfa/step-up, giving
     * them a 15-minute window to pass EnsureMfaStepUp without re-prompting.
     *
     * Usage:
     *   $admin = $this->createAdmin();
     *   $this->grantMfaStepUp($admin);
     *   $this->actingAs($admin)->postJson('/api/applications/1/review', [...]);
     */
    protected function grantMfaStepUp(User $user): void
    {
        // In tests, actingAs() does not create a Sanctum token, so
        // currentAccessToken()?->id returns null, and MfaService::hasValidStepUp()
        // falls back to 'unknown' via the ?? 'unknown' expression — making the
        // effective key "mfa_step_up:{userId}:unknown". Write both that form and
        // the legacy bare-user-id form so tests pass regardless of auth driver.
        Cache::put("mfa_step_up:{$user->id}:unknown", true, now()->addMinutes(15));
        Cache::put("mfa_step_up:{$user->id}", true, now()->addMinutes(15));
    }

    /**
     * Clear any MFA step-up grant for the given user.
     *
     * Use this in negative-path tests to verify that EnsureMfaStepUp blocks
     * an admin who has not recently re-verified.
     */
    protected function revokeMfaStepUp(User $user): void
    {
        Cache::forget("mfa_step_up:{$user->id}:unknown");
        Cache::forget("mfa_step_up:{$user->id}");
    }
}
