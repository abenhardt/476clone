<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\AuditLog;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\MedicalRecord;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — audit log entries across all 6 event categories.
 *
 * Provides 55+ realistic entries for testing the AuditLogPage timeline,
 * category filters, entity label display, before/after diffs, and CSV export.
 *
 * Event type distribution:
 *   authentication  — 12 entries (logins, logouts, failures, MFA events, lockout)
 *   phi_access      — 16 entries (camper records read, allergies, medications, PHI exports)
 *   admin_action    — 12 entries (status changes, role changes, session ops, provider links)
 *   security        — 6  entries (rate limiting, suspicious activity, permission denials)
 *   data_change     — 6  entries (application created/updated, camper updated, medical record changed)
 *   file_access     — 6  entries (uploads, downloads, scan results, verifications)
 *
 * IP addresses use realistic RFC 5737 documentation ranges (192.0.2.x, 198.51.100.x)
 * plus typical home/mobile ISP ranges.
 *
 * Safe to re-run — each entry has a unique request_id (UUID), so there are no
 * duplicates from re-seeding. Running this seeder multiple times will insert
 * duplicate entries, which is acceptable for dev data but not for production.
 * The DatabaseSeeder wraps this in a config gate (enable_demo_data).
 */
class AuditLogSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $admin2 = User::where('email', 'admin2@campburntgin.org')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();
        $medical2 = User::where('email', 'medical2@campburntgin.org')->firstOrFail();
        $superA = User::where('email', 'admin@campburntgin.org')->firstOrFail();

        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $patricia = User::where('email', 'patricia.davis@example.com')->firstOrFail();

        $session1 = CampSession::where('name', 'Session 1 — Summer 2026')->firstOrFail();
        $session2 = CampSession::where('name', 'Session 2 — Summer 2026')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();
        $emma = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        $chloe = Camper::where('first_name', 'Chloe')->where('last_name', 'Rodriguez')->firstOrFail();
        $liam = Camper::where('first_name', 'Liam')->where('last_name', 'Young')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)->where('camp_session_id', $session1->id)->first();
        $appSofia = Application::where('camper_id', $sofia->id)->where('camp_session_id', $session1->id)->first();
        $appNoah = Application::where('camper_id', $noah->id)->where('camp_session_id', $session1->id)->first();
        $appAva = Application::where('camper_id', $ava->id)->where('camp_session_id', $session2->id)->first();

        $medEthan = MedicalRecord::where('camper_id', $ethan->id)->first();
        $medSofia = MedicalRecord::where('camper_id', $sofia->id)->first();
        $medAva = MedicalRecord::where('camper_id', $ava->id)->first();
        $medLucas = MedicalRecord::where('camper_id', $lucas->id)->first();

        // ── AUTHENTICATION ────────────────────────────────────────────────────

        // Successful logins
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.success',
            'desc' => 'Admin login from Columbia, SC (BCBS headquarters IP range)',
            'auditable' => null,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'meta' => ['role' => 'admin', 'remember_me' => false],
            'at' => now()->subDays(1)->setTime(8, 14, 22),
        ]);

        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.success',
            'desc' => 'Medical Director login — start of shift',
            'auditable' => null,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'meta' => ['role' => 'medical'],
            'at' => now()->subDays(1)->setTime(7, 58, 05),
        ]);

        $this->log([
            'user' => $sarah,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.success',
            'desc' => 'Applicant login from mobile — applicant checking application status',
            'auditable' => null,
            'ip' => '73.158.204.97',
            'ua' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
            'meta' => ['role' => 'applicant'],
            'at' => now()->subDays(1)->setTime(19, 43, 11),
        ]);

        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.success',
            'desc' => 'Super admin login — system configuration session',
            'auditable' => null,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['role' => 'super_admin', 'mfa_completed' => true],
            'at' => now()->subDays(2)->setTime(9, 00, 00),
        ]);

        // MFA events
        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'mfa.challenge_issued',
            'desc' => 'MFA TOTP challenge issued for super_admin login',
            'auditable' => null,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['method' => 'totp'],
            'at' => now()->subDays(2)->setTime(8, 59, 55),
        ]);

        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'mfa.success',
            'desc' => 'MFA verification successful — access granted',
            'auditable' => null,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['method' => 'totp'],
            'at' => now()->subDays(2)->setTime(9, 00, 00),
        ]);

        // Failed login — wrong password
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.failed',
            'desc' => 'Failed login attempt — email exists, wrong password',
            'auditable' => null,
            'ip' => '203.0.113.88',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['email' => 'admin@example.com', 'reason' => 'invalid_credentials', 'attempt' => 1],
            'at' => now()->subDays(3)->setTime(2, 17, 44),
        ]);

        // Failed login — unknown email
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'login.failed',
            'desc' => 'Failed login attempt — email not found in system',
            'auditable' => null,
            'ip' => '203.0.113.88',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['email' => 'hacker@external.example.com', 'reason' => 'user_not_found'],
            'at' => now()->subDays(3)->setTime(2, 18, 01),
        ]);

        // MFA failed
        $this->log([
            'user' => $admin2,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'mfa.failed',
            'desc' => 'MFA code incorrect — code expired (30s window)',
            'auditable' => null,
            'ip' => '192.0.2.77',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'meta' => ['method' => 'totp', 'attempt' => 1],
            'at' => now()->subDays(4)->setTime(14, 22, 33),
        ]);

        // Logouts
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'logout',
            'desc' => 'Admin logged out — end of session',
            'auditable' => null,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['session_duration_minutes' => 127],
            'at' => now()->subDays(1)->setTime(10, 21, 18),
        ]);

        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'logout',
            'desc' => 'Medical staff logout — end of clinical shift',
            'auditable' => null,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['session_duration_minutes' => 254],
            'at' => now()->subDays(1)->setTime(12, 12, 42),
        ]);

        // Password reset
        $this->log([
            'user' => $jennifer,
            'event_type' => AuditLog::EVENT_TYPE_AUTH,
            'action' => 'password.reset',
            'desc' => 'Applicant completed password reset via email link',
            'auditable' => null,
            'ip' => '66.249.93.200',
            'ua' => 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0',
            'meta' => ['method' => 'email_link'],
            'at' => now()->subDays(6)->setTime(11, 05, 19),
        ]);

        // ── PHI ACCESS ────────────────────────────────────────────────────────

        // Admin viewing Ethan's full medical record
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Admin viewed full medical record for Ethan Johnson',
            'auditable' => $medEthan,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_id' => $ethan->id, 'camper_name' => 'Ethan Johnson', 'context' => 'application_review'],
            'at' => now()->subDays(8)->setTime(9, 31, 22),
        ]);

        // Medical Director viewing Sofia's medical record
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Medical Director viewed medical record for Sofia Martinez — CIC protocol review',
            'auditable' => $medSofia,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $sofia->id, 'camper_name' => 'Sofia Martinez', 'context' => 'medical_review'],
            'at' => now()->subDays(7)->setTime(10, 45, 00),
        ]);

        // Medical viewing Ava's medical record
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Medical staff viewed Ava Williams medical record — T1D / insulin pump review',
            'auditable' => $medAva,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $ava->id, 'camper_name' => 'Ava Williams', 'context' => 'pre_camp_prep'],
            'at' => now()->subDays(5)->setTime(14, 20, 55),
        ]);

        // Medical viewing Lucas's medical record (DMD severity)
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Medical Director viewed medical record for Lucas Williams — DMD BiPAP review',
            'auditable' => $medLucas,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $lucas->id, 'camper_name' => 'Lucas Williams', 'context' => 'medical_review'],
            'at' => now()->subDays(6)->setTime(11, 30, 00),
        ]);

        // Nurse viewing Ethan's allergies
        $this->log([
            'user' => $medical2,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'allergy.viewed',
            'desc' => 'Nursing staff viewed allergy list for Ethan Johnson (Penicillin — life threatening)',
            'auditable' => $ethan,
            'ip' => '192.0.2.31',
            'ua' => 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'meta' => ['camper_id' => $ethan->id, 'allergy_count' => 1, 'context' => 'medication_admin'],
            'at' => now()->subDays(2)->setTime(8, 05, 12),
        ]);

        // Admin viewing Sofia's allergy list (latex — life threatening)
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'allergy.viewed',
            'desc' => 'Admin reviewed Sofia Martinez allergy list during equipment safety audit (latex)',
            'auditable' => $sofia,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_id' => $sofia->id, 'allergy_count' => 2, 'context' => 'safety_audit'],
            'at' => now()->subDays(4)->setTime(15, 10, 33),
        ]);

        // Medical viewing Ava's medications (insulin)
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medication.viewed',
            'desc' => 'Medical Director reviewed Ava Williams medication list — insulin types and dosing',
            'auditable' => $ava,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $ava->id, 'medication_count' => 4, 'context' => 'pump_protocol_review'],
            'at' => now()->subDays(5)->setTime(14, 21, 10),
        ]);

        // Admin viewing Ethan's behavioral profile
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'behavioral_profile.viewed',
            'desc' => 'Admin reviewed behavioral profile for Ethan Johnson (ASD) during staffing assignment',
            'auditable' => $ethan,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_id' => $ethan->id, 'context' => 'staffing_assignment'],
            'at' => now()->subDays(3)->setTime(16, 45, 22),
        ]);

        // PHI bulk export — admin export for compliance report
        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'phi.bulk_export',
            'desc' => 'Super admin exported medical summary report for Session 1 — Summer 2026 (30 campers)',
            'auditable' => null,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['session_id' => $session1->id, 'record_count' => 30, 'export_format' => 'pdf', 'purpose' => 'compliance_audit'],
            'at' => now()->subDays(2)->setTime(10, 00, 00),
        ]);

        // Medical viewing Emma's feeding plan (g-tube)
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'feeding_plan.viewed',
            'desc' => 'Medical staff viewed g-tube feeding plan for Emma Anderson (Jevity 1.5 Cal, 5×/day)',
            'auditable' => $emma,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $emma->id, 'context' => 'pre_camp_prep'],
            'at' => now()->subDays(3)->setTime(9, 15, 00),
        ]);

        // Nurse viewing Mia's medical record
        $this->log([
            'user' => $medical2,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Nursing staff viewed medical record for Mia Davis — SCD hydroxyurea MAR review',
            'auditable' => $mia,
            'ip' => '192.0.2.31',
            'ua' => 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'meta' => ['camper_id' => $mia->id, 'context' => 'medication_admin'],
            'at' => now()->subDays(1)->setTime(8, 10, 00),
        ]);

        // Admin viewing Chloe's restrictions
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_restriction.viewed',
            'desc' => 'Admin reviewed medical restrictions for Chloe Rodriguez — heat/environment restrictions',
            'auditable' => $chloe,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_id' => $chloe->id, 'restriction_count' => 2, 'context' => 'activity_planning'],
            'at' => now()->subDays(2)->setTime(14, 00, 00),
        ]);

        // Medical accessing treatment log (Ava hyperglycemia incident)
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'treatment_log.viewed',
            'desc' => 'Medical Director reviewed Ava Williams treatment log — hyperglycemia emergency entry',
            'auditable' => $ava,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $ava->id, 'log_type' => 'emergency', 'context' => 'incident_review'],
            'at' => now()->subDays(1)->setTime(16, 30, 00),
        ]);

        // Medical accessing Liam's medical record
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'medical_record.viewed',
            'desc' => 'Medical Director reviewed Liam Young medical record (Dravet syndrome, seizure risk)',
            'auditable' => $liam,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => $liam->id, 'context' => 'seizure_protocol_review'],
            'at' => now()->subDays(1)->setTime(11, 20, 00),
        ]);

        // Provider link access — external physician accessed Sofia's medical form
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_PHI_ACCESS,
            'action' => 'provider_link.accessed',
            'desc' => 'External provider link accessed for Sofia Martinez — Dr. James Owens, pediatrics',
            'auditable' => $sofia,
            'ip' => '64.233.160.100',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0 Safari/537.36',
            'meta' => ['provider_email' => 'dr.owens@pediatrics.example.com', 'provider_name' => 'Dr. James Owens', 'camper_id' => $sofia->id],
            'at' => now()->subDays(2)->setTime(13, 42, 18),
        ]);

        // ── ADMIN ACTIONS ─────────────────────────────────────────────────────

        // Application status change: Ethan approved
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'application.status_changed',
            'desc' => 'Admin approved Ethan Johnson\'s application for Session 1 — Summer 2026',
            'auditable' => $appEthan,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['old_status' => 'under_review', 'new_status' => 'approved', 'camper_name' => 'Ethan Johnson'],
            'old' => ['status' => 'under_review'],
            'new' => ['status' => 'approved'],
            'at' => now()->subDays(6)->setTime(11, 15, 00),
        ]);

        // Application status change: Noah rejected
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'application.status_changed',
            'desc' => 'Admin rejected Noah Thompson\'s application for Session 1 — insufficient cardiac monitoring capacity',
            'auditable' => $appNoah,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['old_status' => 'under_review', 'new_status' => 'rejected', 'camper_name' => 'Noah Thompson', 'reason' => 'Insufficient cardiac monitoring staff capacity for Session 1'],
            'old' => ['status' => 'under_review'],
            'new' => ['status' => 'rejected'],
            'at' => now()->subDays(10)->setTime(14, 30, 00),
        ]);

        // Application moved to under_review
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'application.status_changed',
            'desc' => 'Admin moved Sofia Martinez application to under_review — assigned to Dr. Chen for medical evaluation',
            'auditable' => $appSofia,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['old_status' => 'pending', 'new_status' => 'under_review', 'assigned_to' => 'medical'],
            'old' => ['status' => 'pending'],
            'new' => ['status' => 'under_review'],
            'at' => now()->subDays(7)->setTime(9, 00, 00),
        ]);

        // Document verified by admin
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'document.verified',
            'desc' => 'Admin approved physician clearance document for Ethan Johnson',
            'auditable' => $ethan,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['document_type' => 'physician_clearance', 'camper_name' => 'Ethan Johnson'],
            'at' => now()->subDays(12)->setTime(10, 30, 00),
        ]);

        // Provider link revoked
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'provider_link.revoked',
            'desc' => 'Admin revoked provider link for Mia Davis — Dr. Patel requested direct fax instead',
            'auditable' => $mia,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['provider_email' => 'dr.patel@hematology.example.com', 'reason' => 'Provider requested direct fax'],
            'at' => now()->subDays(1)->setTime(13, 22, 00),
        ]);

        // Provider link created
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'provider_link.created',
            'desc' => 'Medical Director created provider access link for Carlos Rivera — Dr. Miguel Reyes (pulmonology)',
            'auditable' => null,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_id' => null, 'camper_name' => 'Carlos Rivera', 'provider_email' => 'dr.reyes@pulmonology.example.com', 'expires_hours' => 72],
            'at' => now()->subDays(6)->setTime(15, 00, 00),
        ]);

        // Super admin role grant
        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'user.role_changed',
            'desc' => 'Super admin granted medical role to Jamie Santos (part-time nurse hire)',
            'auditable' => $medical2,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['target_user_id' => $medical2->id, 'target_user_email' => $medical2->email],
            'old' => ['role' => 'applicant'],
            'new' => ['role' => 'medical'],
            'at' => now()->subDays(30)->setTime(10, 00, 00),
        ]);

        // Session archived
        $this->log([
            'user' => $superA,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'camp_session.archived',
            'desc' => 'Super admin archived Session 1 — Summer 2025 (session completed)',
            'auditable' => $session1,
            'ip' => '198.51.100.1',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['session_name' => 'Session 1 — Summer 2025', 'reason' => 'session_completed'],
            'old' => ['is_active' => true],
            'new' => ['is_active' => false],
            'at' => now()->subDays(270)->setTime(9, 00, 00),
        ]);

        // Announcement created
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'announcement.created',
            'desc' => 'Admin created pre-camp information broadcast for Session 1 — Summer 2026 families',
            'auditable' => null,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['session_id' => $session1->id, 'recipient_count' => 14],
            'at' => now()->subDays(5)->setTime(11, 00, 00),
        ]);

        // Document request created by medical
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'document_request.created',
            'desc' => 'Medical staff created document request for Lucas Williams — BiPAP equipment protocol',
            'auditable' => $lucas,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['document_type' => 'BiPAP Equipment Protocol', 'due_days' => 7],
            'at' => now()->subDays(5)->setTime(10, 00, 00),
        ]);

        // Admin bulk camper export
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'camper_list.exported',
            'desc' => 'Admin exported camper roster for Session 1 — Summer 2026 (14 approved campers)',
            'auditable' => null,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['session_id' => $session1->id, 'format' => 'csv', 'record_count' => 14],
            'at' => now()->subDays(1)->setTime(8, 45, 00),
        ]);

        // Document request approved
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_ADMIN_ACTION,
            'action' => 'document_request.approved',
            'desc' => 'Admin approved latex allergy management protocol document submitted by David Martinez for Sofia Martinez',
            'auditable' => $sofia,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['document_type' => 'Latex Allergy Management Protocol', 'camper_name' => 'Sofia Martinez'],
            'at' => now()->subDays(10)->setTime(16, 00, 00),
        ]);

        // ── SECURITY ──────────────────────────────────────────────────────────

        // Rate limit hit — too many login attempts
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'rate_limit.exceeded',
            'desc' => 'Login rate limit exceeded — 5 failed attempts within 1 minute from same IP',
            'auditable' => null,
            'ip' => '203.0.113.88',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['limiter' => 'login', 'attempts' => 5, 'window_seconds' => 60, 'email' => 'admin@example.com'],
            'at' => now()->subDays(3)->setTime(2, 19, 00),
        ]);

        // Account lockout
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'account.locked',
            'desc' => 'Account temporarily locked after 10 failed login attempts — automatic 30-minute lockout',
            'auditable' => null,
            'ip' => '203.0.113.88',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['email' => 'admin@example.com', 'lockout_minutes' => 30, 'total_attempts' => 10],
            'at' => now()->subDays(3)->setTime(2, 22, 00),
        ]);

        // Permission denied — applicant tried to access admin route
        $this->log([
            'user' => $sarah,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'permission.denied',
            'desc' => 'Applicant attempted to access admin-only endpoint — 403 returned',
            'auditable' => null,
            'ip' => '73.158.204.97',
            'ua' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15',
            'meta' => ['requested_path' => '/api/admin/applications', 'user_role' => 'applicant', 'required_role' => 'admin'],
            'at' => now()->subDays(1)->setTime(20, 15, 44),
        ]);

        // MFA rate limit
        $this->log([
            'user' => $admin2,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'mfa.rate_limit_exceeded',
            'desc' => 'MFA verification rate limit exceeded — 3 failed attempts in 1 minute',
            'auditable' => null,
            'ip' => '192.0.2.77',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'meta' => ['attempts' => 3, 'window_seconds' => 60, 'lockout_minutes' => 15],
            'at' => now()->subDays(4)->setTime(14, 25, 00),
        ]);

        // Suspicious login from unusual location
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'login.suspicious_location',
            'desc' => 'Login from IP outside expected range — flagged for review (international IP detected)',
            'auditable' => null,
            'ip' => '185.220.101.45',
            'ua' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'meta' => ['country' => 'DE', 'expected_country' => 'US', 'flagged' => true],
            'at' => now()->subDays(14)->setTime(3, 42, 00),
        ]);

        // Inactive user login attempt
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_SECURITY,
            'action' => 'login.inactive_account',
            'desc' => 'Login attempt by deactivated account — access denied',
            'auditable' => null,
            'ip' => '192.0.2.50',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['email' => 'inactive@example.com', 'reason' => 'account_inactive'],
            'at' => now()->subDays(2)->setTime(9, 30, 00),
        ]);

        // ── DATA CHANGES ─────────────────────────────────────────────────────

        // New application submitted
        $this->log([
            'user' => $michael,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'application.created',
            'desc' => 'New camp application submitted for Ava Williams — Session 2, Summer 2026',
            'auditable' => $appAva,
            'ip' => '108.26.78.152',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_name' => 'Ava Williams', 'session_name' => 'Session 2 — Summer 2026', 'submitted_by' => 'applicant'],
            'old' => null,
            'new' => ['status' => 'pending', 'is_draft' => false],
            'at' => now()->subDays(3)->setTime(21, 10, 00),
        ]);

        // Camper profile updated (new diagnosis added)
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'medical_record.updated',
            'desc' => 'Medical staff added updated CF diagnosis severity note for Elijah Green',
            'auditable' => $ethan, // using ethan as a stand-in; real audit would point to the specific record
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_name' => 'Elijah Green', 'field_changed' => 'diagnosis.notes'],
            'old' => ['notes' => 'FEV1 78% predicted'],
            'new' => ['notes' => 'FEV1 72% predicted (updated Jan 2026) — increased monitoring recommended'],
            'at' => now()->subDays(9)->setTime(11, 00, 00),
        ]);

        // Camper supervision level updated
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'camper.supervision_updated',
            'desc' => 'Admin updated supervision level for Lucas Williams from enhanced to one_to_one (DMD progression)',
            'auditable' => $lucas,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['camper_name' => 'Lucas Williams'],
            'old' => ['supervision_level' => 'enhanced'],
            'new' => ['supervision_level' => 'one_to_one'],
            'at' => now()->subDays(45)->setTime(10, 30, 00),
        ]);

        // Application cancelled by applicant
        $this->log([
            'user' => $sarah,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'application.cancelled',
            'desc' => 'Applicant cancelled Lily Johnson\'s application for Session 2 — Summer 2026',
            'auditable' => null,
            'ip' => '73.158.204.97',
            'ua' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15',
            'meta' => ['camper_name' => 'Lily Johnson', 'session_name' => 'Session 2 — Summer 2026', 'reason' => 'applicant_withdrawal'],
            'old' => ['status' => 'pending'],
            'new' => ['status' => 'cancelled'],
            'at' => now()->subDays(5)->setTime(16, 55, 00),
        ]);

        // New medical treatment log created
        $this->log([
            'user' => $medical2,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'treatment_log.created',
            'desc' => 'Nursing staff created treatment log for Ava Williams — albuterol rescue inhaler administered',
            'auditable' => $ava,
            'ip' => '192.0.2.31',
            'ua' => 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
            'meta' => ['camper_name' => 'Ava Williams', 'treatment_type' => 'medication_administered', 'medication' => 'Albuterol'],
            'at' => now()->subDays(2)->setTime(14, 30, 00),
        ]);

        // Medical incident created
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_DATA_CHANGE,
            'action' => 'medical_incident.created',
            'desc' => 'Medical Director documented medical incident for Ava Williams — hypoglycemia episode (BG 52 mg/dL)',
            'auditable' => $ava,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['camper_name' => 'Ava Williams', 'incident_type' => 'medical', 'severity' => 'moderate', 'blood_glucose' => 52],
            'at' => now()->subDays(1)->setTime(14, 05, 00),
        ]);

        // ── FILE ACCESS ───────────────────────────────────────────────────────

        // Document uploaded by parent
        $this->log([
            'user' => $michael,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document.uploaded',
            'desc' => 'Applicant uploaded insulin protocol document for Ava Williams',
            'auditable' => $ava,
            'ip' => '108.26.78.152',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['filename' => 'Ava_Williams_Insulin_Protocol.pdf', 'file_size_bytes' => 284530, 'mime_type' => 'application/pdf', 'camper_name' => 'Ava Williams'],
            'at' => now()->subDays(14)->setTime(19, 45, 00),
        ]);

        // Virus scan passed
        $this->log([
            'user' => null,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document.scan_passed',
            'desc' => 'Virus scan completed — Ava Williams insulin protocol document cleared',
            'auditable' => $ava,
            'ip' => '127.0.0.1',
            'ua' => 'ClamAV/1.2.0',
            'meta' => ['filename' => 'Ava_Williams_Insulin_Protocol.pdf', 'scanner' => 'clamav', 'result' => 'clean'],
            'at' => now()->subDays(14)->setTime(19, 45, 30),
        ]);

        // Document downloaded by admin (medical review)
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document.downloaded',
            'desc' => 'Admin downloaded Ethan Johnson physician clearance letter for review',
            'auditable' => $ethan,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['filename' => 'Ethan_Johnson_Dr_Hill_Clearance_2026.pdf', 'document_type' => 'physician_clearance', 'camper_name' => 'Ethan Johnson'],
            'at' => now()->subDays(12)->setTime(9, 30, 00),
        ]);

        // PHI document downloaded by medical for clinical prep
        $this->log([
            'user' => $medical,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document.downloaded',
            'desc' => 'Medical staff downloaded Sofia Martinez allergy action plan PDF for clinical prep binder',
            'auditable' => $sofia,
            'ip' => '192.0.2.15',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['filename' => 'Sofia_Martinez_Latex_Allergy_Plan.pdf', 'document_type' => 'allergy_action_plan', 'purpose' => 'clinical_prep'],
            'at' => now()->subDays(6)->setTime(10, 00, 00),
        ]);

        // Document verification status updated
        $this->log([
            'user' => $admin,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document.verification_updated',
            'desc' => 'Admin changed verification status of Sofia Martinez immunization record from pending to approved',
            'auditable' => $sofia,
            'ip' => '198.51.100.42',
            'ua' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'meta' => ['document_type' => 'immunization_record', 'camper_name' => 'Sofia Martinez'],
            'old' => ['verification_status' => 'pending'],
            'new' => ['verification_status' => 'approved'],
            'at' => now()->subDays(3)->setTime(15, 00, 00),
        ]);

        // Document request upload by applicant
        $this->log([
            'user' => $michael,
            'event_type' => AuditLog::EVENT_TYPE_FILE_ACCESS,
            'action' => 'document_request.file_uploaded',
            'desc' => 'Applicant uploaded BiPAP equipment protocol in response to document request for Lucas Williams',
            'auditable' => $lucas,
            'ip' => '108.26.78.152',
            'ua' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'meta' => ['filename' => 'Lucas_Williams_BiPAP_Settings_Sheet.pdf', 'document_type' => 'BiPAP Equipment Protocol', 'file_size_bytes' => 192048],
            'at' => now()->subHours(4),
        ]);

        $count = AuditLog::count();
        $this->command->line("  Audit log seeded ({$count} total entries after seed).");
    }

    private function log(array $data): void
    {
        AuditLog::create([
            'request_id' => Str::uuid()->toString(),
            'user_id' => $data['user']?->id,
            'event_type' => $data['event_type'],
            'auditable_type' => isset($data['auditable']) && $data['auditable'] ? get_class($data['auditable']) : null,
            'auditable_id' => isset($data['auditable']) && $data['auditable'] ? $data['auditable']->id : null,
            'action' => $data['action'],
            'description' => $data['desc'] ?? null,
            'old_values' => $data['old'] ?? null,
            'new_values' => $data['new'] ?? null,
            'metadata' => $data['meta'] ?? null,
            'ip_address' => $data['ip'],
            'user_agent' => $data['ua'],
            'created_at' => $data['at'],
        ]);
    }
}
