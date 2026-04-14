<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;
use App\Models\User;
use App\Services\InboxService;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * ConversationController — handles HTTP requests for all conversation-level inbox operations.
 *
 * This controller is the entry point for the inbox system. It is intentionally thin:
 * validation and authorization happen here, but all business logic is delegated to
 * InboxService. This keeps complex rules (like participant management and unread counts)
 * testable independently from HTTP concerns.
 *
 * Responsibilities:
 *   - Validate incoming request data
 *   - Enforce authorization via Laravel Gate (policies in ConversationPolicy)
 *   - Delegate business operations to InboxService
 *   - Format and return JSON responses
 *
 * All routes require Sanctum token authentication.
 * Role-Based Access Control is enforced at the policy layer, not here.
 *
 * Key endpoints:
 *   GET    /api/inbox/conversations              — list conversations (folder-aware)
 *   POST   /api/inbox/conversations              — create a new conversation
 *   GET    /api/inbox/conversations/{id}         — get a single conversation
 *   POST   /api/inbox/conversations/{id}/star    — toggle starred state
 *   POST   /api/inbox/conversations/{id}/trash   — move to trash
 *   DELETE /api/inbox/conversations/{id}         — soft-delete (admin only)
 */
class ConversationController extends Controller
{
    /**
     * Inject InboxService and MessageService — all heavy lifting happens there.
     */
    public function __construct(
        protected InboxService $inboxService,
        protected MessageService $messageService
    ) {}

    /**
     * List conversations for the authenticated user, grouped by folder.
     *
     * Supports pagination (up to 100 per page) and the following folder filters:
     * inbox, starred, important, sent, archive, trash, system, all.
     *
     * The "system_only" query param lets the frontend fetch only automated system
     * notifications (e.g., "Your application was approved") separately from human messages.
     *
     * GET /api/inbox/conversations
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Cap per_page at 100 to prevent overly large database queries
        $perPage = min($request->integer('per_page', 25), 100);

        // Folder-based filtering added in Phase 8 — defaults to "inbox" if not specified
        $folder = $request->string('folder', 'inbox')->toString();
        $validFolders = ['inbox', 'starred', 'important', 'sent', 'archive', 'trash', 'system', 'all'];
        if (! in_array($folder, $validFolders, true)) {
            // Unknown folder name falls back to inbox to avoid silent errors
            $folder = 'inbox';
        }

        // Legacy param compat: include_archived=true → archive folder
        // Old frontend code sent this param before the folder system was introduced
        if ($folder === 'inbox' && $request->boolean('include_archived', false)) {
            $folder = 'archive';
        }

        // system_only=1 → only automated system notifications
        // system_only=0 → only human conversations
        // absent → both (null means no filter)
        $systemOnly = $request->has('system_only')
            ? $request->boolean('system_only')
            : null;

        // Delegate the query to InboxService which handles all folder/filter logic
        $conversations = $this->inboxService->getUserConversations(
            $user,
            $perPage,
            $systemOnly,
            $folder
        );

        return response()->json([
            'success' => true,
            // ConversationResource transforms the model into the API contract shape
            'data' => ConversationResource::collection($conversations->items())->resolve($request),
            'meta' => [
                'current_page' => $conversations->currentPage(),
                'last_page' => $conversations->lastPage(),
                'per_page' => $conversations->perPage(),
                'total' => $conversations->total(),
                // Included in every list response so the inbox badge can update without a separate request
                'unread_count' => $this->inboxService->getUnreadConversationCount($user),
            ],
        ]);
    }

    /**
     * Create a new conversation between the authenticated user and one or more participants.
     *
     * Security note: applicants (parents) are only allowed to message admin-role users.
     * The controller checks participant roles before calling Gate::authorize so the policy
     * can make an informed decision without repeating the role lookup.
     *
     * POST /api/inbox/conversations
     *
     * @throws ValidationException
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => 'nullable|string|max:255',
            'category' => 'nullable|string|in:general,medical,application,other',
            // At least one other participant is required; cap at 10 to prevent spam broadcasts
            'participant_ids' => 'required|array|min:1|max:10',
            // Each participant must be a real user ID; distinct prevents duplicate entries
            'participant_ids.*' => 'required|integer|exists:users,id|distinct',
            'application_id' => 'nullable|integer|exists:applications,id',
            'camper_id' => 'nullable|integer|exists:campers,id',
            'camp_session_id' => 'nullable|integer|exists:camp_sessions,id',
        ]);

        $user = $request->user();

        // For applicants and medical providers, verify they are not trying to message
        // non-admin users. Both 'admin' and 'super_admin' are administrative roles.
        $hasNonAdminParticipants = false;
        if ($user->isApplicant() || $user->isMedicalProvider()) {
            // Load the role for each proposed participant to inspect who they are
            $participantRoles = \App\Models\User::whereIn('id', $validated['participant_ids'])
                ->with('role')
                ->get()
                ->pluck('role.name')
                ->unique();

            // If any participant is NOT an admin or super_admin, the flag is raised
            $hasNonAdminParticipants = $participantRoles->contains(
                fn ($role) => ! in_array($role, ['admin', 'super_admin'], true)
            );
        }

        // The ConversationPolicy::create method receives the flag so it can reject
        // applicants who try to bypass the admin-only messaging restriction
        Gate::authorize('create', [Conversation::class, $hasNonAdminParticipants]);

        // InboxService::createConversation handles participant attachment, welcome messages, etc.
        $conversation = $this->inboxService->createConversation(
            $user,
            $validated['subject'] ?? null,
            $validated['participant_ids'],
            $validated['application_id'] ?? null,
            $validated['camper_id'] ?? null,
            $validated['camp_session_id'] ?? null,
            $validated['category'] ?? 'general'
        );

        return response()->json([
            'success' => true,
            'data' => (new ConversationResource($conversation))->resolve($request),
            'message' => 'Conversation created successfully',
        ], 201);
    }

    /**
     * Get a specific conversation with full participant and message preview data.
     *
     * Loads participants with their roles (for display badges) and the last message
     * so the frontend can immediately show the conversation thread.
     *
     * GET /api/inbox/conversations/{conversation}
     */
    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        // ConversationPolicy::view checks that the user is a participant in this conversation
        Gate::authorize('view', $conversation);

