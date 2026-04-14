<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Role model — defines a named access level that users are assigned to.
 *
 * This is a simple lookup table. The system currently uses four roles:
 *   - applicant    : A parent/guardian who submits camper applications.
 *   - admin        : Camp staff who review applications and manage data.
 *   - super_admin  : Full system authority; inherits all admin privileges.
 *   - medical      : Medical providers who view and record health information.
 *
 * A user belongs to exactly one role (role_id on the users table).
 * Permission checks are performed in Laravel Policies and on the User model
 * (isAdmin(), isMedicalProvider(), etc.) rather than stored in this table.
 */
class Role extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',        // Machine-readable slug — used in policy checks (e.g. 'super_admin').
        'description', // Human-readable label shown in the admin UI.
    ];

    /**
     * Get all users who are assigned this role.
     *
     * Useful for listing all admins, all medical providers, etc.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
