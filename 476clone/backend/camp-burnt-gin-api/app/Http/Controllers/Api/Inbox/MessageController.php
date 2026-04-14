<?php

namespace App\Http\Controllers\Api\Inbox;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageAttachmentResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

/**
 * MessageController — handles HTTP requests for individual message operations within conversations.
 *
 * This controller works alongside ConversationController: conversations are the threads,
 * messages are the individual items inside those threads. Every message belongs to one conversation.
 *
 * Responsibilities:
 *   - Validate incoming request data (body length, attachment types/sizes)
 *   - Enforce authorization via Laravel Gate (MessagePolicy)
 *   - Delegate business logic to MessageService
 *   - Return formatted JSON responses
 *
 * All routes require Sanctum token authentication.
 * Idempotency keys on message sends prevent duplicate messages if the frontend retries.
 *
 * Key endpoints:
 *   GET    /api/inbox/conversations/{conversation}/messages       — list messages
 *   POST   /api/inbox/conversations/{conversation}/messages       — send a message
 *   GET    /api/inbox/messages/{message}                          — view + mark read
 *   GET    /api/inbox/messages/unread-count                       — badge count
 *   GET    /api/inbox/messages/{message}/attachments/{documentId} — download file
 *   DELETE /api/inbox/messages/{message}                          — soft-delete (admin)
 */
class MessageController extends Controller
{
    /**
     * Inject MessageService via constructor — business logic lives there.
     */
    public function __construct(protected MessageService $messageService) {}

