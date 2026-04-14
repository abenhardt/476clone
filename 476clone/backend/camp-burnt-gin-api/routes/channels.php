<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

/**
 * Private per-user channel for real-time messaging notifications.
 *
 * Each authenticated user subscribes only to their own channel.
 * The frontend uses this to receive MessageSent events without
 * any cross-user data leakage.
 */
Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
