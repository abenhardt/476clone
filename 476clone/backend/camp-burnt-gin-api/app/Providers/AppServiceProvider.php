<?php

namespace App\Providers;

use App\Models\ActivityPermission;
use App\Models\Allergy;
use App\Models\ApplicantDocument;
use App\Models\Application;
use App\Models\ApplicationDraft;
use App\Models\AssistiveDevice;
use App\Models\BehavioralProfile;
use App\Models\Camp;
use App\Models\Camper;
use App\Models\CampSession;
use App\Models\Conversation;
use App\Models\Deadline;
use App\Models\Diagnosis;
use App\Models\Document;
use App\Models\DocumentRequest;
use App\Models\EmergencyContact;
use App\Models\FeedingPlan;
use App\Models\FormDefinition;
use App\Models\FormField;
use App\Models\FormSection;
use App\Models\MedicalFollowUp;
use App\Models\MedicalIncident;
use App\Models\MedicalRecord;
use App\Models\MedicalRestriction;
use App\Models\MedicalVisit;
use App\Models\Medication;
use App\Models\Message;
use App\Models\RiskAssessment;
use App\Models\Role;
use App\Models\TreatmentLog;
use App\Models\UserEmergencyContact;
use App\Observers\AllergyObserver;
use App\Observers\AssistiveDeviceObserver;
use App\Observers\BehavioralProfileObserver;
use App\Observers\CamperObserver;
use App\Observers\DatabaseNotificationObserver;
use App\Observers\DeadlineObserver;
use App\Observers\DiagnosisObserver;
use App\Observers\FeedingPlanObserver;
use App\Observers\MedicalRecordObserver;
use App\Policies\ActivityPermissionPolicy;
use App\Policies\AllergyPolicy;
use App\Policies\ApplicantDocumentPolicy;
use App\Policies\ApplicationDraftPolicy;
use App\Policies\ApplicationPolicy;
use App\Policies\AssistiveDevicePolicy;
use App\Policies\BehavioralProfilePolicy;
use App\Policies\CamperPolicy;
use App\Policies\CampPolicy;
use App\Policies\CampSessionPolicy;
use App\Policies\ConversationPolicy;
use App\Policies\DeadlinePolicy;
use App\Policies\DiagnosisPolicy;
use App\Policies\DocumentPolicy;
use App\Policies\DocumentRequestPolicy;
use App\Policies\EmergencyContactPolicy;
use App\Policies\FeedingPlanPolicy;
use App\Policies\FormDefinitionPolicy;
use App\Policies\FormFieldPolicy;
use App\Policies\FormSectionPolicy;
use App\Policies\MedicalFollowUpPolicy;
use App\Policies\MedicalIncidentPolicy;
use App\Policies\MedicalRecordPolicy;
use App\Policies\MedicalRestrictionPolicy;
use App\Policies\MedicalVisitPolicy;
use App\Policies\MedicationPolicy;
use App\Policies\MessagePolicy;
use App\Policies\RiskAssessmentPolicy;
use App\Policies\RolePolicy;
use App\Policies\TreatmentLogPolicy;
use App\Policies\UserEmergencyContactPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

/**
 * AppServiceProvider — Application Bootstrap and Service Registration
 *
 * This is the main "startup file" for the Laravel application. Laravel calls
 * boot() and register() on this provider every time the application starts.
 *
 * Think of it as the control room that wires everything together:
 *
 *  1. POLICIES  — tells Laravel "when a user tries to do X with model Y,
 *                 check policy Z to decide if they're allowed."
 *                 Every model that has access restrictions is listed here.
 *
 *  2. OBSERVERS — attaches observer classes to models so when a model is
 *                 created/updated/deleted, the observer automatically runs.
 *                 Used here to recalculate medical risk scores when clinical
 *                 data changes (e.g. adding a diagnosis updates supervision level).
 *
 *  3. RATE LIMITING — registers named rate-limit rules used by routes.
 *                 Prevents abuse of authentication, uploads, and sensitive operations.
 *
 * Note: this provider also handles AuthServiceProvider responsibilities since
 * Laravel 11+ consolidates providers into AppServiceProvider.
 */
