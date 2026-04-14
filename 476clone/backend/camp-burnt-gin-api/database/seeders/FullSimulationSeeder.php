<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * FullSimulationSeeder — complete scenario simulation for Camp Burnt Gin.
 *
 * This seeder populates the database with a full, realistic simulation of
 * the live system. Every record exists for a reason. Every scenario is
 * documented. Nothing is placeholder or incomplete.
 *
 * ─── EXECUTION TIERS ────────────────────────────────────────────────────────
 *
 *   Tier 1 — System bootstrap (production-safe, always runs)
 *     RoleSeeder              → 4 roles (super_admin, admin, applicant, medical)
 *     System configuration    → document rules, activity permissions, form definitions
 *     Super admin account     → admin@campburntgin.org (inline, production bootstrap)
 *
 *   Tier 2 — People and structure (dev/staging only)
 *     StaffSeeder             → 7 staff accounts + 2 edge-case accounts (inactive, locked)
 *     CampSeeder              → Camp Burnt Gin + 3 sessions (1 past, 2 upcoming)
 *     FamilySeeder            → 8 applicant families with campers and emergency contacts
 *     ExtendedEmergencyContactSeeder → secondary/edge-case emergency contacts
 *     ScaleSeeder             → 32 additional families (~42 campers) for volume/scenario coverage
 *
 *   Tier 3 — Application workflow scenarios (all 6 statuses + draft + paper)
 *     ApplicationSeeder       → 14 applications covering every status and edge case
 *
 *   Tier 4 — Medical data scenarios (5 complexity tiers + all medical states)
 *     MedicalSeeder           → Records, diagnoses, allergies, medications, treatment logs
 *     MedicalPhase11Seeder    → Incidents, visits, follow-ups, restrictions (Phase 11)
 *     TreatmentLogSeeder      → Visit-linked treatment log entries
 *     CamperProfileSeeder     → Behavioral profiles, assistive devices, feeding plans
 *     PersonalCarePlanSeeder  → ADL care plans for 8 core + 8 supporting campers
 *     ExtendedMedicalRecordSeeder → Seizure data, activity permission overrides
 *     FormParitySeeder        → Backfills all form-parity fields (migrations 000001–000005)
 *     MedicalCrossLinkSeeder  → Incident/follow-up cross-links; restrictions for Ava+Mia
 *
 *   Tier 5 — Communication and operations
 *     DocumentSeeder          → Document metadata records (no actual files)
 *     ApplicantDocumentSeeder → Admin-to-applicant documents (3 states)
 *     DocumentRequestSeeder   → Full document request lifecycle (7 states)
 *     MessagingSeeder         → Conversations, messages, read receipts
 *     AnnouncementSeeder      → Announcements + calendar events
 *     AuditLogSeeder          → Audit trail entries (55+ entries, all categories)
 *     NotificationSeeder      → Database notifications
 *     DeadlineSeeder          → 15 deadlines + auto-synced calendar events (all urgency levels)
 *     EdgeCaseSeeder          → 14 intentional boundary/failure scenarios for QA
 *
 * ─── SCENARIO COVERAGE ──────────────────────────────────────────────────────
 *
 *   Application statuses   : pending, under_review, approved, rejected, cancelled, waitlisted, withdrawn
 *   Draft applications     : 2 (Mia returning draft, Olivia new family draft)
 *   Paper application      : 1 (Henry Carter — admin-entered from physical form)
 *   Medical complexity     : no record, partial, complete (mild/moderate/severe)
 *   Family structures      : single child, multi-child, returning, new, mixed outcomes
 *   Session distribution   : past, upcoming × 2, capacity variation
 *   Admin interactions     : reviewed, pending, rejected, waitlisted with notes
 *   Edge-case accounts     : inactive user, locked-out user, MFA-enabled admin
 *   Scale                  : ~76 total campers across ~62 families (8 core + 32 scale + 14 edge)
 *   Edge cases (EC-001–014): no EC, all flags true, all devices, seizure/no plan, inactive parent,
 *                            max-length strings, empty medical, polypharmacy, duplicate sessions,
 *                            all-Spanish family, all health flags, same session both choices
 *
 * ─── HOW TO USE ─────────────────────────────────────────────────────────────
 *
 *   SEED_MODE=full php artisan migrate:fresh --seed
 *   php artisan db:seed --class=FullSimulationSeeder
 *
 *   Not for use in production. All data is simulated for testing and demonstration.
 */
