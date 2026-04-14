<?php

namespace Database\Seeders;

use App\Models\AssistiveDevice;
use App\Models\BehavioralProfile;
use App\Models\Camper;
use App\Models\FeedingPlan;
use Illuminate\Database\Seeder;

/**
 * Seeder — behavioral profiles, assistive devices, and feeding plans.
 *
 * Covers campers with complex behavioral, mobility, and nutritional needs.
 * Not all campers have behavioral profiles — only those with documented
 * behavioral support requirements.
 *
 * Feeding plans are seeded for campers who have G-tube or other special
 * nutritional requirements beyond standard dietary restrictions.
 *
 * Assistive devices are seeded for campers who use mobility, communication,
 * or medical equipment.
 */
class BehavioralProfileSeeder extends Seeder
{
    public function run(): void
    {
        $this->profileEthan();
        $this->profileEmma();
        $this->profileChloe();
        $this->profileNathan();
        $this->profilePenelope();
        $this->profileJayden();
        $this->profileMason();
        $this->profileLiam();
        $this->profileCaleb();

        $this->feedingEmma();
        $this->feedingChloe();
        $this->feedingCarlos();
        $this->feedingOlivia();

        $this->devicesLucas();
        $this->devicesSofia();
        $this->devicesWyatt();
        $this->devicesEmma();
        $this->devicesCarlos();
        $this->devicesElijah();
        $this->devicesAva();

        $this->command->line('  Behavioral profiles, feeding plans, and assistive devices seeded.');
    }

    // ── Behavioral Profiles ───────────────────────────────────────────────────