class AppServiceProvider extends ServiceProvider
{
    /**
     * The model-to-policy mapping table.
     *
     * Each entry says: "when a Gate/Policy check is performed on this model class,
     * use this policy class to determine whether the action is allowed."
     *
     * Policies live in app/Policies/ and follow a standard naming convention:
     * {ModelName}Policy with methods like viewAny, view, create, update, delete.
     *
     * @var array<class-string, class-string>
     */
    protected array $policies = [
        // Core camper and application data
        Camper::class => CamperPolicy::class,
        Application::class => ApplicationPolicy::class,
        ApplicationDraft::class => ApplicationDraftPolicy::class,

        // Medical record and clinical data (PHI — strict access control)
        MedicalRecord::class => MedicalRecordPolicy::class,
        EmergencyContact::class => EmergencyContactPolicy::class,
        Allergy::class => AllergyPolicy::class,
        Medication::class => MedicationPolicy::class,
        Document::class => DocumentPolicy::class,
        // Special health care needs (CYSHCN) clinical data
        ActivityPermission::class => ActivityPermissionPolicy::class,
        AssistiveDevice::class => AssistiveDevicePolicy::class,
        BehavioralProfile::class => BehavioralProfilePolicy::class,
        Diagnosis::class => DiagnosisPolicy::class,
        FeedingPlan::class => FeedingPlanPolicy::class,

        // Camp management
        Camp::class => CampPolicy::class,
        CampSession::class => CampSessionPolicy::class,

        // Inbox messaging system policies
        Conversation::class => ConversationPolicy::class,
        Message::class => MessagePolicy::class,

        // Role delegation governance (super_admin only)
        Role::class => RolePolicy::class,

        // User-level (not camper-level) emergency contacts
        UserEmergencyContact::class => UserEmergencyContactPolicy::class,

        // Medical staff treatment logs (Phase 6)
        TreatmentLog::class => TreatmentLogPolicy::class,

        // Phase 11: Full medical portal models
        MedicalIncident::class => MedicalIncidentPolicy::class,
        MedicalFollowUp::class => MedicalFollowUpPolicy::class,
        MedicalVisit::class => MedicalVisitPolicy::class,
        MedicalRestriction::class => MedicalRestrictionPolicy::class,

        // Risk assessment — system-calculated camper risk scores (PHI)
        RiskAssessment::class => RiskAssessmentPolicy::class,

        // Applicant Documents — admin-to-applicant document workflow
        ApplicantDocument::class => ApplicantDocumentPolicy::class,

        // Application form management (Phase 14 — dynamic form builder)
        FormDefinition::class => FormDefinitionPolicy::class,
        FormSection::class => FormSectionPolicy::class,
        FormField::class => FormFieldPolicy::class,

        // Document requests — admin-initiated document request workflow (Phase 13)
        DocumentRequest::class => DocumentRequestPolicy::class,

        // Deadline management system — single source of truth for all time-based enforcement
        Deadline::class => DeadlinePolicy::class,
    ];

    /**
     * Register application services.
     *
     * Called before boot(). Use this to bind things into the service container.
     * Currently empty — all registrations are done in boot() for this provider.
     */
    public function register(): void {}

    /**
     * Bootstrap application services.
     *
     * Called after all providers are registered. Wires up policies, observers,
     * and rate limiters that the application needs to function correctly.
     */
    public function boot(): void
    {
        // Force all generated URLs to use HTTPS in production.
        // This ensures redirect responses, asset URLs, and signed URLs are never
        // downgraded to HTTP — important when Laravel sits behind a TLS terminator.
        if ($this->app->environment('production')) {
            URL::forceHttps();
        }

        // Global password strength defaults — enforces mixed case, numbers, symbols,
        // and breach-database check on all Password::defaults() usages.
        Password::defaults(fn () => Password::min(8)->mixedCase()->numbers()->symbols()->uncompromised());

        $this->registerPolicies();
        $this->registerObservers();
        $this->configureRateLimiting();
        $this->registerGateAbilities();
    }

    /**
     * Register standalone Gate abilities that are not tied to a specific model/policy.
     *
     * These abilities cover cross-cutting access rules that don't map cleanly to a
     * single model (e.g. "view-families" operates on User but with different semantics
     * than the UserPolicy which governs super_admin user-management).
     */
    protected function registerGateAbilities(): void
    {
        // 'view-families' — grants admin and super_admin access to the family management
        // endpoints (GET /api/families and GET /api/families/{user}).
        // Regular admins need this for daily operations; super_admin inherits it via isAdmin().
        Gate::define('view-families', fn (\App\Models\User $user): bool => $user->isAdmin());
    }

    /**
     * Register all model policies with Laravel's Gate.
     *
     * Iterates the $policies array above and calls Gate::policy() for each entry.
     * After this runs, $gate->allows('update', $camper) will automatically find
     * and call CamperPolicy::update().
     */
    protected function registerPolicies(): void
    {
        foreach ($this->policies as $model => $policy) {
            Gate::policy($model, $policy);
        }
    }

