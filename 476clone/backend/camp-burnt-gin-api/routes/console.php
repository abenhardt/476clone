<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Scheduled Tasks
|--------------------------------------------------------------------------
|
| Tasks that run on a schedule to handle background operations.
| FR-29: Incomplete application reminders (weekly)
| Record retention compliance (daily)
|
*/

Schedule::command('applications:send-reminders --days=7')
    ->weekly()
    ->mondays()
    ->at('09:00')
    ->withoutOverlapping()
    ->description('Send reminders for incomplete applications');

Schedule::command('campers:calculate-retention')
    ->daily()
    ->at('02:00')
    ->withoutOverlapping()
    ->description('Calculate and update medical record retention dates');

Schedule::command('records:identify-expired')
    ->weekly()
    ->sundays()
    ->at('03:00')
    ->withoutOverlapping()
    ->description('Identify campers past retention period for archival review');
