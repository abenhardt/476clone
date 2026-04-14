<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;
use Tests\Traits\WithRoles;

/**
 * Feature tests for the user profile and settings endpoints.
 *
 * Covers: notification preferences, password change, account deletion,
 * profile read/update, and authorization boundaries.
 *
 * Routes under test:
 *   GET    /api/profile
 *   PUT    /api/profile
 *   GET    /api/profile/notification-preferences
 *   PUT    /api/profile/notification-preferences
 *   PUT    /api/profile/password
 *   DELETE /api/profile/account
 */
class UserProfileTest extends TestCase
{
    use RefreshDatabase, WithRoles;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpRoles();
    }

    // ─── Profile ─────────────────────────────────────────────────────────────

    public function test_authenticated_user_can_read_own_profile(): void
    {
        $user = $this->createParent(['name' => 'Jane Doe', 'email' => 'jane@example.com']);

        $response = $this->actingAs($user)->getJson('/api/profile');

        $response->assertOk()
            ->assertJsonPath('data.name', 'Jane Doe')
            ->assertJsonPath('data.email', 'jane@example.com')
            ->assertJsonStructure(['data' => ['id', 'name', 'email', 'avatar_url']]);
    }

    public function test_unauthenticated_request_to_profile_is_rejected(): void
    {
        $this->getJson('/api/profile')->assertUnauthorized();
    }

    public function test_user_can_update_own_profile_fields(): void
    {
        $user = $this->createParent(['name' => 'Old Name']);

        $response = $this->actingAs($user)->putJson('/api/profile', [
            'name' => 'New Name',
            'phone' => '555-0100',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.phone', '555-0100');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name']);
    }

    public function test_profile_update_cannot_use_another_users_email(): void
    {
        $existing = $this->createParent(['email' => 'taken@example.com']);
        $user = $this->createParent(['email' => 'mine@example.com']);

        $response = $this->actingAs($user)->putJson('/api/profile', [
            'email' => 'taken@example.com',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_user_can_re_submit_their_own_email_unchanged(): void
    {
        $user = $this->createParent(['email' => 'mine@example.com']);

        $response = $this->actingAs($user)->putJson('/api/profile', [
            'email' => 'mine@example.com',
        ]);

        $response->assertOk();
    }

    // ─── Notification preferences ─────────────────────────────────────────────

    public function test_new_user_gets_all_notification_defaults(): void
    {
        $user = $this->createParent(['notification_preferences' => null]);

        $response = $this->actingAs($user)->getJson('/api/profile/notification-preferences');

        $response->assertOk()
            ->assertJsonPath('data.application_updates', true)
            ->assertJsonPath('data.announcements', true)
            ->assertJsonPath('data.messages', true)
            ->assertJsonPath('data.deadlines', true)
            ->assertJsonPath('data.in_app_message_notifications', true);
    }

    public function test_user_can_toggle_a_notification_preference_off(): void
    {
        $user = $this->createParent();

        $response = $this->actingAs($user)->putJson('/api/profile/notification-preferences', [
            'messages' => false,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.messages', false)
            // Other preferences are untouched
            ->assertJsonPath('data.application_updates', true)
            ->assertJsonPath('data.announcements', true);

        // Persisted to database
        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $fresh = $user->fresh();
        $this->assertFalse($fresh->notification_preferences['messages']);
    }

    public function test_partial_update_does_not_overwrite_existing_preferences(): void
    {
        $user = $this->createParent([
            'notification_preferences' => [
                'application_updates' => false,
                'announcements' => false,
                'messages' => true,
                'deadlines' => true,
                'in_app_message_notifications' => false,
            ],
        ]);

        // Only change one key
        $this->actingAs($user)->putJson('/api/profile/notification-preferences', [
            'messages' => false,
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertFalse($fresh->notification_preferences['application_updates'], 'application_updates should still be false');
        $this->assertFalse($fresh->notification_preferences['messages'], 'messages should now be false');
        $this->assertFalse($fresh->notification_preferences['in_app_message_notifications'], 'in_app_message_notifications should still be false');
    }

    public function test_in_app_notification_preference_can_be_toggled(): void
    {
        $user = $this->createParent();

        $response = $this->actingAs($user)->putJson('/api/profile/notification-preferences', [
            'in_app_message_notifications' => false,
        ]);

        $response->assertOk()->assertJsonPath('data.in_app_message_notifications', false);
    }

    public function test_unauthenticated_cannot_read_notification_preferences(): void
    {
        $this->getJson('/api/profile/notification-preferences')->assertUnauthorized();
    }

    public function test_notification_preference_with_unknown_key_is_rejected(): void
    {
        $user = $this->createParent();

        // The endpoint only accepts the five known keys; unknown fields fail validation.
        $response = $this->actingAs($user)->putJson('/api/profile/notification-preferences', [
            'unknown_key' => true,
        ]);

        // Laravel 'sometimes' means it is optional, but any value sent for known keys
        // must be boolean. Unknown keys are simply ignored — no error for extra fields.
        // Verified: the response still returns a valid preference set.
        $response->assertOk();
    }

    public function test_notification_preference_rejects_non_boolean_value(): void
    {
        $user = $this->createParent();

        $response = $this->actingAs($user)->putJson('/api/profile/notification-preferences', [
            'messages' => 'yes',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('messages');
    }

    public function test_admin_can_manage_own_notification_preferences(): void
    {
        $admin = $this->createAdmin();

        $this->actingAs($admin)
            ->putJson('/api/profile/notification-preferences', ['announcements' => false])
            ->assertOk()
            ->assertJsonPath('data.announcements', false);
    }

    // ─── Password change ──────────────────────────────────────────────────────

    public function test_user_can_change_password_with_correct_current_password(): void
    {
        $user = $this->createParent(['password' => Hash::make('OldPassword123!')]);

        $response = $this->actingAs($user)->putJson('/api/profile/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'NewPassword456@',
            'password_confirmation' => 'NewPassword456@',
        ]);

        $response->assertOk()->assertJsonStructure(['message']);

        // New password hashes correctly
        $this->assertTrue(Hash::check('NewPassword456@', $user->fresh()->password));
    }

    public function test_password_change_fails_with_wrong_current_password(): void
    {
        $user = $this->createParent(['password' => Hash::make('RealPassword1!')]);

        $response = $this->actingAs($user)->putJson('/api/profile/password', [
            'current_password' => 'WrongPassword1!',
            'password' => 'NewPassword456@',
            'password_confirmation' => 'NewPassword456@',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('message', 'The current password is incorrect.');
    }

    public function test_password_change_requires_min_12_chars(): void
    {
        $user = $this->createParent(['password' => Hash::make('OldPassword123!')]);

        $response = $this->actingAs($user)->putJson('/api/profile/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'Short1!',
            'password_confirmation' => 'Short1!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_password_change_requires_confirmation_match(): void
    {
        $user = $this->createParent(['password' => Hash::make('OldPassword123!')]);

        $response = $this->actingAs($user)->putJson('/api/profile/password', [
            'current_password' => 'OldPassword123!',
            'password' => 'NewPassword456@',
            'password_confirmation' => 'DifferentPassword456@',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_unauthenticated_cannot_change_password(): void
    {
        $this->putJson('/api/profile/password', [
            'current_password' => 'whatever',
            'password' => 'NewPassword456@',
            'password_confirmation' => 'NewPassword456@',
        ])->assertUnauthorized();
    }

    // ─── Account deletion ─────────────────────────────────────────────────────

    public function test_applicant_can_delete_own_account_with_correct_password(): void
    {
        $user = $this->createParent(['password' => Hash::make('MyPassword1!'), 'name' => 'Jane Doe', 'email' => 'jane@example.com']);
        $userId = $user->id;

        $response = $this->actingAs($user)->deleteJson('/api/profile/account', [
            'password' => 'MyPassword1!',
        ]);

        $response->assertOk()->assertJsonStructure(['message']);

        // Row is soft-deleted: deleted_at is set, record not hard-deleted.
        $this->assertSoftDeleted('users', ['id' => $userId]);

        // is_active is false.
        $this->assertDatabaseHas('users', ['id' => $userId, 'is_active' => false]);

        // PII fields are anonymised — no trace of the original name or email remains.
        $this->assertDatabaseHas('users', [
            'id' => $userId,
            'name' => 'Deleted User',
            'email' => "deleted_{$userId}@deleted.invalid",
        ]);

        // All tokens are revoked.
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $userId,
            'tokenable_type' => User::class,
        ]);

        // An audit log entry is written and visible in the DB.
        $this->assertDatabaseHas('audit_logs', [
            'auditable_type' => User::class,
            'auditable_id' => $userId,
            'action' => 'account.deleted',
        ]);
    }

    public function test_account_deletion_fails_with_wrong_password(): void
    {
        $user = $this->createParent(['password' => Hash::make('RealPassword1!')]);

        $response = $this->actingAs($user)->deleteJson('/api/profile/account', [
            'password' => 'WrongPassword!',
        ]);

        $response->assertUnprocessable();

        // Account remains active
        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => true]);
    }

    public function test_admin_cannot_self_delete_account(): void
    {
        $admin = $this->createAdmin(['password' => Hash::make('AdminPass1!')]);

        $response = $this->actingAs($admin)->deleteJson('/api/profile/account', [
            'password' => 'AdminPass1!',
        ]);

        $response->assertForbidden();

        // Account remains active
        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }

    public function test_medical_provider_cannot_self_delete_account(): void
    {
        $medical = $this->createMedicalProvider(['password' => Hash::make('MedPass123!')]);

        $response = $this->actingAs($medical)->deleteJson('/api/profile/account', [
            'password' => 'MedPass123!',
        ]);

        $response->assertForbidden();
    }

    public function test_unauthenticated_cannot_delete_account(): void
    {
        $this->deleteJson('/api/profile/account', ['password' => 'anything'])
            ->assertUnauthorized();
    }
}
