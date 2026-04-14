<?php

namespace App\Http\Requests\Application;

use App\Models\Camper;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Form request for creating a new camp application.
 *
 * Validates application submission including camper and session
 * selection. Ensures the camper belongs to the requesting user
 * unless the user is an administrator.
 */
class StoreApplicationRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();

        // Admins can create applications for any camper
        if ($user->isAdmin()) {
            return true;
        }

        // Parents can only create applications for their own campers
        if ($user->isApplicant()) {
            $camperId = $this->input('camper_id');
            if ($camperId) {
                $camper = Camper::find($camperId);
                // If camper exists but doesn't belong to user, deny (403)
                if ($camper && $camper->user_id !== $user->id) {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Map client-side field aliases to the canonical database column names
     * before validation runs. The frontend sends session_id; the applications
     * table stores it as camp_session_id.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('session_id') && ! $this->has('camp_session_id')) {
            $this->merge(['camp_session_id' => $this->input('session_id')]);
        }
        if ($this->has('session_id_second') && ! $this->has('camp_session_id_second')) {
            $this->merge(['camp_session_id_second' => $this->input('session_id_second')]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'camper_id' => ['required', 'integer', 'exists:campers,id'],
            'camp_session_id' => [
                'required',
                'integer',
                // Admins can create applications for any session (open or closed).
                // Applicants may only submit to sessions with portal_open=true and is_active=true.
                $this->user()?->isAdmin()
                    ? 'exists:camp_sessions,id'
                    : Rule::exists('camp_sessions', 'id')->where('portal_open', true)->where('is_active', true),
                Rule::unique('applications')->where(function ($query) {
                    return $query->where('camper_id', $this->input('camper_id'));
                }),
            ],
            'notes' => ['nullable', 'string', 'max:1000'],
            // Narrative responses from Section "About Your Camper" (free-text)
            'narrative_rustic_environment' => ['nullable', 'string', 'max:5000'],
            'narrative_staff_suggestions' => ['nullable', 'string', 'max:5000'],
            'narrative_participation_concerns' => ['nullable', 'string', 'max:5000'],
            'narrative_camp_benefit' => ['nullable', 'string', 'max:5000'],
            'narrative_heat_tolerance' => ['nullable', 'string', 'max:5000'],
            'narrative_transportation' => ['nullable', 'string', 'max:5000'],
            'narrative_additional_info' => ['nullable', 'string', 'max:5000'],
            'narrative_emergency_protocols' => ['nullable', 'string', 'max:5000'],
            // Form parity (2026_03_26_000002)
            'first_application' => ['nullable', 'boolean'],
            'attended_before' => ['nullable', 'boolean'],
            'session_id_second' => ['nullable', 'integer', 'exists:camp_sessions,id'],
            // camp_session_id_second is the canonical column name (mapped from session_id_second via prepareForValidation).
            // The 'different' rule ensures the second choice cannot duplicate the first choice.
            'camp_session_id_second' => ['nullable', 'integer', 'exists:camp_sessions,id', 'different:camp_session_id'],
            // When submitting a new application that originates from a previous one
            // (reapplication flow), the frontend passes this to preserve the audit trail.
            // Must reference an existing application — the application ID is validated but
            // ownership is not re-checked here because the store endpoint's policy gate
            // already ensures the parent owns the camper being registered.
            'reapplied_from_id' => ['nullable', 'integer', 'exists:applications,id'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'camper_id.exists' => 'The selected camper is invalid or does not belong to you.',
            'camp_session_id.exists' => 'The selected camp session is not currently accepting applications.',
            'camp_session_id.unique' => 'An application for this camper and session already exists.',
            'camp_session_id_second.different' => 'Your second session choice must be different from your first choice.',
        ];
    }
}
