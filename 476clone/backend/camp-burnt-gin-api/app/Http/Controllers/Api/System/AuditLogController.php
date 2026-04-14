<?php

namespace App\Http\Controllers\Api\System;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * AuditLogController — Read-only access to the system audit trail.
 *
 * An audit log is like a security camera recording for the database — every
 * important action (login, record creation, message sent, etc.) is written as
 * an AuditLog entry so administrators can review what happened and when.
 *
 * This controller gives super administrators two ways to interact with the log:
 *   - index()  → paginated, filterable view in the browser (used by AuditLogPage).
 *   - export() → downloadable CSV or JSON file for offline analysis / compliance.
 *
 * Access is restricted to the super_admin role (enforced at the route level).
 *
 * HIPAA note: The audit log itself is a compliance requirement — these endpoints
 * must never be disabled or unprotected.
 *
 * Supported filters (both index and export):
 *   search      - text across action, description, entity type
 *   user_id     - filter by actor
 *   action      - filter by action name
 *   event_type  - category filter (authentication, messaging, applications, etc.)
 *   entity_type - short model name (Conversation, Message, Application, etc.)
 *   from / to   - date range
 *
 * Export: GET /audit-log/export?format=csv|json
 */
class AuditLogController extends Controller
{
    /**
     * Return a paginated list of audit log entries.
     *
     * GET /api/audit-log
     *
     * Step-by-step:
     *   1. Validate all optional filter parameters.
     *   2. Build a filtered, sorted Eloquent query via buildQuery().
     *   3. Paginate the results (default 25 per page).
     *   4. Format entries through formatEntries() to add derived fields.
     */
    public function index(Request $request): JsonResponse
    {
        // Validate all filter parameters before they touch the database query builder.
        $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            // user_id must reference a real user row — prevents querying phantom IDs.
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'action' => ['nullable', 'string', 'max:100'],
            'event_type' => ['nullable', 'string', 'max:100'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            // 'to' must be on or after 'from' to prevent impossible date ranges.
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        // buildQuery() applies all active filters and returns a query builder instance.
        $query = $this->buildQuery($request);

        $entries = $query->paginate($request->integer('per_page', 25));

        return response()->json([
            // formatEntries() adds human_description, category, and short entity names.
            'data' => $this->formatEntries($entries->items()),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'last_page' => $entries->lastPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
                'from' => $entries->firstItem(),
                'to' => $entries->lastItem(),
            ],
        ]);
    }

