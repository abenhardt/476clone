<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Seeder — extended messaging scenarios.
 *
 * The base MessageSeeder creates 5 short conversations (all applicant ↔ admin).
 * This seeder adds:
 *
 *   1. Medical staff conversation — Dr. Chen reaches out to admin about Lucas respiratory event
 *   2. Archived conversation     — an older completed thread, marked archived
 *   3. Long-thread conversation  — 10+ message thread testing pagination/scroll
 *   4. Medical-category thread   — Noah latex allergy follow-up with nursing staff
 *   5. Admin-to-admin internal   — internal staff coordination (admin ↔ medical)
 *   6. Unanswered thread         — applicant message with no admin reply (tests badge/unread state)
 *   7. Medical2 staff thread     — conversation involving second medical user (Jamie Santos)
 *
 * Also sets is_starred on one conversation participant to test starred state.
 *
 * Safe to re-run — duplicate detection on conversation subject.
 */
class ExtendedMessageSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $medical = User::where('email', 'medical@example.com')->firstOrFail();
        $sarah = User::where('email', 'sarah.johnson@example.com')->firstOrFail();
        $jennifer = User::where('email', 'jennifer.thompson@example.com')->firstOrFail();
        $michael = User::where('email', 'michael.williams@example.com')->firstOrFail();
        $patricia = User::where('email', 'patricia.davis@example.com')->firstOrFail();

        // Load medical2 if seeded
        $medical2 = User::where('email', 'medical2@campburntgin.org')->first();

        // 1. Medical staff → Admin: Lucas respiratory coordination
        $this->makeConversation(
            subject: 'Lucas Williams — Respiratory Event Follow-Up (Internal)',
            creator: $medical,
            participants: [$admin],
            category: 'medical',
            applicationId: null,
            isArchived: false,
            messages: [
                [$medical, "Hi Alex, following up on Lucas's respiratory event this morning (03/06). O2 sat dropped to 94%. I contacted Dr. Gonzalez verbally — she advised increasing IPAP from 14 to 15 on the BiPAP tonight. I need to document this as a formal physician order. Can you confirm if the family has been notified and whether we have a signed consent for the settings change?"],
                [$admin, "Thanks Morgan. I spoke to Michael Williams at 8:15 AM — he's aware and relieved Lucas is stable. He said Dr. Gonzalez will fax the written order today. Can you update the care chart once it arrives? Also, I've flagged this in the follow-up queue for the cardiologist notification."],
                [$medical, "Got it. Will update the chart when the fax comes in. I've also updated Lucas's BiPAP log in his medical record. O2 sat at 9 AM check was 96% — trending in the right direction. Keep me posted on the cardiologist timeline."],
                [$admin, "Will do. Good call on the cough-assist technique — that made a real difference. I'll loop in the cardiologist office before noon. Anything else you need from me?"],
                [$medical, "Nothing for now. I'll do another O2 check at noon and report back. Thanks for the fast parent notification — that really helps."],
            ]
        );

        // 2. Archived conversation — older packing list discussion (completed/closed)
        $conv = $this->makeConversation(
            subject: 'Pre-Camp 2025 — Packing List and Drop-Off',
            creator: $sarah,
            participants: [$admin],
            category: 'general',
            applicationId: null,
            isArchived: true,  // ARCHIVED
            messages: [
                [$sarah, 'Hi! Do you have the packing list available for summer 2025? We attended last year and just want to make sure we have everything for Ethan.'],
                [$admin, 'Hi Sarah! Great to hear from you. The full packing list for 2025 is attached in the Announcements section of the portal. For returning families, the main addition this year is a signed Medication Administration Authorization form — please download and return it before June 1.'],
                [$sarah, "Perfect! Found it. We'll get the MAA signed and uploaded this week. Can't wait for Ethan to be back!"],
                [$admin, "We're so glad to have him returning! His counselors from last year have been specifically requesting to work with him again. See you in June!"],
            ]
        );

        // Mark this conversation as starred for Sarah (tests starred state in UI)
        if ($conv) {
            $participant = ConversationParticipant::where('conversation_id', $conv->id)
                ->where('user_id', $sarah->id)
                ->first();
            if ($participant && ! $participant->is_starred) {
                $participant->update(['is_starred' => true]);
            }
        }

        // 3. Long-thread conversation — Ava's diabetes management discussion
        $this->makeConversation(
            subject: 'Ava Williams — Insulin Pump and CGM Protocol Questions',
            creator: $michael,
            participants: [$admin, $medical],
            category: 'medical',
            applicationId: null,
            isArchived: false,
            messages: [
                [$michael, "Hi, I'm Michael — Ava and Lucas's father. I have some questions about how camp handles Ava's insulin pump and CGM. She's on an OmniPod and Dexcom G7. Can you tell me what training your nursing staff has with these devices?"],
                [$medical, "Hi Michael! I'm Dr. Morgan Chen, the camp's medical director. We have extensive experience with both OmniPod and Dexcom systems. Our nursing team completes annual diabetes technology training. For Ava specifically, I'd like to review her current basal rates and correction table before she arrives."],
                [$michael, "That's reassuring. Her endocrinologist Dr. Gonzalez is happy to do a phone consultation with your team before camp. Would that be helpful?"],
                [$medical, "Absolutely — we'd love that. Can you have Dr. Gonzalez contact us at medical@campburntgin.org to arrange a time? Ideally at least 2 weeks before the session start."],
                [$michael, "I'll pass that along today. One other question — Ava has had two hypoglycemia episodes in the past month. We adjusted her basal rate but wanted camp to know. Should I send the updated pump settings?"],
                [$medical, 'Yes, please send the updated pump report from the OmniPod PDM app as a PDF when you can. Also include her most recent Dexcom clarity report (last 2 weeks of CGM data). That will help us calibrate our monitoring plan.'],
                [$michael, 'Will do. Also — for activities like swimming and boating, should she keep the pump on? Dr. Gonzalez says the OmniPod is waterproof, but I want your team to know.'],
                [$medical, "Yes, the OmniPod is waterproof (IPX8 rated) and should remain on during all water activities. Staff will be instructed not to attempt removal. We'll have glucose tabs and glucagon kit at the pool at all times during Ava's sessions."],
                [$michael, "Wonderful. I feel so much better knowing this. Last thing — Ava's camp doctor from last summer mentioned a 'buddy system' for kids with diabetes. Does that exist here?"],
                [$admin, "Hi Michael! Yes — we pair medically complex campers with a senior counselor who has additional training. Ava's counselor will be someone who has worked specifically with T1D campers before. We'll make sure she has a great, safe summer!"],
                [$michael, "Thank you both so much. We're so grateful for everything you do. Ava has been counting down the days!"],
            ]
        );

        // 4. Unanswered applicant message — Patricia Davis waiting for reply (tests unread badge)
        $this->makeConversation(
            subject: 'Mia Davis — Heat Protocol Questions',
            creator: $patricia,
            participants: [$admin],
            category: 'general',
            applicationId: null,
            isArchived: false,
            messages: [
                [$patricia, "Good morning, I'm Patricia, Mia's mom. I read in the portal that Mia has a heat restriction documented for camp. I just want to make sure the outdoor activity staff will actually know about this when she arrives. Can you confirm who gets briefed on her restrictions and how the information gets shared with activity counselors? This is really important to us — Mia had a heat crisis at a different program two summers ago and it was very scary."],
                // No admin reply yet — tests "waiting for response" / unread badge state
            ]
        );

        // 5. Internal admin coordination
        $this->makeConversation(
            subject: 'Staff Orientation Logistics — March 14 Attendance Confirmation',
            creator: $admin,
            participants: [$medical],
            category: 'general',
            applicationId: null,
            isArchived: false,
            messages: [
                [$admin, "Hi Morgan — just confirming: you're still presenting the Medication Administration refresher at orientation on March 14, right? We have 18 staff registered and I want to make sure the med room is ready."],
                [$medical, "Yes, I'm confirmed for both the morning medication session (9–10 AM) and the emergency protocol refresher after lunch. I'll bring the updated protocol binders. Do you have an up-to-date count of staff with CPR certification? I want to know how many need to do the renewal module."],
                [$admin, "I'll check with HR and get back to you by end of day Thursday. Also — we now have a camper (Lucas Williams) attending who uses a BiPAP. Can you add a quick 15-minute BiPAP orientation to the schedule? His family is sending the equipment specs in advance."],
                [$medical, "Absolutely, I can add that. I'll prepare a one-page BiPAP basics sheet for staff too. Would 2:15 PM work after the first aid practical?"],
                [$admin, "Perfect. I'll update the agenda and re-send to all registered staff today. Thanks Morgan!"],
            ]
        );

        // 6. Medical2 conversation (if user was seeded)
        if ($medical2) {
            $this->makeConversation(
                subject: 'Sofia Martinez — Catheterization Schedule Coordination',
                creator: $medical2,
                participants: [$medical],
                category: 'medical',
                applicationId: null,
                isArchived: false,
                messages: [
                    [$medical2, "Hi Dr. Chen, this is Jamie. I'm reviewing Sofia Martinez's schedule for tomorrow. Her catheterization is at 4pm which conflicts with the afternoon pool session for her cabin. Should I adjust the pool time or the cath schedule?"],
                    [$medical, "Hi Jamie — always prioritize the catheterization schedule. It cannot be moved without physician consultation. Request the activity coordinator shift Sofia's pool slot to 3pm instead. The protocol is clear: cath schedule takes precedence over all recreational scheduling."],
                    [$medical2, "Understood. I'll coordinate with the activity schedule now and note it in the daily log. Should I notify Sofia's parents about the schedule adjustment?"],
                    [$medical, "Not necessary for a routine scheduling change like this. Parents were briefed on arrival that catheterization schedules take priority. Document the adjustment in the care notes and we're good."],
                ]
            );
        }

        $this->command->line('  Extended messages seeded (medical threads, archived, long thread, unanswered, internal).');
    }

    private function makeConversation(
        string $subject,
        User $creator,
        array $participants,
        string $category,
        ?int $applicationId,
        bool $isArchived,
        array $messages,
    ): ?Conversation {
        if (Conversation::where('subject', $subject)->exists()) {
            return null;
        }

        $conv = Conversation::create([
            'created_by_id' => $creator->id,
            'subject' => $subject,
            'category' => $category,
            'application_id' => $applicationId,
            'last_message_at' => now()->subHours(rand(1, 48)),
            'is_archived' => $isArchived,
        ]);

        $participantIds = array_unique(array_merge(
            [$creator->id],
            array_map(fn (User $u) => $u->id, $participants)
        ));

        foreach ($participantIds as $uid) {
            ConversationParticipant::create([
                'conversation_id' => $conv->id,
                'user_id' => $uid,
                'joined_at' => now()->subDays(rand(1, 10)),
                'is_starred' => false,
                'is_important' => false,
            ]);
        }

        $offsetMinutes = count($messages) * 30;
        foreach ($messages as [$sender, $body]) {
            Message::create([
                'conversation_id' => $conv->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'idempotency_key' => Str::uuid()->toString(),
                'created_at' => now()->subMinutes($offsetMinutes),
                'updated_at' => now()->subMinutes($offsetMinutes),
            ]);
            $offsetMinutes -= rand(10, 40);
            if ($offsetMinutes < 1) {
                $offsetMinutes = 1;
            }
        }

        return $conv;
    }
}
