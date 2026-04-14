<?php

namespace Database\Seeders;

use App\Models\Camper;
use App\Models\EmergencyContact;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * FamilySeeder — 31 applicant families, 35 campers, emergency contacts.
 *
 * ─── SCENARIO-DRIVEN FAMILIES ───────────────────────────────────────────────
 *
 *   Core families (scenario-documented in ApplicationSeeder):
 *     1. Johnson     — returning family, 2 children, split outcomes (Ethan approved + Lily pending)
 *     2. Martinez    — single child, complex physical disability, under review
 *     3. Thompson    — single child, rejected S1 → reapplied S2
 *     4. Williams    — 2 children, different medical complexity, split sessions
 *     5. Davis       — returning family, past approved + 2026 draft
 *     6. Wilson      — Tyler waitlisted for Session 1 (capacity constraint)
 *     7. Carter      — paper application family (admin manual-entry workflow)
 *
 *   Supporting families (provide admin dashboard density and realistic filtering):
 *     8–31. South Carolina families across Columbia, Charleston, and Greenville
 *           with varied supervision levels, multi-child households, and diverse
 *           emergency contact structures.
 *
 * ─── SUPERVISION LEVEL DISTRIBUTION ────────────────────────────────────────
 *
 *   standard    — most campers (daily activities without special staffing)
 *   enhanced    — campers with complex medical needs (1:3 staff ratio)
 *   one_to_one  — campers with severe behavioral/medical requirements (dedicated staff)
 *
 * ─── EMERGENCY CONTACT COVERAGE ─────────────────────────────────────────────
 *
 *   Every camper has a primary contact (is_primary=true, is_authorized_pickup=true).
 *   Selected campers have secondary contacts via ec2_* fields:
 *     - Secondary pickup contacts (ec2_pickup=true) — grandparents, other guardians
 *     - Secondary NON-pickup contacts (ec2_pickup=false) — physicians, school nurses
 *     - Contacts with phone_secondary populated (tests multi-phone UI)
 *     - Contacts with null email (tests nullable email state)
 *
 * All accounts use password "password" for local development.
 *
 * ExtendedEmergencyContactSeeder adds additional secondary contacts after this seeder runs.
 */
class FamilySeeder extends Seeder
{
    public function run(): void
    {
        $parentRole = Role::where('name', 'applicant')->firstOrFail();

        foreach ($this->families() as $family) {
            $user = User::firstOrCreate(
                ['email' => $family['email']],
                [
                    'name' => $family['name'],
                    'role_id' => $parentRole->id,
                    'password' => Hash::make('password'),
                    'email_verified_at' => now(),
                    'is_active' => true,
                    'phone' => $family['phone'] ?? null,
                    'address_line_1' => $family['address'] ?? null,
                    'city' => $family['city'] ?? null,
                    'state' => 'SC',
                    'postal_code' => $family['zip'] ?? null,
                    'country' => 'US',
                    'notification_preferences' => ['email', 'database'],
                ]
            );

            foreach ($family['campers'] as $c) {
                $camper = Camper::firstOrCreate(
                    ['user_id' => $user->id, 'first_name' => $c['first_name'], 'last_name' => $c['last_name']],
                    [
                        'date_of_birth' => $c['dob'],
                        'gender' => $c['gender'],
                        'tshirt_size' => $c['tshirt_size'],
                        'supervision_level' => $c['supervision'] ?? 'standard',
                    ]
                );

                if (! EmergencyContact::where('camper_id', $camper->id)->exists()) {
                    // Primary contact
                    EmergencyContact::create([
                        'camper_id' => $camper->id,
                        'name' => $c['ec_name'],
                        'relationship' => $c['ec_rel'],
                        'phone_primary' => $c['ec_phone'],
                        'phone_secondary' => $c['ec_phone2'] ?? null,
                        'email' => $c['ec_email'] ?? null,
                        'is_primary' => true,
                        'is_authorized_pickup' => true,
                    ]);

                    // Secondary contact for some families
                    if (isset($c['ec2_name'])) {
                        EmergencyContact::create([
                            'camper_id' => $camper->id,
                            'name' => $c['ec2_name'],
                            'relationship' => $c['ec2_rel'],
                            'phone_primary' => $c['ec2_phone'],
                            'phone_secondary' => null,
                            'email' => $c['ec2_email'] ?? null,
                            'is_primary' => false,
                            'is_authorized_pickup' => $c['ec2_pickup'] ?? false,
                        ]);
                    }
                }
            }
        }

        $this->command->line('  Families seeded: 31 families, 35 campers, emergency contacts.');
    }