    private function profileEthan(): void
    {
        $c = Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => true,
            'functioning_age_level' => '9–10 years',
            'communication_methods' => ['verbal', 'visual_schedule', 'pecs'],
            'notes' => 'Ethan needs 5-minute transition warnings. He may vocally protest changes but self-regulates within 10–15 minutes when given space. Preferred de-escalation: quiet corner with stress ball and visual timer. Do not rush him.',
            // Parity flags deliberately left null — FormParitySeeder owns these for the
            // 6 core family campers (Ethan, Noah, Sofia, Lucas, Tyler, Mia) and will
            // backfill them with full clinical descriptions.
        ]);
    }

    private function profileEmma(): void
    {
        $c = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => true,
            'developmental_delay' => true,
            'functioning_age_level' => '18 months',
            'communication_methods' => ['pecs', 'eye_gaze', 'vocalization', 'facial_expression'],
            'notes' => 'Emma requires 1:1 supervision at all times. Hand stereotypies (hand-wringing) are constant — this is a Rett syndrome feature, not distress. Music activates positive engagement. Respond to crying/distress by checking positioning, feeding schedule, and pain signs.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => false,
            'follows_instructions_description' => 'Emma is non-verbal and functioning at approximately an 18-month developmental level. She does not follow multi-step verbal instructions. Respond to her communicative signals (eye gaze, vocalization, facial expression) rather than issuing verbal directives.',
            'group_participation' => false,
            'group_participation_description' => 'Emma can be present in group settings with 1:1 staff support but does not actively participate in group activities. Music-based group activities produce positive engagement — she will track sounds and display positive affect.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profileChloe(): void
    {
        $c = Camper::where('first_name', 'Chloe')->where('last_name', 'Rodriguez')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => true,
            'developmental_delay' => true,
            'functioning_age_level' => '6 months',
            'communication_methods' => ['vocalization', 'facial_expression', 'eye_gaze'],
            'notes' => 'Chloe is non-ambulatory and non-verbal. She communicates via eye gaze (up = yes, down/away = no). She responds to music, bright colors, and wind (enjoys fan airflow on face). Repositioning required every 2 hours to prevent pressure injury.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => false,
            'follows_instructions_description' => 'Chloe is non-verbal and functioning at approximately a 6-month developmental level. She does not follow verbal instructions. Staff should interpret her communicative signals: eye gaze up = yes, down/away = no.',
            'group_participation' => true,
            'group_participation_description' => 'Chloe can participate in sensory-based group activities (music, art, water play) from her wheelchair with 1:1 support. She responds positively to music and environmental stimulation in group settings.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profileNathan(): void
    {
        $c = Camper::where('first_name', 'Nathan')->where('last_name', 'Roberts')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => true,
            'wandering_description' => 'Nathan wanders toward novel stimuli — particularly water, animals, and open paths — without awareness of boundaries. Elopement is curiosity-driven, not distress-driven. Line-of-sight supervision is mandatory during all outdoor transitions.',
            'one_to_one_supervision' => false,
            'developmental_delay' => true,
            'functioning_age_level' => '6 years',
            'communication_methods' => ['verbal_simple', 'pecs'],
            'notes' => 'Nathan wanders — particularly when tired or over-stimulated. He must have line-of-sight supervision at all outdoor activities. He responds to his name and "stop" commands reliably when calm. Fever is primary seizure trigger — check temperature if he seems off.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => true,
            'follows_instructions_description' => 'Follows simple one-step verbal instructions reliably when calm. Responds well to his name and the command "stop." Two-step or complex instructions require pairing with a gesture or PECS card.',
            'group_participation' => true,
            'group_participation_description' => 'Enthusiastic group participant who enjoys high-energy group activities. Monitor for overstimulation (increased vocal volume is early sign) — redirect to quiet buddy walk before full dysregulation.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profilePenelope(): void
    {
        $c = Camper::where('first_name', 'Penelope')->where('last_name', 'Campbell')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => true,
            'self_abuse_description' => 'Penelope bites her wrists when overwhelmed. De-escalation: remove immediately from trigger environment, offer ear defenders, provide "Plum" (purple stuffed rabbit). Do NOT redirect verbally during meltdown — wait. Self-regulates in 5–15 minutes.',
            'wandering_risk' => true,
            'wandering_description' => 'Penelope may elope when highly distressed. Primary risk is during or immediately after meltdown when she seeks to escape stimulation. 1:1 supervision prevents this.',
            'one_to_one_supervision' => true,
            'one_to_one_description' => '1:1 required throughout all camp activities and overnight. Food security protocols require knowing Penelope\'s location at all mealtimes.',
            'developmental_delay' => true,
            'functioning_age_level' => '3–4 years',
            'communication_methods' => ['pecs', 'aac_device', 'gestures'],
            'notes' => 'Penelope bites her wrists when overwhelmed. De-escalation: immediate removal from trigger environment, offer ear defenders, provide preferred object (purple stuffed rabbit named "Plum"). Do NOT attempt to redirect verbally during meltdown — wait. She will self-regulate in 5–15 minutes. Any food exposure outside scheduled meals is a behavioral trigger — food security is absolute.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => true,
            'social_emotional_description' => 'Becomes severely overwhelmed in high-stimulation environments, leading to meltdowns and self-abusive behavior. Food exposure outside scheduled meals is an absolute trigger. Ear defenders and preferred object ("Plum") are the primary calming supports. Do not attempt verbal redirection during active meltdown.',
            'follows_instructions' => true,
            'follows_instructions_description' => 'Follows simple instructions via AAC device or PECS when regulated. During meltdown state, no instruction-following is possible — wait for self-regulation before engaging.',
            'group_participation' => false,
            'group_participation_description' => 'Cannot participate in unstructured or food-adjacent group activities due to trigger risk. Small structured groups of 2–3 campers (no food present) are manageable with 1:1 support.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profileJayden(): void
    {
        $c = Camper::where('first_name', 'Jayden')->where('last_name', 'Taylor')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => true,
            'functioning_age_level' => '7–8 years',
            'communication_methods' => ['verbal_scripted', 'pecs', 'gestures'],
            'notes' => 'Jayden communicates in scripted phrases. He may repeat movie/TV dialogue — this is language, not gibberish. Join his script to establish rapport. Loud sudden sounds cause significant distress. Notify 10 minutes before any activity transition.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => true,
            'social_emotional_description' => 'Loud sudden sounds cause significant distress and behavioral dysregulation. Transitions must be announced 10 minutes in advance. Scripted TV/movie dialogue is his primary communication — join the script to build rapport rather than correcting or redirecting it.',
            'follows_instructions' => true,
            'follows_instructions_description' => 'Follows instructions best when delivered calmly and with advance notice. Does not respond well to urgency. Scripted routines with familiar language support compliance significantly.',
            'group_participation' => true,
            'group_participation_description' => 'Can participate in small structured groups (4–6 campers). Large groups or settings with unpredictable sound (assemblies, pool events with PA) cause sensory overload and behavioral regression.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profileMason(): void
    {
        $c = Camper::where('first_name', 'Mason')->where('last_name', 'Lewis')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => true,
            'functioning_age_level' => '7–9 years',
            'communication_methods' => ['verbal', 'visual_schedule'],
            'notes' => 'Mason benefits greatly from visual daily schedule. He resets well with schedule review. Mealtimes must be on schedule — delayed meals cause escalating distress. He responds well to logical explanations delivered calmly.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => true,
            'follows_instructions_description' => 'Follows instructions reliably when paired with a visual daily schedule. Verbal-only instructions for novel tasks are less reliable. Mealtime schedule adherence is critical — delays cause escalating anxiety and refusal.',
            'group_participation' => true,
            'group_participation_description' => 'Participates well in structured group activities when the schedule is predictable. Responds positively to logical explanations from calm staff. Thrives with a consistent daily routine shared by the whole group.',
            'attends_school' => true,
            'classroom_type' => 'Resource room',
        ]);
    }

    private function profileLiam(): void
    {
        $c = Camper::where('first_name', 'Liam')->where('last_name', 'Young')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => true,
            'one_to_one_description' => '1:1 required for all activities. Liam is non-ambulatory and requires full staff support for positioning, transfers, and participation in all activities.',
            'developmental_delay' => true,
            'functioning_age_level' => '12–18 months',
            'communication_methods' => ['vocalization', 'facial_expression', 'gestures'],
            'notes' => 'Liam expresses happiness frequently — his signature happy laugh is infectious. He signals discomfort with a low whimper. Position him near music sources for maximum engagement. He fascination with water — sensory water play is a preferred activity.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => false,
            'follows_instructions' => false,
            'follows_instructions_description' => 'Liam is functioning at a 12–18 month developmental level. He does not follow verbal instructions. Respond to his communicative cues: happy vocalizations and laughter indicate engagement; low whimper indicates discomfort.',
            'group_participation' => true,
            'group_participation_description' => 'Can be included in music and sensory group activities with 1:1 support. Responds joyfully to music and water play in group settings. Position near other campers for incidental social engagement.',
            'attends_school' => true,
            'classroom_type' => 'Self-contained',
        ]);
    }

    private function profileCaleb(): void
    {
        $c = Camper::where('first_name', 'Caleb')->where('last_name', 'Phillips')->firstOrFail();
        if (BehavioralProfile::where('camper_id', $c->id)->exists()) {
            return;
        }
        BehavioralProfile::create([
            'camper_id' => $c->id,
            'aggression' => false,
            'self_abuse' => false,
            'wandering_risk' => false,
            'one_to_one_supervision' => false,
            'developmental_delay' => false,
            'functioning_age_level' => null,
            'communication_methods' => ['verbal'],
            'notes' => 'Caleb is cognitively normal. PANDAS behavioral symptoms (OCD rituals, emotional lability) are currently in remission. If he becomes unexpectedly distressed or begins ritualistic behaviors, check for fever first — this may signal a strep exposure. Contact nurse and parent immediately if PANDAS symptoms emerge.',
            'sexual_behaviors' => false,
            'interpersonal_behavior' => false,
            'social_emotional' => true,
            'social_emotional_description' => 'PANDAS symptoms currently in remission. If unexpected distress or OCD rituals (counting, ordering, repetitive checking) emerge, check temperature immediately — fever may signal a strep exposure and active PANDAS flare. Contact nurse and parent immediately; do not manage as a behavioral issue alone.',
            'follows_instructions' => true,
            'group_participation' => true,
            'attends_school' => true,
            'classroom_type' => 'General education',
        ]);
    }

    // ── Feeding Plans ─────────────────────────────────────────────────────────

    private function feedingEmma(): void
    {
        $c = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        if (FeedingPlan::where('camper_id', $c->id)->exists()) {
            return;
        }
        FeedingPlan::create([
            'camper_id' => $c->id,
            'special_diet' => true,
            'diet_description' => 'G-tube feeder — 100% nutrition via gastrostomy tube. No oral feeding. Jevity 1.5 Cal formula. Bolus feedings 5x daily.',
            'g_tube' => true,
            'formula' => 'Jevity 1.5 Cal (Ross Nutrition)',
            'amount_per_feeding' => '240mL',
            'feedings_per_day' => 5,
            'feeding_times' => ['7:00', '10:30', '13:00', '16:30', '20:00'],
            'bolus_only' => true,
            'notes' => 'Family provides formula. 30° head elevation during and 30 min after each feeding. Flush tube with 20mL water before and after medication administration. Contact nurse if feeding intolerance (vomiting, distension, diarrhea).',
        ]);
    }

    private function feedingChloe(): void
    {
        $c = Camper::where('first_name', 'Chloe')->where('last_name', 'Rodriguez')->firstOrFail();
        if (FeedingPlan::where('camper_id', $c->id)->exists()) {
            return;
        }
        FeedingPlan::create([
            'camper_id' => $c->id,
            'special_diet' => true,
            'diet_description' => 'G-tube feeder — 100% enteral nutrition. Pediasure 1.5 Cal. Gravity drip over 30 minutes each feeding. Strict NPO — no oral nutrition.',
            'g_tube' => true,
            'formula' => 'Pediasure 1.5 Cal (Abbott)',
            'amount_per_feeding' => '240mL over 30 minutes',
            'feedings_per_day' => 5,
            'feeding_times' => ['7:30', '11:00', '13:30', '16:30', '20:00'],
            'bolus_only' => false,
            'notes' => 'Gravity drip — hang bag at appropriate height. Head of bed 30° during and 45 min after feedings. No oral food or fluids — aspiration risk. Tube flush 20mL water pre/post medication and feeding.',
        ]);
    }

    private function feedingCarlos(): void
    {
        $c = Camper::where('first_name', 'Carlos')->where('last_name', 'Rivera')->firstOrFail();
        if (FeedingPlan::where('camper_id', $c->id)->exists()) {
            return;
        }
        FeedingPlan::create([
            'camper_id' => $c->id,
            'special_diet' => true,
            'diet_description' => 'Mixed feeder — oral meals (breakfast, lunch, dinner) with thin liquids. Supplemental G-tube feed at bedtime for additional calories. Nutren 1.5 Cal.',
            'g_tube' => true,
            'formula' => 'Nutren 1.5 Cal (Nestlé)',
            'amount_per_feeding' => '240mL',
            'feedings_per_day' => 1,
            'feeding_times' => ['21:00'],
            'bolus_only' => true,
            'notes' => 'Carlos eats regular meals orally — G-tube only for nighttime supplementation. He is independent with oral eating. Ensure tube is properly flushed before and after nighttime feed. Carlos can direct staff on his tube care.',
        ]);
    }

    private function feedingOlivia(): void
    {
        $c = Camper::where('first_name', 'Olivia')->where('last_name', 'Lee')->firstOrFail();
        if (FeedingPlan::where('camper_id', $c->id)->exists()) {
            return;
        }
        FeedingPlan::create([
            'camper_id' => $c->id,
            'special_diet' => true,
            'diet_description' => 'Mixed feeder — regular oral diet during the day. Supplemental G-tube feed at night for caloric boost.',
            'g_tube' => true,
            'formula' => 'Pediasure 1.5 Cal (Abbott)',
            'amount_per_feeding' => '240mL',
            'feedings_per_day' => 1,
            'feeding_times' => ['21:00'],
            'bolus_only' => true,
            'notes' => 'Olivia eats all regular camp meals orally without restriction. Bedtime G-tube supplement only. Head of bed elevated during feed.',
        ]);
    }

    // ── Assistive Devices ─────────────────────────────────────────────────────

    private function devicesLucas(): void
    {
        $c = Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Power Wheelchair', 'notes' => 'Permobil M3 power wheelchair. Tilt-in-space function for pressure relief. Charging required nightly.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'BiPAP Machine', 'notes' => 'ResMed BiPAP — IPAP 14 / EPAP 8. Full face mask. Required every night. Family provides equipment.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Cough Assist Device', 'notes' => 'CoughAssist E70 — settings on file. Use during respiratory illness or when unable to clear secretions.']);
    }

    private function devicesSofia(): void
    {
        $c = Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Manual Wheelchair', 'notes' => 'Quickie Q7 manual wheelchair. Folding frame. Sofia can propel short distances independently.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Rollator Walker', 'notes' => 'Used for short indoor distances (cabin to bathroom). Sofia transfers to wheelchair for longer distances.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Catheterization Supplies', 'notes' => 'Latex-free intermittent catheters (size 10Fr). Performed every 4 hours by trained staff. Supplies provided by family.']);
    }

    private function devicesWyatt(): void
    {
        $c = Camper::where('first_name', 'Wyatt')->where('last_name', 'Mitchell')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Forearm Crutches', 'notes' => 'Lofstrand forearm crutches for primary ambulation. Wyatt is fully independent with these.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Manual Wheelchair', 'notes' => 'For longer distances or when fatigued. Wyatt self-propels independently.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Catheterization Supplies', 'notes' => 'Latex-free CIC supplies every 4 hours. Wyatt self-catheterizes with privacy.']);
    }

    private function devicesEmma(): void
    {
        $c = Camper::where('first_name', 'Emma')->where('last_name', 'Anderson')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Power Wheelchair', 'notes' => 'Permobil M1 pediatric. Tilt and recline for positioning. Emma directed by caregiver — does not self-propel.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Vagus Nerve Stimulator (VNS)', 'notes' => 'Implanted VNS Model 106. Magnet sweep protocol: swipe magnet over device for 1–2 seconds at seizure onset. Magnet kept in Emma\'s fanny pack at all times.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'TLSO Brace', 'notes' => 'Thoracolumbar spinal orthosis for scoliosis. Worn during all waking hours except bathing. Staff must check skin under brace daily.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'G-Tube (Gastrostomy)', 'notes' => 'MIC-KEY 14Fr G-tube. Bolus feedings per feeding plan. Family-trained nurse must prime and administer.']);
    }

    private function devicesCarlos(): void
    {
        $c = Camper::where('first_name', 'Carlos')->where('last_name', 'Rivera')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Power Wheelchair', 'notes' => 'Permobil C500 — tilts, reclines, elevating legs. Carlos is an expert user. Do not operate without his direction.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'BiPAP Machine', 'notes' => 'Nighttime BiPAP. Family provides device. Settings: IPAP 16 / EPAP 10. Interface: nasal mask.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Cough Assist Device', 'notes' => 'For use during respiratory illness. Carlos directs use himself.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'G-Tube (Gastrostomy)', 'notes' => 'MIC-KEY 14Fr. Supplemental nighttime feeding only. Carlos manages tube care himself.']);
    }

    private function devicesElijah(): void
    {
        $c = Camper::where('first_name', 'Elijah')->where('last_name', 'Green')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Airway Clearance Vest', 'notes' => 'SmartVest HFCWO therapy device. Used twice daily (7am and 7pm) for 20 minutes each. Elijah sets up independently.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Nebulizer', 'notes' => 'PARI LC Sprint nebulizer for albuterol treatments before vest therapy. Elijah self-administers.']);
    }

    private function devicesAva(): void
    {
        $c = Camper::where('first_name', 'Ava')->where('last_name', 'Williams')->firstOrFail();
        if (AssistiveDevice::where('camper_id', $c->id)->exists()) {
            return;
        }
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Insulin Pump (OmniPod)', 'notes' => 'OmniPod DASH tubeless insulin pump — right upper arm. Do not remove or alter. CGM-integrated. Ava manages her pump under nurse supervision.']);
        AssistiveDevice::create(['camper_id' => $c->id, 'device_type' => 'Continuous Glucose Monitor (Dexcom G7)', 'notes' => 'Dexcom G7 CGM — left upper arm. Alarms share to nurse\'s phone. Do not remove. Receiver kept at nursing station.']);
    }
}
