<?php

namespace App\Policies;

use App\Models\User;
use App\Models\UserEmergencyContact;

class UserEmergencyContactPolicy
{
    /**
     * Users may only update their own emergency contacts.
     */
    public function update(User $user, UserEmergencyContact $contact): bool
    {
        return $user->id === $contact->user_id;
    }

    /**
     * Users may only delete their own emergency contacts.
     */
    public function delete(User $user, UserEmergencyContact $contact): bool
    {
        return $user->id === $contact->user_id;
    }
}
