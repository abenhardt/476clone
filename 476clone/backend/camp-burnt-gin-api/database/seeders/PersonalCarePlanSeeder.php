<?php

namespace Database\Seeders;

use App\Models\Camper;
use App\Models\PersonalCarePlan;
use Illuminate\Database\Seeder;

/**
 * PersonalCarePlanSeeder — ADL (Activities of Daily Living) care plans.
 *
 * Covers all 8 core scenario campers plus 12 supporting campers from the
 * ScaleSeeder to ensure medical portal pages always have meaningful data.
 *
 * ADL Assistance Levels:
 *   independent    — performs task entirely without assistance
 *   verbal_cue     — needs verbal prompts / reminders only
 *   physical_assist — needs hands-on support but participates
 *   full_assist    — staff performs task; camper is a passive participant
 *
 * Intentional variations to test all UI states:
 *   - Clean baseline (Tyler) — tests "no concerns" display
 *   - Partial plan (Lily) — tests partial completion display
 *   - Full complexity (Sofia, Lucas) — tests all ADL fields + catheter/irregular bowel
 *   - Moderate (Ethan, Noah) — tests verbal_cue and physical_assist levels
 *   - Menstruation support (Mia, Ava) — tests gender-sensitive care UI
 *   - G-tube adjacent (Lucas) — sleep notes with BiPAP
 *   - Night wandering (Noah) — tests sleep flag display
 *
 * Safe to re-run — short-circuits if record already exists per camper.
 */
class PersonalCarePlanSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedCoreCampers();
        $this->seedSupportingCampers();
        $this->command->line('  Personal care plans seeded (20 campers, full ADL coverage).');
    }

    // ─── Core scenario campers ────────────────────────────────────────────────

    private function seedCoreCampers(): void
    {
        $plans = $this->corePlans();
        foreach ($plans as $lookup => $plan) {
            [$first, $last] = explode(' ', $lookup, 2);
            $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
            if (! $camper || PersonalCarePlan::where('camper_id', $camper->id)->exists()) {
                continue;
            }
            PersonalCarePlan::create(array_merge(['camper_id' => $camper->id], $plan));
        }
    }

    private function corePlans(): array
    {
        return [

            // ── Ethan Johnson — ASD Level 2 (age 12) ─────────────────────────
            // Verbal and capable but needs structure, prompting, and routine.
            'Ethan Johnson' => [
                'bathing_level' => 'verbal_cue',
                'bathing_notes' => 'Ethan can complete bathing independently but requires verbal prompts for thoroughness ("wash behind ears", "rinse shampoo out"). Allow adequate time; rushing causes shutdown behavior. Preferred shower temperature is warm—not hot. Keep routine consistent with home: wash hair first, then body.',
                'toileting_level' => 'verbal_cue',
                'toileting_notes' => 'Toilets independently. Requires verbal reminder every 2–3 hours as he does not self-initiate when engaged in preferred activities. Will comply without resistance when prompted calmly.',
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue',
                'dressing_notes' => 'Can dress independently but has strong sensory preferences regarding clothing. Tags must be removed. Seams in socks are intolerable — seamless socks provided by family. Will not wear unfamiliar clothing without a transition period. Lay out clothes the evening before.',
                'oral_hygiene_level' => 'physical_assist',
                'oral_hygiene_notes' => 'Requires physical guidance to achieve full oral hygiene. Cannot effectively self-evaluate brushing coverage. Use an electric toothbrush (provided by family) — Ethan tolerates this better than manual. Brushing for 2 full minutes is important; use a visual timer.',
                'positioning_notes' => null,
                'sleep_notes' => 'Has significant difficulty falling asleep in unfamiliar environments. Weighted blanket provided by family is mandatory. White noise machine helpful. Allow 30–45 minutes wind-down time with preferred quiet activity (book or tablet without games). Lights-out no earlier than 9:30pm.',
                'falling_asleep_issues' => true,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => 'Bowel schedule is generally regular. May need verbal cue after meals. No incontinence history.',
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],

            // ── Noah Thompson — Down syndrome (age 13) ────────────────────────
            // Enthusiastic, social. ADL needs vary; night wandering is primary safety concern.
            'Noah Thompson' => [
                'bathing_level' => 'physical_assist',
                'bathing_notes' => 'Requires hands-on assistance for thorough bathing, especially hair washing and back/feet scrubbing. Noah will attempt to rush through; staff must ensure completeness. He loves bath time and will comply happily with familiar routines. Use picture schedule posted at shower station.',
                'toileting_level' => 'verbal_cue',
                'toileting_notes' => 'Uses toilet independently but must be prompted on a schedule — every 2 hours during waking hours. May not self-initiate due to engagement with activities. Can communicate the need to go when it is urgent.',
                'nighttime_toileting' => true,
                'nighttime_notes' => 'Requires nighttime toileting reminders at 11pm and 3am. When not prompted has had occasional wet bedding. Protective underwear recommended for overnight. Night wandering behavior documented — see below.',
                'dressing_level' => 'verbal_cue',
                'dressing_notes' => 'Can dress with verbal cues and patience. Buttons are challenging — velcro closures and elastic waists preferred. May put shirts on backwards; redirect gently with humor.',
                'oral_hygiene_level' => 'physical_assist',
                'oral_hygiene_notes' => 'Needs physical assist for brushing and to ensure adequate coverage. Low muscle tone affects grip on toothbrush. Use pediatric brush with large handle. Noah enjoys the routine when it is framed as "getting ready for fun".',
                'positioning_notes' => 'Standard seating and positioning. No special adaptive equipment needed for meals or activity stations. Can navigate most terrain independently with supervision.',
                'sleep_notes' => 'Noah is a night wanderer. Bed must be positioned near the wall. Cabin door must have an audible chime or alert system. Buddy check at 11pm and 3am strongly recommended. He wanders quietly — does not cry or call out.',
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => true,
                'bowel_control_notes' => 'Generally continent. Irregular bowel schedule — tends toward constipation. High fluid intake required. Monitor for 3+ days without bowel movement; notify nursing.',
                'irregular_bowel' => true,
                'irregular_bowel_notes' => 'Tends toward constipation; typically has 1 bowel movement every 2 days. Ensure 64oz fluid daily. Prune juice at breakfast if no BM in 2 days. Notify nursing if no BM for 3+ days. Miralax in lunch drink authorized per physician order on file.',
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],

            // ── Sofia Martinez — CP + Spina Bifida (age 12) ──────────────────
            // Full physical complexity. High cognitive ability. Urinary catheter.
            'Sofia Martinez' => [
                'bathing_level' => 'full_assist',
                'bathing_notes' => 'Full physical assistance required for all bathing. Sofia has limited upper extremity strength and cannot independently wash hair or reach lower extremities. Uses shower chair (provided — see equipment list). Two-person assist required for transfer to and from shower chair. Water temperature must be tested by staff before Sofia contacts it — reduced sensation in lower extremities means she cannot detect scalding.',
                'toileting_level' => 'full_assist',
                'toileting_notes' => 'Uses clean intermittent catheterization (CIC) for bladder management. Catheterization performed by nursing staff per schedule: every 4 hours during waking hours. Staff performing catheterization must complete CIC competency check-off. Sterile technique required. Supplies in labeled case in med hut.',
                'nighttime_toileting' => true,
                'nighttime_notes' => 'Catheterized at 10pm before sleep and at 6am by nursing staff. No nighttime awakening required for toilet. Bowel program performed each morning before breakfast.',
                'dressing_level' => 'physical_assist',
                'dressing_notes' => 'Can perform upper body dressing with minimal assist if clothing is adaptive (front-snap, wide armholes). Lower body dressing requires physical assist due to spasticity and limited hip mobility. Pants must be loose-fitting with elastic waists. Button/zipper closures not manageable independently.',
                'oral_hygiene_level' => 'physical_assist',
                'oral_hygiene_notes' => 'Can brush front teeth and upper surfaces independently. Requires physical assist for posterior teeth and thorough coverage due to fatigue in hands. Electric toothbrush preferred to reduce effort. Allow 3 minutes.',
                'positioning_notes' => 'Seated positioning: use proper wheelchair support at all activity stations. Postural supports (lateral trunk supports and seat wedge) are part of the TiLite wheelchair configuration — do not remove. For meals, position at height-adjustable table. Lower extremity positioning is critical: feet must be on footrests at all times, not dangling, to prevent contracture. Repositioning every 60–90 minutes when stationary. Pressure relief tilt every 30 minutes.',
                'sleep_notes' => 'Sleeps in bed with side rails (provided or arranged with facility). Overnight positioning: alternating side-lying or supine per physician-prescribed schedule (every 4 hours). Do not position in prone. Pillow supports under knees and ankles help prevent pressure injury. Morning wakeup includes assisted repositioning to seated position before transfer to wheelchair.',
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => 'Neurogenic bowel. Bowel program each morning: suppository inserted by nursing staff, followed by 20–30 minutes seated on commode. Results documented. No prn laxative without physician order. High fiber diet and fluid intake (64oz/day minimum) required for program effectiveness.',
                'irregular_bowel' => true,
                'irregular_bowel_notes' => 'Neurogenic bowel — no voluntary bowel control. Relies entirely on structured morning bowel program with suppository. Regular daily rhythm required; disruptions to schedule cause accidents. Results of morning program MUST be documented in nursing log.',
                'urinary_catheter' => true,
                'menstruation_support' => true,
            ],

            // ── Lucas Williams — Duchenne Muscular Dystrophy (age 14) ─────────
            // Progressive weakness, near-total physical dependency. High cognition.
            'Lucas Williams' => [
                'bathing_level' => 'full_assist',
                'bathing_notes' => 'Full physical assistance required. Lucas has minimal functional upper extremity strength — cannot raise arms above shoulder height without support. Shower chair with full-back support and safety belt required. Two-staff transfer minimum. Water temperature must be checked by staff. Adaptive long-handled sponge and handheld showerhead required. Estimated time: 25–30 minutes including transfer.',
                'toileting_level' => 'full_assist',
                'toileting_notes' => 'Full physical assist for all toileting transfers. Mechanical lift or two-person manual transfer technique required — see transfer protocol binder. Raised toilet seat with side rails required (in accessible cabin bathroom). Lucas is capable of directing his own care clearly. Allow adequate transfer time — do not rush.',
                'nighttime_toileting' => false,
                'nighttime_notes' => 'No nighttime toileting required. BiPAP is active throughout the night — do not reposition without disengaging alarms first. Morning routine begins at 7am with two-person transfer sequence: bed to sitting position → transfer board to wheelchair.',
                'dressing_level' => 'full_assist',
                'dressing_notes' => 'Complete physical assistance required for all dressing. Adaptive clothing strongly recommended (snap sides, open-back shirts). Lucas can indicate preferences and direct staff on clothing selection. Prioritize dignity and privacy throughout; he is 14 and acutely aware of his personal space.',
                'oral_hygiene_level' => 'physical_assist',
                'oral_hygiene_notes' => 'Can hold powered toothbrush independently for brief periods. Requires physical assist to achieve adequate oral hygiene and rinsing. Position slightly reclined in wheelchair for best access. Mouthwash requires suction or assistance due to swallowing precaution risk — confirm current protocol with family at drop-off.',
                'positioning_notes' => 'CRITICAL: Lucas is at high risk for pressure injury due to minimal movement and limited circulation. Pressure relief tilt EVERY 30 MINUTES when in wheelchair. Lateral supports, chest harness, and headrest must be adjusted per the seating prescription in his file. Never leave Lucas unattended in an unsupported position. For all activity transfers, two trained staff minimum. Transfer board and mechanical lift available in med hut.',
                'sleep_notes' => 'BiPAP (ResMed AirCurve) must be verified functioning at all times during sleep — see respiratory protocol. Position: supine with head-of-bed slightly elevated (15–30°). Pillow under knees. Side rails UP. Nursing staff must perform safety check at 10pm, 2am, and 6am: BiPAP function, positioning, skin check. BiPAP alarm means wake nursing immediately.',
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => 'Bowel schedule: every other morning. High-fiber diet and adequate fluids (48oz minimum) required. Constipation is a serious complication given limited mobility — document all bowel movements. Suppository authorized per physician order if no BM in 3 days. Notify family if bowel program is disrupted.',
                'irregular_bowel' => true,
                'irregular_bowel_notes' => 'BM frequency: every 1–2 days. Constipation risk is HIGH due to limited mobility and muscle weakness. Documented at each occurrence. Physician order authorizes Miralax in morning drink and suppository if no BM in 3 days. Notify nursing and family for any BM-related concern.',
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],

            // ── Tyler Wilson — clean baseline (age 12) ────────────────────────
            // Waitlisted. Clean ADL profile — tests "no concerns" display state.
            'Tyler Wilson' => [
                'bathing_level' => 'verbal_cue',
                'bathing_notes' => 'Manages independently with verbal reminders to be thorough. Standard supervision for age.',
                'toileting_level' => 'independent',
                'toileting_notes' => null,
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'independent',
                'dressing_notes' => null,
                'oral_hygiene_level' => 'verbal_cue',
                'oral_hygiene_notes' => 'Reminded to brush for full 2 minutes. No other concerns.',
                'positioning_notes' => null,
                'sleep_notes' => null,
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => null,
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],

            // ── Mia Davis — returning camper (age 11) ─────────────────────────
            // Past approved. 2026 draft. Moderate needs. Menstruation support.
            'Mia Davis' => [
                'bathing_level' => 'physical_assist',
                'bathing_notes' => 'Requires hands-on help with hair washing and back scrubbing. Can manage body washing with verbal prompting. Sensory-sensitive to cold water — keep warm. Familiar with the routine from previous camp years; responds well to the same staff approach used in 2025.',
                'toileting_level' => 'verbal_cue',
                'toileting_notes' => 'Independent with verbal reminders. Toilet schedule: every 2.5 hours. Uses familiar bathroom locations only on first day; orient to new facilities explicitly.',
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue',
                'dressing_notes' => 'Manages dressing with verbal cues. Prefers clothing laid out in order. Will not wear unfamiliar clothing brands — family packs labeled favorites.',
                'oral_hygiene_level' => 'physical_assist',
                'oral_hygiene_notes' => 'Needs physical assist for thoroughness. Likes strawberry-flavored toothpaste (brought from home). Make brushing fun — she responds to counting aloud.',
                'positioning_notes' => null,
                'sleep_notes' => 'Returning camper — adapts well after first night. White noise machine helpful. Sleeps with a small stuffed animal brought from home.',
                'falling_asleep_issues' => true,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => 'Regular schedule. No concerns historically.',
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => true,
            ],

            // ── Ava Williams — approved (age 15) ──────────────────────────────
            // Approved for Session 2. Moderate physical needs + menstruation support.
            'Ava Williams' => [
                'bathing_level' => 'physical_assist',
                'bathing_notes' => 'Requires assistance for hair washing and lower extremity hygiene. Upper body is manageable with verbal prompting. Privacy is extremely important — Ava is 15 and very modest. Female staff only for all personal care.',
                'toileting_level' => 'verbal_cue',
                'toileting_notes' => 'Manages toileting independently with schedule reminders. Female staff available at all times for ADL support.',
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue',
                'dressing_notes' => 'Independent with verbal prompting. Female staff only during dressing. Adaptive clothing not required.',
                'oral_hygiene_level' => 'independent',
                'oral_hygiene_notes' => null,
                'positioning_notes' => null,
                'sleep_notes' => 'Sleeps well. No special accommodations beyond standard supervision.',
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => 'No concerns noted.',
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => true,
            ],

            // ── Henry Carter — paper application (age 10) ─────────────────────
            // Admin-entered paper application. Moderate complexity.
            'Henry Carter' => [
                'bathing_level' => 'physical_assist',
                'bathing_notes' => 'Requires physical assistance for bathing. Father (James) noted Henry has tactile sensitivities — avoid rough washcloths. Shower only, not bath submersion.',
                'toileting_level' => 'verbal_cue',
                'toileting_notes' => 'Independent with verbal cues every 2 hours. No incontinence.',
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue',
                'dressing_notes' => 'Dresses independently with verbal prompting. Takes longer than peers — allow extra time. Shoe tying requires adult assistance.',
                'oral_hygiene_level' => 'verbal_cue',
                'oral_hygiene_notes' => 'Can brush independently with reminders for duration and coverage.',
                'positioning_notes' => null,
                'sleep_notes' => 'Henry needs a consistent bedtime routine. Prefers lights fully off. Reads independently if given 15 minutes before lights-out.',
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => null,
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],

            // ── Lily Johnson — standard profile (age 9) ───────────────────────
            // Pending. Partial ADL record — tests incomplete plan UI state.
            'Lily Johnson' => [
                'bathing_level' => 'verbal_cue',
                'bathing_notes' => 'Manages with verbal prompting. Standard for age.',
                'toileting_level' => 'independent',
                'toileting_notes' => null,
                'nighttime_toileting' => false,
                'nighttime_notes' => null,
                'dressing_level' => 'independent',
                'dressing_notes' => null,
                'oral_hygiene_level' => 'verbal_cue',
                'oral_hygiene_notes' => null,
                'positioning_notes' => null,
                'sleep_notes' => null,
                'falling_asleep_issues' => false,
                'sleep_walking' => false,
                'night_wandering' => false,
                'bowel_control_notes' => null,
                'irregular_bowel' => false,
                'irregular_bowel_notes' => null,
                'urinary_catheter' => false,
                'menstruation_support' => false,
            ],
        ];
    }

    // ─── Supporting campers (from ScaleSeeder — first 12 in order) ────────────

    private function seedSupportingCampers(): void
    {
        $plans = $this->supportingPlans();
        foreach ($plans as $lookup => $plan) {
            [$first, $last] = explode(' ', $lookup, 2);
            $camper = Camper::where('first_name', $first)->where('last_name', $last)->first();
            if (! $camper || PersonalCarePlan::where('camper_id', $camper->id)->exists()) {
                continue;
            }
            PersonalCarePlan::create(array_merge(['camper_id' => $camper->id], $plan));
        }
    }

    private function supportingPlans(): array
    {
        return [

            // Marcus Brown — ASD Level 1, moderate independence
            'Marcus Brown' => [
                'bathing_level' => 'verbal_cue', 'bathing_notes' => 'Prompting for thoroughness only.',
                'toileting_level' => 'independent', 'toileting_notes' => null,
                'nighttime_toileting' => false, 'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue', 'dressing_notes' => 'Sensitive to seams; seamless socks required.',
                'oral_hygiene_level' => 'verbal_cue', 'oral_hygiene_notes' => null,
                'positioning_notes' => null, 'sleep_notes' => 'Difficulty with first night in new places. White noise helps.',
                'falling_asleep_issues' => true, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => null, 'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],

            // Camila Reyes — Intellectual Disability, supported independence
            'Camila Reyes' => [
                'bathing_level' => 'physical_assist', 'bathing_notes' => 'Hands-on assist required. Spanish is primary language — use bilingual communication card posted at bathroom station.',
                'toileting_level' => 'verbal_cue', 'toileting_notes' => 'Spanish verbal prompts preferred. Every 2 hours.',
                'nighttime_toileting' => false, 'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue', 'dressing_notes' => null,
                'oral_hygiene_level' => 'physical_assist', 'oral_hygiene_notes' => null,
                'positioning_notes' => null, 'sleep_notes' => null,
                'falling_asleep_issues' => false, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => null, 'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => true,
            ],

            // Jordan Lee — Spina Bifida, catheter
            'Jordan Lee' => [
                'bathing_level' => 'physical_assist', 'bathing_notes' => 'Shower chair required. Physical assist for lower body. Reduced sensation below waist — check water temp before contact.',
                'toileting_level' => 'full_assist', 'toileting_notes' => 'CIC every 4 hours. Female nursing staff for catheterization. Supplies in labeled kit.',
                'nighttime_toileting' => true, 'nighttime_notes' => 'Catheterized at 10pm and 6am.',
                'dressing_level' => 'physical_assist', 'dressing_notes' => 'Lower body full assist. Upper body verbal cue.',
                'oral_hygiene_level' => 'verbal_cue', 'oral_hygiene_notes' => null,
                'positioning_notes' => 'Adapted seating at activity tables. Pressure relief every 30 min.',
                'sleep_notes' => null,
                'falling_asleep_issues' => false, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => 'Morning bowel program: seated on commode 30 min after breakfast. Document results.',
                'irregular_bowel' => true, 'irregular_bowel_notes' => 'Neurogenic bowel. Structured morning program required. Suppository authorized per physician order.',
                'urinary_catheter' => true, 'menstruation_support' => true,
            ],

            // Devon Patel — ADHD + Anxiety, mostly independent
            'Devon Patel' => [
                'bathing_level' => 'verbal_cue', 'bathing_notes' => 'Reminders only. May rush — redirect to complete routine.',
                'toileting_level' => 'independent', 'toileting_notes' => null,
                'nighttime_toileting' => false, 'nighttime_notes' => null,
                'dressing_level' => 'independent', 'dressing_notes' => null,
                'oral_hygiene_level' => 'verbal_cue', 'oral_hygiene_notes' => null,
                'positioning_notes' => null, 'sleep_notes' => 'Anxiety may delay sleep. Allow preferred quiet activity (reading) for 20 min before lights-out. No screens.',
                'falling_asleep_issues' => true, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => null, 'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],

            // Isabelle Nguyen — cerebral palsy, hemiplegic, moderate
            'Isabelle Nguyen' => [
                'bathing_level' => 'physical_assist', 'bathing_notes' => 'Right-side hemiplegia. Assist with right-side washing and hair. Left arm functional. Grab bars required.',
                'toileting_level' => 'verbal_cue', 'toileting_notes' => 'Independent with accessible bathroom fixtures.',
                'nighttime_toileting' => false, 'nighttime_notes' => null,
                'dressing_level' => 'physical_assist', 'dressing_notes' => 'Dress affected right arm first. Elastic waists only. No buttons.',
                'oral_hygiene_level' => 'verbal_cue', 'oral_hygiene_notes' => 'Manages with non-dominant left hand. Allow extra time.',
                'positioning_notes' => 'Adaptive seating cushion at meals. Right-side hand splint worn at meals and structured activities — see OT note.',
                'sleep_notes' => null,
                'falling_asleep_issues' => false, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => null, 'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],

            // Tyler Anderson — autism Level 2, similar to Ethan
            'Tyler Anderson' => [
                'bathing_level' => 'verbal_cue', 'bathing_notes' => 'Picture schedule at shower. Dislikes getting face wet.',
                'toileting_level' => 'verbal_cue', 'toileting_notes' => 'Every 2 hours prompt.',
                'nighttime_toileting' => false, 'nighttime_notes' => null,
                'dressing_level' => 'verbal_cue', 'dressing_notes' => 'Sensory preferences. No tags. Weighted clothing acceptable.',
                'oral_hygiene_level' => 'physical_assist', 'oral_hygiene_notes' => 'Needs hand-over-hand guidance. Electric toothbrush required.',
                'positioning_notes' => null, 'sleep_notes' => 'Weighted blanket from home mandatory. Quiet environment required.',
                'falling_asleep_issues' => true, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => null, 'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],

            // Priya Sharma — Down syndrome, moderate needs
            'Priya Sharma' => [
                'bathing_level' => 'physical_assist', 'bathing_notes' => 'Full hair-wash assist. Body wash with verbal cue.',
                'toileting_level' => 'verbal_cue', 'toileting_notes' => 'Prompt schedule every 2 hrs.',
                'nighttime_toileting' => true, 'nighttime_notes' => 'Protective underwear overnight. 11pm prompt.',
                'dressing_level' => 'verbal_cue', 'dressing_notes' => 'Velcro closures preferred.',
                'oral_hygiene_level' => 'physical_assist', 'oral_hygiene_notes' => null,
                'positioning_notes' => null, 'sleep_notes' => null,
                'falling_asleep_issues' => false, 'sleep_walking' => false, 'night_wandering' => false,
                'bowel_control_notes' => 'Monitor for constipation. 2+ glasses water with each meal.',
                'irregular_bowel' => true, 'irregular_bowel_notes' => 'Intermittent constipation; ensure adequate hydration. Notify nursing if no BM for 2+ days.',
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],

            // Caleb Freeman — autism Level 3, one-to-one support
            'Caleb Freeman' => [
                'bathing_level' => 'full_assist', 'bathing_notes' => 'Full assist required. Significant tactile defensiveness — use gloves, avoid harsh pressure, use soft washcloth only. Pre-warn each step with consistent verbal cue ("washing arm now"). Two-staff for shower transfers. Expect protest behavior — use calm voice throughout.',
                'toileting_level' => 'full_assist', 'toileting_notes' => 'Toileting schedule strictly every 90 min. Requires full assist and consistent cueing. Staff must use visual schedule board.',
                'nighttime_toileting' => true, 'nighttime_notes' => 'Protective underwear. 2am check for wet bedding.',
                'dressing_level' => 'full_assist', 'dressing_notes' => 'Full assist. Heavy sensory preferences — only family-provided clothing. Do not substitute.',
                'oral_hygiene_level' => 'full_assist', 'oral_hygiene_notes' => 'Resists oral hygiene — use gradual desensitization approach per family guidance. Start with gum massage before brush.',
                'positioning_notes' => 'Weighted vest during transitions and structured activities. Sensory break corner with bean bag available in cabin.',
                'sleep_notes' => 'Highly individualized routine. Family-provided pillow and blanket mandatory. White noise machine. Room must be dark. No deviation from routine without family consultation.',
                'falling_asleep_issues' => true, 'sleep_walking' => false, 'night_wandering' => true,
                'bowel_control_notes' => 'Scheduled toileting has maintained continence. Prompt strictly or accident risk is high.',
                'irregular_bowel' => false, 'irregular_bowel_notes' => null,
                'urinary_catheter' => false, 'menstruation_support' => false,
            ],
        ];
    }
}
