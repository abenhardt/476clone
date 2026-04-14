<?php

namespace App\Services\Medical;

use App\Models\Camper;

/**
 * MedicalAlertService — Real-Time Medical Alert Computation
 *
 * This service answers the question: "What does the medical team need to know
 * about this camper right now, at a glance?"
 *
 * Instead of maintaining a separate "alerts" table that could go stale when
 * clinical data changes, alerts are computed on-demand directly from the
 * existing medical data (allergies, diagnoses, medical_record, medications).
 * This means alerts are always accurate and never need manual refreshing.
 *
 * Each alert is a simple array with four fields:
 *  - level:    'critical' | 'warning' | 'info'
 *              (critical = may be life-threatening, warning = needs attention, info = FYI)
 *  - category: short machine-readable tag (e.g. 'allergy', 'seizure', 'device', 'diagnosis')
 *  - title:    one-line human-readable label displayed in the UI badge
 *  - detail:   optional extra context shown when the user expands the alert panel
 *
 * Alerts are sorted by severity so critical items always appear first.
 *
 * Called by: CamperController -> medicalAlerts() endpoint
 *            MedicalRecordPage in the frontend for the alert strip
 */
class MedicalAlertService
{
    /**
     * Compute and return all medical alerts for the given camper.
     *
     * Loads the required relationships if not already loaded, then evaluates
     * each clinical data section for conditions that generate an alert.
     *
     * The final list is sorted: critical → warning → info.
     *
     * @param  Camper  $camper  The camper whose alerts are being computed
     * @return list<array{level: string, category: string, title: string, detail: string|null}>
     */
    public function alertsFor(Camper $camper): array
    {
        // Eagerly load all relationships needed for alert computation in a single query set
        $camper->loadMissing([
            'allergies',
            'diagnoses',
            'medicalRecord',
            'medications',
        ]);

        $alerts = [];

        // ── Allergies ────────────────────────────────────────────────────────
        foreach ($camper->allergies as $allergy) {
            // Only surface allergies that require immediate attention (severe / life-threatening)
            if (! $allergy->severity->requiresImmediateAttention()) {
                continue;
            }

            // Build the detail string by combining reaction and treatment if available
            $detail = null;
            if ($allergy->reaction) {
                $detail = 'Reaction: '.$allergy->reaction;
            }
            if ($allergy->treatment) {
                // Append treatment info with a separator if reaction info is already present
                $detail .= ($detail ? ' | ' : '').'Treatment: '.$allergy->treatment;
            }

            // Life-threatening allergies are critical; all other severe ones are warnings
            $alerts[] = [
                'level' => $allergy->severity->value === 'life_threatening' ? 'critical' : 'warning',
                'category' => 'allergy',
                'title' => strtoupper($allergy->severity->label()).' ALLERGY — '.$allergy->allergen,
                'detail' => $detail,
            ];
        }

        // ── Seizure history ──────────────────────────────────────────────────
        // A seizure history is always critical — staff need a Seizure Action Plan
        $record = $camper->medicalRecord;
        if ($record && $record->has_seizures) {
            // Build detail from the description and/or date of last seizure
            $detail = null;
            if ($record->seizure_description) {
                $detail = $record->seizure_description;
            }
            if ($record->last_seizure_date) {
                $detail .= ($detail ? ' | ' : '').'Last seizure: '.$record->last_seizure_date->toDateString();
            }

            $alerts[] = [
                'level' => 'critical',
                'category' => 'seizure',
                'title' => 'SEIZURE HISTORY — Seizure Action Plan required',
                'detail' => $detail,
            ];
        }

        // ── Neurostimulator ──────────────────────────────────────────────────
        // Neurostimulators (like VNS or DBS devices) are incompatible with MRI and some electrical equipment
        if ($record && $record->has_neurostimulator) {
            $alerts[] = [
                'level' => 'warning',
                'category' => 'device',
                'title' => 'NEUROSTIMULATOR — Avoid MRI and electrical equipment near chest',
                'detail' => null,
            ];
        }

        // ── Diagnoses ────────────────────────────────────────────────────────
        // Surface all diagnoses as informational alerts so medics see
        // the full picture at a glance without opening the sub-section.
        foreach ($camper->diagnoses as $dx) {
            $alerts[] = [
                'level' => 'info',
                'category' => 'diagnosis',
                'title' => 'DIAGNOSIS — '.$dx->name,
                // Include diagnosis notes as the detail if present
                'detail' => $dx->notes ?? null,
            ];
        }

        // ── Medications that require refrigeration ───────────────────────────
        // Scan medication notes for the word "refrigerat" (covers "refrigerate", "refrigerated", etc.)
        foreach ($camper->medications as $med) {
            $notesLower = mb_strtolower($med->notes ?? '');
            if (str_contains($notesLower, 'refrigerat')) {
                $alerts[] = [
                    'level' => 'warning',
                    'category' => 'medication',
                    'title' => 'REFRIGERATED MEDICATION — '.$med->name,
                    'detail' => $med->notes,
                ];
            }
        }

        // ── Sort: critical → warning → info ─────────────────────────────────
        // Map each level to a numeric priority so usort can order them correctly
        usort($alerts, function (array $a, array $b): int {
            $order = ['critical' => 0, 'warning' => 1, 'info' => 2];

            // <=> is the "spaceship" operator: returns -1, 0, or 1 for comparison
            return ($order[$a['level']] ?? 9) <=> ($order[$b['level']] ?? 9);
        });

        return $alerts;
    }
}
