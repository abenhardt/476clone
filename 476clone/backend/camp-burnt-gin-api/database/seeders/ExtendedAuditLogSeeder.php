<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — comprehensive audit log entries for audit log viewer testing.
 *
 * The base AnnouncementSeeder inserts only 6 audit log entries — far too few
 * for meaningful audit log page testing (filters, pagination, category badges,
 * before/after diffs, timeline layout).
 *
 * This seeder adds ~35 entries across all categories and event types so the
 * audit log viewer can be exercised with realistic volume and variety.
 *
 * Categories covered:
 *   auth            — logins, logouts, MFA, failed attempts, lockouts
 *   admin_action    — application decisions, user management, announcements
 *   phi_access      — medical record views, PHI exports
 *   document        — uploads, verifications, rejections
 *   provider_link   — link creation, revocation, access, submission
 *   medical         — treatment logs, incidents, follow-ups
 *   system          — role changes, session config
 *
 * Safe to re-run — no duplicate detection (each call inserts a new row).
 * Run once after initial seed or use ENABLE_AUDIT_SEED=false to skip.
 */
class ExtendedAuditLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();
        $super = User::where('email', 'admin@campburntgin.org')->firstOrFail();
        $sarah = User::where('email', 'sarah.johnson@example.com')->first();
        $david = User::where('email', 'david.martinez@example.com')->first();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->first();
        $michael = User::where('email', 'michael.williams@example.com')->first();
        $patricia = User::where('email', 'patricia.davis@example.com')->first();
        $grace = User::where('email', 'grace.wilson@example.com')->first();

        $entries = [

            // ── Auth events ────────────────────────────────────────────────────
            [
                'user_id' => $admin->id,
                'event_type' => 'auth',
                'action' => 'login',
                'description' => 'Admin logged in successfully',
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120',
                'created_at' => now()->subDays(1)->subHours(2),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'auth',
                'action' => 'logout',
                'description' => 'Admin logged out',
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120',
                'created_at' => now()->subDays(1)->subHours(1),
            ],
            [
                'user_id' => $sarah?->id ?? $admin->id,
                'event_type' => 'auth',
                'action' => 'login',
                'description' => 'Applicant logged in (mobile)',
                'ip_address' => '192.168.1.100',
                'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
                'created_at' => now()->subHours(18),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'auth',
                'action' => 'login',
                'description' => 'Medical staff logged in',
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119',
                'created_at' => now()->subHours(8),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'auth',
                'action' => 'login.failed',
                'description' => 'Failed login attempt for admin@example.com — incorrect password',
                'ip_address' => '10.0.99.5',
                'user_agent' => 'Mozilla/5.0 (Linux; Android 11) Chrome/118',
                'created_at' => now()->subDays(3),
            ],
            [
                'user_id' => $super->id,
                'event_type' => 'auth',
                'action' => 'password.changed',
                'description' => 'Super admin changed account password',
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
                'created_at' => now()->subDays(7),
            ],

            // ── Application decisions ──────────────────────────────────────────
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.approved',
                'description' => 'Approved application for Ethan Johnson (Session 1 — Summer 2026)',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['status' => 'approved'],
                'old_values' => ['status' => 'pending'],
                'created_at' => now()->subDays(10),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.rejected',
                'description' => 'Rejected application for Noah Thompson (Session 1 — Summer 2026): session at capacity',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 4,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['status' => 'rejected', 'notes' => 'Session 1 is at capacity'],
                'old_values' => ['status' => 'under_review'],
                'created_at' => now()->subDays(22),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.waitlisted',
                'description' => 'Waitlisted application for Tyler Wilson (Session 1 — Summer 2026)',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 11,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['status' => 'waitlisted'],
                'old_values' => ['status' => 'pending'],
                'created_at' => now()->subDays(15),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.status_changed',
                'description' => 'Changed application status to Under Review for Sofia Martinez',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 3,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['status' => 'under_review'],
                'old_values' => ['status' => 'pending'],
                'created_at' => now()->subDays(18),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.approved',
                'description' => 'Approved paper application for Henry Carter (Session 1 — Summer 2026)',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 12,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['status' => 'approved', 'paper_entry' => true],
                'old_values' => ['status' => 'pending'],
                'created_at' => now()->subDays(7),
            ],

            // ── User management ───────────────────────────────────────────────
            [
                'user_id' => $super->id,
                'event_type' => 'admin_action',
                'action' => 'user.role.updated',
                'description' => 'Super admin updated role for user admin@example.com to admin',
                'auditable_type' => 'App\\Models\\User',
                'auditable_id' => 2,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['role' => 'admin'],
                'old_values' => ['role' => 'super_admin'],
                'created_at' => now()->subDays(30),
            ],
            [
                'user_id' => $super->id,
                'event_type' => 'admin_action',
                'action' => 'user.deactivated',
                'description' => 'Super admin deactivated user account: inactive@example.com',
                'auditable_type' => 'App\\Models\\User',
                'auditable_id' => 99,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['is_active' => false],
                'old_values' => ['is_active' => true],
                'created_at' => now()->subDays(14),
            ],
            [
                'user_id' => $super->id,
                'event_type' => 'admin_action',
                'action' => 'user.created',
                'description' => 'New medical staff account created: medical2@campburntgin.org (Nurse Jamie Santos)',
                'auditable_type' => 'App\\Models\\User',
                'auditable_id' => 7,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(5),
            ],

            // ── PHI access ────────────────────────────────────────────────────
            [
                'user_id' => $medical->id,
                'event_type' => 'phi_access',
                'action' => 'camper.medical_record.viewed',
                'description' => 'Medical staff viewed medical record for Ava Williams',
                'auditable_type' => 'App\\Models\\MedicalRecord',
                'auditable_id' => 5,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subHours(6),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'phi_access',
                'action' => 'camper.medical_record.viewed',
                'description' => 'Medical staff viewed medical record for Lucas Williams',
                'auditable_type' => 'App\\Models\\MedicalRecord',
                'auditable_id' => 6,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subHours(7),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'phi_access',
                'action' => 'application.reviewed',
                'description' => 'Admin reviewed application and medical section for Sofia Martinez',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 3,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(14),
            ],
            [
                'user_id' => $david?->id ?? $admin->id,
                'event_type' => 'phi_access',
                'action' => 'camper.medical_record.viewed',
                'description' => 'Applicant viewed medical record for Sofia Martinez',
                'auditable_type' => 'App\\Models\\MedicalRecord',
                'auditable_id' => 3,
                'ip_address' => '10.0.0.45',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subDays(13),
            ],

            // ── Document events ───────────────────────────────────────────────
            [
                'user_id' => $admin->id,
                'event_type' => 'document',
                'action' => 'document.uploaded',
                'description' => 'Admin uploaded physician clearance for Ethan Johnson',
                'auditable_type' => 'App\\Models\\Document',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(12),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'document',
                'action' => 'document.verified',
                'description' => 'Admin verified and approved physician clearance for Ethan Johnson',
                'auditable_type' => 'App\\Models\\Document',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['verification_status' => 'approved'],
                'old_values' => ['verification_status' => 'pending'],
                'created_at' => now()->subDays(12),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'document',
                'action' => 'document.uploaded',
                'description' => 'Admin uploaded OmniPod insulin protocol for Ava Williams',
                'auditable_type' => 'App\\Models\\Document',
                'auditable_id' => 4,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(8),
            ],

            // ── Medical events ────────────────────────────────────────────────
            [
                'user_id' => $medical->id,
                'event_type' => 'medical',
                'action' => 'treatment_log.created',
                'description' => 'Medical staff created treatment log: Hypoglycemia episode — Ava Williams',
                'auditable_type' => 'App\\Models\\TreatmentLog',
                'auditable_id' => 4,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subDays(1),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'medical',
                'action' => 'incident.created',
                'description' => 'Incident report created: Hypoglycemia episode — Ava Williams (moderate, archery range)',
                'auditable_type' => 'App\\Models\\MedicalIncident',
                'auditable_id' => 1,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subDays(3),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'medical',
                'action' => 'incident.created',
                'description' => 'Incident report created: Increased respiratory effort — Lucas Williams (moderate, escalation required)',
                'auditable_type' => 'App\\Models\\MedicalIncident',
                'auditable_id' => 5,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subDays(1),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'medical',
                'action' => 'visit.created',
                'description' => 'Health office visit created for Ava Williams — post-hypoglycemia monitoring',
                'auditable_type' => 'App\\Models\\MedicalVisit',
                'auditable_id' => 1,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'created_at' => now()->subDays(3),
            ],
            [
                'user_id' => $medical->id,
                'event_type' => 'medical',
                'action' => 'follow_up.completed',
                'description' => 'Follow-up completed: Lily\'s parent notification of 03/01 albuterol use',
                'auditable_type' => 'App\\Models\\MedicalFollowUp',
                'auditable_id' => 7,
                'ip_address' => '10.0.0.5',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/119',
                'new_values' => ['status' => 'completed', 'completed_at' => now()->subDays(6)->toIso8601String()],
                'old_values' => ['status' => 'pending'],
                'created_at' => now()->subDays(6),
            ],

            // ── Announcement events ───────────────────────────────────────────
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'announcement.created',
                'description' => 'Published announcement: Registration Now Open — Session 1 & Session 2, Summer 2026',
                'auditable_type' => 'App\\Models\\Announcement',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(45),
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'announcement.created',
                'description' => 'Published urgent announcement: Medication Form Update Required Before April 1',
                'auditable_type' => 'App\\Models\\Announcement',
                'auditable_id' => 2,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'created_at' => now()->subDays(10),
            ],

            // ── System events ─────────────────────────────────────────────────
            [
                'user_id' => $super->id,
                'event_type' => 'system',
                'action' => 'session.config.updated',
                'description' => 'Super admin updated Session 1 2026 capacity from 50 to 60',
                'auditable_type' => 'App\\Models\\CampSession',
                'auditable_id' => 2,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh) Chrome/120',
                'new_values' => ['capacity' => 60],
                'old_values' => ['capacity' => 50],
                'created_at' => now()->subDays(20),
            ],
        ];

        foreach ($entries as $entry) {
            AuditLog::create([
                'user_id' => $entry['user_id'],
                'event_type' => $entry['event_type'],
                'action' => $entry['action'],
                'description' => $entry['description'],
                'auditable_type' => $entry['auditable_type'] ?? null,
                'auditable_id' => $entry['auditable_id'] ?? null,
                'ip_address' => $entry['ip_address'],
                'user_agent' => $entry['user_agent'],
                'request_id' => Str::uuid()->toString(),
                'old_values' => isset($entry['old_values']) ? $entry['old_values'] : null,
                'new_values' => isset($entry['new_values']) ? $entry['new_values'] : null,
                'metadata' => null,
                'created_at' => $entry['created_at'] ?? now(),
            ]);
        }

        $this->command->line('  Extended audit log seeded ('.count($entries).' entries across all categories).');
    }
}
