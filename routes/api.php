<?php

use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\EmailVerificationController;
use App\Http\Controllers\Api\Auth\MfaController;
use App\Http\Controllers\Api\Auth\PasswordResetController;
use App\Http\Controllers\Api\CalendarEventController;
use App\Http\Controllers\Api\Camp\CampController;
use App\Http\Controllers\Api\Camp\CampSessionController;
use App\Http\Controllers\Api\Camp\SessionDashboardController;
use App\Http\Controllers\Api\Camper\ApplicationController;
use App\Http\Controllers\Api\Camper\ApplicationDraftController;
use App\Http\Controllers\Api\Camper\CamperController;
use App\Http\Controllers\Api\Camper\PersonalCarePlanController;
use App\Http\Controllers\Api\Camper\UserProfileController;
use App\Http\Controllers\Api\Deadline\DeadlineController;
use App\Http\Controllers\Api\Document\ApplicantDocumentController;
use App\Http\Controllers\Api\Document\DocumentController;
use App\Http\Controllers\Api\Document\DocumentRequestController;
use App\Http\Controllers\Api\Family\FamilyController;
use App\Http\Controllers\Api\Form\FormDefinitionController;
use App\Http\Controllers\Api\Form\FormFieldController;
use App\Http\Controllers\Api\Form\FormFieldOptionController;
use App\Http\Controllers\Api\Form\FormsDownloadController;
use App\Http\Controllers\Api\Form\FormSectionController;
use App\Http\Controllers\Api\Form\FormTemplateController;
use App\Http\Controllers\Api\Form\PublicFormController;
use App\Http\Controllers\Api\Inbox\ConversationController;
use App\Http\Controllers\Api\Inbox\InboxUserController;
use App\Http\Controllers\Api\Inbox\MessageController;
use App\Http\Controllers\Api\Medical\ActivityPermissionController;
use App\Http\Controllers\Api\Medical\AllergyController;
use App\Http\Controllers\Api\Medical\AssistiveDeviceController;
use App\Http\Controllers\Api\Medical\BehavioralProfileController;
use App\Http\Controllers\Api\Medical\DiagnosisController;
use App\Http\Controllers\Api\Medical\EmergencyContactController;
use App\Http\Controllers\Api\Medical\FeedingPlanController;
use App\Http\Controllers\Api\Medical\MedicalFollowUpController;
use App\Http\Controllers\Api\Medical\MedicalIncidentController;
use App\Http\Controllers\Api\Medical\MedicalRecordController;
use App\Http\Controllers\Api\Medical\MedicalRestrictionController;
use App\Http\Controllers\Api\Medical\MedicalStatsController;
use App\Http\Controllers\Api\Medical\MedicalVisitController;
use App\Http\Controllers\Api\Medical\MedicationController;
use App\Http\Controllers\Api\Medical\TreatmentLogController;
use App\Http\Controllers\Api\Risk\RiskAssessmentController;
use App\Http\Controllers\Api\System\AuditLogController;
use App\Http\Controllers\Api\System\HealthController;
use App\Http\Controllers\Api\System\NotificationController;
use App\Http\Controllers\Api\System\ReportController;
use App\Http\Controllers\Api\System\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Camp Burnt Gin
|--------------------------------------------------------------------------
|
| All routes in this file are automatically prefixed with /api by Laravel.
| For example, Route::get('/health') maps to GET /api/health.
|
| Route structure:
|  - Public routes (no auth):    /health, /ready, /auth/*
|  - Authenticated routes:       Everything under middleware('auth:sanctum')
|    - Admin-only:               Additional middleware('admin') or middleware('role:...')
|    - Super-admin-only:         middleware('role:super_admin')
|    - Medical + admin only:     middleware('role:admin,medical')
|
| Rate limiting is applied via named limiters defined in AppServiceProvider.
| Policies (defined in AppServiceProvider) enforce per-record authorization.
|
*/

/*
|--------------------------------------------------------------------------
| Health Check Routes (No Authentication Required)
|--------------------------------------------------------------------------
|
| These endpoints are used by monitoring tools and container orchestrators
| (e.g. Kubernetes, AWS ECS) to check if the application is alive and ready.
| They intentionally skip authentication so probes can run without credentials.
|
| GET /health  → liveness probe  (is the app running?)
| GET /ready   → readiness probe (is the app ready to serve traffic?)
|
*/
Route::get('/health', [HealthController::class, 'liveness'])->name('health.liveness');
Route::get('/ready', [HealthController::class, 'readiness'])->name('health.readiness');

/*
|--------------------------------------------------------------------------
| Public Form Downloads
|--------------------------------------------------------------------------
|
| Blank application and medical examination forms that families can download
| before or during the application process. No authentication required so
| families can access the forms at any point in the workflow.
|
*/
Route::middleware('throttle:api')->prefix('forms')->group(function () {
    Route::get('/', [FormsDownloadController::class, 'index'])->name('forms.index');
    Route::get('/application', [FormsDownloadController::class, 'application'])->name('forms.application');
    Route::get('/application-spanish', [FormsDownloadController::class, 'applicationSpanish'])->name('forms.application-spanish');
    Route::get('/medical-exam', [FormsDownloadController::class, 'medicalExam'])->name('forms.medical-exam');
    Route::get('/cyshcn', [FormsDownloadController::class, 'cyshcn'])->name('forms.cyshcn');
});

/*
|--------------------------------------------------------------------------
| Public Authentication Routes
|--------------------------------------------------------------------------
|
| These routes handle account creation, login, and password recovery.
| No API token is required, but the 'throttle:auth' rate limiter is applied
| (5 requests per minute per IP) to prevent brute-force and enumeration attacks.
|
*/
Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    // Create a new applicant (parent) account
    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    // Log in with email + password (and optionally an MFA code)
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    // Request a password reset email
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink'])->name('password.email');
    // Complete the password reset using the emailed token
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->name('password.reset');
    // Verify an email address using the token sent in the verification email
    // No auth required — the token itself is the credential
    Route::post('/email/verify', [EmailVerificationController::class, 'verify'])->name('verification.verify');
});

