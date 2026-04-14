<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Camper;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeder — database notifications for demo applicant accounts.
 *
 * Inserts rows directly into the `notifications` table (Laravel's default
 * Notifiable database channel schema). The `data` column matches the
 * toArray() format of each corresponding Notification class.
 *
 * Notifications seeded:
 *   Sarah Johnson:
 *     - application_submitted (Ethan) — READ
 *     - application_status_changed → approved (Ethan) — READ
 *     - application_submitted (Lily) — UNREAD
 *   Jennifer Thompson:
 *     - application_submitted (Noah) — READ
 *     - application_status_changed → rejected (Noah) — READ
 *     - new_message (from admin, re: Session 2) — UNREAD
 *   David Martinez:
 *     - application_submitted (Sofia) — READ
 *     - new_message (from admin, re: missing documents) — UNREAD
 *
 * Notifications are idempotent per notifiable_id + type + data[application_id].
 */
class NotificationSeeder extends Seeder
{
    public function run(): void
    {
        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $lily = Camper::where('first_name', 'Lily')->where('last_name', 'Johnson')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)
            ->whereHas('campSession', fn ($q) => $q->where('name', 'Session 1 — Summer 2026'))
            ->first();
        $appLily = Application::where('camper_id', $lily->id)->first();
        $appNoahS1 = Application::where('camper_id', $noah->id)
            ->whereHas('campSession', fn ($q) => $q->where('name', 'Session 1 — Summer 2026'))
            ->first();
        $appSofia = Application::where('camper_id', $sofia->id)->first();

        // ── Sarah Johnson ──────────────────────────────────────────────────────

        $this->notify(
            notifiable: $sarah,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Ethan Johnson',
                'message' => 'Your application for Ethan Johnson (Session 1 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appEthan?->id,
                'camper_name' => 'Ethan Johnson',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(20)->toIso8601String(),
            ],
            readAt: now()->subDays(19),
            createdAt: now()->subDays(20)
        );

        $this->notify(
            notifiable: $sarah,
            type: 'App\\Notifications\\Camper\\ApplicationStatusChangedNotification',
            data: [
                'type' => 'application_status_changed',
                'title' => 'Application status updated — Approved',
                'message' => 'The application for Ethan Johnson has been updated from Pending to Approved.',
                'application_id' => $appEthan?->id,
                'camper_name' => 'Ethan Johnson',
                'camp_session' => 'Session 1 — Summer 2026',
                'previous_status' => 'pending',
                'new_status' => 'approved',
                'changed_at' => now()->subDays(10)->toIso8601String(),
            ],
            readAt: now()->subDays(9),
            createdAt: now()->subDays(10)
        );

        $this->notify(
            notifiable: $sarah,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Lily Johnson',
                'message' => 'Your application for Lily Johnson (Session 1 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appLily?->id,
                'camper_name' => 'Lily Johnson',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(5)->toIso8601String(),
            ],
            readAt: null,  // UNREAD
            createdAt: now()->subDays(5)
        );

        // ── Jennifer Thompson ──────────────────────────────────────────────────

        $this->notify(
            notifiable: $jennifer,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Noah Thompson',
                'message' => 'Your application for Noah Thompson (Session 1 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appNoahS1?->id,
                'camper_name' => 'Noah Thompson',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(30)->toIso8601String(),
            ],
            readAt: now()->subDays(28),
            createdAt: now()->subDays(30)
        );

        $this->notify(
            notifiable: $jennifer,
            type: 'App\\Notifications\\Camper\\ApplicationStatusChangedNotification',
            data: [
                'type' => 'application_status_changed',
                'title' => 'Application status updated — Rejected',
                'message' => 'The application for Noah Thompson has been updated from Under Review to Rejected.',
                'application_id' => $appNoahS1?->id,
                'camper_name' => 'Noah Thompson',
                'camp_session' => 'Session 1 — Summer 2026',
                'previous_status' => 'under_review',
                'new_status' => 'rejected',
                'changed_at' => now()->subDays(22)->toIso8601String(),
            ],
            readAt: now()->subDays(21),
            createdAt: now()->subDays(22)
        );

        $this->notify(
            notifiable: $jennifer,
            type: 'App\\Notifications\\NewMessageNotification',
            data: [
                'type' => 'new_message',
                'title' => 'New message from Camp Burnt Gin',
                'message' => 'You have a new message: "Hi Jennifer, I\'m so sorry for the disappointment..."',
                'conversation_id' => null,
                'sender_name' => 'Alex Rivera',
            ],
            readAt: null,  // UNREAD
            createdAt: now()->subDays(2)
        );

        // ── David Martinez ──────────────────────────────────────────────────────

        $this->notify(
            notifiable: $david,
            type: 'App\\Notifications\\Camper\\ApplicationSubmittedNotification',
            data: [
                'type' => 'application_submitted',
                'title' => 'Application submitted for Sofia Martinez',
                'message' => 'Your application for Sofia Martinez (Session 1 — Summer 2026) has been received and is now pending review.',
                'application_id' => $appSofia?->id,
                'camper_name' => 'Sofia Martinez',
                'camp_session' => 'Session 1 — Summer 2026',
                'submitted_at' => now()->subDays(14)->toIso8601String(),
            ],
            readAt: now()->subDays(13),
            createdAt: now()->subDays(14)
        );

        $this->notify(
            notifiable: $david,
            type: 'App\\Notifications\\NewMessageNotification',
            data: [
                'type' => 'new_message',
                'title' => 'New message from Camp Burnt Gin',
                'message' => 'You have a new message: "Hi David, I\'m following up on Sofia\'s application..."',
                'conversation_id' => null,
                'sender_name' => 'Alex Rivera',
            ],
            readAt: null,  // UNREAD
            createdAt: now()->subDays(1)
        );
    }

    /**
     * Insert a single notification row if one doesn't already exist
     * for the same notifiable + type + title combination.
     */
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