    // -------------------------------------------------------------------------

    private function families(): array
    {
        return [

            // ── 1. Johnson Family — 2 children ────────────────────────────────
            [
                'name' => 'Sarah Johnson',
                'email' => 'sarah.johnson@example.com',
                'phone' => '803-555-0121',
                'address' => '2847 Devine Street',
                'city' => 'Columbia',
                'zip' => '29205',
                'campers' => [
                    [
                        'first_name' => 'Ethan',
                        'last_name' => 'Johnson',
                        'dob' => '2013-04-12',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Robert Johnson',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0122',
                        'ec_phone2' => '803-555-0123',
                        'ec_email' => 'robert.johnson@example.com',
                        'ec2_name' => 'Dorothy Johnson',
                        'ec2_rel' => 'Grandmother',
                        'ec2_phone' => '803-555-0124',
                        'ec2_email' => null,
                        'ec2_pickup' => true,
                    ],
                    [
                        'first_name' => 'Lily',
                        'last_name' => 'Johnson',
                        'dob' => '2015-09-03',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Robert Johnson',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0122',
                        'ec_email' => 'robert.johnson@example.com',
                    ],
                ],
            ],

            // ── 2. Martinez Family ────────────────────────────────────────────
            [
                'name' => 'David Martinez',
                'email' => 'david.martinez@example.com',
                'phone' => '803-555-0131',
                'address' => '518 Henderson Street',
                'city' => 'Sumter',
                'zip' => '29150',
                'campers' => [
                    [
                        'first_name' => 'Sofia',
                        'last_name' => 'Martinez',
                        'dob' => '2014-06-28',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Carlos Martinez',
                        'ec_rel' => 'Grandfather',
                        'ec_phone' => '803-555-0132',
                        'ec_email' => 'carlos.m@example.com',
                        'ec2_name' => 'Rosa Martinez',
                        'ec2_rel' => 'Aunt',
                        'ec2_phone' => '803-555-0133',
                        'ec2_pickup' => true,
                    ],
                ],
            ],

            // ── 3. Thompson Family ────────────────────────────────────────────
            [
                'name' => 'Jennifer Thompson',
                'email' => 'jennifer.thompson@example.com',
                'phone' => '803-555-0141',
                'address' => '3920 Forest Drive',
                'city' => 'Columbia',
                'zip' => '29204',
                'campers' => [
                    [
                        'first_name' => 'Noah',
                        'last_name' => 'Thompson',
                        'dob' => '2012-11-17',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'standard',
                        'ec_name' => 'Linda Thompson',
                        'ec_rel' => 'Grandmother',
                        'ec_phone' => '803-555-0142',
                        'ec_email' => 'linda.t@example.com',
                        'ec2_name' => 'Brian Thompson',
                        'ec2_rel' => 'Father',
                        'ec2_phone' => '803-555-0143',
                        'ec2_email' => 'brian.t@example.com',
                        'ec2_pickup' => true,
                    ],
                ],
            ],

            // ── 4. Williams Family — 2 children ───────────────────────────────
            [
                'name' => 'Michael Williams',
                'email' => 'michael.williams@example.com',
                'phone' => '864-555-0151',
                'address' => '211 Augusta Road',
                'city' => 'Greenville',
                'zip' => '29605',
                'campers' => [
                    [
                        'first_name' => 'Ava',
                        'last_name' => 'Williams',
                        'dob' => '2016-02-09',
                        'gender' => 'female',
                        'tshirt_size' => 'YS',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Angela Williams',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0152',
                        'ec_email' => 'angela.w@example.com',
                    ],
                    [
                        'first_name' => 'Lucas',
                        'last_name' => 'Williams',
                        'dob' => '2011-08-22',
                        'gender' => 'male',
                        'tshirt_size' => 'AM',
                        'supervision' => 'one_to_one',
                        'ec_name' => 'Angela Williams',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0152',
                        'ec_email' => 'angela.w@example.com',
                        'ec2_name' => 'Dr. Maria Gonzalez',
                        'ec2_rel' => 'Physician',
                        'ec2_phone' => '864-555-2330',
                        'ec2_pickup' => false,
                    ],
                ],
            ],

            // ── 5. Davis Family ───────────────────────────────────────────────
            [
                'name' => 'Patricia Davis',
                'email' => 'patricia.davis@example.com',
                'phone' => '803-555-0161',
                'address' => '742 Harden Street',
                'city' => 'Columbia',
                'zip' => '29203',
                'campers' => [
                    [
                        'first_name' => 'Mia',
                        'last_name' => 'Davis',
                        'dob' => '2015-05-14',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Thomas Davis',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0162',
                        'ec_email' => 'thomas.d@example.com',
                    ],
                ],
            ],

            // ── 6. Wilson Family — Tyler waitlisted for Session 1 ────────────
            [
                'name' => 'Grace Wilson',
                'email' => 'grace.wilson@example.com',
                'phone' => '843-555-0171',
                'address' => '1200 King Street',
                'city' => 'Charleston',
                'zip' => '29403',
                'campers' => [
                    [
                        'first_name' => 'Tyler',
                        'last_name' => 'Wilson',
                        'dob' => '2014-03-07',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Daniel Wilson',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0172',
                        'ec_email' => 'daniel.w@example.com',
                    ],
                ],
            ],

            // ── 7. Carter Family (James) ──────────────────────────────────────
            [
                'name' => 'James Carter',
                'email' => 'james.carter@example.com',
                'phone' => '803-555-0181',
                'address' => '1892 Oak Street',
                'city' => 'Columbia',
                'zip' => '29201',
                'campers' => [
                    [
                        'first_name' => 'Henry',
                        'last_name' => 'Carter',
                        'dob' => '2016-03-22',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'standard',
                        'ec_name' => 'Diane Carter',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0182',
                        'ec_phone2' => '803-555-0183',
                        'ec_email' => 'diane.carter@example.com',
                        'ec2_name' => 'Raymond Carter',
                        'ec2_rel' => 'Grandfather',
                        'ec2_phone' => '803-555-0184',
                        'ec2_pickup' => false,
                    ],
                ],
            ],

            // ── 8. Anderson Family — 2 children ───────────────────────────────
            [
                'name' => 'Robert Anderson',
                'email' => 'robert.anderson@example.com',
                'phone' => '803-555-0191',
                'address' => '480 Blossom Street',
                'city' => 'Columbia',
                'zip' => '29205',
                'campers' => [
                    [
                        'first_name' => 'Emma',
                        'last_name' => 'Anderson',
                        'dob' => '2013-07-19',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'one_to_one',
                        'ec_name' => 'Karen Anderson',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0192',
                        'ec_email' => 'karen.anderson@example.com',
                    ],
                    [
                        'first_name' => 'Owen',
                        'last_name' => 'Anderson',
                        'dob' => '2015-11-03',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Karen Anderson',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0192',
                        'ec_email' => 'karen.anderson@example.com',
                    ],
                ],
            ],

            // ── 9. Rodriguez Family ───────────────────────────────────────────
            [
                'name' => 'Lisa Rodriguez',
                'email' => 'lisa.rodriguez@example.com',
                'phone' => '843-555-0201',
                'address' => '390 Meeting Street',
                'city' => 'Charleston',
                'zip' => '29403',
                'campers' => [
                    [
                        'first_name' => 'Chloe',
                        'last_name' => 'Rodriguez',
                        'dob' => '2012-09-14',
                        'gender' => 'female',
                        'tshirt_size' => 'YL',
                        'supervision' => 'one_to_one',
                        'ec_name' => 'Manuel Rodriguez',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0202',
                        'ec_email' => 'manuel.r@example.com',
                    ],
                ],
            ],

            // ── 10. Taylor Family ─────────────────────────────────────────────
            [
                'name' => 'Mark Taylor',
                'email' => 'mark.taylor@example.com',
                'phone' => '864-555-0211',
                'address' => '703 Wade Hampton Blvd',
                'city' => 'Greenville',
                'zip' => '29609',
                'campers' => [
                    [
                        'first_name' => 'Jayden',
                        'last_name' => 'Taylor',
                        'dob' => '2014-02-28',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Sandra Taylor',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0212',
                        'ec_email' => 'sandra.taylor@example.com',
                    ],
                ],
            ],

            // ── 11. Clark Family ──────────────────────────────────────────────
            [
                'name' => 'Angela Clark',
                'email' => 'angela.clark@example.com',
                'phone' => '803-555-0221',
                'address' => '1560 St Andrews Road',
                'city' => 'Columbia',
                'zip' => '29210',
                'campers' => [
                    [
                        'first_name' => 'Zoe',
                        'last_name' => 'Clark',
                        'dob' => '2015-06-17',
                        'gender' => 'female',
                        'tshirt_size' => 'YS',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Dennis Clark',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0222',
                        'ec_email' => 'dennis.clark@example.com',
                    ],
                ],
            ],

            // ── 12. Harris Family ─────────────────────────────────────────────
            [
                'name' => 'Brian Harris',
                'email' => 'brian.harris@example.com',
                'phone' => '803-555-0231',
                'address' => '2100 Rosewood Drive',
                'city' => 'Columbia',
                'zip' => '29205',
                'campers' => [
                    [
                        'first_name' => 'Isabella',
                        'last_name' => 'Harris',
                        'dob' => '2016-04-11',
                        'gender' => 'female',
                        'tshirt_size' => 'YS',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Pamela Harris',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0232',
                        'ec_email' => 'pamela.harris@example.com',
                    ],
                ],
            ],

            // ── 13. Lewis Family ──────────────────────────────────────────────
            [
                'name' => 'Susan Lewis',
                'email' => 'susan.lewis@example.com',
                'phone' => '843-555-0241',
                'address' => '620 Rutledge Avenue',
                'city' => 'Charleston',
                'zip' => '29403',
                'campers' => [
                    [
                        'first_name' => 'Mason',
                        'last_name' => 'Lewis',
                        'dob' => '2012-08-03',
                        'gender' => 'male',
                        'tshirt_size' => 'AM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'George Lewis',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0242',
                        'ec_email' => 'george.lewis@example.com',
                    ],
                ],
            ],

            // ── 14. Lee Family ────────────────────────────────────────────────
            [
                'name' => 'Kevin Lee',
                'email' => 'kevin.lee@example.com',
                'phone' => '864-555-0251',
                'address' => '415 North Main Street',
                'city' => 'Greenville',
                'zip' => '29601',
                'campers' => [
                    [
                        'first_name' => 'Olivia',
                        'last_name' => 'Lee',
                        'dob' => '2014-12-21',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Jenny Lee',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0252',
                        'ec_email' => 'jenny.lee@example.com',
                    ],
                ],
            ],

            // ── 15. Young Family ──────────────────────────────────────────────
            [
                'name' => 'Michelle Young',
                'email' => 'michelle.young@example.com',
                'phone' => '803-555-0261',
                'address' => '3340 Trenholm Road',
                'city' => 'Columbia',
                'zip' => '29204',
                'campers' => [
                    [
                        'first_name' => 'Liam',
                        'last_name' => 'Young',
                        'dob' => '2015-07-09',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Brandon Young',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0262',
                        'ec_email' => 'brandon.young@example.com',
                    ],
                ],
            ],

            // ── 16. Hall Family — 2 children ──────────────────────────────────
            [
                'name' => 'Christopher Hall',
                'email' => 'christopher.hall@example.com',
                'phone' => '803-555-0271',
                'address' => '1050 Bull Street',
                'city' => 'Columbia',
                'zip' => '29201',
                'campers' => [
                    [
                        'first_name' => 'Sophia',
                        'last_name' => 'Hall',
                        'dob' => '2013-05-28',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Michelle Hall',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0272',
                        'ec_email' => 'michelle.hall@example.com',
                    ],
                    [
                        'first_name' => 'James',
                        'last_name' => 'Hall',
                        'dob' => '2016-08-14',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'standard',
                        'ec_name' => 'Michelle Hall',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0272',
                        'ec_email' => 'michelle.hall@example.com',
                    ],
                ],
            ],

            // ── 17. Allen Family ──────────────────────────────────────────────
            [
                'name' => 'Amanda Allen',
                'email' => 'amanda.allen@example.com',
                'phone' => '864-555-0281',
                'address' => '822 Pendleton Street',
                'city' => 'Greenville',
                'zip' => '29601',
                'campers' => [
                    [
                        'first_name' => 'Benjamin',
                        'last_name' => 'Allen',
                        'dob' => '2012-03-16',
                        'gender' => 'male',
                        'tshirt_size' => 'AM',
                        'supervision' => 'standard',
                        'ec_name' => 'Derek Allen',
                        'ec_rel' => 'Father',
                        'ec_phone' => '864-555-0282',
                        'ec_email' => 'derek.allen@example.com',
                    ],
                ],
            ],

            // ── 18. Scott Family ──────────────────────────────────────────────
            [
                'name' => 'Jason Scott',
                'email' => 'jason.scott@example.com',
                'phone' => '843-555-0291',
                'address' => '275 Calhoun Street',
                'city' => 'Charleston',
                'zip' => '29401',
                'campers' => [
                    [
                        'first_name' => 'Charlotte',
                        'last_name' => 'Scott',
                        'dob' => '2014-09-30',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Melissa Scott',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '843-555-0292',
                        'ec_email' => 'melissa.scott@example.com',
                    ],
                ],
            ],

            // ── 19. Green Family ──────────────────────────────────────────────
            [
                'name' => 'Kimberly Green',
                'email' => 'kimberly.green@example.com',
                'phone' => '803-555-0301',
                'address' => '5100 Forest Hills Road',
                'city' => 'Columbia',
                'zip' => '29206',
                'campers' => [
                    [
                        'first_name' => 'Elijah',
                        'last_name' => 'Green',
                        'dob' => '2015-01-25',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Marcus Green',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0302',
                        'ec_email' => 'marcus.green@example.com',
                        'ec2_name' => 'Beverly Green',
                        'ec2_rel' => 'Grandmother',
                        'ec2_phone' => '803-555-0303',
                        'ec2_pickup' => true,
                    ],
                ],
            ],

            // ── 20. Baker Family ──────────────────────────────────────────────
            [
                'name' => 'Timothy Baker',
                'email' => 'timothy.baker@example.com',
                'phone' => '864-555-0311',
                'address' => '108 Pelham Road',
                'city' => 'Greenville',
                'zip' => '29615',
                'campers' => [
                    [
                        'first_name' => 'Amelia',
                        'last_name' => 'Baker',
                        'dob' => '2013-10-12',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Cheryl Baker',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0312',
                        'ec_email' => 'cheryl.baker@example.com',
                    ],
                ],
            ],

            // ── 21. Nelson Family ─────────────────────────────────────────────
            [
                'name' => 'Rebecca Nelson',
                'email' => 'rebecca.nelson@example.com',
                'phone' => '843-555-0321',
                'address' => '88 Spring Street',
                'city' => 'Charleston',
                'zip' => '29403',
                'campers' => [
                    [
                        'first_name' => 'Sebastian',
                        'last_name' => 'Nelson',
                        'dob' => '2014-05-08',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Craig Nelson',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0322',
                        'ec_email' => 'craig.nelson@example.com',
                    ],
                ],
            ],

            // ── 22. Carter Family (Scott) ─────────────────────────────────────
            [
                'name' => 'Scott Carter',
                'email' => 'scott.carter@example.com',
                'phone' => '803-555-0331',
                'address' => '720 Assembly Street',
                'city' => 'Columbia',
                'zip' => '29201',
                'campers' => [
                    [
                        'first_name' => 'Harper',
                        'last_name' => 'Carter',
                        'dob' => '2016-02-17',
                        'gender' => 'female',
                        'tshirt_size' => 'YS',
                        'supervision' => 'standard',
                        'ec_name' => 'Valerie Carter',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0332',
                        'ec_email' => 'valerie.carter@example.com',
                    ],
                ],
            ],

            // ── 23. Mitchell Family ───────────────────────────────────────────
            [
                'name' => 'Laura Mitchell',
                'email' => 'laura.mitchell@example.com',
                'phone' => '803-555-0341',
                'address' => '4630 Two Notch Road',
                'city' => 'Columbia',
                'zip' => '29204',
                'campers' => [
                    [
                        'first_name' => 'Wyatt',
                        'last_name' => 'Mitchell',
                        'dob' => '2012-04-03',
                        'gender' => 'male',
                        'tshirt_size' => 'AM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Steve Mitchell',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0342',
                        'ec_email' => 'steve.mitchell@example.com',
                        'ec2_name' => 'Brenda Mitchell',
                        'ec2_rel' => 'Aunt',
                        'ec2_phone' => '803-555-0343',
                        'ec2_pickup' => true,
                    ],
                ],
            ],

            // ── 24. Perez Family ──────────────────────────────────────────────
            [
                'name' => 'Daniel Perez',
                'email' => 'daniel.perez@example.com',
                'phone' => '864-555-0351',
                'address' => '213 Buncombe Street',
                'city' => 'Greenville',
                'zip' => '29601',
                'campers' => [
                    [
                        'first_name' => 'Luna',
                        'last_name' => 'Perez',
                        'dob' => '2015-08-19',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Maria Perez',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '864-555-0352',
                        'ec_email' => 'maria.perez@example.com',
                    ],
                ],
            ],

            // ── 25. Roberts Family ────────────────────────────────────────────
            [
                'name' => 'Elizabeth Roberts',
                'email' => 'elizabeth.roberts@example.com',
                'phone' => '803-555-0361',
                'address' => '1700 Hampton Street',
                'city' => 'Columbia',
                'zip' => '29201',
                'campers' => [
                    [
                        'first_name' => 'Nathan',
                        'last_name' => 'Roberts',
                        'dob' => '2013-12-06',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Kevin Roberts',
                        'ec_rel' => 'Father',
                        'ec_phone' => '803-555-0362',
                        'ec_email' => 'kevin.roberts@example.com',
                    ],
                ],
            ],

            // ── 26. Phillips Family ───────────────────────────────────────────
            [
                'name' => 'Rachel Phillips',
                'email' => 'rachel.phillips@example.com',
                'phone' => '843-555-0371',
                'address' => '50 Broad Street',
                'city' => 'Charleston',
                'zip' => '29401',
                'campers' => [
                    [
                        'first_name' => 'Caleb',
                        'last_name' => 'Phillips',
                        'dob' => '2012-06-22',
                        'gender' => 'male',
                        'tshirt_size' => 'AM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Trevor Phillips',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0372',
                        'ec_email' => 'trevor.phillips@example.com',
                    ],
                ],
            ],

            // ── 27. Campbell Family ───────────────────────────────────────────
            [
                'name' => 'Anthony Campbell',
                'email' => 'anthony.campbell@example.com',
                'phone' => '803-555-0381',
                'address' => '2600 Millwood Avenue',
                'city' => 'Columbia',
                'zip' => '29205',
                'campers' => [
                    [
                        'first_name' => 'Penelope',
                        'last_name' => 'Campbell',
                        'dob' => '2015-03-14',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Donna Campbell',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0382',
                        'ec_email' => 'donna.campbell@example.com',
                        'ec2_name' => 'Frank Campbell',
                        'ec2_rel' => 'Grandfather',
                        'ec2_phone' => '803-555-0383',
                        'ec2_pickup' => false,
                    ],
                ],
            ],

            // ── 28. Evans Family ──────────────────────────────────────────────
            [
                'name' => 'Stephanie Evans',
                'email' => 'stephanie.evans@example.com',
                'phone' => '864-555-0391',
                'address' => '500 East Washington Street',
                'city' => 'Greenville',
                'zip' => '29601',
                'campers' => [
                    [
                        'first_name' => 'Isaiah',
                        'last_name' => 'Evans',
                        'dob' => '2013-01-31',
                        'gender' => 'male',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'Derrick Evans',
                        'ec_rel' => 'Father',
                        'ec_phone' => '864-555-0392',
                        'ec_email' => 'derrick.evans@example.com',
                    ],
                ],
            ],

            // ── 29. Edwards Family ────────────────────────────────────────────
            [
                'name' => 'Joshua Edwards',
                'email' => 'joshua.edwards@example.com',
                'phone' => '803-555-0401',
                'address' => '315 Pickens Street',
                'city' => 'Columbia',
                'zip' => '29205',
                'campers' => [
                    [
                        'first_name' => 'Nora',
                        'last_name' => 'Edwards',
                        'dob' => '2014-07-16',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'standard',
                        'ec_name' => 'Tiffany Edwards',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '803-555-0402',
                        'ec_email' => 'tiffany.edwards@example.com',
                    ],
                ],
            ],

            // ── 30. Rivera Family ─────────────────────────────────────────────
            [
                'name' => 'Marcus Rivera',
                'email' => 'marcus.rivera@example.com',
                'phone' => '843-555-0411',
                'address' => '1050 Wappoo Road',
                'city' => 'Charleston',
                'zip' => '29407',
                'campers' => [
                    [
                        'first_name' => 'Carlos',
                        'last_name' => 'Rivera',
                        'dob' => '2013-08-15',
                        'gender' => 'male',
                        'tshirt_size' => 'YL',
                        'supervision' => 'one_to_one',
                        'ec_name' => 'Elena Rivera',
                        'ec_rel' => 'Mother',
                        'ec_phone' => '843-555-0412',
                        'ec_email' => 'elena.rivera@example.com',
                        'ec2_name' => 'Dr. Miguel Reyes',
                        'ec2_rel' => 'Physician',
                        'ec2_phone' => '843-555-2500',
                        'ec2_pickup' => false,
                    ],
                ],
            ],

            // ── 31. Robinson Family (Michelle) ────────────────────────────────
            [
                'name' => 'Michelle Robinson',
                'email' => 'michelle.robinson@example.com',
                'phone' => '843-555-0421',
                'address' => '301 Ashley Hall Road',
                'city' => 'Charleston',
                'zip' => '29407',
                'campers' => [
                    [
                        'first_name' => 'Olivia',
                        'last_name' => 'Robinson',
                        'dob' => '2015-04-10',
                        'gender' => 'female',
                        'tshirt_size' => 'YM',
                        'supervision' => 'enhanced',
                        'ec_name' => 'David Robinson',
                        'ec_rel' => 'Father',
                        'ec_phone' => '843-555-0422',
                        'ec_email' => 'david.robinson@example.com',
                    ],
                ],
            ],
        ];
    }
}