        // Eager-load relationships to avoid N+1 queries when serializing the resource
        $conversation->load(['participants.role', 'creator', 'lastMessage.sender.role', 'activeParticipantRecords']);

        return response()->json([
            'success' => true,
            'data' => (new ConversationResource($conversation))->resolve($request),
            'meta' => [
                // Let the frontend know how many unread messages exist in this thread
                'unread_count' => $conversation->getUnreadCountForUser($request->user()),
            ],
        ]);
    }

    /**
     * Archive a conversation (moves it out of the inbox to the archive folder).
     *
     * Archiving is a system-level action that affects all participants' views.
     * Delegates to InboxService which sets the archived_at timestamp.
     *
     * POST /api/inbox/conversations/{conversation}/archive
     */
    public function archive(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('archive', $conversation);

        $conversation = $this->inboxService->archiveConversation($conversation);

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'message' => 'Conversation archived successfully',
        ]);
    }

    /**
     * Unarchive a conversation (moves it back to the inbox).
     *
     * Reuses the 'archive' policy since the same permission governs both directions.
     *
     * POST /api/inbox/conversations/{conversation}/unarchive
     */
    public function unarchive(Request $request, Conversation $conversation): JsonResponse
    {
        // The 'archive' policy covers both archiving and unarchiving
        Gate::authorize('archive', $conversation);

        $conversation = $this->inboxService->unarchiveConversation($conversation);

        return response()->json([
            'success' => true,
            'data' => $conversation,
            'message' => 'Conversation unarchived successfully',
        ]);
    }

    /**
     * Add a new participant to an existing conversation.
     *
     * The policy checks that the requesting user has permission to modify participant lists
     * (typically admins or conversation creators).
     *
     * POST /api/inbox/conversations/{conversation}/participants
     *
     * @throws ValidationException
     */
    public function addParticipant(Request $request, Conversation $conversation): JsonResponse
    {
        $validated = $request->validate([
            // Must be a valid existing user ID
            'user_id' => 'required|integer|exists:users,id',
        ]);

        // Load the new participant model so the policy can inspect their role
        $newParticipant = User::findOrFail($validated['user_id']);

        // Pass both the conversation and the new participant to the policy for role checks
        Gate::authorize('addParticipant', [$conversation, $newParticipant]);

        $this->inboxService->addParticipant($conversation, $newParticipant);

        return response()->json([
            'success' => true,
            'message' => 'Participant added successfully',
        ]);
    }

    /**
     * Remove a participant from a conversation (admin action).
     *
     * Different from "leave" — this removes another user, not the current user.
     * The policy restricts this to admins.
     *
     * DELETE /api/inbox/conversations/{conversation}/participants/{user}
     *
     * @param  User  $user  The user to remove
     */
    public function removeParticipant(
        Request $request,
        Conversation $conversation,
        User $user
    ): JsonResponse {
        // Pass both the conversation and the target user to the policy
        Gate::authorize('removeParticipant', [$conversation, $user]);

        $this->inboxService->removeParticipant($conversation, $user);

        return response()->json([
            'success' => true,
            'message' => 'Participant removed successfully',
        ]);
    }

    /**
     * Allow the authenticated user to leave (remove themselves from) a conversation.
     *
     * Unlike removeParticipant, this is self-service — the user leaves voluntarily.
     *
     * POST /api/inbox/conversations/{conversation}/leave
     */
    public function leave(Request $request, Conversation $conversation): JsonResponse
    {
        $user = $request->user();

        // ConversationPolicy::leave checks the user is an active participant
        Gate::authorize('leave', $conversation);

        // Reuses removeParticipant internally — the user removes themselves
        $this->inboxService->removeParticipant($conversation, $user);

        return response()->json([
            'success' => true,
            'message' => 'Left conversation successfully',
        ]);
    }

    /**
     * Toggle the starred state for the authenticated user on this conversation.
     *
     * Starring is per-user — other participants are not affected.
     * Returns the new boolean state so the frontend can update the icon immediately.
     *
     * POST /api/inbox/conversations/{conversation}/star
     */
    public function star(Request $request, Conversation $conversation): JsonResponse
    {
        // Any participant who can view the conversation can star it
        Gate::authorize('view', $conversation);

        // InboxService updates the ConversationParticipant row and returns the new value
        $isStarred = $this->inboxService->toggleStar($conversation, $request->user());

        return response()->json([
            'success' => true,
            'is_starred' => $isStarred,
            'message' => $isStarred ? 'Conversation starred.' : 'Star removed.',
        ]);
    }

    /**
     * Toggle the important flag for the authenticated user on this conversation.
     *
     * Works identically to star() but uses a separate "important" inbox folder.
     *
     * POST /api/inbox/conversations/{conversation}/important
     */
    public function important(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $isImportant = $this->inboxService->toggleImportant($conversation, $request->user());

        return response()->json([
            'success' => true,
            'is_important' => $isImportant,
            'message' => $isImportant ? 'Marked as important.' : 'Removed from important.',
        ]);
    }

    /**
     * Move a conversation to the authenticated user's trash folder.
     *
     * Trashing is per-user (sets trashed_at on ConversationParticipant, not the Conversation itself).
     * Other participants are unaffected. The conversation can be restored later.
     *
     * POST /api/inbox/conversations/{conversation}/trash
     */
    public function trash(Request $request, Conversation $conversation): JsonResponse
    {
        // Participants with view access can trash their own copy of the conversation
        Gate::authorize('view', $conversation);

        $this->inboxService->trashConversation($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation moved to trash.',
        ]);
    }

    /**
     * Restore a conversation from the authenticated user's trash folder.
     *
     * Clears the trashed_at timestamp on the participant record so the conversation
     * reappears in the inbox.
     *
     * POST /api/inbox/conversations/{conversation}/restore-trash
     */
    public function restoreFromTrash(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $this->inboxService->restoreFromTrash($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation restored.',
        ]);
    }

    /**
     * Mark all messages in a conversation as read for the authenticated user.
     *
     * Clears the unread badge for this conversation without requiring the user
     * to open and scroll through the thread. Safe to call repeatedly (idempotent).
     *
     * POST /api/inbox/conversations/{conversation}/read
     */
    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $this->messageService->markAllAsRead($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation marked as read.',
        ]);
    }

    /**
     * Mark a conversation as unread for the authenticated user.
     *
     * Removes the read receipt for the most recent non-own message so the conversation
     * appears unread again. Per-user action — other participants are unaffected.
     *
     * POST /api/inbox/conversations/{conversation}/unread
     */
    public function markUnread(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('view', $conversation);

        $this->messageService->markConversationUnread($conversation, $request->user());

        return response()->json([
            'success' => true,
            'message' => 'Conversation marked as unread.',
        ]);
    }

    /**
     * Permanently soft-delete a conversation (admin only).
     *
     * Unlike per-user trash, this hides the conversation from ALL participants.
     * The record is kept in the database with a deleted_at timestamp (soft delete).
     *
     * DELETE /api/inbox/conversations/{conversation}
     */
    public function destroy(Request $request, Conversation $conversation): JsonResponse
    {
        // ConversationPolicy::delete restricts this to admin roles
        Gate::authorize('delete', $conversation);

        $this->inboxService->deleteConversation($conversation);

        return response()->json([
            'success' => true,
            'message' => 'Conversation deleted successfully',
        ]);
    }
}
