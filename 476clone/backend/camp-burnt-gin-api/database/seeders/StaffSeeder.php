<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Models\UserEmergencyContact;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeder — all staff accounts and edge-case user states.
 *
 * Staff accounts created:
 *   Super Admin  : admin@campburntgin.org  (in DatabaseSeeder)
 *   Deputy SA    : admin2@campburntgin.org — Jordan Blake
 *   Admin        : admin@example.com       — Alex Rivera
 *   Coordinator  : admin3@campburntgin.org — Taylor Brooks
 *   Medical Dir  : medical@example.com     — Dr. Morgan Chen
 *   Nurse        : medical2@campburntgin.org — Jamie Santos RN
 *   MFA Admin    : mfa.admin@campburntgin.org — MFA-enabled, TOTP required
 *
 * Edge-case accounts (all password: "password"):
 *   Inactive     : inactive@example.com        (is_active=false — login denied)
 *   Locked       : locked.applicant@example.com (lockout_until in future)
 *
 * All accounts have email_verified_at set so they can log in immediately.
 * All staff have address/phone data to exercise profile edit views.
 */
class StaffSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::where('name', 'admin')->firstOrFail();
        $medicalRole = Role::where('name', 'medical')->firstOrFail();
        $superRole = Role::where('name', 'super_admin')->firstOrFail();
        $applicantRole = Role::where('name', 'applicant')->firstOrFail();

        // ── Deputy Super Admin ────────────────────────────────────────────────
        User::firstOrCreate(
            ['email' => 'admin2@campburntgin.org'],
            [
                'name' => 'Jordan Blake',
                'role_id' => $superRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0001',
                'address_line_1' => '445 Gervais Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'preferred_name' => 'Jordan',
            ]
        );

        // ── Primary Admin ─────────────────────────────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Alex Rivera',
                'role_id' => $adminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0002',
                'address_line_1' => '112 Blanding Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'preferred_name' => 'Alex',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // Admin emergency contact
        if (! UserEmergencyContact::where('user_id', $admin->id)->exists()) {
            UserEmergencyContact::create([
                'user_id' => $admin->id,
                'name' => 'Carmen Rivera',
                'relationship' => 'Spouse',
                'phone' => '803-555-0003',
                'email' => 'carmen.rivera@example.com',
            ]);
        }

        // ── Camp Coordinator (Admin role) ─────────────────────────────────────
        User::firstOrCreate(
            ['email' => 'admin3@campburntgin.org'],
            [
                'name' => 'Taylor Brooks',
                'role_id' => $adminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0004',
                'address_line_1' => '318 Senate Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'preferred_name' => 'Taylor',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // ── Medical Director ──────────────────────────────────────────────────
        $medical = User::firstOrCreate(
            ['email' => 'medical@example.com'],
            [
                'name' => 'Dr. Morgan Chen',
                'role_id' => $medicalRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0005',
                'address_line_1' => '1 Medical Park Drive',
                'city' => 'Orangeburg',
                'state' => 'SC',
                'postal_code' => '29115',
                'country' => 'US',
                'preferred_name' => 'Dr. Chen',
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // Medical director emergency contact
        if (! UserEmergencyContact::where('user_id', $medical->id)->exists()) {
            UserEmergencyContact::create([
                'user_id' => $medical->id,
                'name' => 'Wei Chen',
                'relationship' => 'Spouse',
                'phone' => '803-555-0006',
                'email' => 'wei.chen@example.com',
            ]);
        }

        // ── Camp Nurse ────────────────────────────────────────────────────────
        User::firstOrCreate(
            ['email' => 'medical2@campburntgin.org'],
            [
                'name' => 'Jamie Santos',
                'role_id' => $medicalRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'phone' => '803-555-0007',
                'address_line_1' => '820 Barnwell Street',
                'city' => 'Columbia',
                'state' => 'SC',
                'postal_code' => '29201',
                'country' => 'US',
                'preferred_name' => 'Jamie',
                'notification_preferences' => ['database'],
            ]
        );

        // ── MFA-enabled Admin (for MFA flow testing) ──────────────────────────
        User::firstOrCreate(
            ['email' => 'mfa.admin@campburntgin.org'],
            [
                'name' => 'Dana Forsythe',
                'role_id' => $adminRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'mfa_enabled' => true,
                // mfa_secret left null — forces user to complete MFA setup in tests
                'notification_preferences' => ['email', 'database'],
            ]
        );

        // ── EDGE CASE: Inactive applicant (is_active=false — login denied) ────
        User::firstOrCreate(
            ['email' => 'inactive@example.com'],
            [
                'name' => 'Deactivated User',
                'role_id' => $applicantRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => false,   // ← login will be denied
            ]
        );

        // ── EDGE CASE: Locked applicant (lockout_until in future) ─────────────
        User::firstOrCreate(
            ['email' => 'locked.applicant@example.com'],
            [
                'name' => 'Locked Applicant',
                'role_id' => $applicantRole->id,
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
                'is_active' => true,
                'failed_login_attempts' => 5,
                'lockout_until' => now()->addHours(2),  // ← still locked
                'last_failed_login_at' => now()->subMinutes(10),
            ]
        );

        $this->command->line('  Staff seeded: 2 super_admin, 3 admin, 2 medical, 2 edge-case accounts.');
    }
}
