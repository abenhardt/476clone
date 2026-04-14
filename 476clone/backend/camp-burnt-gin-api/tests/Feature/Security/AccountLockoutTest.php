<?php

namespace Tests\Feature\Security;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tests for account lockout security feature.
 *
 * Verifies that accounts are locked after failed login attempts
 * and that lockouts expire correctly.
 */
class AccountLockoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Ensure database is migrated and ready
    }

    public function test_account_locks_after_five_failed_attempts(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('correct-password'),
        ]);

        // First 4 failed attempts should not lock
        for ($i = 0; $i < 4; $i++) {
            $response = $this->postJson('/api/auth/login', [
                'email' => 'test@example.com',
                'password' => 'wrong-password',
            ]);

            $response->assertStatus(401);
            $response->assertJson([
                'success' => false,
                'message' => 'Invalid credentials.',
            ]);
        }

        // 5th failed attempt should trigger lockout
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401);
        $response->assertJson([
            'success' => false,
            'lockout' => true,
        ]);
        $this->assertStringContainsString('Account locked due to too many failed attempts', $response->json('message'));

        // Verify user is locked in database
        $user->refresh();
        $this->assertNotNull($user->lockout_until);
        $this->assertEquals(5, $user->failed_login_attempts);
    }

    public function test_locked_account_rejects_correct_password(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('correct-password'),
            'failed_login_attempts' => 5,
            'lockout_until' => now()->addMinutes(15),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'correct-password',
        ]);

        $response->assertStatus(401);
        $response->assertJson([
            'success' => false,
            'lockout' => true,
        ]);
    }

    public function test_lockout_expires_after_fifteen_minutes(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('correct-password'),
            'failed_login_attempts' => 5,
            'lockout_until' => now()->subMinute(), // Expired 1 minute ago
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'correct-password',
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
        ]);

        // Verify lockout was cleared
        $user->refresh();
        $this->assertNull($user->lockout_until);
        $this->assertEquals(0, $user->failed_login_attempts);
    }

    public function test_successful_login_resets_failed_attempts(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('correct-password'),
            'failed_login_attempts' => 3,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'correct-password',
        ]);

        $response->assertStatus(200);

        // Verify failed attempts were reset
        $user->refresh();
        $this->assertEquals(0, $user->failed_login_attempts);
        $this->assertNull($user->lockout_until);
    }

    public function test_failed_attempts_include_remaining_count(): void
    {
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('correct-password'),
        ]);

        // First failed attempt
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('attempts_remaining', 4);

        // Second failed attempt
        $response = $this->postJson('/api/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401);
        $response->assertJsonPath('attempts_remaining', 3);
    }
}
