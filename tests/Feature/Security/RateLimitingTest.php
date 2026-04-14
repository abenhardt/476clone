<?php

namespace Tests\Feature\Security;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Tests for rate limiting security feature.
 *
 * Verifies that rate limits are enforced on sensitive endpoints
 * to prevent brute force attacks and abuse.
 */
class RateLimitingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Flush the array cache between tests so rate limiter counters do not carry
        // over. RefreshDatabase reuses the same auto-increment user IDs across tests,
        // meaning user-scoped limiter keys (e.g. throttle:mfa|1) would accumulate
        // hits and fire prematurely if not cleared.
        Cache::flush();
    }

    public function test_auth_endpoint_rate_limited_after_five_attempts(): void
    {
        // Make 5 requests (should succeed)
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'password',
            ]);
            $response->assertStatus(401); // Invalid credentials, but not rate limited
        }

        // 6th request should be rate limited
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(429);
    }

    public function test_mfa_endpoint_rate_limited_after_three_attempts(): void
    {
        $user = User::factory()->create([
            'mfa_enabled' => true,
            'mfa_secret' => 'JBSWY3DPEHPK3PXP',
        ]);

        // The MFA limiter is defined in bootstrap/app.php as 3 req/min per user
        // (plus 10/hr). The per-minute limit is the binding constraint: 3 requests
        // are allowed before the 4th triggers a 429.
        for ($i = 0; $i < 3; $i++) {
            $response = $this->actingAs($user)->postJson('/api/mfa/verify', [
                'code' => '000000',
            ]);
            $response->assertStatus(401); // Invalid code, but not rate limited
        }

        // 4th request should be rate limited.
        $response = $this->actingAs($user)->postJson('/api/mfa/verify', [
            'code' => '000000',
        ]);

        $response->assertStatus(429);
    }

    public function test_upload_endpoint_rate_limited_after_five_attempts(): void
    {
        $user = User::factory()->create();

        // Make 5 requests (should succeed or fail for other reasons)
        for ($i = 0; $i < 5; $i++) {
            $response = $this->actingAs($user)->postJson('/api/documents', [
                'documentable_type' => 'App\\Models\\Camper',
                'documentable_id' => 1,
            ]);
            // Don't care about the response code, just that it's not 429
            $this->assertNotEquals(429, $response->status());
        }

        // 6th request should be rate limited
        $response = $this->actingAs($user)->postJson('/api/documents', [
            'documentable_type' => 'App\\Models\\Camper',
            'documentable_id' => 1,
        ]);

        $response->assertStatus(429);
    }

    public function test_rate_limits_are_per_ip_for_unauthenticated(): void
    {
        // Clear any existing rate limits
        RateLimiter::clear('auth');

        // Make 5 requests from first IP
        for ($i = 0; $i < 5; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'password',
            ], ['REMOTE_ADDR' => '192.168.1.1']);
            $response->assertStatus(401);
        }

        // 6th request from first IP should be rate limited
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ], ['REMOTE_ADDR' => '192.168.1.1']);
        $response->assertStatus(429);

        // Request from second IP should still work
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ], ['REMOTE_ADDR' => '192.168.1.2']);
        $response->assertStatus(401); // Not rate limited
    }

    public function test_rate_limits_are_per_user_for_authenticated(): void
    {
        $user1 = User::factory()->create(['mfa_enabled' => true, 'mfa_secret' => 'ABCDEFGH23456789']);
        $user2 = User::factory()->create(['mfa_enabled' => true, 'mfa_secret' => 'ZYXWVUTS76543210']);

        // Clear any existing rate limits
        RateLimiter::clear('mfa');

        // Make 3 requests as user1
        for ($i = 0; $i < 3; $i++) {
            $response = $this->actingAs($user1)->postJson('/api/mfa/verify', [
                'code' => '000000',
            ]);
            $response->assertStatus(401);
        }

        // 4th request as user1 should be rate limited
        $response = $this->actingAs($user1)->postJson('/api/mfa/verify', [
            'code' => '000000',
        ]);
        $response->assertStatus(429);

        // Request as user2 should still work (different user)
        $response = $this->actingAs($user2)->postJson('/api/mfa/verify', [
            'code' => '000000',
        ]);
        $response->assertStatus(401); // Not rate limited
    }
}