    /**
     * Register Eloquent model observers for automatic medical risk reassessment.
     *
     * Observers are classes that "watch" a model and react when it changes.
     * When a camper's medical data is modified (e.g. a new diagnosis is added),
     * the observer automatically recalculates the camper's risk score and
     * updates their supervision level — no manual recalculation needed.
     *
     * Models observed:
     *  - Camper:           recalculates when base camper data changes
     *  - MedicalRecord:    recalculates when seizure history or neurostimulator changes
     *  - Diagnosis:        recalculates when a diagnosis is added/updated/removed
     *  - Allergy:          recalculates when a life-threatening allergy is added/changed/removed
     *  - BehavioralProfile: recalculates when behavioural risk flags change
     *  - FeedingPlan:      recalculates when G-tube or feeding needs change
     *  - AssistiveDevice:  recalculates when transfer-assistance needs change
     */
    protected function registerObservers(): void
    {
        Camper::observe(CamperObserver::class);
        MedicalRecord::observe(MedicalRecordObserver::class);
        Diagnosis::observe(DiagnosisObserver::class);
        Allergy::observe(AllergyObserver::class);
        BehavioralProfile::observe(BehavioralProfileObserver::class);
        FeedingPlan::observe(FeedingPlanObserver::class);
        AssistiveDevice::observe(AssistiveDeviceObserver::class);
        // Deadline observer: maintains 1:1 parity with CalendarEvent on every write
        Deadline::observe(DeadlineObserver::class);
        // Broadcasts NotificationCreated to the recipient's private channel whenever a
        // new database notification row is written — powers the real-time bell badge.
        DatabaseNotification::observe(DatabaseNotificationObserver::class);
    }

    /**
     * Configure named rate limiting rules for the application.
     *
     * These rules are referenced by name in routes/api.php using middleware('throttle:{name}').
     * Each rule defines a maximum number of requests per time window, identified by
     * either the authenticated user's ID or their IP address (for unauthenticated requests).
     *
     * Rules and their limits:
     *  - api:            60 req/min  — general API rate limit for all authenticated routes
     *  - auth:            5 req/min  — login/register (strict, prevents brute-force)
     *  - mfa:             5 req/min  — MFA verification (prevents code guessing)
     *  - uploads:        10 req/hour — file uploads (prevents storage abuse)
     *  - sensitive:      30 req/hour — sensitive operations (password change, account deletion)
     *  - inbox-compose:  30/min (admin) or 5/min (applicant) — conversation creation
     */
    protected function configureRateLimiting(): void
    {
        // General API limit: 60 requests per minute per user (or IP if unauthenticated)
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many requests. Please wait a moment and try again.',
                        'retry_after' => 60,
                    ], 429);
                });
        });

        // Authentication limit: 5 requests per minute per IP — prevents brute-force attacks
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many authentication attempts. Please try again later.',
                    ], 429);
                });
        });

        // MFA limit: 5 per minute per user — prevents 6-digit code brute-forcing
        RateLimiter::for('mfa', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many MFA attempts. Please try again later.',
                    ], 429);
                });
        });

        // Upload limit: 10 per hour per user — prevents storage exhaustion attacks
        RateLimiter::for('uploads', function (Request $request) {
            return Limit::perHour(10)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Upload limit exceeded. Please try again later.',
                    ], 429);
                });
        });

        // Inbox compose limit: admins/super_admins get 30/min; applicants get 5/min.
        // Prevents conversation spam while not blocking staff who compose in bulk.
        RateLimiter::for('inbox-compose', function (Request $request) {
            $user = $request->user();
            $limit = ($user && $user->isAdmin()) ? 30 : 5;

            return Limit::perMinute($limit)->by($user?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too Many Attempts.',
                    ], 429);
                });
        });

        // Sensitive operations limit: 30 per hour per user — covers password changes, account deletion
        RateLimiter::for('sensitive', function (Request $request) {
            return Limit::perHour(30)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Rate limit exceeded for sensitive operations.',
                    ], 429);
                });
        });

        // PHI export limit: 5 per hour per user — covers audit log CSV/JSON export.
        // Each export can include up to 5,000 rows of sensitive audit data; this
        // limit prevents bulk exfiltration even from a compromised super_admin account.
        RateLimiter::for('phi-export', function (Request $request) {
            return Limit::perHour(5)->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Export rate limit exceeded. A maximum of 5 exports per hour is allowed. Please narrow your date range or wait before exporting again.',
                    ], 429);
                });
        });
    }
}
