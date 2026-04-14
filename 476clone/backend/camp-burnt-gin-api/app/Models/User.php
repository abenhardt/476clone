<?php

namespace App\Models;

use App\Notifications\Auth\EmailVerificationNotification;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User model — the central account record for every person who can log in.
 *
 * A User can be an admin, super_admin, applicant (parent/guardian), or medical
 * provider. The role_id column points to the Role model, which defines what
 * that person is allowed to see and do.
 *
 * Security highlights:
 *  - Passwords are always stored hashed (never plain-text).
 *  - mfa_secret is hidden from API responses to prevent token exposure.
 *  - After 5 bad login attempts the account is locked for 15 minutes (configurable).
 *  - The last super_admin cannot be deleted, preventing full system lockout.
 */
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    // HasApiTokens — lets Sanctum issue and validate API bearer tokens for this user.
    // Notifiable   — allows $user->notify(...) to send emails and database notifications.
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * Only columns listed here can be set via User::create([...]) or $user->fill([...]).
     * This is a security guard that prevents attackers from stuffing unexpected columns.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'preferred_name',
        'email',
        'phone',
        'avatar_path',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'postal_code',
        'country',
        'password',
        'role_id',
        'is_active',
        'mfa_enabled',
        'mfa_secret',
        'mfa_verified_at',
        'failed_login_attempts',
        'lockout_until',
        'last_failed_login_at',
        'notification_preferences',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * These columns are stripped from any JSON or array output, so they
     * are never accidentally sent to the frontend or logged.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',       // Never expose the hashed password in API responses.
        'remember_token', // Internal Laravel session token — not for public consumption.
        'mfa_secret',     // The TOTP seed — exposing it would defeat 2-factor auth entirely.
    ];

    /**
     * Get the attributes that should be cast.
     *
     * Casting tells Laravel how to automatically convert raw database values
     * into the right PHP types when you access them on the model.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            // Treat these timestamp columns as Carbon date objects.
            'email_verified_at' => 'datetime',
            'mfa_verified_at' => 'datetime',
            'lockout_until' => 'datetime',
            'last_failed_login_at' => 'datetime',
            // Boolean flags — stored as 0/1 in MySQL, returned as true/false in PHP.
            'is_active' => 'boolean',
            'mfa_enabled' => 'boolean',
            // 'hashed' cast automatically bcrypt-hashes the value when you set it.
            'password' => 'hashed',
            // JSON column decoded to a PHP array automatically on read.
            'notification_preferences' => 'array',
            // Encrypt the TOTP seed at rest so a raw DB dump cannot be used to clone authenticators.
            'mfa_secret' => 'encrypted',
        ];
    }

    /**
     * Boot the model and register lifecycle event listeners.
     *
     * The "deleting" hook fires just before a User record is removed from the
     * database. We use it to block the deletion of the very last super_admin,
     * which would leave the system with no way to recover admin access.
     */
    protected static function boot()
    {
        parent::boot();

        static::deleting(function ($user) {
            // Only run the guard if the user being deleted is a super_admin.
            if ($user->isSuperAdmin()) {
                // Count how many super_admin users still exist in the database.
                $superAdminCount = static::whereHas('role', function ($query) {
                    $query->where('name', 'super_admin');
                })->count();

                // If this is the only super_admin left, abort the deletion.
                if ($superAdminCount <= 1) {
                    throw new \Exception('Cannot delete the last super administrator. At least one super administrator must exist in the system.');
                }
            }
        });
    }

    /**
     * Get the role assigned to this user.
     *
     * A user belongs to exactly one Role row (e.g. "admin", "applicant").
     * Access via $user->role->name.
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * Get all campers managed by this user.
     *
     * An applicant (parent/guardian) may register multiple children.
     * Each Camper row has a user_id foreign key pointing back here.
     */
    public function campers(): HasMany
    {
        return $this->hasMany(Camper::class);
    }

    /**
     * Get the user's personal emergency contacts.
     *
     * Results are sorted so primary contacts always appear first, then
     * alphabetically by name within each tier.
     */
    public function userEmergencyContacts(): HasMany
    {
        return $this->hasMany(UserEmergencyContact::class)->orderByDesc('is_primary')->orderBy('name');
    }

    /**
     * Get all applications that this user reviewed as an admin.
     *
     * The foreign key is "reviewed_by" (not the default "user_id"), so
     * we pass it explicitly to Laravel's relationship builder.
     */
    public function reviewedApplications(): HasMany
    {
        return $this->hasMany(Application::class, 'reviewed_by');
    }

    /**
     * Determine if the user has a specific role by name.
     *
     * Checks that the role relationship is loaded and that its name matches
     * the requested string (e.g. "admin", "medical").
     */
    public function hasRole(string $roleName): bool
    {
        return $this->role !== null && $this->role->name === $roleName;
    }

    /**
     * Determine if the user is a super administrator.
     *
     * Super administrators have absolute system authority and can manage
     * system-level configurations, feature flags, and role assignments.
     */
    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    /**
     * Determine if the user is an administrator.
     *
     * Returns true for both "admin" and "super_admin" roles, because
     * super admins inherit all regular admin privileges.
     */
    public function isAdmin(): bool
    {
        // OR condition ensures super_admins pass all admin-only policy checks.
        return $this->hasRole('admin') || $this->hasRole('super_admin');
    }

    /**
     * Determine if the user is an applicant (parent or guardian of a camper).
     */
    public function isApplicant(): bool
    {
        return $this->hasRole('applicant');
    }

    /**
     * Determine if the user is a medical provider.
     */
    public function isMedicalProvider(): bool
    {
        return $this->hasRole('medical');
    }

    /**
     * Determine if the user owns (manages) the given camper.
     *
     * Comparing IDs directly is faster than loading the relationship and
     * prevents accidental cross-user data access in policy checks.
     */
    public function ownsCamper(Camper $camper): bool
    {
        return $this->id === $camper->user_id;
    }

    /**
     * Determine if a medical provider is permitted to access a specific camper.
     *
     * Medical staff may only access campers whose applications have been approved
     * (is_active = true). This prevents medical staff from viewing medical data
     * for applicants who have not yet been accepted to camp.
     *
     * Business rule: "Medical staff can ONLY access ACCEPTED (active) campers."
     */
    public function canAccessCamperAsMedical(Camper $camper): bool
    {
        return $camper->is_active;
    }

    /**
     * Check if the account is currently locked due to too many failed logins.
     *
     * If the lockout has expired, this method also clears the lockout fields
     * so the user can try again without needing an explicit admin reset.
     */
    public function isLockedOut(): bool
    {
        // No lockout timestamp stored means the account is definitely not locked.
        if (! $this->lockout_until) {
            return false;
        }

        // If the lockout window is still in the future, deny login.
        if ($this->lockout_until->isFuture()) {
            return true;
        }

        // The lockout has expired — clean up so the next login attempt works normally.
        $this->update([
            'lockout_until' => null,
            'failed_login_attempts' => 0,
        ]);

        return false;
    }

    /**
     * Increment the failed login counter and lock the account when the threshold is reached.
     *
     * Called by LoginController on every authentication failure for this user.
     * After 5 failures, the account is locked for the configured duration (default 15 minutes).
     */
    public function recordFailedLogin(): void
    {
        $attempts = $this->failed_login_attempts + 1;
        $lockoutMinutes = config('auth.lockout_minutes', 15);

        $data = [
            'failed_login_attempts' => $attempts,
            'last_failed_login_at' => now(),
        ];

        // Trigger the lockout once the attempt count reaches the threshold.
        if ($attempts >= 5) {
            $data['lockout_until'] = now()->addMinutes($lockoutMinutes);
        }

        $this->update($data);
    }

    /**
     * Reset failed login counters after a successful authentication.
     *
     * Called by LoginController immediately after a correct password is verified
     * so the next genuine accidental mistype does not immediately lock the account.
     */
    public function resetFailedLogins(): void
    {
        $this->update([
            'failed_login_attempts' => 0,
            'lockout_until' => null,
            'last_failed_login_at' => null,
        ]);
    }

    /**
     * Get how many whole minutes remain before the current lockout expires.
     *
     * Returns null if the account is not locked, allowing callers to skip
     * the "try again in X minutes" message when there is nothing to show.
     */
    public function getLockoutMinutesRemaining(): ?int
    {
        // Return null if there is no active lockout.
        if (! $this->lockout_until || $this->lockout_until->isPast()) {
            return null;
        }

        // diffInMinutes returns a negative number if $lockout_until is in the past,
        // but the isPast() guard above ensures we only reach this line when it is future.
        return now()->diffInMinutes($this->lockout_until, false);
    }

    /**
     * Send the email verification notification using the project's custom mailer.
     *
     * Overrides the default Laravel method so our branded email template is used
     * instead of the generic Laravel verification email.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new EmailVerificationNotification);
    }

    /**
     * Determine if this account has been administratively activated.
     *
     * Inactive users cannot log in even with a correct password; admins
     * toggle this flag to suspend/reinstate accounts without deleting them.
     */
    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }
}
