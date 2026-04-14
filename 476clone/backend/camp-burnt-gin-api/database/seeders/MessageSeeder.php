<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\Camper;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — inbox conversations and messages.
 *
 * Creates five realistic conversation threads across categories:
 *   1. Application query (parent → admin re: approved application)
 *   2. Missing documents (admin → parent re: under-review application)
 *   3. Reapplication follow-up (parent → admin after rejection)
 *   4. Medical/allergy question (parent → admin, no application context)
 *   5. General inquiry — packing list (parent → admin)
 *
 * All conversations are idempotent — duplicate subjects are skipped on re-seed.
 */
class MessageSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $david = User::where('email', 'david.martinez@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();

        $ethan = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        $sofia = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        $noah = Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail();

        $appEthan = Application::where('camper_id', $ethan->id)
            ->whereHas('campSession', fn ($q) => $q->where('name', 'Session 1 — Summer 2026'))
            ->firstOrFail();
        $appSofia = Application::where('camper_id', $sofia->id)->firstOrFail();
        $appNoah = Application::where('camper_id', $noah->id)
            ->whereHas('campSession', fn ($q) => $q->where('name', 'Session 1 — Summer 2026'))
            ->firstOrFail();

        $this->makeConversation(
            subject: 'Ethan Johnson — Session 1 Application Question',
            creator: $sarah,
            participants: [$admin],
            applicationId: $appEthan->id,
            category: 'application',
            messages: [
                [$sarah, "Hi, I submitted Ethan's application for Session 1 about three weeks ago and wanted to check on the status. He is so excited about camp this year!"],
                [$admin, "Hi Sarah! Great news — Ethan's application has been approved. Our medical team has reviewed his file and everything looks great. You should receive an official confirmation email shortly with next steps."],
                [$sarah, 'That is wonderful! Thank you so much. Should I send his updated seizure action plan now, or wait for the pre-camp packet?'],
                [$admin, 'Please go ahead and send it now so we can get it to our nursing staff early. You can attach it in a new message here or email it to us at medical@campburntgin.org. We want to be fully prepared for Ethan.'],
            ]
        );

        $this->makeConversation(
            subject: 'Sofia Martinez — Missing Documents',
            creator: $admin,
            participants: [$david],
            applicationId: $appSofia->id,
            category: 'application',
            messages: [
                [$admin, "Hi David, I'm following up on Sofia's application. We're currently under review and need two things to move forward: (1) an updated immunization record from her pediatrician, and (2) a physician clearance letter confirming she is cleared for camp participation. Could you send those by the end of the week?"],
                [$david, "Of course, I'll contact Dr. Owens's office today. Sofia's annual exam was last month so the immunizations should be up to date. I'll have them send the records directly — what email should they use?"],
                [$admin, "They can send records to records@campburntgin.org and reference Sofia's application ID. Thank you for the quick response, David!"],
                [$david, "Done — Dr. Owens's office said they'll fax the clearance letter by Friday and email the immunization record tomorrow. Let me know if you need anything else."],
            ]
        );

        $this->makeConversation(
            subject: 'Noah Thompson — Session 2 Application',
            creator: $jennifer,
            participants: [$admin],
            applicationId: $appNoah->id,
            category: 'general',
            messages: [
                [$jennifer, "Hi, I received the email that Noah's Session 1 application was rejected due to capacity. I understand but we're disappointed. You mentioned we could apply for Session 2 — I've done that now. Will his existing medical file carry over?"],
                [$admin, "Hi Jennifer, I'm so sorry for the disappointment. Yes — all of Noah's medical records and forms are already on file. His Session 2 application will move much faster through review. Thank you for reapplying!"],
                [$jennifer, "That's a relief. Noah is really looking forward to this. Please let me know if there's anything else needed."],
            ]
        );

        $this->makeConversation(
            subject: 'Latex Allergy Protocol — Noah Thompson',
            creator: $jennifer,
            participants: [$admin],
            applicationId: null,
            category: 'medical',
            messages: [
                [$jennifer, "I want to make sure the camp is aware of Noah's severe latex allergy. He had a significant reaction two years ago. Does camp have a latex-free environment policy?"],
                [$admin, "Absolutely, Jennifer. We maintain a latex-safe environment throughout the entire camp. Our nursing staff is briefed on all allergy protocols before campers arrive. Noah's Epipen will be with nursing staff and copies will be at each activity station. We've handled latex-allergic campers many times."],
            ]
        );

        $this->makeConversation(
            subject: 'Packing List & Drop-Off Instructions',
            creator: $sarah,
            participants: [$admin],
            applicationId: null,
            category: 'general',
            messages: [
                [$sarah, 'Hi! When will the packing list and drop-off time/location be sent out for Session 1?'],
                [$admin, "Hi Sarah! We'll send the full pre-camp packet (packing list, drop-off instructions, medication form, and schedule overview) 6 weeks before the session start date — so around late April. We'll also post it in the announcements here. Keep an eye out!"],
                [$sarah, 'Perfect, thank you!'],
            ]
        );
    }

    private function makeConversation(
        string $subject,
        User $creator,
        array $participants,
        ?int $applicationId,
        string $category,
        array $messages
    ): void {
        if (Conversation::where('subject', $subject)->exists()) {
            return;
        }

        $conv = Conversation::create([
            'created_by_id' => $creator->id,
            'subject' => $subject,
            'category' => $category,
            'application_id' => $applicationId,
            'last_message_at' => now()->subHours(rand(1, 72)),
            'is_archived' => false,
        ]);

        $participantIds = array_unique(array_merge(
            [$creator->id],
            array_map(fn (User $u) => $u->id, $participants)
        ));

        foreach ($participantIds as $uid) {
            ConversationParticipant::create([
                'conversation_id' => $conv->id,
                'user_id' => $uid,
                'joined_at' => now()->subDays(rand(1, 14)),
            ]);
        }

        foreach ($messages as [$sender, $body]) {
            Message::create([
                'conversation_id' => $conv->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'idempotency_key' => Str::uuid()->toString(),
                'created_at' => now()->subMinutes(rand(5, 4320)),
            ]);
        }
    }
}
