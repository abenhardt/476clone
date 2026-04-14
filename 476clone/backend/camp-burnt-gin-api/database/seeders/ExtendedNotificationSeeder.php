<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Camper;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeder — extended notifications for admin, medical, and additional applicant accounts.
 *
 * The base NotificationSeeder seeds notifications only for 3 applicant users.
 * This seeder adds:
 *
 *   Admin notifications:
 *     - application_submitted (Lucas Williams — new submission)
 *     - application_submitted (Noah Thompson reapplication — Session 2)
 *     - provider_link_submitted (Dr. Kim completed Noah's form)
 *     - provider_link_expired (Lucas's link expired without submission)
 *     - new_message (Patricia Davis sent a heat protocol question)
 *
 *   Medical staff notifications:
 *     - medical_alert (Ava hypoglycemia — second episode)
 *     - follow_up_overdue (Ava insulin rate review overdue)
 *     - follow_up_overdue (Lucas cardiologist notification overdue)
 *     - new_message (admin forwarding Lucas respiratory coordination message)
 *
 *   Additional applicant notifications:
 *     Michael Williams:
 *       - application_submitted (Ava — approved Session 2)
 *       - application_status_changed → approved (Ava)
 *       - application_submitted (Lucas — pending Session 1)
 *     Patricia Davis:
 *       - application_submitted (Mia — past session approved)
 *
 * Safe to re-run — idempotent per notifiable + type + title.
 */
class ExtendedNotificationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();
        $patricia = User::where('email', 'patricia.davis@example.com')->firstOrFail();

        $ava = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        $lucas = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $mia = Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail();

        $appAva = Application::where('camper_id', $ava->id)->first();
        $appLucas = Application::where('camper_id', $lucas->id)->first();
        $appNoahS2 = Application::where('camper_id', $noah->id)
            ->whereHas('campSession', fn ($q) => $q->where('name', 'Session 2 — Summer 2026'))
            ->first();
        $appMia = Application::where('camper_id', $mia->id)->first();

        // ── Admin notifications ────────────────────────────────────────────────

        $this->notify(
            notifiable: $admin,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'New application submitted — Lucas Williams',
                'message' => 'Lucas Williams (Session 1 — Summer 2026) submitted a new application requiring review.',
                'application_id' => $appLucas?->id,
                'camper_name' => 'Lucas Williams',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(3)->toIso8601String(),
            ],
            readAt: null,  // UNREAD — new application waiting for admin review
            createdAt: now()->subDays(3)
        );

        $this->notify(
            notifiable: $admin,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'New application submitted — Noah Thompson (Session 2)',
                'message' => 'Noah Thompson reapplied for Session 2 — Summer 2026 after Session 1 rejection.',
                'application_id' => $appNoahS2?->id,
                'camper_name' => 'Noah Thompson',
                'camp_session' => 'Session 2 — Summer 2026',
                'submitted_at' => now()->subDays(2)->toIso8601String(),
            ],
            readAt: now()->subDays(1),
            createdAt: now()->subDays(2)
        );

        $this->notify(
            notifiable: $admin,
            type: 'App\\Notifications\\NewMessageNotification',
            data: [
                'type' => 'new_message',
                'title' => 'New message from Patricia Davis — Heat protocol question',
                'message' => 'You have an unread message: "I\'m Patricia, Mia\'s mom. I want to make sure the outdoor activity staff will actually know about this..."',
                'conversation_id' => null,
                'sender_name' => 'Patricia Davis',
            ],
            readAt: null,  // UNREAD — awaiting response
            createdAt: now()->subHours(6)
        );

        // ── Medical staff notifications ────────────────────────────────────────

        $this->notify(
            notifiable: $medical,
            type: 'App\\Notifications\\Medical\\MedicalAlertNotification',
            data: [
                'type' => 'medical_alert',
                'title' => 'Medical alert — Ava Williams hypoglycemia (second episode)',
                'message' => 'Ava Williams experienced a second hypoglycemia episode this session (BG 52 mg/dL at archery range, 03/04). Basal rate review with endocrinologist flagged as urgent follow-up.',
                'camper_name' => 'Ava Williams',
                'alert_type' => 'hypoglycemia',
                'occurred_at' => now()->subDays(3)->toIso8601String(),
            ],
            readAt: now()->subDays(2),
            createdAt: now()->subDays(3)
        );

        $this->notify(
            notifiable: $medical,
            type: 'App\\Notifications\\Medical\\FollowUpOverdueNotification',
            data: [
                'type' => 'follow_up_overdue',
                'title' => 'Follow-up overdue — Ava Williams insulin rate review',
                'message' => 'The follow-up task "Contact endocrinologist re: basal rate adjustment" was due 2026-03-05 and is now 2 days overdue.',
                'camper_name' => 'Ava Williams',
                'due_date' => '2026-03-05',
                'priority' => 'urgent',
            ],
            readAt: null,  // UNREAD — still overdue
            createdAt: now()->subDays(2)
        );

        $this->notify(
            notifiable: $medical,
            type: 'App\\Notifications\\Medical\\FollowUpOverdueNotification',
            data: [
                'type' => 'follow_up_overdue',
                'title' => 'Follow-up overdue — Lucas Williams cardiologist notification',
                'message' => 'The follow-up task "Notify cardiologist of 03/06 respiratory event" was due 2026-03-06 and is now overdue.',
                'camper_name' => 'Lucas Williams',
                'due_date' => '2026-03-06',
                'priority' => 'high',
            ],
            readAt: null,  // UNREAD
            createdAt: now()->subDays(1)
        );

        $this->notify(
            notifiable: $medical,
            type: 'App\\Notifications\\NewMessageNotification',
            data: [
                'type' => 'new_message',
                'title' => 'New message from Alex Rivera — Lucas respiratory follow-up',
                'message' => 'You have a new message: "Thanks Morgan. I spoke to Michael Williams at 8:15 AM — he\'s aware and relieved..."',
                'conversation_id' => null,
                'sender_name' => 'Alex Rivera',
            ],
            readAt: now()->subHours(4),
            createdAt: now()->subHours(5)
        );

        // ── Michael Williams notifications ─────────────────────────────────────

        $this->notify(
            notifiable: $michael,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Ava Williams',
                'message' => 'Your application for Ava Williams (Session 2 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appAva?->id,
                'camper_name' => 'Ava Williams',
                'camp_session' => 'Session 2 — Summer 2026',
                'submitted_at' => now()->subDays(18)->toIso8601String(),
            ],
            readAt: now()->subDays(17),
            createdAt: now()->subDays(18)
        );

        $this->notify(
            notifiable: $michael,
            type: 'App\\Notifications\\Camper\\ApplicationStatusChangedNotification',
            data: [
                'type' => 'application_status_changed',
                'title' => 'Application status updated — Approved (Ava Williams)',
                'message' => 'The application for Ava Williams has been updated from Pending to Approved.',
                'application_id' => $appAva?->id,
                'camper_name' => 'Ava Williams',
                'camp_session' => 'Session 2 — Summer 2026',
                'previous_status' => 'pending',
                'new_status' => 'approved',
                'changed_at' => now()->subDays(8)->toIso8601String(),
            ],
            readAt: now()->subDays(7),
            createdAt: now()->subDays(8)
        );

        $this->notify(
            notifiable: $michael,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Lucas Williams',
                'message' => 'Your application for Lucas Williams (Session 1 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appLucas?->id,
                'camper_name' => 'Lucas Williams',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(3)->toIso8601String(),
            ],
            readAt: null,  // UNREAD
            createdAt: now()->subDays(3)
        );

        // ── Patricia Davis notifications ────────────────────────────────────────

        $this->notify(
            notifiable: $patricia,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Mia Davis',
                'message' => 'Your application for Mia Davis (Session 1 — Summer 2025) has been received and is now pending review.',
                'application_id' => $appMia?->id,
                'camper_name' => 'Mia Davis',
                'camp_session' => 'Session 1 — Summer 2025',
                'submitted_at' => '2025-04-10T10:00:00+00:00',
            ],
            readAt: now()->subDays(330),
            createdAt: now()->subDays(332)
        );

        $this->command->line('  Extended notifications seeded (admin, medical, Michael, Patricia).');
    }

    private function notify(
        User $notifiable,
        string $type,
        array $data,
        ?\DateTimeInterface $readAt,
        \DateTimeInterface $createdAt
    ): void {
        $exists = DB::table('notifications')
            ->where('notifiable_id', $notifiable->id)
            ->where('notifiable_type', User::class)
            ->where('type', $type)
            ->whereJsonContains('data->title', $data['title'])
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('notifications')->insert([
            'id' => Str::uuid()->toString(),
            'type' => $type,
            'notifiable_type' => User::class,
            'notifiable_id' => $notifiable->id,
            'data' => json_encode($data),
            'read_at' => $readAt,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ]);
    }
}
