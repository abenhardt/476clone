<?php

namespace Database\Seeders;

use App\Models\Camper;
use App\Models\EmergencyContact;
use Illuminate\Database\Seeder;

/**
 * Seeder — secondary and edge-case emergency contacts.
 *
 * The base ApplicantSeeder seeds exactly one primary emergency contact per camper
 * with is_authorized_pickup=true. This seeder adds:
 *
 *   - Secondary contacts (is_primary=false) for campers with complex care needs
 *   - Non-pickup contacts (is_authorized_pickup=false) to test that filter
 *   - Contacts with secondary phone numbers (phone_secondary populated)
 *   - Contacts with no email address (null email — tests nullable UI state)
 *
 * Camper-contact additions:
 *   Ethan Johnson:   2nd contact — Aunt Karen Hill (not authorized pickup)
 *   Sofia Martinez:  2nd contact — Medical proxy — clinic coordinator
 *   Noah Thompson:   2nd contact — School nurse (emergency only, not pickup)
 *   Lucas Williams:  2nd contact — Respite care coordinator
 *   Mia Davis:       2nd contact — Grandmother (authorized pickup)
 *   Tyler Wilson:    2nd contact — Daniel Wilson's employer (emergency contact only)
 *
 * Safe to re-run — skips if any secondary contact already exists for camper.
 */
class ExtendedEmergencyContactSeeder extends Seeder
{
    public function run(): void
    {
        $campers = [
            'ethan' => Camper::where('first_name', 'Ethan')->where('last_name', 'Johnson')->firstOrFail(),
            'sofia' => Camper::where('first_name', 'Sofia')->where('last_name', 'Martinez')->firstOrFail(),
            'noah' => Camper::where('first_name', 'Noah')->where('last_name', 'Thompson')->firstOrFail(),
            'lucas' => Camper::where('first_name', 'Lucas')->where('last_name', 'Williams')->firstOrFail(),
            'mia' => Camper::where('first_name', 'Mia')->where('last_name', 'Davis')->firstOrFail(),
            'tyler' => Camper::where('first_name', 'Tyler')->where('last_name', 'Wilson')->firstOrFail(),
        ];

        $secondaryContacts = [
            'ethan' => [
                'name' => 'Karen Hill',
                'relationship' => 'Aunt',
                'phone_primary' => '803-555-0201',
                'phone_secondary' => null,
                'email' => 'karen.hill@example.com',
                'is_primary' => false,
                'is_authorized_pickup' => false,   // NOT authorized — tests filter
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ],
            'sofia' => [
                'name' => 'Marta Reyes (Medical Proxy)',
                'relationship' => 'Clinical Coordinator',
                'phone_primary' => '803-555-0212',
                'phone_secondary' => '803-555-0213',
                'phone_work' => '803-555-0214',
                'email' => 'mreyes@pediatric-rehab.example.com',
                'is_primary' => false,
                'is_authorized_pickup' => false,
                'primary_language' => 'Spanish',  // Medical proxy for Spanish-speaking family
                'interpreter_needed' => true,
            ],
            'noah' => [
                'name' => 'Beverly Green',
                'relationship' => 'School Nurse',
                'phone_primary' => '803-555-0223',
                'phone_secondary' => null,
                'email' => null,   // no email — tests nullable email state
                'is_primary' => false,
                'is_authorized_pickup' => false,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ],
            'lucas' => [
                'name' => 'Care Coordination Office — Palmetto Respite',
                'relationship' => 'Respite Care Agency',
                'phone_primary' => '803-555-0234',
                'phone_secondary' => '803-555-0235',
                'phone_work' => '803-555-0236',
                'email' => 'intake@palmettorespite.example.org',
                'is_primary' => false,
                'is_authorized_pickup' => false,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ],
            'mia' => [
                'name' => 'Dorothy Davis',
                'relationship' => 'Grandmother',
                'phone_primary' => '803-555-0245',
                'phone_secondary' => '803-555-0246',
                'email' => null,   // elderly relative without email
                'is_primary' => false,
                'is_authorized_pickup' => true,   // IS authorized pickup
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ],
            'tyler' => [
                'name' => 'Wilson Lumber Supply (Daniel Wilson — work)',
                'relationship' => 'Father\'s Employer',
                'phone_primary' => '803-555-0179',
                'phone_work' => '803-555-0180',
                'phone_secondary' => null,
                'email' => null,
                'is_primary' => false,
                'is_authorized_pickup' => false,
                'primary_language' => 'English',
                'interpreter_needed' => false,
            ],
        ];

        foreach ($secondaryContacts as $key => $contactData) {
            $camper = $campers[$key];

            // Only add if we have exactly 1 contact (the primary from ApplicantSeeder)
            $count = EmergencyContact::where('camper_id', $camper->id)->count();
            if ($count >= 2) {
                continue;  // already has secondary, skip
            }

            EmergencyContact::create(array_merge($contactData, [
                'camper_id' => $camper->id,
            ]));
        }

        $this->command->line('  Extended emergency contacts seeded (secondary contacts, non-pickup contacts).');
    }
}
