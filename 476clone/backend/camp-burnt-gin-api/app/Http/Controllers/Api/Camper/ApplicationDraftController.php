<?php

namespace App\Http\Controllers\Api\Camper;

use App\Http\Controllers\Controller;
use App\Models\ApplicationDraft;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ApplicationDraftController — server-side save slots for in-progress forms.
 *
 * A draft is a raw JSON blob of the frontend FormState. It is not linked to
 * any camper or application record — those are created only on final Submit.
 * This resource is applicant-only; admins do not interact with drafts.
 *
 * Endpoints:
 *   GET    /application-drafts           List all drafts for the authenticated user
 *   POST   /application-drafts           Create a new (empty) draft
 *   GET    /application-drafts/{draft}   Retrieve a single draft
 *   PUT    /application-drafts/{draft}   Save (overwrite) the draft data
 *   DELETE /application-drafts/{draft}   Hard-delete the draft
 */
class ApplicationDraftController extends Controller
{
    /**
     * List all draft save slots for the authenticated user.
     *
     * GET /api/application-drafts
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ApplicationDraft::class);

        $drafts = ApplicationDraft::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->get(['id', 'label', 'created_at', 'updated_at']);

        return response()->json(['data' => $drafts]);
    }

    /**
     * Create a new empty draft save slot.
     *
     * POST /api/application-drafts
     * Body: { label?: string }
     *
     * Rate-limited to 10 drafts per user. Parents rarely need more than a
     * handful of concurrent in-progress applications; exceeding this limit
     * almost always indicates a frontend bug (e.g. rapid navigation looping).
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ApplicationDraft::class);

        // Guard against runaway draft creation (buggy clients, automated abuse).
        $existingCount = ApplicationDraft::where('user_id', $request->user()->id)->count();
        if ($existingCount >= 10) {
            return response()->json([
                'message' => 'Draft limit reached. Please delete an existing draft before creating a new one.',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
        ]);

        $draft = ApplicationDraft::create([
            'user_id' => $request->user()->id,
            'label' => $validated['label'] ?? 'New Application',
            'draft_data' => null,
        ]);

        return response()->json(['data' => $draft], Response::HTTP_CREATED);
    }

    /**
     * Retrieve a single draft (including its full draft_data).
     *
     * GET /api/application-drafts/{draft}
     */
    public function show(ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('view', $draft);

        return response()->json(['data' => $draft]);
    }

    /**
     * Save (overwrite) the draft data. Called on every auto-save.
     *
     * PUT /api/application-drafts/{draft}
     * Body: { label?: string, draft_data: object, last_known_updated_at?: string }
     *
     * Optimistic concurrency guard: if the caller supplies last_known_updated_at
     * and it does not match the server's current updated_at, the request is
     * rejected with 409 Conflict. This prevents the "two-tab lost-update" race
     * condition where a second browser tab overwrites progress from the first.
     * Callers should pass the updated_at value they received from the last
     * successful fetch or save and refresh their local copy on 409.
     */
    public function update(Request $request, ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('update', $draft);

        $validated = $request->validate([
            'label' => ['sometimes', 'string', 'max:255'],
            'draft_data' => ['required', 'array'],
            'last_known_updated_at' => ['sometimes', 'nullable', 'string'],
        ]);

        // Guard against pathologically large payloads. A fully-completed application
        // form with all narratives, medications, and device notes is well under 64 KB.
        // 512 KB is a generous ceiling that catches unbounded growth without impacting
        // any legitimate use.
        $payloadSize = strlen((string) json_encode($validated['draft_data']));
        if ($payloadSize > 524288) { // 512 KB
            return response()->json([
                'message' => 'Draft data exceeds the maximum allowed size of 512 KB.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Optimistic locking: reject if the client's last-known timestamp doesn't
        // match the server's current updated_at, indicating a concurrent save won.
        if (! empty($validated['last_known_updated_at'])) {
            $clientTs = $validated['last_known_updated_at'];
            $serverTs = $draft->updated_at?->toISOString();
            if ($clientTs !== $serverTs) {
                return response()->json([
                    'message' => 'Draft was modified in another tab or session. Please reload to see the latest version.',
                    'conflict' => true,
                    'server_updated_at' => $serverTs,
                ], Response::HTTP_CONFLICT);
            }
        }

        $draft->update([
            'label' => $validated['label'] ?? $draft->label,
            'draft_data' => $validated['draft_data'],
        ]);

        return response()->json(['data' => $draft->only(['id', 'label', 'updated_at'])]);
    }

    /**
     * Permanently delete a draft. No audit log — drafts contain no finalised records.
     *
     * DELETE /api/application-drafts/{draft}
     */
    public function destroy(ApplicationDraft $draft): JsonResponse
    {
        $this->authorize('delete', $draft);

        $draft->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