/*
|--------------------------------------------------------------------------
| Auth-Only Routes (authenticated but NOT required to be verified)
|--------------------------------------------------------------------------
|
| These routes must be accessible to authenticated users who have not yet
| verified their email address:
|  - Resend verification email
|  - Logout (unverified users must be able to log out)
|  - MFA setup / verify / disable (MFA is part of the login flow)
|
*/
Route::middleware(['auth:sanctum'])->group(function () {
    // Resend verification email — tighter rate limit (6/min) to prevent abuse
    Route::post('/auth/email/resend', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')
        ->name('verification.resend');

    // Logout — unverified users must be able to revoke their token
    Route::post('/logout', [AuthController::class, 'logout'])->name('auth.logout');

    // GET /user — returns the authenticated user's profile with role.
    // Must be accessible to unverified users so the frontend can restore the session
    // on page refresh and check email_verified_at before routing the user.
    Route::get('/user', [AuthController::class, 'user'])->name('auth.user');

    // MFA routes — MFA verification is part of authentication; must not require verified email
    Route::prefix('mfa')->middleware('throttle:mfa')->group(function () {
        // Step 1: Generate secret + QR code for the user to scan
        Route::post('/setup', [MfaController::class, 'setup'])->name('mfa.setup');
        // Step 2: Confirm the authenticator app is working by submitting the first code
        Route::post('/verify', [MfaController::class, 'verify'])->name('mfa.verify');
        // Disable MFA after verifying password + current TOTP code
        Route::post('/disable', [MfaController::class, 'disable'])->name('mfa.disable');
        // Step-up authentication: re-verify identity before a sensitive action.
        // On success, a short-lived cache grant lets EnsureMfaStepUp pass through.
        Route::post('/step-up', [MfaController::class, 'stepUp'])->name('mfa.step-up');
    });
});

/*
|--------------------------------------------------------------------------
| All Authenticated + Verified Routes
|--------------------------------------------------------------------------
|
| Every route in this group requires:
|  - A valid Sanctum bearer token (auth:sanctum)
|  - A verified email address (verified)
|  - Respects the 'api' rate limit (60 req/min)
|
| Model-level authorization (who can view/edit which records) is enforced
| by policies via $this->authorize() calls in each controller.
|
*/
Route::middleware(['auth:sanctum', 'verified', 'throttle:api'])->group(function () {
    /*
    |--------------------------------------------------------------------------
    | User Profile Routes
    |--------------------------------------------------------------------------
    |
    | Implements FR-7: Pre-fill recurring fields for returning applicants.
    | The /prefill endpoint returns saved profile data so the application form
    | can auto-populate fields the user filled in previously.
    |
    */
    Route::prefix('profile')->group(function () {
        Route::get('/', [UserProfileController::class, 'show'])->name('profile.show');
        Route::put('/', [UserProfileController::class, 'update'])->name('profile.update');
        // Returns structured pre-fill data for the application form
        Route::get('/prefill', [UserProfileController::class, 'prefillData'])->name('profile.prefill');
        Route::get('/notification-preferences', [UserProfileController::class, 'getNotificationPreferences'])->name('profile.notification-preferences.show');
        Route::put('/notification-preferences', [UserProfileController::class, 'updateNotificationPreferences'])->name('profile.notification-preferences.update');
        Route::put('/password', [UserProfileController::class, 'changePassword'])->name('profile.password.update');

        // Avatar upload and removal (throttled because uploads are expensive)
        Route::post('/avatar', [UserProfileController::class, 'uploadAvatar'])
            ->middleware('throttle:uploads')
            ->name('profile.avatar.upload');
        Route::delete('/avatar', [UserProfileController::class, 'removeAvatar'])->name('profile.avatar.remove');

        // Account-level emergency contacts (separate from camper emergency contacts)
        Route::get('/emergency-contacts', [UserProfileController::class, 'listEmergencyContacts'])->name('profile.emergency-contacts.index');
        Route::post('/emergency-contacts', [UserProfileController::class, 'storeEmergencyContact'])->name('profile.emergency-contacts.store');
        Route::put('/emergency-contacts/{contact}', [UserProfileController::class, 'updateEmergencyContact'])->name('profile.emergency-contacts.update');
        Route::delete('/emergency-contacts/{contact}', [UserProfileController::class, 'destroyEmergencyContact'])->name('profile.emergency-contacts.destroy');

        // Account deletion (throttled to prevent abuse)
        Route::delete('/account', [UserProfileController::class, 'deleteAccount'])
            ->middleware('throttle:sensitive')
            ->name('profile.account.delete');
    });

    /*
    |--------------------------------------------------------------------------
    | Camp and Session Routes
    |--------------------------------------------------------------------------
    |
    | Camps and sessions are publicly readable by any authenticated user.
    | Only admins can create, update, or delete them.
    |
    */
    Route::prefix('camps')->group(function () {
        Route::get('/', [CampController::class, 'index'])->name('camps.index');
        Route::get('/{camp}', [CampController::class, 'show'])->name('camps.show');
        Route::post('/', [CampController::class, 'store'])->middleware('admin')->name('camps.store');
        Route::put('/{camp}', [CampController::class, 'update'])->middleware('admin')->name('camps.update');
        Route::delete('/{camp}', [CampController::class, 'destroy'])->middleware('admin')->name('camps.destroy');
    });

    Route::prefix('sessions')->group(function () {
        Route::get('/', [CampSessionController::class, 'index'])->name('sessions.index');
        Route::get('/{session}', [CampSessionController::class, 'show'])->name('sessions.show');
        Route::post('/', [CampSessionController::class, 'store'])->middleware('admin')->name('sessions.store');
        Route::put('/{session}', [CampSessionController::class, 'update'])->middleware('admin')->name('sessions.update');
        Route::delete('/{session}', [CampSessionController::class, 'destroy'])->middleware('admin')->name('sessions.destroy');
        // Session dashboard + operations (Phase 15)
        Route::get('/{session}/dashboard', [SessionDashboardController::class, 'dashboard'])->middleware('admin')->name('sessions.dashboard');
        Route::get('/{session}/applications', [SessionDashboardController::class, 'applications'])->middleware('admin')->name('sessions.applications');
        Route::post('/{session}/activate', [CampSessionController::class, 'activate'])->middleware('admin')->name('sessions.activate');
        Route::post('/{session}/deactivate', [CampSessionController::class, 'deactivate'])->middleware('admin')->name('sessions.deactivate');
        Route::post('/{session}/archive', [CampSessionController::class, 'archive'])->middleware('admin')->name('sessions.archive');
        Route::post('/{session}/restore', [CampSessionController::class, 'restore'])->middleware('admin')->name('sessions.restore');
    });

    /*
    |--------------------------------------------------------------------------
    | Notification Routes
    |--------------------------------------------------------------------------
    |
    | Database notifications from Laravel's notification system.
    | These appear in the bell-icon dropdown (separate from the inbox system).
    |
    */
    Route::prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index'])->name('notifications.index');
        Route::put('/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
        Route::put('/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.read-all');
        Route::delete('/clear-all', [NotificationController::class, 'deleteAll'])->name('notifications.clear-all');
    });

    /*
    |--------------------------------------------------------------------------
    | Document Upload Routes
    |--------------------------------------------------------------------------
    |
    | Document uploads are throttled by the 'uploads' limiter (10/hour).
    | Downloads are throttled by 'sensitive' (30/hour) because files may contain PHI.
    | The /verify endpoint is admin-only (handled by DocumentPolicy).
    |
    */
    Route::prefix('documents')->group(function () {
        Route::get('/', [DocumentController::class, 'index'])->name('documents.index');
        Route::post('/', [DocumentController::class, 'store'])->middleware('throttle:uploads')->name('documents.store');
        Route::get('/{document}', [DocumentController::class, 'show'])->name('documents.show');
        // Downloads are throttled at 30/hour to limit PHI data exfiltration
        Route::get('/{document}/download', [DocumentController::class, 'download'])->middleware('throttle:sensitive')->name('documents.download');
        // Only admins can verify (approve/reject) documents — enforced by DocumentPolicy
        Route::patch('/{document}/verify', [DocumentController::class, 'verify'])->name('documents.verify');
        // Archive/restore: non-destructive alternative to delete (admin only)
        Route::patch('/{document}/archive', [DocumentController::class, 'archive'])->name('documents.archive');
        Route::patch('/{document}/restore', [DocumentController::class, 'restore'])->name('documents.restore');
        // Submit: applicant promotes a draft upload to submitted state (visible to admins)
        Route::patch('/{document}/submit', [DocumentController::class, 'submit'])->name('documents.submit');
        Route::delete('/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Applicant Documents Routes
    |--------------------------------------------------------------------------
    |
    | Admin side: send documents to applicants, list, download, review, replace.
    | Applicant side: list assigned documents, download original, upload completed.
    |
    */

    // Applicant Documents — Admin side
    Route::middleware(['role:admin,super_admin'])->group(function () {
        Route::post('/admin/documents/send', [ApplicantDocumentController::class, 'adminSend']);
        Route::get('/admin/documents', [ApplicantDocumentController::class, 'adminList']);
        Route::get('/admin/documents/{applicantId}', [ApplicantDocumentController::class, 'adminListForApplicant']);
        // Admin PHI file downloads — require MFA enrollment before serving raw files.
        Route::get('/admin/applicant-documents/{applicantDocument}/download-original', [ApplicantDocumentController::class, 'adminDownloadOriginal'])->middleware('mfa.enrolled');
        Route::get('/admin/applicant-documents/{applicantDocument}/download-submitted', [ApplicantDocumentController::class, 'adminDownloadSubmitted'])->middleware('mfa.enrolled');
        Route::patch('/admin/applicant-documents/{applicantDocument}/review', [ApplicantDocumentController::class, 'adminMarkReviewed']);
        Route::post('/admin/applicant-documents/{applicantDocument}/replace', [ApplicantDocumentController::class, 'adminReplace']);
    });

    // Applicant Documents — Applicant side
    Route::middleware(['role:applicant'])->group(function () {
        Route::get('/applicant/documents', [ApplicantDocumentController::class, 'applicantList']);
        Route::get('/applicant/applicant-documents/{applicantDocument}/download', [ApplicantDocumentController::class, 'applicantDownload']);
        Route::get('/applicant/applicant-documents/{applicantDocument}/download-submitted', [ApplicantDocumentController::class, 'applicantDownloadSubmitted']);
        Route::post('/applicant/documents/upload', [ApplicantDocumentController::class, 'applicantSubmit'])
            ->middleware('throttle:uploads');
    });

    /*
    |--------------------------------------------------------------------------
    | Document Requests Routes
    |--------------------------------------------------------------------------
    |
    | Admin: create requests, list, view stats, approve, reject.
    | Applicant: list own requests, upload document, download uploaded file.
    |
    */

    // Document Requests — Admin side
    Route::middleware(['role:admin,super_admin'])->group(function () {
        Route::get('/document-requests/stats', [DocumentRequestController::class, 'stats']);
        Route::get('/document-requests', [DocumentRequestController::class, 'index']);
        Route::post('/document-requests', [DocumentRequestController::class, 'store']);
        Route::get('/document-requests/{documentRequest}', [DocumentRequestController::class, 'show']);
        Route::get('/document-requests/{documentRequest}/download', [DocumentRequestController::class, 'download'])
            ->middleware('throttle:sensitive');
        Route::patch('/document-requests/{documentRequest}/approve', [DocumentRequestController::class, 'approve']);
        Route::patch('/document-requests/{documentRequest}/reject', [DocumentRequestController::class, 'reject']);
        Route::delete('/document-requests/{documentRequest}', [DocumentRequestController::class, 'cancel']);
        Route::post('/document-requests/{documentRequest}/remind', [DocumentRequestController::class, 'remind']);
        Route::patch('/document-requests/{documentRequest}/extend', [DocumentRequestController::class, 'extend']);
        Route::patch('/document-requests/{documentRequest}/reupload', [DocumentRequestController::class, 'requestReupload']);
    });

    // Document Requests — Applicant side
    Route::middleware(['role:applicant'])->group(function () {
        Route::get('/applicant/document-requests', [DocumentRequestController::class, 'applicantIndex']);
        Route::post('/applicant/document-requests/{documentRequest}/upload', [DocumentRequestController::class, 'applicantUpload'])
            ->middleware('throttle:uploads');
        Route::get('/applicant/document-requests/{documentRequest}/download', [DocumentRequestController::class, 'applicantDownload'])
            ->middleware('throttle:sensitive');
    });

    /*
    |--------------------------------------------------------------------------
    | Family Routes (Admin Only)
    |--------------------------------------------------------------------------
    |
    | Family-first admin view of guardian accounts and their registered campers.
    | A "family" is an applicant User with one or more associated campers.
    |
    | These endpoints power the 3-level family management IA:
    |   Level 1 — GET /families          → paginated family summary cards
    |   Level 2 — GET /families/{user}   → full family workspace
    |   Level 3 — existing /campers/{id} and /applications/{id} endpoints
    |
    | Authorization: admin and super_admin only (enforced by FamilyController
    | via the 'view-families' Gate ability defined in AppServiceProvider).
    |
    | PHI safety: no medical record data is loaded in either endpoint.
    | Only structural/application data (names, DOB, session, status) is returned.
    |
    */
    Route::middleware('admin')->prefix('families')->group(function () {
        Route::get('/', [FamilyController::class, 'index'])->name('families.index');
        Route::get('/{user}', [FamilyController::class, 'show'])->name('families.show');
    });

    /*
    |--------------------------------------------------------------------------
    | Report Routes (Admin Only)
    |--------------------------------------------------------------------------
    |
    | All report endpoints are protected by the 'admin' middleware.
    | Reports may contain sensitive aggregate data and camper PHI.
    |
    */
    Route::middleware('admin')->prefix('reports')->group(function () {
        // Summary is aggregate/non-PHI data — no MFA enforcement needed.
        Route::get('/summary', [ReportController::class, 'summary'])->name('reports.summary');
        // CSV exports contain individual camper PHI (names, DOBs, addresses) — require MFA
        // enrollment and apply the phi-export rate limiter (same as audit-log.export).
        Route::get('/applications', [ReportController::class, 'applications'])->middleware(['throttle:phi-export', 'mfa.enrolled'])->name('reports.applications');
        Route::get('/accepted', [ReportController::class, 'acceptedApplicants'])->middleware(['throttle:phi-export', 'mfa.enrolled'])->name('reports.accepted');
        Route::get('/rejected', [ReportController::class, 'rejectedApplicants'])->middleware(['throttle:phi-export', 'mfa.enrolled'])->name('reports.rejected');
        Route::get('/mailing-labels', [ReportController::class, 'mailingLabels'])->middleware(['throttle:phi-export', 'mfa.enrolled'])->name('reports.mailing-labels');
        Route::get('/id-labels', [ReportController::class, 'idLabels'])->middleware(['throttle:phi-export', 'mfa.enrolled'])->name('reports.id-labels');
    });

    /*
    |--------------------------------------------------------------------------
    | Camper Routes
    |--------------------------------------------------------------------------
    |
    | Parents (applicant role) can only access their own children — enforced
    | by CamperPolicy. Admins can access all campers. Medical providers have
    | no access to these endpoints.
    |
    | Special computed endpoints:
    |  - /risk-summary:       Returns risk score, supervision level, and flags
    |  - /compliance-status:  Returns document compliance check results
    |  - /medical-alerts:     Returns computed medical alerts for the camper
    |
    */
    Route::prefix('campers')->group(function () {
        Route::get('/', [CamperController::class, 'index'])->name('campers.index');
        Route::post('/', [CamperController::class, 'store'])->name('campers.store');
        Route::get('/{camper}', [CamperController::class, 'show'])->name('campers.show');
        Route::put('/{camper}', [CamperController::class, 'update'])->name('campers.update');
        Route::delete('/{camper}', [CamperController::class, 'destroy'])->name('campers.destroy');
        // Runs SpecialNeedsRiskAssessmentService and returns the scored results (legacy endpoint, kept for BC)
        Route::get('/{camper}/risk-summary', [CamperController::class, 'riskSummary'])->name('campers.risk-summary');
        // Full risk assessment with factor breakdown, medical review state, and recommendations
        Route::get('/{camper}/risk-assessment', [RiskAssessmentController::class, 'show'])->name('campers.risk-assessment.show');
        // Medical staff: validate the assessment and add clinical notes (role: admin, medical)
        Route::post('/{camper}/risk-assessment/review', [RiskAssessmentController::class, 'review'])
            ->middleware('role:admin,medical')
            ->name('campers.risk-assessment.review');
        // Clinical override: change the supervision level with a documented reason (role: medical, super_admin)
        Route::post('/{camper}/risk-assessment/override', [RiskAssessmentController::class, 'override'])
            ->middleware('role:medical,super_admin')
            ->name('campers.risk-assessment.override');
        // History of all past assessments for this camper (role: admin, medical)
        Route::get('/{camper}/risk-assessment/history', [RiskAssessmentController::class, 'history'])
            ->middleware('role:admin,medical')
            ->name('campers.risk-assessment.history');
        // Runs DocumentEnforcementService and returns compliance gaps
        Route::get('/{camper}/compliance-status', [CamperController::class, 'complianceStatus'])->name('campers.compliance-status');
        // Runs MedicalAlertService and returns sorted alert list
        Route::get('/{camper}/medical-alerts', [CamperController::class, 'medicalAlerts'])->name('campers.medical-alerts');
        // Fetch or upsert the camper's ADL personal care plan (Section 6 of the application form).
        Route::get('/{camper}/personal-care-plan', [PersonalCarePlanController::class, 'show'])->name('campers.personal-care-plan.show');
        Route::post('/{camper}/personal-care-plan', [PersonalCarePlanController::class, 'store'])->name('campers.personal-care-plan.store');
        // Upsert extended health profile fields onto the camper's MedicalRecord (Section 2 ext.).
        Route::post('/{camper}/health-profile', [MedicalRecordController::class, 'storeHealthProfile'])->name('campers.health-profile.store');
    });

    /*
    |--------------------------------------------------------------------------
    | Application Routes
    |--------------------------------------------------------------------------
    |
    | Parents can submit and view their own children's applications.
    | The /review endpoint (admin only) triggers the full ApplicationService
    | workflow (compliance check, status update, notifications, letters).
    |
    */
    /*
    |--------------------------------------------------------------------------
    | Application Drafts (server-side save slots for in-progress forms)
    |--------------------------------------------------------------------------
    |
    | Applicant-only. Each draft is a raw JSON blob of FormState — no camper
    | record is created until final submission.
    |
    */
    Route::prefix('application-drafts')->group(function () {
        Route::get('/', [ApplicationDraftController::class, 'index'])->name('application-drafts.index');
        Route::post('/', [ApplicationDraftController::class, 'store'])->name('application-drafts.store');
        Route::get('/{draft}', [ApplicationDraftController::class, 'show'])->name('application-drafts.show');
        Route::put('/{draft}', [ApplicationDraftController::class, 'update'])->name('application-drafts.update');
        Route::delete('/{draft}', [ApplicationDraftController::class, 'destroy'])->name('application-drafts.destroy');
    });

    Route::prefix('applications')->group(function () {
        Route::get('/', [ApplicationController::class, 'index'])->name('applications.index');
        Route::post('/', [ApplicationController::class, 'store'])->name('applications.store');
        Route::get('/{application}', [ApplicationController::class, 'show'])->name('applications.show');
        Route::put('/{application}', [ApplicationController::class, 'update'])->name('applications.update');
        // Sign an application (parent e-signature step)
        Route::post('/{application}/sign', [ApplicationController::class, 'sign'])->name('applications.sign');
        // Withdraw an application — parent-initiated only (no admin middleware).
        // Admins cancel via /review with status=cancelled.
        Route::post('/{application}/withdraw', [ApplicationController::class, 'withdraw'])->name('applications.withdraw');
        // Store guardian consent records (5 consents per application, matching CYSHCN paper form).
        Route::post('/{application}/consents', [ApplicationController::class, 'storeConsents'])->name('applications.consents.store');
        // Clone an application into a new reapplication draft (same camper, new session).
        Route::post('/{application}/clone', [ApplicationController::class, 'clone'])->name('applications.clone');
        // Hard delete — admin only; step-up required (irreversible action)
        Route::delete('/{application}', [ApplicationController::class, 'destroy'])
            ->middleware(['admin', 'mfa.step_up'])
            ->name('applications.destroy');
        // Pre-approval completeness check — read-only; returns structured missing-data report.
        Route::get('/{application}/completeness', [ApplicationController::class, 'completeness'])
            ->middleware('admin')
            ->name('applications.completeness');
        // Approve/reject an application — admin-only; no MFA step-up (routine operational task).
        // Delete (above) retains step-up because it is irreversible.
        Route::post('/{application}/review', [ApplicationController::class, 'review'])
            ->middleware('admin')
            ->name('applications.review');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Record Routes
    |--------------------------------------------------------------------------
    |
    | Medical records contain HIPAA-protected PHI (Protected Health Information).
    | The index endpoint (list all) is restricted to admin and medical roles.
    | Individual record access is further restricted by MedicalRecordPolicy.
    |
    */
    Route::prefix('medical-records')->group(function () {
        // List all medical records — admins and medical staff only
        Route::get('/', [MedicalRecordController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('medical-records.index');
        // Write access requires role guard — same restriction as index but write is higher risk.
        Route::post('/', [MedicalRecordController::class, 'store'])->middleware('role:admin,medical')->name('medical-records.store');
        Route::get('/{medicalRecord}', [MedicalRecordController::class, 'show'])->middleware('mfa.enrolled')->name('medical-records.show');
        // Write (PUT) requires MFA enrollment — read already required it; write must match or exceed that bar.
        Route::put('/{medicalRecord}', [MedicalRecordController::class, 'update'])->middleware('mfa.enrolled')->name('medical-records.update');
        // Hard delete — admin only
        Route::delete('/{medicalRecord}', [MedicalRecordController::class, 'destroy'])
            ->middleware('admin')
            ->name('medical-records.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Emergency Contact Routes
    |--------------------------------------------------------------------------
    |
    | Emergency contacts for campers (not user-level contacts — those are
    | under /profile/emergency-contacts). Medical providers can view these
    | in an emergency. Only admins and parents can modify them.
    |
    */
    Route::prefix('emergency-contacts')->group(function () {
        Route::get('/', [EmergencyContactController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('emergency-contacts.index');
        Route::post('/', [EmergencyContactController::class, 'store'])->name('emergency-contacts.store');
        Route::get('/{emergencyContact}', [EmergencyContactController::class, 'show'])->name('emergency-contacts.show');
        Route::put('/{emergencyContact}', [EmergencyContactController::class, 'update'])->name('emergency-contacts.update');
        Route::delete('/{emergencyContact}', [EmergencyContactController::class, 'destroy'])->name('emergency-contacts.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Allergy Routes
    |--------------------------------------------------------------------------
    |
    | Allergy data is critical for camper safety — used in medical alerts
    | and ID badges. All roles with medical need can access this data.
    |
    */
    Route::prefix('allergies')->group(function () {
        Route::get('/', [AllergyController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('allergies.index');
        Route::post('/', [AllergyController::class, 'store'])->name('allergies.store');
        Route::get('/{allergy}', [AllergyController::class, 'show'])->name('allergies.show');
        Route::put('/{allergy}', [AllergyController::class, 'update'])->name('allergies.update');
        Route::delete('/{allergy}', [AllergyController::class, 'destroy'])->name('allergies.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medication Routes
    |--------------------------------------------------------------------------
    |
    | Medication information used for daily administration schedules and
    | medical record completeness. All medical-access roles can view.
    |
    */
    Route::prefix('medications')->group(function () {
        Route::get('/', [MedicationController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('medications.index');
        Route::post('/', [MedicationController::class, 'store'])->name('medications.store');
        Route::get('/{medication}', [MedicationController::class, 'show'])->name('medications.show');
        Route::put('/{medication}', [MedicationController::class, 'update'])->name('medications.update');
        Route::delete('/{medication}', [MedicationController::class, 'destroy'])->name('medications.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | CYSHCN (Children and Youth with Special Health Care Needs) Routes
    |--------------------------------------------------------------------------
    |
    | These endpoints manage specialised clinical data for campers with complex
    | medical needs. All contain PHI and require strict access controls.
    |
    | Data types covered:
    |  - Diagnoses:          Medical diagnosis entries with severity levels
    |  - Behavioral profiles: Wandering risk, aggression, supervision needs
    |  - Feeding plans:      G-tube, special diets, feeding schedules
    |  - Assistive devices:  Wheelchairs, communication devices, etc.
    |  - Activity permissions: What activities the camper is cleared to participate in
    |
    */

    // ── Diagnosis Routes ─────────────────────────────────────────────────────
    Route::prefix('diagnoses')->group(function () {
        Route::get('/', [DiagnosisController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('diagnoses.index');
        Route::post('/', [DiagnosisController::class, 'store'])->name('diagnoses.store');
        Route::get('/{diagnosis}', [DiagnosisController::class, 'show'])->name('diagnoses.show');
        Route::put('/{diagnosis}', [DiagnosisController::class, 'update'])->name('diagnoses.update');
        Route::delete('/{diagnosis}', [DiagnosisController::class, 'destroy'])->name('diagnoses.destroy');
    });

    // ── Behavioral Profile Routes ─────────────────────────────────────────────
    Route::prefix('behavioral-profiles')->group(function () {
        Route::get('/', [BehavioralProfileController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('behavioral-profiles.index');
        Route::post('/', [BehavioralProfileController::class, 'store'])->name('behavioral-profiles.store');
        Route::get('/{behavioralProfile}', [BehavioralProfileController::class, 'show'])->name('behavioral-profiles.show');
        Route::put('/{behavioralProfile}', [BehavioralProfileController::class, 'update'])->name('behavioral-profiles.update');
        Route::delete('/{behavioralProfile}', [BehavioralProfileController::class, 'destroy'])->name('behavioral-profiles.destroy');
    });

    // ── Feeding Plan Routes ───────────────────────────────────────────────────
    Route::prefix('feeding-plans')->group(function () {
        Route::get('/', [FeedingPlanController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('feeding-plans.index');
        Route::post('/', [FeedingPlanController::class, 'store'])->name('feeding-plans.store');
        Route::get('/{feedingPlan}', [FeedingPlanController::class, 'show'])->name('feeding-plans.show');
        Route::put('/{feedingPlan}', [FeedingPlanController::class, 'update'])->name('feeding-plans.update');
        Route::delete('/{feedingPlan}', [FeedingPlanController::class, 'destroy'])->name('feeding-plans.destroy');
    });

    // ── Assistive Device Routes ───────────────────────────────────────────────
    Route::prefix('assistive-devices')->group(function () {
        Route::get('/', [AssistiveDeviceController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('assistive-devices.index');
        Route::post('/', [AssistiveDeviceController::class, 'store'])->name('assistive-devices.store');
        Route::get('/{assistiveDevice}', [AssistiveDeviceController::class, 'show'])->name('assistive-devices.show');
        Route::put('/{assistiveDevice}', [AssistiveDeviceController::class, 'update'])->name('assistive-devices.update');
        Route::delete('/{assistiveDevice}', [AssistiveDeviceController::class, 'destroy'])->name('assistive-devices.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Treatment Log Routes
    |--------------------------------------------------------------------------
    |
    | Treatment logs are clinical records of interventions performed by medical
    | staff during camp (medication administration, first aid, observations).
    | Access is restricted to medical staff and admins. Deletion requires admin.
    |
    */
    Route::prefix('treatment-logs')->middleware('role:admin,medical')->group(function () {
        Route::get('/', [TreatmentLogController::class, 'index'])->name('treatment-logs.index');
        Route::post('/', [TreatmentLogController::class, 'store'])->name('treatment-logs.store');
        Route::get('/{treatmentLog}', [TreatmentLogController::class, 'show'])->name('treatment-logs.show');
        Route::put('/{treatmentLog}', [TreatmentLogController::class, 'update'])->name('treatment-logs.update');
        // Deletion of clinical records requires admin — medical staff cannot self-delete
        Route::delete('/{treatmentLog}', [TreatmentLogController::class, 'destroy'])
            ->middleware('admin')
            ->name('treatment-logs.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Stats Route
    |--------------------------------------------------------------------------
    |
    | Returns aggregate dashboard widget data for the medical portal.
    | Used by MedicalDashboardPage to populate stats bar and alert strip.
    |
    */
    Route::get('/medical/stats', [MedicalStatsController::class, 'index'])
        ->middleware('role:admin,medical')
        ->name('medical.stats');

    /*
    |--------------------------------------------------------------------------
    | Medical Incidents Routes (Phase 11)
    |--------------------------------------------------------------------------
    |
    | Clinical incident records (injuries, health events, emergency responses).
    | Medical staff can create/update incidents; only admins can delete them.
    |
    */
    Route::prefix('medical-incidents')->middleware('role:admin,medical')->group(function () {
        Route::get('/', [MedicalIncidentController::class, 'index'])->name('medical-incidents.index');
        Route::post('/', [MedicalIncidentController::class, 'store'])->name('medical-incidents.store');
        Route::get('/{medicalIncident}', [MedicalIncidentController::class, 'show'])->name('medical-incidents.show');
        Route::put('/{medicalIncident}', [MedicalIncidentController::class, 'update'])->name('medical-incidents.update');
        Route::delete('/{medicalIncident}', [MedicalIncidentController::class, 'destroy'])
            ->middleware('admin')
            ->name('medical-incidents.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Follow-Up Routes (Phase 11)
    |--------------------------------------------------------------------------
    |
    | Follow-up tasks linked to incidents or visits (e.g. "call parent tomorrow").
    | Tracked by medical staff and administrators.
    |
    */
    Route::prefix('medical-follow-ups')->middleware('role:admin,medical')->group(function () {
        Route::get('/', [MedicalFollowUpController::class, 'index'])->name('medical-follow-ups.index');
        Route::post('/', [MedicalFollowUpController::class, 'store'])->name('medical-follow-ups.store');
        Route::get('/{medicalFollowUp}', [MedicalFollowUpController::class, 'show'])->name('medical-follow-ups.show');
        Route::put('/{medicalFollowUp}', [MedicalFollowUpController::class, 'update'])->name('medical-follow-ups.update');
        Route::delete('/{medicalFollowUp}', [MedicalFollowUpController::class, 'destroy'])
            ->middleware('admin')
            ->name('medical-follow-ups.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Visit Routes (Phase 11)
    |--------------------------------------------------------------------------
    |
    | Records of campers visiting the medical station (sick bay, nurse's office).
    | Each visit captures reason, disposition, and follow-up instructions.
    |
    */
    Route::prefix('medical-visits')->middleware('role:admin,medical')->group(function () {
        Route::get('/', [MedicalVisitController::class, 'index'])->name('medical-visits.index');
        Route::post('/', [MedicalVisitController::class, 'store'])->name('medical-visits.store');
        Route::get('/{medicalVisit}', [MedicalVisitController::class, 'show'])->name('medical-visits.show');
        Route::put('/{medicalVisit}', [MedicalVisitController::class, 'update'])->name('medical-visits.update');
        Route::delete('/{medicalVisit}', [MedicalVisitController::class, 'destroy'])
            ->middleware('admin')
            ->name('medical-visits.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Medical Restriction Routes (Phase 11)
    |--------------------------------------------------------------------------
    |
    | Activity restrictions placed on a camper by medical staff
    | (e.g. "no swimming this week", "limited sun exposure").
    | No additional admin middleware on delete — policy handles it.
    |
    */
    Route::prefix('medical-restrictions')->middleware('role:admin,medical')->group(function () {
        Route::get('/', [MedicalRestrictionController::class, 'index'])->name('medical-restrictions.index');
        Route::post('/', [MedicalRestrictionController::class, 'store'])->name('medical-restrictions.store');
        Route::get('/{medicalRestriction}', [MedicalRestrictionController::class, 'show'])->name('medical-restrictions.show');
        Route::put('/{medicalRestriction}', [MedicalRestrictionController::class, 'update'])->name('medical-restrictions.update');
        Route::delete('/{medicalRestriction}', [MedicalRestrictionController::class, 'destroy'])->name('medical-restrictions.destroy');
    });

    // ── Activity Permission Routes ─────────────────────────────────────────────
    Route::prefix('activity-permissions')->group(function () {
        Route::get('/', [ActivityPermissionController::class, 'index'])
            ->middleware('role:admin,medical')
            ->name('activity-permissions.index');
        Route::post('/', [ActivityPermissionController::class, 'store'])->name('activity-permissions.store');
        Route::get('/{activityPermission}', [ActivityPermissionController::class, 'show'])->name('activity-permissions.show');
        Route::put('/{activityPermission}', [ActivityPermissionController::class, 'update'])->name('activity-permissions.update');
        Route::delete('/{activityPermission}', [ActivityPermissionController::class, 'destroy'])->name('activity-permissions.destroy');
    });

    /*
    |--------------------------------------------------------------------------
    | Inbox / Messaging Routes
    |--------------------------------------------------------------------------
    |
    | Secure internal messaging system for parents, admins, and medical staff.
    | All messages are HIPAA-compliant and have a full audit trail.
    | Fine-grained rate limits per route prevent message flooding.
    |
    */

    // ── Announcements (admin creates, all roles read) ──────────────────────────
    Route::prefix('announcements')->group(function () {
        Route::get('/', [AnnouncementController::class, 'index'])->name('announcements.index');
        Route::get('/{announcement}', [AnnouncementController::class, 'show'])->name('announcements.show');
        Route::post('/', [AnnouncementController::class, 'store'])->middleware('admin')->name('announcements.store');
        Route::put('/{announcement}', [AnnouncementController::class, 'update'])->middleware('admin')->name('announcements.update');
        Route::delete('/{announcement}', [AnnouncementController::class, 'destroy'])->middleware('admin')->name('announcements.destroy');
        // Toggle the pinned-to-top state (admin only)
        Route::post('/{announcement}/pin', [AnnouncementController::class, 'togglePin'])->middleware('admin')->name('announcements.pin');
    });

    // ── Audit Log (super_admin only) ─────────────────────────────────────────
    // Full audit history and CSV/JSON export of all system actions
    Route::middleware('role:super_admin')->prefix('audit-log')->group(function () {
        Route::get('/', [AuditLogController::class, 'index'])->name('audit-log.index');
        // Export up to 5,000 audit log rows — rate-limited + step-up required.
        // mfa.enrolled ensures the caller has MFA configured; mfa.step_up ensures
        // they re-verified recently. Both gates apply to prevent bulk data exfiltration.
        Route::get('/export', [AuditLogController::class, 'export'])
            ->middleware(['throttle:phi-export', 'mfa.enrolled', 'mfa.step_up'])
            ->name('audit-log.export');
    });

    // ── User Management (super_admin only) ────────────────────────────────────
    // Role assignment and account activation/deactivation
    Route::middleware('role:super_admin')->prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index'])->name('users.index');
        // Super-admin direct account creation for staff (admin/medical/super_admin roles only)
        // mfa.step_up: account creation is irreversible — require recent MFA re-verification.
        Route::post('/', [UserController::class, 'store'])->middleware('mfa.step_up')->name('users.store');
        // Role changes and account status changes are irreversible high-privilege actions —
        // require both super_admin role and a recent MFA step-up challenge.
        Route::put('/{user}/role', [UserController::class, 'updateRole'])->middleware(['role:super_admin', 'mfa.step_up'])->name('users.update-role');
        Route::post('/{user}/deactivate', [UserController::class, 'deactivate'])->middleware(['role:super_admin', 'mfa.step_up'])->name('users.deactivate');
        Route::post('/{user}/reactivate', [UserController::class, 'reactivate'])->middleware(['role:super_admin', 'mfa.step_up'])->name('users.reactivate');
    });

    // ── Deadline Management ────────────────────────────────────────────────────
    // Single source of truth for all time-based enforcement across sessions.
    // Write access: admin and super_admin only. Read: any authenticated user (content filtered by role).
    // Deadline writes automatically sync to calendar_events via DeadlineObserver.
    Route::prefix('deadlines')->group(function () {
        // Applicant: own visible deadlines (must be before {deadline} wildcard)
        Route::get('/my', [DeadlineController::class, 'myDeadlines'])->name('deadlines.my');
        // Admin: session-wide bulk deadline creation
        Route::post('/bulk-session', [DeadlineController::class, 'bulkSession'])
            ->middleware('admin')
            ->name('deadlines.bulk-session');
        // CRUD (list/create admin-gated inside controller via policy)
        Route::get('/', [DeadlineController::class, 'index'])->name('deadlines.index');
        Route::post('/', [DeadlineController::class, 'store'])->middleware('admin')->name('deadlines.store');
        Route::get('/{deadline}', [DeadlineController::class, 'show'])->name('deadlines.show');
        Route::put('/{deadline}', [DeadlineController::class, 'update'])->middleware('admin')->name('deadlines.update');
        Route::delete('/{deadline}', [DeadlineController::class, 'destroy'])->middleware('admin')->name('deadlines.destroy');
        // Admin actions: extend due date or manually complete (override enforcement)
        Route::post('/{deadline}/extend', [DeadlineController::class, 'extend'])
            ->middleware('admin')
            ->name('deadlines.extend');
        Route::post('/{deadline}/complete', [DeadlineController::class, 'complete'])
            ->middleware('admin')
            ->name('deadlines.complete');
    });

    // ── Calendar Events ────────────────────────────────────────────────────────
    // Camp calendar visible to all authenticated users; only admins can modify.
    // NOTE: event_type='deadline' is managed exclusively by the deadline system above.
    // CalendarEventController blocks manual creation/editing of deadline-type events.
    Route::prefix('calendar')->group(function () {
        Route::get('/', [CalendarEventController::class, 'index'])->name('calendar.index');
        Route::get('/{calendarEvent}', [CalendarEventController::class, 'show'])->name('calendar.show');
        Route::post('/', [CalendarEventController::class, 'store'])->middleware('admin')->name('calendar.store');
        Route::put('/{calendarEvent}', [CalendarEventController::class, 'update'])->middleware('admin')->name('calendar.update');
        Route::delete('/{calendarEvent}', [CalendarEventController::class, 'destroy'])->middleware('admin')->name('calendar.destroy');
    });

    // ── Inbox Routes ──────────────────────────────────────────────────────────
    Route::prefix('inbox')->group(function () {
        // User search for the compose recipient autocomplete field
        // Throttled at 30/min to prevent user enumeration via autocomplete
        Route::get('/users', [InboxUserController::class, 'index'])
            ->middleware('throttle:30,1')
            ->name('inbox.users.index');

        // ── Conversation Routes ────────────────────────────────────────────────
        Route::prefix('conversations')->group(function () {
            // List conversations — filtered by folder via ?folder= query param
            Route::get('/', [ConversationController::class, 'index'])
                ->middleware('throttle:180,1')
                ->name('inbox.conversations.index');
            // Create a new conversation — 60/min for admins, 15/min for applicants
            Route::post('/', [ConversationController::class, 'store'])
                ->middleware('throttle:inbox-compose')
                ->name('inbox.conversations.store');
            // View a specific conversation and its messages
            Route::get('/{conversation}', [ConversationController::class, 'show'])
                ->middleware('throttle:180,1')
                ->name('inbox.conversations.show');
            // Move to archive folder
            Route::post('/{conversation}/archive', [ConversationController::class, 'archive'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.archive');
            // Restore from archive
            Route::post('/{conversation}/unarchive', [ConversationController::class, 'unarchive'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.unarchive');
            // Add a user to the conversation's participant list
            Route::post('/{conversation}/participants', [ConversationController::class, 'addParticipant'])
                ->middleware('throttle:30,60')
                ->name('inbox.conversations.add-participant');
            // Remove a specific user from the conversation
            Route::delete('/{conversation}/participants/{user}', [ConversationController::class, 'removeParticipant'])
                ->middleware('throttle:30,60')
                ->name('inbox.conversations.remove-participant');
            // Leave the conversation (user removes themselves)
            Route::post('/{conversation}/leave', [ConversationController::class, 'leave'])
                ->middleware('throttle:30,60')
                ->name('inbox.conversations.leave');
            // Toggle starred flag for this user's view of the conversation
            Route::post('/{conversation}/star', [ConversationController::class, 'star'])
                ->middleware('throttle:180,1')
                ->name('inbox.conversations.star');
            // Toggle important flag for this user's view of the conversation
            Route::post('/{conversation}/important', [ConversationController::class, 'important'])
                ->middleware('throttle:180,1')
                ->name('inbox.conversations.important');
            // Move to trash (per-user — does not affect other participants)
            Route::post('/{conversation}/trash', [ConversationController::class, 'trash'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.trash');
            // Restore from trash
            Route::post('/{conversation}/restore-trash', [ConversationController::class, 'restoreFromTrash'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.restore-trash');
            // Mark all messages in conversation as read (per-user)
            Route::post('/{conversation}/read', [ConversationController::class, 'markRead'])
                ->middleware('throttle:120,1')
                ->name('inbox.conversations.mark-read');
            // Mark conversation as unread by removing latest read receipt (per-user)
            Route::post('/{conversation}/unread', [ConversationController::class, 'markUnread'])
                ->middleware('throttle:120,1')
                ->name('inbox.conversations.mark-unread');
            // Hard delete (soft-delete) — admin only
            Route::delete('/{conversation}', [ConversationController::class, 'destroy'])
                ->middleware('admin')
                ->name('inbox.conversations.destroy');

            // ── Messages within a Conversation ────────────────────────────────
            // Paginated message history (oldest first); auto-marks as read on fetch
            Route::get('/{conversation}/messages', [MessageController::class, 'index'])
                ->middleware('throttle:180,1')
                ->name('inbox.conversations.messages.index');
            // Send a new message
            Route::post('/{conversation}/messages', [MessageController::class, 'store'])
                ->middleware('throttle:20,1')
                ->name('inbox.conversations.messages.store');

            // Reply to a specific message — sends only to the original message's sender
            Route::post('/{conversation}/reply', [MessageController::class, 'reply'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.reply');

            // Reply All — sends to original sender + all visible TO/CC recipients (BCC excluded by server)
            Route::post('/{conversation}/reply-all', [MessageController::class, 'replyAll'])
                ->middleware('throttle:60,1')
                ->name('inbox.conversations.reply-all');
        });

        // ── Message-level Routes ────────────────────────────────────────────────
        Route::prefix('messages')->group(function () {
            // Total unread message count — used for the inbox nav badge
            Route::get('/unread-count', [MessageController::class, 'unreadCount'])
                ->middleware('throttle:180,1')
                ->name('inbox.messages.unread-count');
            // View a single message by ID
            Route::get('/{message}', [MessageController::class, 'show'])
                ->middleware('throttle:180,1')
                ->name('inbox.messages.show');
            // Download a file attached to a message (throttled at 30/hour per user)
            Route::get('/{message}/attachments/{documentId}', [MessageController::class, 'downloadAttachment'])
                ->middleware('throttle:30,60')
                ->name('inbox.messages.download-attachment');
            // Preview a file inline — images/PDFs open in the browser instead of downloading
            Route::get('/{message}/attachments/{documentId}/preview', [MessageController::class, 'previewAttachment'])
                ->middleware('throttle:60,1')
                ->name('inbox.messages.preview-attachment');
            // Soft-delete a message (admin moderation only)
            Route::delete('/{message}', [MessageController::class, 'destroy'])
                ->middleware('admin')
                ->name('inbox.messages.destroy');
        });
    });

    /*
    |--------------------------------------------------------------------------
    | Application Form Management Routes
    |--------------------------------------------------------------------------
    |
    | The form schema drives the applicant's multi-step application form.
    |
    | Public (any authenticated user):
    |   GET /form/active    — active form schema; applicants use this to render the form
    |   GET /form/{form}    — specific version by ID; admin use for reviewing old apps
    |
    | Admin-readable (admin + super_admin):
    |   GET /form/definitions          — list all versions
    |   GET /form/definitions/{form}   — full definition with sections and fields
    |
    | Super admin only (structural mutations):
    |   POST   /form/definitions                          — create draft
    |   PUT    /form/definitions/{form}                   — update draft metadata
    |   DELETE /form/definitions/{form}                   — delete unpublished draft
    |   POST   /form/definitions/{form}/publish           — publish draft → active
    |   POST   /form/definitions/{form}/duplicate         — copy into new draft
    |   CRUD   /form/definitions/{form}/sections          — section management
    |   POST   /form/definitions/{form}/sections/reorder  — batch reorder sections
    |   CRUD   /form/sections/{section}/fields            — field management
    |   POST   /form/sections/{section}/fields/reorder    — batch reorder fields
    |   POST   /form/fields/{field}/activate              — set is_active = true
    |   POST   /form/fields/{field}/deactivate            — set is_active = false
    |   CRUD   /form/fields/{field}/options               — option management
    |   POST   /form/fields/{field}/options/reorder       — batch reorder options
    |
    */
    // ── Official Form Templates (authenticated download + metadata) ───────────
    // Authenticated version of the public /api/forms routes — includes audit logging.
    // The metadata endpoint (index) is available to all authenticated users.
    // The download endpoint streams blank PDFs with a download audit trail.
    Route::prefix('form-templates')->group(function () {
        Route::get('/', [FormTemplateController::class, 'index'])->name('form-templates.index');
        Route::get('/{type}/download', [FormTemplateController::class, 'download'])->name('form-templates.download');
    });

    Route::prefix('form')->group(function () {
        // ── Public schema endpoints (any authenticated user) ──────────────────
        Route::get('/active', [PublicFormController::class, 'active'])->name('form.active');
        Route::get('/version/{form}', [PublicFormController::class, 'version'])->name('form.version');

        // ── Admin-readable (form builder viewing) ─────────────────────────────
        Route::middleware(['role:admin,super_admin'])->group(function () {
            Route::get('/definitions', [FormDefinitionController::class, 'index'])->name('form.definitions.index');
            Route::get('/definitions/{form}', [FormDefinitionController::class, 'show'])->name('form.definitions.show');
        });

        // ── Super admin only (structural mutations) ───────────────────────────
        Route::middleware(['role:super_admin'])->group(function () {
            // Form definition lifecycle
            Route::post('/definitions', [FormDefinitionController::class, 'store'])->name('form.definitions.store');
            Route::put('/definitions/{form}', [FormDefinitionController::class, 'update'])->name('form.definitions.update');
            Route::delete('/definitions/{form}', [FormDefinitionController::class, 'destroy'])->name('form.definitions.destroy');
            Route::post('/definitions/{form}/publish', [FormDefinitionController::class, 'publish'])->name('form.definitions.publish');
            Route::post('/definitions/{form}/duplicate', [FormDefinitionController::class, 'duplicate'])->name('form.definitions.duplicate');

            // Section management within a definition
            Route::get('/definitions/{form}/sections', [FormSectionController::class, 'index'])->name('form.sections.index');
            Route::post('/definitions/{form}/sections', [FormSectionController::class, 'store'])->name('form.sections.store');
            Route::put('/definitions/{form}/sections/{section}', [FormSectionController::class, 'update'])->name('form.sections.update');
            Route::delete('/definitions/{form}/sections/{section}', [FormSectionController::class, 'destroy'])->name('form.sections.destroy');
            Route::post('/definitions/{form}/sections/reorder', [FormSectionController::class, 'reorder'])->name('form.sections.reorder');

            // Field management within a section
            Route::get('/sections/{section}/fields', [FormFieldController::class, 'index'])->name('form.fields.index');
            Route::post('/sections/{section}/fields', [FormFieldController::class, 'store'])->name('form.fields.store');
            Route::put('/sections/{section}/fields/{field}', [FormFieldController::class, 'update'])->name('form.fields.update');
            Route::delete('/sections/{section}/fields/{field}', [FormFieldController::class, 'destroy'])->name('form.fields.destroy');
            Route::post('/sections/{section}/fields/reorder', [FormFieldController::class, 'reorder'])->name('form.fields.reorder');
            Route::post('/fields/{field}/activate', [FormFieldController::class, 'activate'])->name('form.fields.activate');
            Route::post('/fields/{field}/deactivate', [FormFieldController::class, 'deactivate'])->name('form.fields.deactivate');

            // Option management within a field
            Route::get('/fields/{field}/options', [FormFieldOptionController::class, 'index'])->name('form.options.index');
            Route::post('/fields/{field}/options', [FormFieldOptionController::class, 'store'])->name('form.options.store');
            Route::put('/fields/{field}/options/{option}', [FormFieldOptionController::class, 'update'])->name('form.options.update');
            Route::delete('/fields/{field}/options/{option}', [FormFieldOptionController::class, 'destroy'])->name('form.options.destroy');
            Route::post('/fields/{field}/options/reorder', [FormFieldOptionController::class, 'reorder'])->name('form.options.reorder');
        });
    });
});