class FullSimulationSeeder extends Seeder
{
    public function run(): void
    {
        // ── Tier 1: System bootstrap ──────────────────────────────────────────
        // Roles must be seeded first — every user record requires a role_id.
        $this->call(RoleSeeder::class);

        // System configuration — safe to run in all environments.
        $this->call([
            RequiredDocumentRuleSeeder::class,
            ActivityPermissionSeeder::class,
            FormDefinitionSeeder::class,
        ]);

        // Super admin — the only account that must exist before any staff can log in.
        // This runs in production too. Change the password immediately after deploy.
        $this->bootstrapSuperAdmin();

        // ── Production gate ───────────────────────────────────────────────────
        if (app()->environment('production')) {
            $this->command->info('Production environment — simulation data skipped.');
            $this->printProductionSummary();

            return;
        }

        // ── Tier 2: People and structure ──────────────────────────────────────
        $this->command->info('Seeding people and structure...');
        $this->call([
            StaffSeeder::class,                    // 7 staff + 2 edge-case accounts (inactive, locked)
            CampSeeder::class,                     // Camp Burnt Gin + 3 sessions (1 past, 2 upcoming)
            FamilySeeder::class,                   // 8 core applicant families with campers
            ExtendedEmergencyContactSeeder::class, // secondary/edge-case emergency contacts
            ScaleSeeder::class,                    // 32 additional families (~42 campers) — volume coverage
        ]);

        // ── Tier 3: Application workflow scenarios ────────────────────────────
        $this->command->info('Seeding application scenarios...');
        $this->call(ApplicationSeeder::class);

        // ── Tier 4: Medical data scenarios ────────────────────────────────────
        $this->command->info('Seeding medical data scenarios...');
        $this->call([
            MedicalSeeder::class,               // core records, diagnoses, medications, treatment logs
            MedicalPhase11Seeder::class,        // incidents, visits, follow-ups, restrictions
            TreatmentLogSeeder::class,          // visit-linked treatment logs (all 5 types)
            CamperProfileSeeder::class,         // behavioral profiles, assistive devices, feeding plans
            PersonalCarePlanSeeder::class,      // ADL care plans for 8 core + 8 supporting campers
            ExtendedMedicalRecordSeeder::class, // seizure data, activity permission overrides
            FormParitySeeder::class,            // backfills form-parity fields (migrations 000001–000005)
            MedicalCrossLinkSeeder::class,      // incident/follow-up cross-links
        ]);

        // Backfill medical_records.is_active after all medical seeders have run.
        // ApplicationSeeder activates campers on approval; now that MedicalSeeder
        // has created the records, we sync the flag so medical staff can see
        // active campers correctly.
        \App\Models\MedicalRecord::whereIn(
            'camper_id',
            \App\Models\Camper::where('is_active', true)->pluck('id')
        )->update(['is_active' => true]);

        // ── Tier 5: Communication and operations ──────────────────────────────
        $this->command->info('Seeding communication and documents...');
        $this->call([
            // Documents
            DocumentSeeder::class,              // uploaded document metadata (no real files)
            ApplicantDocumentSeeder::class,     // admin-to-applicant docs (pending/submitted/reviewed)
            DocumentRequestSeeder::class,       // full document request lifecycle (7 states)

            // Messaging — MessagingSeeder is the comprehensive replacement for
            // MessageSeeder + ExtendedMessageSeeder + MessageReadSeeder.
            // It covers 10 human threads + 4 system threads with read receipts.
            MessagingSeeder::class,

            // Admin content
            AnnouncementSeeder::class,          // announcements + calendar events
            AuditLogSeeder::class,              // 55+ audit entries across all 6 categories
            NotificationSeeder::class,          // database notifications

            // Deadlines — after doc requests so entity IDs can be resolved;
            // observer auto-syncs calendar events on Deadline creation
            DeadlineSeeder::class,              // 15 deadlines (all urgency levels)

            // Edge cases — must run last (depends on sessions, roles, all prior data)
            EdgeCaseSeeder::class,              // 14 boundary/failure scenarios (EC-001–EC-014)
        ]);

        $this->printDemoSummary();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function bootstrapSuperAdmin(): void
    {
        $superAdminRole = Role::where('name', 'super_admin')->firstOrFail();

        User::firstOrCreate(
            ['email' => 'admin@campburntgin.org'],
            [
                'name' => 'Super Administrator',
                'role_id' => $superAdminRole->id,
                'password' => Hash::make('ChangeThisPassword123!'),
                'email_verified_at' => now(),
                'is_active' => true,
            ]
        );
    }

    private function printProductionSummary(): void
    {
        $this->command->newLine();
        $this->command->warn('SECURITY: Change the super admin password immediately!');
        $this->command->warn('  Email:    admin@campburntgin.org');
        $this->command->warn('  Password: ChangeThisPassword123!');
        $this->command->newLine();
    }

    private function printDemoSummary(): void
    {
        $this->command->newLine();
        $this->command->info('✓ Database seeded — full scenario simulation ready.');
        $this->command->newLine();

        $this->command->warn('SECURITY: Change the super admin password immediately!');
        $this->command->warn('  admin@campburntgin.org / ChangeThisPassword123!');
        $this->command->newLine();

        $this->command->line('<comment>Staff accounts</comment> (password: password):');
        $this->command->line('  Super Admin : admin@campburntgin.org         Jordan Blake (deputy)');
        $this->command->line('  Admin       : admin@example.com              Alex Rivera');
        $this->command->line('  Coordinator : admin3@campburntgin.org        Taylor Brooks');
        $this->command->line('  Medical Dir : medical@example.com            Dr. Morgan Chen');
        $this->command->line('  Nurse       : medical2@campburntgin.org      Jamie Santos RN');
        $this->command->line('  MFA Admin   : mfa.admin@campburntgin.org     Dana Forsythe (TOTP required)');
        $this->command->newLine();

        $this->command->line('<comment>Applicant accounts</comment> (password: password):');
        $this->command->line('  sarah.johnson@example.com        Ethan (approved S1) + Lily (pending S2)');
        $this->command->line('  david.martinez@example.com       Sofia (under review S1)');
        $this->command->line('  jennifer.thompson@example.com    Noah (rejected S1, pending S2)');
        $this->command->line('  michael.williams@example.com     Ava (approved S2) + Lucas (pending S1)');
        $this->command->line('  patricia.davis@example.com       Mia (past approved + 2026 draft)');
        $this->command->line('  grace.wilson@example.com         Tyler (waitlisted S1)');
        $this->command->line('  james.carter@example.com         Henry (paper app approved S1 + pending S2)');
        $this->command->line('  michelle.robinson@example.com    Olivia (draft S2 — no medical data)');
        $this->command->newLine();

        $this->command->line('<comment>Edge-case accounts</comment>:');
        $this->command->line('  inactive@example.com             Login denied (is_active=false)');
        $this->command->line('  locked.applicant@example.com     Login denied (lockout active)');
        $this->command->newLine();

        $this->command->line('<comment>Application status coverage</comment>:');
        $this->command->line('  pending      : Lily (S2), Lucas (S1), Noah (S2), Henry (S2) + scale families');
        $this->command->line('  under_review : Sofia (S1) + scale families');
        $this->command->line('  approved     : Ethan (S1), Ava (S2), Mia (2025), Henry (S1) + scale families');
        $this->command->line('  rejected     : Noah (S1 — capacity) + scale families');
        $this->command->line('  cancelled    : Lucas (S2 — draft abandoned) + EC-003, EC-011, EC-014');
        $this->command->line('  waitlisted   : Tyler (S1 — promotable) + scale families');
        $this->command->line('  withdrawn    : EC-004 (parent-initiated)');
        $this->command->line('  draft        : Mia (S1 2026 in-progress), Olivia (S2 brand new) + scale families');
        $this->command->newLine();

        $this->command->line('<comment>Edge cases (EdgeCaseSeeder)</comment>:');
        $this->command->line('  EC-001 ec001.no.contact@edgecase.test        No emergency contact');
        $this->command->line('  EC-002 ec002.all.flags@edgecase.test         All behavioral flags true');
        $this->command->line('  EC-003 ec003.cancelled@edgecase.test         Admin-cancelled (terminal)');
        $this->command->line('  EC-004 ec004.withdrawn@edgecase.test         Parent-withdrawn (terminal)');
        $this->command->line('  EC-005 ec005.all.devices@edgecase.test       All assistive devices + G-tube');
        $this->command->line('  EC-006 ec006.seizure.noplan@edgecase.test    Seizure disorder — no plan');
        $this->command->line('  EC-007 ec007.inactive.parent@edgecase.test   Inactive parent (login denied)');
        $this->command->line('  EC-008 ec008.maxlength@edgecase.test         Max-length strings in all fields');
        $this->command->line('  EC-009 ec009.empty.medical@edgecase.test     Empty medical profile');
        $this->command->line('  EC-010 ec010.max.meds@edgecase.test          5 medications + conflicting diet');
        $this->command->line('  EC-011 ec011.duplicate.session@edgecase.test Duplicate session (cancelled)');
        $this->command->line('  EC-012 ec012.espanol.only@edgecase.test      All-Spanish, all interpreters');
        $this->command->line('  EC-013 ec013.all.health.flags@edgecase.test  All health parity flags true');
        $this->command->line('  EC-014 ec014.same.session@edgecase.test      Second session = first session');
        $this->command->line('  All edge-case passwords: password');
        $this->command->newLine();
    }
}
