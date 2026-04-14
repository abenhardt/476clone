<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Notifications\Camper\IncompleteApplicationReminderNotification;
use Illuminate\Console\Command;

/**
 * SendIncompleteApplicationReminders — reminds parents to finish their draft applications.
 *
 * Sometimes a parent starts an application and then forgets to submit it. If an application
 * stays in draft state for too long, this command finds it and sends a friendly reminder
 * email to the parent. It only sends reminders while registration is still open, so parents
 * are never bothered after the deadline has passed.
 *
 * Implements FR-29: Incomplete application reminders.
 * Typically scheduled to run once a day via the task scheduler.
 */
class SendIncompleteApplicationReminders extends Command
{
    /**
     * The artisan command name and flags.
     * --days=7 controls how old a draft must be before a reminder is sent (default: 7 days).
     * Run with: php artisan applications:send-reminders --days=3
     *
     * @var string
     */
    protected $signature = 'applications:send-reminders {--days=7 : Days after which to send reminders}';

    /**
     * A short description shown when running `php artisan list`.
     *
     * @var string
     */
    protected $description = 'Send reminders for incomplete/draft applications';

    /**
     * Run the command: find old draft applications and email the parent for each one.
     * Only sends reminders when the camp session's registration window is still open.
     */
    public function handle(): int
    {
        // Read the --days option (defaults to 7 if not provided).
        $days = (int) $this->option('days');

        // Find all draft applications that are older than $days and have never been submitted.
        // chunk(50) processes 50 records at a time to prevent memory exhaustion on large datasets.
        $count = 0;
        Application::where('is_draft', true)
            ->whereNull('submitted_at')
            ->where('created_at', '<=', now()->subDays($days))
            ->with(['camper.user', 'campSession'])
            ->chunk(50, function ($applications) use (&$count) {
                foreach ($applications as $application) {
                    // Only send a reminder if registration is still open for this session.
                    // There is no point reminding someone if they can no longer submit.
                    if ($application->campSession->registration_closes_at?->isFuture()) {
                        $application->camper->user->notify(new IncompleteApplicationReminderNotification($application));
                        $count++;
                    }
                }
            });

        $this->info("Sent {$count} incomplete application reminders.");

        return Command::SUCCESS;
    }
}
