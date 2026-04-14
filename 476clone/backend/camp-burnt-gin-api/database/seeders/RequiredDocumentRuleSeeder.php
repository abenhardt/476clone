<?php

namespace Database\Seeders;

use App\Enums\MedicalComplexityTier;
use App\Enums\SupervisionLevel;
use App\Models\RequiredDocumentRule;
use Illuminate\Database\Seeder;

/**
 * Seeder for medical compliance document requirements.
 *
 * Populates baseline rules for required medical documentation based on
 * complexity tiers, supervision levels, and specific medical conditions.
 * These rules enforce safety and liability compliance before approval.
 */
class RequiredDocumentRuleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $rules = [
            // Universal requirements for all campers
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'official_medical_form',
                'description' => 'Medical Examination Form (Form 4523-ENG-DPH) completed and signed by a licensed physician within the past 12 months',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'immunization_record',
                'description' => 'Current immunization records showing required vaccinations',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'insurance_card',
                'description' => 'Current insurance card (or Medicaid/CHIP card) showing active health coverage',
                'is_mandatory' => true,
            ],

            // Seizure-specific requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'seizures',
                'document_type' => 'seizure_action_plan',
                'description' => 'Detailed seizure action plan from neurologist or treating physician including triggers, warning signs, emergency protocols, and rescue medication administration',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'seizures',
                'document_type' => 'seizure_medication_authorization',
                'description' => 'Medication authorization for rescue medications including dosing instructions and administration route',
                'is_mandatory' => true,
            ],

            // G-tube and enteral feeding requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'g_tube',
                'document_type' => 'feeding_action_plan',
                'description' => 'Enteral feeding action plan from gastroenterologist or dietitian including formula type, amounts, feeding schedule, and emergency protocols for tube displacement or malfunction',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'g_tube',
                'document_type' => 'feeding_equipment_list',
                'description' => 'List of required feeding equipment and replacement supplies',
                'is_mandatory' => true,
            ],

            // One-to-one supervision requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => SupervisionLevel::OneToOne,
                'condition_flag' => null,
                'document_type' => 'behavioral_support_plan',
                'description' => 'Comprehensive behavioral support plan from psychologist, behavioral specialist, or treating physician detailing triggers, de-escalation techniques, and crisis intervention protocols',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => null,
                'supervision_level' => SupervisionLevel::OneToOne,
                'condition_flag' => null,
                'document_type' => 'staffing_accommodation_request',
                'description' => 'Formal request and medical justification for dedicated one-to-one staffing',
                'is_mandatory' => true,
            ],

            // Wandering risk requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'wandering_risk',
                'document_type' => 'elopement_prevention_plan',
                'description' => 'Elopement prevention and response plan including supervision protocols, environmental modifications, and search procedures',
                'is_mandatory' => true,
            ],

            // Aggression/self-abuse requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'aggression',
                'document_type' => 'crisis_intervention_plan',
                'description' => 'Crisis intervention plan from behavioral specialist including de-escalation strategies, physical management protocols if applicable, and emergency contacts',
                'is_mandatory' => true,
            ],

            // Moderate complexity tier requirements
            [
                'medical_complexity_tier' => MedicalComplexityTier::Moderate,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'medical_management_plan',
                'description' => 'Comprehensive medical management plan addressing all active diagnoses, medications, and required accommodations',
                'is_mandatory' => true,
            ],

            // High complexity tier requirements
            [
                'medical_complexity_tier' => MedicalComplexityTier::High,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'medical_management_plan',
                'description' => 'Comprehensive medical management plan addressing all active diagnoses, medications, and required accommodations',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => MedicalComplexityTier::High,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'physician_clearance',
                'description' => 'Explicit physician clearance for overnight camp participation with acknowledgment of medical complexity and emergency protocols',
                'is_mandatory' => true,
            ],
            [
                'medical_complexity_tier' => MedicalComplexityTier::High,
                'supervision_level' => null,
                'condition_flag' => null,
                'document_type' => 'emergency_protocol',
                'description' => 'Detailed emergency protocol for all high-risk medical conditions including nearest appropriate medical facility and transport authorization',
                'is_mandatory' => true,
            ],

            // Enhanced supervision requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => SupervisionLevel::Enhanced,
                'condition_flag' => null,
                'document_type' => 'supervision_justification',
                'description' => 'Medical or behavioral justification for enhanced supervision ratio from treating provider',
                'is_mandatory' => true,
            ],

            // Neurostimulator/medical device requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'neurostimulator',
                'document_type' => 'device_management_plan',
                'description' => 'Vagal nerve stimulator or other implanted device management plan including settings, magnet use instructions, and emergency contacts',
                'is_mandatory' => true,
            ],

            // CPAP / BiPAP requirements
            [
                'medical_complexity_tier' => null,
                'supervision_level' => null,
                'condition_flag' => 'cpap',
                'document_type' => 'cpap_waiver',
                'description' => 'CPAP/BiPAP waiver signed by physician authorizing use of the device at overnight camp, including device settings and staff troubleshooting instructions',
                'is_mandatory' => true,
            ],
        ];

        foreach ($rules as $rule) {
            RequiredDocumentRule::firstOrCreate(
                [
                    'medical_complexity_tier' => $rule['medical_complexity_tier'],
                    'supervision_level' => $rule['supervision_level'],
                    'condition_flag' => $rule['condition_flag'],
                    'document_type' => $rule['document_type'],
                ],
                $rule
            );
        }
    }
}
