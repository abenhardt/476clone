<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * MinimalSeeder — clean-slate bootstrap for first-deploy and controlled testing.
 *
 * Creates exactly what is needed for the system to be operational and nothing
 * more. The database will contain only system infrastructure records and one
 * super_admin account. No families, campers, applications, medical records,
 * documents, messages, or simulation data of any kind will be present.
 *
 * The system will appear exactly as it would on day one of a fresh deployment.
 *
 * ─── WHAT IS CREATED ────────────────────────────────────────────────────────
 *
 *   RoleSeeder                → 4 RBAC roles (required for any user to exist)
 *   RequiredDocumentRuleSeeder → document rule definitions
 *   ActivityPermissionSeeder  → system activity permission defaults
 *   FormDefinitionSeeder      → Phase 14 dynamic form schema v1
 *   Super admin account       → admin@campburntgin.org
 *
 * ─── WHAT IS NOT CREATED ────────────────────────────────────────────────────
 *
 *   No staff accounts        No applicant families      No campers
 *   No applications          No medical records         No documents
 *   No messages              No notifications           No audit logs
 *   No camp sessions         No deadlines               No announcements
 *   No edge-case data        No simulation data of any kind
 *
 * ─── HOW TO USE ─────────────────────────────────────────────────────────────
 *
 *   SEED_MODE=minimal php artisan migrate:fresh --seed
 *   php artisan db:seed --class=MinimalSeeder
 *
 * ─── CREDENTIALS ─────────────────────────────────────────────────────────────
 *
 *   Email:    admin@campburntgin.org
 *   Password: set via ADMIN_BOOTSTRAP_PASSWORD env variable, or randomly
 *             generated and printed once to the console.
 *   Change this password immediately after first login.
 */
class MinimalSeeder extends Seeder
{
    public function run(): void
    {
        // Roles must be seeded first — every user record requires a valid role_id.
        $this->call(RoleSeeder::class);

        // System configuration seeders are infrastructure, not test data.
        // They are required for the application to function correctly.
        $this->call([
            RequiredDocumentRuleSeeder::class,
            ActivityPermissionSeeder::class,
            FormDefinitionSeeder::class,
        ]);

        // The one account that must exist for anyone to log in.
        // Uses firstOrCreate so this seeder is safe to run multiple times.
        $this->bootstrapSuperAdmin();

        $this->printSummary();
    }

    private function bootstrapSuperAdmin(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->firstOrFail();

        // Read password from env or generate a secure random one.
        // Never hardcode a credential in source code — it lives in git history forever.
        $password = env('ADMIN_BOOTSTRAP_PASSWORD') ?: \Illuminate\Support\Str::random(20);

        $created = User::firstOrCreate(
            ['email' => 'admin@campburntgin.org'],
            [
                'name' => 'Super Administrator',
                'role_id' => $superAdminRole->id,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );

        // Only expose the generated password when the account was just created.
        if ($created->wasRecentlyCreated && ! env('ADMIN_BOOTSTRAP_PASSWORD')) {
            $this->command->newLine();
            $this->command->warn('GENERATED PASSWORD (save this now — it will not be shown again):');
            $this->command->warn('  '.$password);
            $this->command->newLine();
        }
    }

    private function printSummary(): void
    {
        $this->command->newLine();
        $this->command->info('✓ Minimal seed complete — clean system ready.');
        $this->command->newLine();
        $this->command->warn('SECURITY: Change the super admin password immediately after first login!');
        $this->command->warn('  Email: admin@campburntgin.org');
        $this->command->newLine();
    }
}