    /**
     * Export audit log entries as CSV or JSON.
     *
     * GET /audit-log/export?format=csv|json&...filters
     *
     * Accepts the same filters as index(). Capped at 5,000 rows to prevent
     * accidental memory exhaustion; callers needing more should apply tighter
     * date ranges and download multiple batches.
     *
     * JSON format is pretty-printed for readability.
     * CSV format includes a UTF-8 BOM equivalent via Content-Type so Excel
     * opens it correctly without garbled special characters.
     */
    public function export(Request $request): Response|JsonResponse
    {
        // Validate filter params identical to index(), plus the format choice.
        $request->validate([
            'format' => ['nullable', 'string', 'in:csv,json'],
            'search' => ['nullable', 'string', 'max:255'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'action' => ['nullable', 'string', 'max:100'],
            'event_type' => ['nullable', 'string', 'max:100'],
            'entity_type' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        // Default to CSV since that's the most universally useful format.
        $format = $request->input('format', 'csv');
        // Hard cap at 5,000 rows — this prevents memory exhaustion for large logs.
        $entries = $this->buildQuery($request)->limit(5000)->get();
        $rows = $this->formatEntries($entries->all());

        if ($format === 'json') {
            // Pretty-print and preserve unicode characters for readability.
            $json = json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $filename = 'audit-log-'.now()->format('Y-m-d').'.json';

            // Set Content-Disposition to "attachment" so the browser downloads it, not renders it.
            return response($json, 200, [
                'Content-Type' => 'application/json',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ]);
        }

        // CSV
        $filename = 'audit-log-'.now()->format('Y-m-d').'.csv';
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        // Define column headers for the CSV file — one per column in the output.
        $columns = ['id', 'timestamp', 'category', 'action', 'description', 'user', 'user_id', 'entity', 'entity_id', 'ip_address', 'user_agent'];
        $csvRows = [];
        // First row is the header row — wrap each header in quotes for safety.
        $csvRows[] = implode(',', array_map(fn ($c) => '"'.$c.'"', $columns));

        foreach ($rows as $row) {
            // addslashes() escapes any quotes inside values so the CSV stays valid.
            // substr() trims the user_agent to 80 chars — full UA strings are very long.
            $csvRows[] = implode(',', [
                $row['id'],
                '"'.($row['created_at'] ?? '').'"',
                '"'.($row['event_type'] ?? '').'"',
                '"'.addslashes($row['action'] ?? '').'"',
                '"'.addslashes($row['description'] ?? '').'"',
                '"'.addslashes($row['user']['name'] ?? 'System').'"',
                $row['user_id'] ?? '',
                '"'.addslashes($this->shortEntityType($row['auditable_type'] ?? '')).'"',
                $row['auditable_id'] ?? '',
                '"'.($row['ip_address'] ?? '').'"',
                '"'.addslashes(substr($row['user_agent'] ?? '', 0, 80)).'"',
            ]);
        }

        // Join all rows with newlines to produce the final CSV string.
        return response(implode("\n", $csvRows), 200, $headers);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Build the filtered AuditLog query from the current request.
     *
     * Encapsulated here so index() and export() share identical filter logic
     * without duplicating code. Returns an Eloquent query builder instance.
     */
    private function buildQuery(Request $request)
    {
        // Eager-load just the fields we need from the user — avoids pulling full user records.
        $query = AuditLog::with('user:id,name,email')
            ->orderBy('created_at', 'desc');

        if ($request->filled('search')) {
            $term = $request->string('search');
            // Search across action slug, human description, and the entity model class name.
            $query->where(function ($q) use ($term) {
                $q->where('action', 'like', "%{$term}%")
                    ->orWhere('description', 'like', "%{$term}%")
                    ->orWhere('auditable_type', 'like', "%{$term}%");
            });
        }

        if ($request->filled('user_id')) {
            // Exact match on user_id — find all actions by a specific person.
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('action')) {
            // Partial match so "creat" will find "created", "created_record", etc.
            $query->where('action', 'like', '%'.$request->string('action').'%');
        }

        if ($request->filled('event_type')) {
            // Exact match — event_type values are controlled enums (e.g., "authentication").
            $query->where('event_type', $request->string('event_type'));
        }

        if ($request->filled('entity_type')) {
            // Accept short names like "Conversation" or full "App\Models\Conversation"
            // LIKE match handles both short names ("User") and full class names ("App\Models\User").
            $entityType = $request->string('entity_type');
            $query->where(function ($q) use ($entityType) {
                $q->where('auditable_type', 'like', "%{$entityType}%");
            });
        }

        if ($request->filled('from')) {
            // whereDate() compares only the date portion, ignoring the time component.
            $query->whereDate('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        return $query;
    }

    /**
     * Format raw AuditLog models into a consistent API response shape.
     *
     * Adds three derived fields that don't exist in the database column but are
     * needed by the frontend:
     *   - human_description: a plain-English sentence describing what happened.
     *   - category:          a broad grouping label (e.g., "Security", "Messaging").
     *   - entity_label:      the short model name without the namespace prefix.
     */
    private function formatEntries(array $items): array
    {
        return array_map(function (AuditLog $entry) {
            // Strip "App\Models\" prefix so "App\Models\Conversation" becomes "Conversation".
            $shortEntity = $this->shortEntityType($entry->auditable_type ?? '');
            $userName = $entry->user?->name ?? 'System';

            return [
                'id' => $entry->id,
                'request_id' => $entry->request_id,
                'user_id' => $entry->user_id,
                // Include a minimal user sub-object for display in the admin table.
                'user' => $entry->user ? [
                    'id' => $entry->user->id,
                    'name' => $entry->user->name,
                    'email' => $entry->user->email,
                ] : null,
                'event_type' => $entry->event_type,
                // Broad display category derived from the event_type slug.
                'category' => $this->mapCategory($entry->event_type),
                'action' => $entry->action,
                'description' => $entry->description,
                // A readable sentence, e.g. "Alice Smith approved Application #42".
                'human_description' => $this->buildHumanDescription($userName, $entry->action, $shortEntity, $entry->auditable_id, $entry->description),
                'auditable_type' => $entry->auditable_type,
                'auditable_id' => $entry->auditable_id,
                // Short model name used as a badge label in the UI.
                'entity_label' => $shortEntity,
                // old_values and new_values power the before/after diff view in the UI.
                'old_values' => $entry->old_values,
                'new_values' => $entry->new_values,
                'metadata' => $entry->metadata,
                'ip_address' => $entry->ip_address,
                'user_agent' => $entry->user_agent,
                'created_at' => $entry->created_at?->toISOString(),
            ];
        }, $items);
    }

    /**
     * Convert a fully-qualified model class name to a short display label.
     *
     * "App\Models\Conversation" → "Conversation"
     * The last segment after the final backslash is the class's simple name.
     */
    private function shortEntityType(string $type): string
    {
        if (! $type) {
            return '';
        }
        // Split on backslash and take the last element — the class name itself.
        $parts = explode('\\', $type);

        return end($parts);
    }

    /**
     * Map event_type values to human-readable category labels.
     *
     * These labels appear as coloured badges in the AuditLogPage timeline so
     * admins can quickly scan which area of the system an action belongs to.
     * The match covers both old and new event_type naming conventions.
     */
    private function mapCategory(string $eventType): string
    {
        return match ($eventType) {
            'authentication', 'auth' => 'Authentication',
            'message', 'conversation' => 'Messaging',
            'message_attachment' => 'Messaging',
            'application' => 'Applications',
            'notification' => 'Notifications',
            'security', 'mfa' => 'Security',
            // 'phi_access' is PHI (Protected Health Information) — HIPAA-relevant.
            'phi_access', 'medical' => 'Medical',
            'admin_action', 'data_change' => 'Administrative',
            'file_access', 'document' => 'Documents',
            'system', 'user' => 'System',
            // Unknown event types fall back to "System" rather than erroring.
            default => 'System',
        };
    }

    /**
     * Build a plain-English sentence describing what happened.
     *
     * Prefers the stored description when it is already informative (longer
     * than 20 characters). Falls back to generating a sentence from the
     * action verb and entity information for shorter / missing descriptions.
     *
     * Examples:
     *   "Alice Smith approved Application #42"
     *   "Bob Jones enabled two-factor authentication"
     */
    private function buildHumanDescription(
        string $userName,
        string $action,
        string $entityLabel,
        ?int $entityId,
        ?string $storedDescription
    ): string {
        // Use stored description if it reads naturally (longer than a bare action word)
        if ($storedDescription && strlen($storedDescription) > 20) {
            return $storedDescription;
        }

        // Build an "entity reference" like "Application #42" or just "Application".
        $entity = $entityLabel && $entityId
            ? "{$entityLabel} #{$entityId}"
            : ($entityLabel ?: 'record');

        // Match common action verbs to full readable sentences.
        return match ($action) {
            'created' => "{$userName} created {$entity}",
            'updated' => "{$userName} updated {$entity}",
            'deleted', 'soft_deleted' => "{$userName} deleted {$entity}",
            'archived' => "{$userName} archived {$entity}",
            'unarchived' => "{$userName} restored {$entity} from archive",
            'trashed' => "{$userName} moved {$entity} to trash",
            'restored_from_trash' => "{$userName} restored {$entity} from trash",
            'sent' => "{$userName} sent a message in {$entity}",
            'read' => "{$userName} read {$entity}",
            'viewed', 'view' => "{$userName} viewed {$entity}",
            'login' => "{$userName} logged in",
            'logout' => "{$userName} logged out",
            'login_failed' => "Failed login attempt for {$userName}",
            'mfa_enabled' => "{$userName} enabled two-factor authentication",
            'mfa_disabled' => "{$userName} disabled two-factor authentication",
            'password_reset' => "{$userName} reset their password",
            'approved' => "{$userName} approved {$entity}",
            'rejected' => "{$userName} rejected {$entity}",
            'starred' => "{$userName} starred {$entity}",
            'participant_added' => "{$userName} added a participant to {$entity}",
            'participant_removed' => "{$userName} removed a participant from {$entity}",
            'accessed' => "{$userName} downloaded attachment on {$entity}",
            'attached' => "{$userName} attached a file to {$entity}",
            // Catch-all for any action verb not explicitly listed above.
            default => "{$userName} performed '{$action}' on {$entity}",
        };
    }
}
