<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Transforms a Conversation model into a consistent API response shape.
 *
 * Handles:
 * - Flat participants array with string role (frontend expects `role: string`)
 * - Per-conversation unread_count for the authenticated user
 * - category field
 * - archived_at mapped from is_archived boolean
 * - Sender role in last_message
 */
class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        // Resolve the current user's participant record for per-user state fields.
        // Uses eagerly-loaded activeParticipantRecords (filtered in memory) to avoid N+1.
        $participantRecord = null;
        if ($user && $this->relationLoaded('activeParticipantRecords')) {
            $participantRecord = $this->activeParticipantRecords
                ->firstWhere('user_id', $user->id);
        }

        /** @var Conversation $this */
        return [
            'id' => $this->id,
            'subject' => $this->subject,
            'category' => $this->category ?? 'general',
            'created_by_id' => $this->created_by_id,
            'creator' => $this->when(
                $this->relationLoaded('creator') && $this->creator,
                fn () => [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                ]
            ),
            'participants' => $this->buildParticipants(),
            'last_message' => $this->buildLastMessage(),
            'last_message_at' => $this->last_message_at?->toISOString(),
            'unread_count' => $user ? $this->getUnreadCountForUser($user) : 0,
            'is_archived' => $this->is_archived,
            'archived_at' => $this->is_archived ? $this->updated_at?->toISOString() : null,
            // Per-user state (from conversation_participants pivot)
            'is_starred' => (bool) ($participantRecord?->is_starred ?? false),
            'is_important' => (bool) ($participantRecord?->is_important ?? false),
            'is_trashed' => $participantRecord?->trashed_at !== null,
            // System notification fields
            'is_system_generated' => (bool) $this->is_system_generated,
            'system_event_type' => $this->system_event_type,
            'system_event_category' => $this->system_event_category,
            'related_entity_type' => $this->related_entity_type,
            'related_entity_id' => $this->related_entity_id,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }

    /**
     * Build flat participants array: [{id, name, role}].
     *
     * Email addresses are intentionally excluded from participant shapes.
     * The compose window only needs id/name/role to display recipient chips
     * and route messages. Exposing emails to all participants creates a PII
     * enumeration vector — participants should not see each other's emails.
     *
     * Works whether participants were loaded via `participants.role`
     * (HasManyThrough → User with role) or via `activeParticipantRecords.user.role`.
     */
    protected function buildParticipants(): array
    {
        // Prefer the HasManyThrough `participants` relation (User objects with role loaded)
        if ($this->relationLoaded('participants')) {
            return $this->participants->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->relationLoaded('role') ? ($user->role?->name ?? 'unknown') : 'unknown',
                'avatar_url' => $user->avatar_path ? Storage::disk('public')->url($user->avatar_path) : null,
            ])->values()->all();
        }

        // Fallback: activeParticipantRecords.user.role
        if ($this->relationLoaded('activeParticipantRecords')) {
            return $this->activeParticipantRecords->map(fn ($record) => [
                'id' => $record->user?->id,
                'name' => $record->user?->name,
                'role' => $record->user?->role?->name ?? 'unknown',
                'avatar_url' => $record->user?->avatar_path ? Storage::disk('public')->url($record->user->avatar_path) : null,
            ])->filter(fn ($p) => $p['id'] !== null)->values()->all();
        }

        return [];
    }

    /**
     * Build last_message with sender.role as string.
     */
    protected function buildLastMessage(): ?array
    {
        if (! $this->relationLoaded('lastMessage') || ! $this->lastMessage) {
            return null;
        }

        $msg = $this->lastMessage;
        $sender = null;

        if ($msg->relationLoaded('sender') && $msg->sender) {
            $sender = [
                'id' => $msg->sender->id,
                'name' => $msg->sender->name,
                // Email omitted: participants must not see each other's email addresses.
                'role' => $msg->sender->relationLoaded('role')
                    ? ($msg->sender->role?->name ?? 'unknown')
                    : 'unknown',
                'avatar_url' => $msg->sender->avatar_path ? Storage::disk('public')->url($msg->sender->avatar_path) : null,
            ];
        }

        return [
            'id' => $msg->id,
            'conversation_id' => $msg->conversation_id,
            'sender_id' => $msg->sender_id,
            'sender' => $sender,
            'body' => $msg->body,
            'read_at' => null,
            'created_at' => $msg->created_at?->toISOString(),
            'attachments' => [],
            // Required by the frontend Message type — populated per-message in the thread view
            // but kept as empty/null here since last_message is display-only (no recipient UI)
            'recipients' => [],
            'parent_message_id' => $msg->parent_message_id ?? null,
            'reply_type' => $msg->reply_type ?? null,
        ];
    }
}
