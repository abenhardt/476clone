<?php

namespace App\Console\Commands;

use App\Models\Camper;
use Illuminate\Console\Command;

/**
 * ArchiveExpiredRecords — identifies camper records that have passed their legal retention date.
 *
 * Medical and personal records must be kept for a minimum period (defined by law and policy),
 * but they should not be kept forever. This command scans the database and finds campers
 * whose records are overdue for archival, then prints a report for administrators to review.
 *
 * IMPORTANT: This command NEVER deletes anything. It only identifies and reports.
 * A human administrator must review the list and follow the organization's data retention
 * policy before any records are actually removed. This prevents accidental data loss.
 */
class ArchiveExpiredRecords extends Command
{
    /**
     * The artisan command name and optional flags.
     * Run with: php artisan records:identify-expired
     * Add --export=/path/to/file.csv to save the results to a file.
     *
     * @var string
     */
    protected $signature = 'records:identify-expired
                            {--export= : Export list of expired records to file}';

    /**
     * A short description shown when running `php artisan list`.
     *
     * @var string
     */
    protected $description = 'Identify campers whose records have exceeded retention period (does not delete)';

    /**
     * Run the command: find all campers past their retention date and display them.
     * Returns SUCCESS even when records are found — this is a reporting command, not an error.
     */
    public function handle(): int
    {
        // Check whether the user passed an --export path on the command line.
        $exportPath = $this->option('export');

        $this->info('Identifying records past retention period...');

        // Find every camper who has a retention date set AND that date is in the past.
        $expiredCampers = Camper::whereNotNull('record_retention_until')
            ->where('record_retention_until', '<', now())
            ->with(['user', 'applications'])
            ->get();

        // If no overdue records exist, let the operator know and exit cleanly.
        if ($expiredCampers->isEmpty()) {
            $this->info('No records past retention period found.');

            return self::SUCCESS;
        }

        // Print a warning with the count before showing the table.
        $this->warn(sprintf(
            'Found %d camper(s) past retention period:',
            $expiredCampers->count()
        ));

        // Build a flat array of rows so we can display them in a console table.
        $tableData = $expiredCampers->map(function ($camper) {
            return [
                'ID' => $camper->id,
                'Name' => sprintf('%s %s', $camper->first_name, $camper->last_name),
                'DOB' => $camper->date_of_birth->format('Y-m-d'),
                'Retention Until' => $camper->record_retention_until->format('Y-m-d'),
                // diffInDays gives a positive integer even though the date is in the past.
                'Days Overdue' => now()->diffInDays($camper->record_retention_until),
                'Applications' => $camper->applications->count(),
            ];
        })->toArray();

        // Display the results as a formatted table in the terminal.
        $this->table(
            ['ID', 'Name', 'DOB', 'Retention Until', 'Days Overdue', 'Applications'],
            $tableData
        );

        // If the operator asked for a CSV export, write the file now.
        if ($exportPath) {
            $this->exportToFile($expiredCampers, $exportPath);
        }

        // Print final reminders so the operator knows no deletion has occurred.
        $this->newLine();
        $this->warn('IMPORTANT: These records should be reviewed by an administrator before archival.');
        $this->warn('This command does NOT automatically delete records.');
        $this->info('To proceed with archival, export the list and follow your organization\'s data retention policy.');

        return self::SUCCESS;
    }

    /**
     * Write the list of expired campers to a CSV file at the given path.
     *
     * SECURITY: This file contains PHI (names, DOB, parent email). It must be
     * written to a secure, access-controlled path. The operator is responsible
     * for encrypting the file and deleting it after review.
     *
     * Each row contains identifiers, dates, and the associated application count.
     */
    protected function exportToFile($campers, string $path): void
    {
        // Restrict export to paths under the configured storage directory to prevent
        // writing PHI to arbitrary locations (e.g. /tmp, public web root).
        $allowedBase = storage_path('app/retention-exports');
        $resolvedPath = realpath(dirname($path)) ?: dirname($path);
        if (! str_starts_with($resolvedPath, storage_path())) {
            $this->error('Export path must be within the application storage directory.');
            $this->error('Allowed base: '.storage_path());
            $this->error('Provided path resolves to: '.$resolvedPath);

            return;
        }

        // Create the export directory if it does not exist.
        if (! is_dir(dirname($path))) {
            mkdir(dirname($path), 0700, true);
        }

        $csv = fopen($path, 'w');

        // Restrict file permissions so only the web server user can read it.
        chmod($path, 0600);

        // Write header
        fputcsv($csv, [
            'Camper ID',
            'First Name',
            'Last Name',
            'Date of Birth',
            'Retention Until',
            'Days Overdue',
            'Parent User ID',
            'Application Count',
            // Note: parent email excluded — use user_id to look up contact details
            // through the application rather than storing PII in the export file.
        ]);

        // Write data
        foreach ($campers as $camper) {
            fputcsv($csv, [
                $camper->id,
                $camper->first_name,
                $camper->last_name,
                $camper->date_of_birth->format('Y-m-d'),
                $camper->record_retention_until->format('Y-m-d'),
                now()->diffInDays($camper->record_retention_until),
                $camper->user_id,
                $camper->applications->count(),
            ]);
        }

        fclose($csv);

        $this->info(sprintf('Exported %d records to: %s', $campers->count(), $path));
        $this->warn('PHI NOTICE: This file contains Protected Health Information.');
        $this->warn('Encrypt and securely delete this file after review.');
    }
}