    /**
     * List all messages in a conversation, paginated oldest-first.
     *
     * Also returns the unread count for the authenticated user within this conversation
     * so the frontend can update the unread badge without a separate API call.
     *
     * GET /api/inbox/conversations/{conversation}/messages
     */
    public function index(Request $request, Conversation $conversation): JsonResponse
    {
        // MessagePolicy::viewAny checks the user is a participant in this conversation
        Gate::authorize('viewAny', [Message::class, $conversation]);

        // Cap per_page at 100 to prevent very large result sets
        $perPage = min($request->integer('per_page', 25), 100);

        // MessageService handles ordering, soft-delete filtering, and read-receipt logic
        $messages = $this->messageService->getConversationMessages(
            $conversation,
            $request->user(),
            $perPage
        );

        $viewer = $request->user();

        return response()->json([
            'success' => true,
            'data' => collect($messages->items())->map(fn ($msg) => $this->shapeMessage($msg, $viewer))->all(),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page' => $messages->lastPage(),
                'per_page' => $messages->perPage(),
                'total' => $messages->total(),
                // How many messages this user hasn't read yet in this conversation
                'unread_count' => $this->messageService->getConversationUnreadCount(
                    $conversation,
                    $request->user()
                ),
            ],
        ]);
    }

    /**
     * Send a new message in a conversation.
     *
     * Attachments are validated for type and size before being stored. An idempotency_key
     * can be supplied by the frontend to safely retry failed sends without creating duplicates.
     *
     * Accepts optional recipients array with TO/CC/BCC types:
     *   recipients: [{user_id: 1, type: "to"}, {user_id: 2, type: "cc"}, ...]
     *
     * When sent as multipart/form-data (with file attachments), recipients must be passed
     * as a JSON string in the recipients_json field. When sent as JSON, use the recipients array.
     *
     * POST /api/inbox/conversations/{conversation}/messages
     */
    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('create', [Message::class, $conversation]);

        $validated = $request->validate([
            'body' => 'required|string|max:65535',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:pdf,jpeg,png,gif,doc,docx',
            'idempotency_key' => 'nullable|string|max:64',
            // Optional typed recipients. Each entry must have user_id + type.
            'recipients' => 'nullable|array|max:20',
            'recipients.*.user_id' => 'required|integer|exists:users,id',
            'recipients.*.type' => 'required|string|in:to,cc,bcc',
            // Multipart fallback: recipients serialised as JSON string
            'recipients_json' => 'nullable|string',
        ]);

        // Resolve recipients: JSON string (multipart) takes precedence → array → empty
        $recipients = $this->resolveRecipients($validated, $request);

        try {
            $message = $this->messageService->sendMessage(
                $conversation,
                $request->user(),
                $validated['body'],
                $validated['attachments'] ?? [],
                $validated['idempotency_key'] ?? null,
                $recipients
            );

            $message->load(['sender', 'attachments', 'recipients.user']);

            return response()->json([
                'success' => true,
                'data' => $this->shapeMessage($message, $request->user()),
                'message' => 'Message sent successfully',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Reply to a specific message — sends only to that message's original sender.
     *
     * Thread linkage: the reply is added to the same conversation so the full
     * conversation history is visible to all participants.
     *
     * POST /api/inbox/conversations/{conversation}/reply
     */
    public function reply(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('create', [Message::class, $conversation]);

        $validated = $request->validate([
            'body' => 'required|string|max:65535',
            'parent_message_id' => 'required|integer|exists:messages,id',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:pdf,jpeg,png,gif,doc,docx',
        ]);

        // Load the parent message and verify it belongs to this conversation
        $parentMessage = Message::where('id', $validated['parent_message_id'])
            ->where('conversation_id', $conversation->id)
            ->firstOrFail();

        try {
            $message = $this->messageService->reply(
                $conversation,
                $parentMessage,
                $request->user(),
                $validated['body'],
                $validated['attachments'] ?? []
            );

            $message->load(['sender', 'attachments', 'recipients.user']);

            return response()->json([
                'success' => true,
                'data' => $this->shapeMessage($message, $request->user()),
                'message' => 'Reply sent successfully',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Reply All to a message — sends to original sender + all visible TO/CC recipients.
     *
     * BCC recipients from the original message are NEVER included.
     * The backend computes recipients server-side to prevent client manipulation.
     *
     * POST /api/inbox/conversations/{conversation}/reply-all
     */
    public function replyAll(Request $request, Conversation $conversation): JsonResponse
    {
        Gate::authorize('create', [Message::class, $conversation]);

        $validated = $request->validate([
            'body' => 'required|string|max:65535',
            'parent_message_id' => 'required|integer|exists:messages,id',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'file|max:10240|mimes:pdf,jpeg,png,gif,doc,docx',
        ]);

        $parentMessage = Message::where('id', $validated['parent_message_id'])
            ->where('conversation_id', $conversation->id)
            ->firstOrFail();

        try {
            $message = $this->messageService->replyAll(
                $conversation,
                $parentMessage,
                $request->user(),
                $validated['body'],
                $validated['attachments'] ?? []
            );

            $message->load(['sender', 'attachments', 'recipients.user']);

            return response()->json([
                'success' => true,
                'data' => $this->shapeMessage($message, $request->user()),
                'message' => 'Reply All sent successfully',
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * View a single message and automatically mark it as read for the requesting user.
     *
     * The read receipt is recorded by MessageService (creates a MessageRead row).
     * This is the primary way the "unread" state clears — viewing marks it read.
     *
     * GET /api/inbox/messages/{message}
     */
    public function show(Request $request, Message $message): JsonResponse
    {
        // MessagePolicy::view checks that the user is a participant in the message's conversation
        Gate::authorize('view', $message);

        // Eager-load relationships needed to render the full message view
        $message->load(['sender', 'attachments', 'recipients.user']);

        // Mark as read — creates a MessageRead record if one doesn't already exist
        $this->messageService->markAsRead($message, $request->user());

        return response()->json([
            'success' => true,
            'data' => $this->shapeMessage($message, $request->user()),
        ]);
    }

    /**
     * Get the total unread message count across all conversations for the authenticated user.
     *
     * Used to power the inbox badge/counter in the navigation bar.
     *
     * GET /api/inbox/messages/unread-count
     */
    public function unreadCount(Request $request): JsonResponse
    {
        // Count messages in all conversations where this user has no MessageRead record
        $count = $this->messageService->getUnreadMessageCount($request->user());

        return response()->json([
            'success' => true,
            'unread_count' => $count,
        ]);
    }

    /**
     * Download an attachment file from a specific message.
     *
     * Authorization is checked at two levels:
     *   1. MessagePolicy::viewAttachments — the user must be a conversation participant
     *   2. MessageService::accessAttachment — the document must belong to this message
     *
     * Returns a file download response (binary stream) on success, or a 404 JSON error.
     *
     * GET /api/inbox/messages/{message}/attachments/{documentId}
     *
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse|JsonResponse
     */
    public function downloadAttachment(
        Request $request,
        Message $message,
        int $documentId
    ) {
        // Verify the user can access attachments on this message
        Gate::authorize('viewAttachments', $message);

        try {
            // accessAttachment confirms the document actually belongs to this message
            $document = $this->messageService->accessAttachment(
                $message,
                $documentId,
                $request->user()
            );

            // Stream the file using the Storage facade so the disk root is resolved
            // correctly. The local disk root is storage/app/private (Laravel 12 default),
            // not storage/app — using storage_path('app/...') would miss the /private/ prefix.
            return Storage::disk($document->disk)->download(
                $document->path,
                // Use the original human-readable filename the user uploaded (decrypted by cast)
                $document->original_filename
            );
        } catch (\Exception $e) {
            // Document not found or doesn't belong to this message
            return response()->json([
                'success' => false,
                'error' => 'Attachment not found',
            ], 404);
        }
    }

    /**
     * Preview an attachment inline (opens in browser rather than forcing a download).
     *
     * Identical authorization to downloadAttachment but returns
     * Content-Disposition: inline via Storage::response() so the browser
     * can render images and PDFs directly without triggering a file save dialog.
     *
     * GET /api/inbox/messages/{message}/attachments/{documentId}/preview
     *
     * @return \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
     */
    public function previewAttachment(
        Request $request,
        Message $message,
        int $documentId
    ) {
        Gate::authorize('viewAttachments', $message);

        try {
            $document = $this->messageService->accessAttachment(
                $message,
                $documentId,
                $request->user()
            );

            return Storage::disk($document->disk)->response(
                $document->path,
                $document->original_filename
            );
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Attachment not found',
            ], 404);
        }
    }

    /**
     * Soft-delete a message (admin only).
     *
     * The message record stays in the database with deleted_at set, but is hidden
     * from all users. Admins can use this to remove inappropriate or accidental messages.
     *
     * DELETE /api/inbox/messages/{message}
     */
    public function destroy(Request $request, Message $message): JsonResponse
    {
        // MessagePolicy::delete restricts this to admin roles
        Gate::authorize('delete', $message);

        $this->messageService->deleteMessage($message);

        return response()->json([
            'success' => true,
            'message' => 'Message deleted successfully',
        ]);
    }

    /**
     * Shape a message model into the API response array.
     *
     * BCC privacy: recipients are filtered through Message::getRecipientsForUser()
     * so that BCC entries are only visible to the original sender. This is the
     * single authoritative location where BCC filtering happens for message responses.
     *
     * @param  Message  $message  The message model (with sender, attachments, recipients.user loaded)
     * @param  \App\Models\User|null  $viewer  The user whose response is being built; null = no recipient filter
     */
    private function shapeMessage(Message $message, ?\App\Models\User $viewer = null): array
    {
        $sender = null;
        if ($message->sender) {
            $sender = [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
                'email' => $message->sender->email,
                'role' => 'unknown', // role relationship not loaded in message queries
                'avatar_url' => $message->sender->avatar_path
                    ? Storage::disk('public')->url($message->sender->avatar_path)
                    : null,
            ];
        }

        // Build the recipient list, applying BCC visibility rules per viewer
        $recipients = [];
        if ($viewer !== null) {
            $visibleRecipients = $message->getRecipientsForUser($viewer);
            foreach ($visibleRecipients as $r) {
                $recipients[] = [
                    'id' => $r->id,
                    'user_id' => $r->user_id,
                    'recipient_type' => $r->recipient_type,
                    'user' => $r->user ? [
                        'id' => $r->user->id,
                        'name' => $r->user->name,
                        'email' => $r->user->email,
                    ] : null,
                ];
            }
        }

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_id,
            'sender' => $sender,
            'body' => $message->body,
            'parent_message_id' => $message->parent_message_id,
            'reply_type' => $message->reply_type,
            'created_at' => $message->created_at?->toISOString(),
            'recipients' => $recipients,
            'attachments' => MessageAttachmentResource::collection(
                $message->attachments ?? collect()
            )->resolve(),
        ];
    }

    /**
     * Resolve the recipients array from the request.
     *
     * Handles two cases:
     *  1. JSON body (standard): recipients is a validated array of objects.
     *  2. Multipart form-data (with file uploads): recipients_json is a JSON string
     *     because FormData cannot send nested objects natively. Decoded and validated here.
     *
     * Returns an array of ['user_id' => int, 'type' => 'to'|'cc'|'bcc'] entries.
     */
    private function resolveRecipients(array $validated, \Illuminate\Http\Request $request): array
    {
        // Multipart path: decode from JSON string
        if (! empty($validated['recipients_json'])) {
            $decoded = json_decode($validated['recipients_json'], true);
            if (! is_array($decoded)) {
                return [];
            }

            // Validate each entry for safety
            return array_values(array_filter(array_map(function ($entry) {
                $userId = isset($entry['user_id']) ? (int) $entry['user_id'] : null;
                $type = in_array($entry['type'] ?? '', ['to', 'cc', 'bcc']) ? $entry['type'] : null;
                if (! $userId || ! $type) {
                    return null;
                }

                return ['user_id' => $userId, 'type' => $type];
            }, $decoded)));
        }

        // JSON body path: already validated as array
        return array_map(fn ($r) => [
            'user_id' => (int) $r['user_id'],
            'type' => $r['type'],
        ], $validated['recipients'] ?? []);
    }
}
