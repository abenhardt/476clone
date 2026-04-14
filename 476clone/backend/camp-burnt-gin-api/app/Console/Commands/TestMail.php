<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class TestMail extends Command
{
    protected $signature = 'mail:test {email}';
    protected $description = 'Send a test email to verify mail configuration';

    public function handle(): void
    {
        $email = $this->argument('email');
        Mail::raw('This is a test email from Camp Burnt Gin. If you see this in your Mailtrap sandbox, mail is configured correctly!', function ($m) use ($email) {
            $m->to($email)->subject('Camp Burnt Gin - Mail Config Test');
        });
        $this->info("Test email sent to {$email}");
    }
}
