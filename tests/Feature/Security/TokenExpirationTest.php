<?php

namespace Tests\Feature\Security;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Tests for Sanctum token expiration.
 *
 * Verifies that authentication tokens expire after the configured time
 * and cannot be used after expiration.
 */
class TokenExpirationTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    public function test_sanctum_token_expiration_is_configured(): void
    {
        $expiration = Config::get('sanctum.expiration');

        // Verify expiration is configured (not null/disabled)
        $this->assertNotNull($expiration);
        $this->assertGreaterThan(0, $expiration);
    }

    public function test_fresh_token_is_valid(): void
    {
        $user = $this->createParent();
        $token = $user->createToken('test-token');

        // Use the token to access a protected endpoint
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');

        $response->assertStatus(200);
    }

    public function test_expired_token_is_rejected(): void
    {
        $user = $this->createParent();
        $token = $user->createToken('test-token');

        // Manually set the token to be expired
        $accessToken = PersonalAccessToken::findToken($token->plainTextToken);
        $accessToken->expires_at = now()->subMinute();
        $accessToken->save();

        // Try to use the expired token
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');

        $response->assertStatus(401);
    }

    public function test_token_within_expiration_window_is_valid(): void
    {
        $user = $this->createParent();
        $token = $user->createToken('test-token');

        // Set token to expire in 1 minute (still valid)
        $accessToken = PersonalAccessToken::findToken($token->plainTextToken);
        $accessToken->expires_at = now()->addMinute();
        $accessToken->save();

        // Token should still work
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');

        $response->assertStatus(200);
    }

    public function test_token_at_exact_expiration_time_is_rejected(): void
    {
        $user = $this->createParent();
        $token = $user->createToken('test-token');

        // Set token to expire at this exact moment
        $accessToken = PersonalAccessToken::findToken($token->plainTextToken);
        $accessToken->expires_at = now();
        $accessToken->save();

        // Token should be expired
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');

        $response->assertStatus(401);
    }

    public function test_user_can_create_new_token_after_old_one_expires(): void
    {
        $user = $this->createParent();
        $user->update([
            'email' => 'test@example.com',
            'password' => bcrypt('password'),
        ]);

        // Create and expire a token
        $oldToken = $user->createToken('old-token');
        $accessToken = PersonalAccessToken::findToken($oldToken->plainTextToken);
        $accessToken->expires_at = now()->subMinute();
        $accessToken->save();

        // Clear any cached authentication state
        $this->app->forgetInstance('auth');

        // Login to get a new token
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'password',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['data' => ['token']]);

        $newToken = $response->json('data.token');

        // New token should work
        $response = $this->withToken($newToken)
            ->getJson('/api/campers');

        $response->assertStatus(200);

        // Clear cache again before testing old token
        $this->app->forgetInstance('auth');

        // Old token should still be rejected
        $response = $this->withToken($oldToken->plainTextToken)
            ->getJson('/api/campers');

        $response->assertStatus(401);
    }

    public function test_multiple_tokens_expire_independently(): void
    {
        $user = $this->createParent();

        // Create two tokens
        $token1 = $user->createToken('token-1');
        $token2 = $user->createToken('token-2');

        // Expire only the first token
        $accessToken1 = PersonalAccessToken::findToken($token1->plainTextToken);
        $accessToken1->expires_at = now()->subMinute();
        $accessToken1->save();

        // Token 1 should be rejected
        $response = $this->withToken($token1->plainTextToken)
            ->getJson('/api/campers');
        $response->assertStatus(401);

        // Token 2 should still work
        $response = $this->withToken($token2->plainTextToken)
            ->getJson('/api/campers');
        $response->assertStatus(200);
    }

    public function test_revoked_token_is_immediately_invalid(): void
    {
        $user = $this->createParent();
        $token = $user->createToken('test-token');

        // Token works initially
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');
        $response->assertStatus(200);

        // Revoke the token by finding and deleting it
        $accessToken = PersonalAccessToken::findToken($token->plainTextToken);
        $accessToken->delete();

        // Clear any cached authentication state
        $this->app->forgetInstance('auth');

        // Token should now be rejected
        $response = $this->withToken($token->plainTextToken)
            ->getJson('/api/campers');
        $response->assertStatus(401);
    }
}
