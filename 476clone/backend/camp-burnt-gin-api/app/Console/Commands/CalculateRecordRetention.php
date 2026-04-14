<?php

namespace App\Console\Commands;

use App\Models\Camper;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * CalculateRecordRetention — updates the record retention date for every camper.
 *
 * By law and camp policy, medical records must be kept for a minimum period after
 * the camper's last session. This command works out the correct retention deadline
 * for each camper and saves it to the database so the ArchiveExpiredRecords command
 * can use it later.
 *
 * The retention formula is: keep records until whichever comes LATER —
 *   (a) 13 years after the camper's last camp session end date, OR
 *   (b) the camper's 19th birthday.
 *
 * Scheduled to run daily to keep retention dates current as new sessions are added.
 */
class CalculateRecordRetention extends Command
{
    /**
     * The artisan command name and optional flags.
     * --dry-run: Show what would change without saving anything to the database.
     * --camper=ID: Only recalculate for one specific camper (useful for debugging).
     *
     * @var string
     */
    protected $signature = 'campers:calculate-retention
                            {--dry-run : Display what would be updated without modifying database}
                            {--camper= : Calculate for specific camper ID only}';

    /**
     * A short description shown when running `php artisan list`.
     *
     * @var string
     */
    protected $description = 'Calculate and update medical record retention dates for campers';

    /**
     * Run the command: loop through all campers, compute their retention date,
     * and save it if it has changed. Reports a summary at the end.
     */
    public function handle(): int
    {
        // Read command-line flags.
        $isDryRun = $this->option('dry-run');
        $specificCamperId = $this->option('camper');

        $this->info('Starting record retention calculation...');
        if ($isDryRun) {
            $this->warn('DRY RUN MODE - No database changes will be made');
        }

        // Build the base query — optionally scoped to a single camper.
        $query = Camper::query();

        if ($specificCamperId) {
            $query->where('id', $specificCamperId);
        }

        // Counters to track progress for the summary table at the end.
        $processedCount = 0;
        $updatedCount = 0;
        $errorCount = 0;

        // Process in chunks of 100 to avoid loading thousands of records into memory at once.
        $query->chunk(100, function ($campers) use ($isDryRun, &$processedCount, &$updatedCount, &$errorCount) {
            foreach ($campers as $camper) {
                try {
                    $processedCount++;

                    // Work out what the retention date should be for this camper.
                    $retentionDate = $this->calculateRetentionDate($camper);
                    $currentRetentionDate = $camper->record_retention_until;

                    if ($currentRetentionDate?->eq($retentionDate)) {
                        // No change needed — skip to the next camper.
                        continue;
                    }

                    if ($isDryRun) {
                        // In dry-run mode just print what would happen, don't save.
                        $this->line(sprintf(
                            'Would update Camper #%d: %s -> %s',
                            $camper->id,
                            $currentRetentionDate?->format('Y-m-d') ?? 'null',
                            $retentionDate->format('Y-m-d')
                        ));
                    } else {
                        // Save the new retention date to the database.
                        $camper->update(['record_retention_until' => $retentionDate]);
                    }

                    $updatedCount++;
                } catch (\Throwable $e) {
                    // Log the error but keep processing the remaining campers.
                    $errorCount++;
                    $this->error(sprintf(
                        'Error processing Camper #%d: %s',
                        $camper->id ?? 'unknown',
                        $e->getMessage()
                    ));
                }
            }
        });

        // Print a neat summary table showing totals for this run.
        $this->newLine();
        $this->info('Retention calculation complete:');
        $this->table(
            ['Metric', 'Count'],
            [
                ['Processed', $processedCount],
                ['Updated', $updatedCount],
                ['Errors', $errorCount],
            ]
        );

        // Return FAILURE if any camper produced an error, so monitoring tools can alert.
        return $errorCount > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Work out the correct retention date for a single camper.
     *
     * Formula: MAX(last_session_date + 13 years, 19th_birthday)
     * Whichever date is further in the future is used as the retention deadline.
     */
    protected function calculateRetentionDate(Camper $camper): Carbon
    {
        // Get last session end date from applications
        $lastSessionDate = $camper->applications()
            ->with('campSession')
            ->get()
            ->pluck('campSession.end_date')
            ->filter()
            ->max();

        // Calculate session-based retention (13 years after last session)
        $sessionBasedRetention = $lastSessionDate
            ? Carbon::parse($lastSessionDate)->addYears(13)
            : now()->addYears(13); // Default if no sessions

        // Calculate age-based retention (19th birthday)
        $ageBasedRetention = Carbon::parse($camper->date_of_birth)->addYears(19);

        // Return whichever is longer
        return $sessionBasedRetention->gt($ageBasedRetention)
            ? $sessionBasedRetention
            : $ageBasedRetention;
    }
}
