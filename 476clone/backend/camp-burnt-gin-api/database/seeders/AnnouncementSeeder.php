<?php

namespace Database\Seeders;

use App\Models\Announcement;
use App\Models\AuditLog;
use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — announcements and calendar events.
 *
 * Announcements cover several audience/urgency combinations:
 *   - Pinned global (registration open)
 *   - Pinned urgent parent-only (medication form deadline)
 *   - Standard parent-only (pre-camp medical review, welcome)
 *   - Admin-only (staff orientation)
 *
 * Calendar events cover deadlines, sessions, orientations, internal reviews,
 * and three medical-staff-targeted events (audience='medical') added to support
 * the medical portal calendar view.
 *
 * Also seeds a small set of realistic audit log entries for the admin log viewer.
 */
class AnnouncementSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();

        $this->seedAnnouncements($admin);
        $this->seedCalendarEvents($admin);
        $this->seedAuditLog($admin);
    }

    private function seedAnnouncements(User $admin): void
    {
        $announcements = [
            [
                'title' => 'Registration Now Open — Session 1 & Session 2, Summer 2026',
                'body' => "We are thrilled to announce that registration for Summer 2026 is now open! Applications are accepted on a rolling basis. Session 1 runs June 8–12 and Session 2 runs June 22–26.\n\nAll camper medical records, physician clearance letters, and required documents must be received no later than May 15 (Session 1) or May 29 (Session 2) for your application to be considered complete.\n\nQuestions? Message us in the inbox or email admissions@campburntgin.org.",
                'is_pinned' => true,
                'is_urgent' => false,
                'audience' => 'all',
                'published_at' => now()->subDays(45),
            ],
            [
                'title' => 'URGENT: Medication Form Update Required Before April 1',
                'body' => "All applicants with approved applications for Summer 2026 must complete and submit the updated Medication Administration Authorization Form (MAA Form Rev. 2026) by April 1, 2026.\n\nThis is a new South Carolina DSS requirement for all residential camps serving children with special health care needs. The form can be downloaded from the Forms section of your applicant portal.\n\nIf you have questions, please message our nursing staff directly through the inbox.",
                'is_pinned' => true,
                'is_urgent' => true,
                'audience' => 'parent',
                'published_at' => now()->subDays(10),
            ],
            [
                'title' => 'Pre-Camp Medical Review — Scheduling Now Open',
                'body' => "We are now scheduling optional pre-camp telehealth consultations with our camp nursing director for families of first-time campers or campers with complex medical needs.\n\nThese 20-minute calls allow our clinical team to review your camper's care plan, ask questions, and ensure we have everything needed for a safe and successful camp experience.\n\nTo schedule, reply to this announcement or message us in the inbox.",
                'is_pinned' => false,
                'is_urgent' => false,
                'audience' => 'parent',
                'published_at' => now()->subDays(25),
            ],
            [
                'title' => 'Staff Orientation — March 14–15, 2026',
                'body' => "All seasonal staff are required to attend in-person orientation on March 14–15 at Camp Burnt Gin (250 Camp Road, Orangeburg, SC 29118). Check-in begins at 8:30 AM on March 14.\n\nTopics covered: HIPAA & FERPA compliance, emergency protocols, disability awareness training, medication administration refresher, and camper behavioral support strategies.\n\nPlease confirm attendance by replying to this announcement.",
                'is_pinned' => false,
                'is_urgent' => false,
                'audience' => 'admin',
                'published_at' => now()->subDays(18),
            ],
            [
                'title' => 'Welcome to the Camp Burnt Gin Applicant Portal',
                'body' => "Welcome to the Camp Burnt Gin applicant portal. Here you can:\n\n• Submit and track your camper's application\n• Message our team directly\n• Access announcements and camp updates\n• Download required forms and documents\n\nWe're glad you're here and look forward to making this a memorable summer for your family. If you have any questions at any time, don't hesitate to reach out via the inbox.",
                'is_pinned' => false,
                'is_urgent' => false,
                'audience' => 'parent',
                'published_at' => now()->subDays(60),
            ],
        ];

        foreach ($announcements as $a) {
            if (! Announcement::where('title', $a['title'])->exists()) {
                Announcement::create(array_merge($a, [
                    'author_id' => $admin->id,
                    'target_session_id' => null,
                ]));
            }
        }
    }

    private function seedCalendarEvents(User $admin): void
    {
        $events = [
            ['title' => 'Session 1 Application Deadline',           'type' => 'deadline',    'color' => '#dc2626', 'start' => '2026-05-15 23:59:00', 'end' => '2026-05-15 23:59:00', 'all_day' => true,  'audience' => 'all'],
            ['title' => 'Session 2 Application Deadline',           'type' => 'deadline',    'color' => '#dc2626', 'start' => '2026-05-29 23:59:00', 'end' => '2026-05-29 23:59:00', 'all_day' => true,  'audience' => 'all'],
            ['title' => 'Medication Forms Due (Session 1)',          'type' => 'deadline',    'color' => '#f59e0b', 'start' => '2026-04-01 23:59:00', 'end' => '2026-04-01 23:59:00', 'all_day' => true,  'audience' => 'all'],
            ['title' => 'Session 1 — Summer 2026',                  'type' => 'session',     'color' => '#16a34a', 'start' => '2026-06-08 08:00:00', 'end' => '2026-06-12 17:00:00', 'all_day' => false, 'audience' => 'all'],
            ['title' => 'Session 2 — Summer 2026',                  'type' => 'session',     'color' => '#16a34a', 'start' => '2026-06-22 08:00:00', 'end' => '2026-06-26 17:00:00', 'all_day' => false, 'audience' => 'all'],
            ['title' => 'Staff Orientation Day 1',                  'type' => 'orientation', 'color' => '#7c3aed', 'start' => '2026-03-14 08:30:00', 'end' => '2026-03-14 17:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'Staff Orientation Day 2',                  'type' => 'orientation', 'color' => '#7c3aed', 'start' => '2026-03-15 08:30:00', 'end' => '2026-03-15 17:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'Family Pre-Camp Info Night (Virtual)',      'type' => 'orientation', 'color' => '#0891b2', 'start' => '2026-05-20 18:00:00', 'end' => '2026-05-20 19:30:00', 'all_day' => false, 'audience' => 'all'],
            ['title' => 'Medical Records Review — Session 1 Cohort', 'type' => 'internal',    'color' => '#475569', 'start' => '2026-05-22 09:00:00', 'end' => '2026-05-22 12:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'Medical Records Review — Session 2 Cohort', 'type' => 'internal',    'color' => '#475569', 'start' => '2026-06-05 09:00:00', 'end' => '2026-06-05 12:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'Post-Camp Debrief & Documentation',        'type' => 'internal',    'color' => '#475569', 'start' => '2026-06-29 10:00:00', 'end' => '2026-06-29 13:00:00', 'all_day' => false, 'audience' => 'staff'],

            // ── Medical/staff-targeted events (audience = 'staff') ───────────
            // Session 1 starts June 8 2026. The staff briefing is 07:00 the same morning,
            // before the 08:00 session open. The dispensing schedule and record review
            // cover the full in-session operational calendar for medical staff.
            ['title' => 'Medical Staff Briefing — Session 1 2026',         'type' => 'staff',    'color' => '#0284c7', 'start' => '2026-06-08 07:00:00', 'end' => '2026-06-08 08:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'Medication Dispensing Schedule — Session 1 2026', 'type' => 'internal', 'color' => '#0284c7', 'start' => '2026-06-08 08:00:00', 'end' => '2026-06-08 09:00:00', 'all_day' => false, 'audience' => 'staff'],
            ['title' => 'End-of-Session Medical Record Review',            'type' => 'deadline', 'color' => '#dc2626', 'start' => '2026-06-12 23:59:00', 'end' => '2026-06-12 23:59:00', 'all_day' => true,  'audience' => 'staff'],
        ];

        foreach ($events as $e) {
            if (! CalendarEvent::where('title', $e['title'])->exists()) {
                CalendarEvent::create([
                    'created_by' => $admin->id,
                    'title' => $e['title'],
                    'description' => null,
                    'event_type' => $e['type'],
                    'color' => $e['color'],
                    'starts_at' => $e['start'],
                    'ends_at' => $e['end'],
                    'all_day' => $e['all_day'],
                    'audience' => $e['audience'],
                    'target_session_id' => null,
                ]);
            }
        }
    }

    private function seedAuditLog(User $admin): void
    {
        $sarah = User::where('email', 'sarah.johnson@example.com')->first();
        $david = User::where('email', 'david.martinez@example.com')->first();
        $super = User::where('email', 'admin@campburntgin.org')->first();

        $entries = [
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.approved',
                'description' => 'Approved application for Ethan Johnson (Session 1 — Summer 2026)',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'application.rejected',
                'description' => 'Rejected application for Noah Thompson (Session 1 — Summer 2026): session at capacity',
                'auditable_type' => 'App\\Models\\Application',
                'auditable_id' => 4,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ],
            [
                'user_id' => $sarah ? $sarah->id : $admin->id,
                'event_type' => 'authentication',
                'action' => 'login',
                'description' => 'User logged in successfully',
                'auditable_type' => null,
                'auditable_id' => null,
                'ip_address' => '192.168.1.100',
                'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            ],
            [
                'user_id' => $david ? $david->id : $admin->id,
                'event_type' => 'phi_access',
                'action' => 'camper.medical_record.viewed',
                'description' => 'Applicant viewed medical record for Sofia Martinez',
                'auditable_type' => 'App\\Models\\MedicalRecord',
                'auditable_id' => 1,
                'ip_address' => '10.0.0.45',
                'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            ],
            [
                'user_id' => $admin->id,
                'event_type' => 'admin_action',
                'action' => 'announcement.created',
                'description' => 'Published announcement: Registration Now Open — Session 1 & Session 2, Summer 2026',
                'auditable_type' => 'App\\Models\\Announcement',
                'auditable_id' => 1,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ],
            [
                'user_id' => $super ? $super->id : $admin->id,
                'event_type' => 'admin_action',
                'action' => 'user.role.updated',
                'description' => 'Super admin updated role for user admin@example.com to admin',
                'auditable_type' => 'App\\Models\\User',
                'auditable_id' => 2,
                'ip_address' => '127.0.0.1',
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ],
        ];

        foreach ($entries as $entry) {
            AuditLog::create(array_merge($entry, [
                'request_id' => Str::uuid()->toString(),
                'old_values' => null,
                'new_values' => null,
                'metadata' => null,
            ]));
        }
    }
}
