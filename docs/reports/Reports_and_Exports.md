# Reports and Exports

**Version:** 1.0 — 2026-03-29
**Access:** `admin`, `super_admin` roles only
**Route:** `/admin/reports`

---

## Table of Contents

1. [Overview](#overview)
2. [Access Control](#access-control)
3. [Summary Dashboard Endpoint](#summary-dashboard-endpoint)
4. [CSV Export Endpoints](#csv-export-endpoints)
5. [Export Format Details](#export-format-details)
6. [Admin Reports Page](#admin-reports-page)
7. [Application Status Coverage](#application-status-coverage)
8. [Session Enrollment Reports](#session-enrollment-reports)

---

## Overview

The reporting subsystem provides two categories of output for administrators:

1. **Summary dashboard (JSON)** — Aggregate counts and timeline data rendered as interactive charts on the `AdminReportsPage`. No file download required.
2. **CSV exports (file downloads)** — Five report types available as streamed CSV downloads for offline use in mail merge tools, spreadsheet analysis, and ID badge printing.

All report endpoints are implemented in `ReportController` (`app/Http/Controllers/Api/System/ReportController.php`). Heavy query logic is delegated to `ReportService` (`app/Services/System/ReportService.php`). All endpoints require the `admin` or `super_admin` role, enforced via the `ApplicationPolicy::viewAny` gate.

---

## Access Control

All report endpoints share the same authorization check:

```php
$this->authorize('viewAny', Application::class);
```

This maps to `ApplicationPolicy::viewAny`, which permits `admin` and `super_admin` roles. Medical providers and applicants cannot access any report endpoint.

| Role | Reports access |
|---|---|
| `super_admin` | Full access to all reports |
| `admin` | Full access to all reports |
| `medical` | No access |
| `applicant` | No access |

---

## Summary Dashboard Endpoint

### `GET /api/reports/summary`

Returns a single JSON object used to populate all charts and stat cards on the `AdminReportsPage`. No file is downloaded.

**Authorization:** `ApplicationPolicy::viewAny`

**Response shape:**

```json
{
  "success": true,
  "data": {
    "total_campers": 84,
    "total_applications": 121,
    "applications_by_status": {
      "pending": 12,
      "under_review": 8,
      "approved": 72,
      "rejected": 14,
      "waitlisted": 9,
      "cancelled": 6
    },
    "accepted_applications": 72,
    "pending_applications": 20,
    "rejected_applications": 14,
    "sessions": [
      {
        "id": 1,
        "name": "Session A",
        "capacity": 30,
        "enrolled": 22
      }
    ],
    "applications_over_time": [
      { "month": "2026-01", "count": 14 },
      { "month": "2026-02", "count": 31 }
    ]
  }
}
```

**Field notes:**

- `applications_by_status` — Full flat map of every status to its application count. Produced by a single `GROUP BY status` query.
- `accepted_applications` — Alias for `applications_by_status.approved`, surfaced separately for the stat card.
- `pending_applications` — Sum of `pending` and `under_review` counts ("awaiting action").
- `sessions` — All `CampSession` rows with an `applications_count` (not filtered by active status). Maximum 8 sessions are shown in the enrollment chart on the frontend.
- `applications_over_time` — Monthly submission counts from `submitted_at`, filtered to exclude draft applications (`whereNotNull('submitted_at')`). Used for the trend line chart.

---

## CSV Export Endpoints

All CSV endpoints stream the file directly to the HTTP output buffer row-by-row using `StreamedResponse`, keeping memory usage flat for large datasets. All files include a UTF-8 BOM (`\xEF\xBB\xBF`) so Excel on Windows renders accented characters in names correctly. Filenames include today's date in `YYYY-MM-DD` format.

---

### Applications Report

| | |
|---|---|
| **Endpoint** | `GET /api/reports/applications` |
| **Filename** | `applications-YYYY-MM-DD.csv` |
| **Access** | `admin`, `super_admin` |
| **Description** | Complete list of applications across all statuses, with camper info, parent info, session assignment, and review details. Suitable for general spreadsheet analysis. |

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter to one `ApplicationStatus` value (e.g. `approved`, `waitlisted`) |
| `camp_session_id` | integer | Filter to a single camp session |
| `date_from` | date (Y-m-d) | Include only applications submitted on or after this date |
| `date_to` | date (Y-m-d) | Include only applications submitted on or before this date |

**Columns:**

`ID` | `Camper Name` | `Parent Name` | `Parent Email` | `Camp Session` | `Camp Name` | `Status` | `Submitted At` | `Reviewed At` | `Reviewer`

**Notes:** `Reviewed At` and `Reviewer` are blank for applications that have not yet been reviewed. Draft applications with `submitted_at = null` are included in the dataset when no `date_from`/`date_to` filter is applied; use the `date_from` filter to restrict to submitted applications.

---

### Accepted Applicants Report

| | |
|---|---|
| **Endpoint** | `GET /api/reports/accepted-applicants` |
| **Filename** | `accepted-applicants-YYYY-MM-DD.csv` |
| **Access** | `admin`, `super_admin` |
| **Description** | Enrollment roster of all approved campers. Includes date of birth, age, and session date range. Used to produce session check-in lists and age-appropriate programming plans. |

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `camp_session_id` | integer | Filter to a single camp session |

**Columns:**

`Camper ID` | `Camper Name` | `Date of Birth` | `Age` | `Parent Name` | `Parent Email` | `Camp Session` | `Session Dates` | `Approved At`

**Notes:** `Session Dates` is formatted as a human-readable range, e.g. `Jun 1 - Jun 7, 2026`. `Age` is calculated from `date_of_birth` at report generation time. The query hard-codes `status = approved`; no status filter parameter is accepted.

---

### Rejected Applicants Report

| | |
|---|---|
| **Endpoint** | `GET /api/reports/rejected-applicants` |
| **Filename** | `rejected-applicants-YYYY-MM-DD.csv` |
| **Access** | `admin`, `super_admin` |
| **Description** | Record of all rejected applications. Includes reviewer notes so the admin team can audit decision rationale over time. |

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `camp_session_id` | integer | Filter to a single camp session |

**Columns:**

`Camper ID` | `Camper Name` | `Parent Name` | `Parent Email` | `Camp Session` | `Rejected At` | `Notes`

**Notes:** `Notes` may be blank if the reviewer did not enter a reason. The query hard-codes `status = rejected`.

---

### Mailing Labels Report

| | |
|---|---|
| **Endpoint** | `GET /api/reports/mailing-labels` |
| **Filename** | `mailing-labels-YYYY-MM-DD.csv` |
| **Access** | `admin`, `super_admin` |
| **Description** | Minimal three-column file ready for import into a mail merge tool to generate physical acceptance or rejection letters. |

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by application status. Defaults to `approved` when omitted. |
| `camp_session_id` | integer | Filter to a single camp session |

**Validation:** `status` must be a non-empty string; `camp_session_id` must reference an existing `camp_sessions.id`.

**Columns:**

`Recipient Name` | `Camper Name` | `Email`

**Notes:** Only submitted applications (`submitted_at` is not null) are included regardless of status filter. When `status` is omitted, the report defaults to approved applications only.

---

### ID Labels Report

| | |
|---|---|
| **Endpoint** | `GET /api/reports/id-labels` |
| **Filename** | `id-labels-YYYY-MM-DD.csv` |
| **Access** | `admin`, `super_admin` |
| **Description** | Per-camper badge data for printing wristbands or lanyard inserts. Includes severe allergy information so ID labels can carry medical alerts. |

**Parameters (all optional):**

| Parameter | Type | Description |
|---|---|---|
| `camp_session_id` | integer | Filter to a single session. Omit to include all approved campers across all sessions. |

**Validation:** `camp_session_id` must reference an existing `camp_sessions.id` if provided. Passing `0` is treated as null (all sessions).

**Columns:**

`Camper Name` | `Date of Birth` | `Age` | `Session Name` | `Has Severe Allergies` | `Severe Allergies`

**Notes:**
- `Date of Birth` uses US format `m/d/Y`.
- `Has Severe Allergies` is `Yes` or `No`.
- `Severe Allergies` lists allergens delimited by `;` (semicolon), so individual cells remain readable in Excel without splitting into sub-columns.
- Severity determination uses `Allergy::requiresImmediateAttention()` on each allergy row; only severe or life-threatening allergies are listed.
- The query hard-codes `status = approved`.

---

## Export Format Details

### Format

All exports use **CSV only**. There is no PDF export capability in the current implementation. PDF letters (acceptance/rejection) are generated separately through the mailing system; they are not produced by this controller.

### Streaming

Exports use Laravel's `response()->streamDownload()`, which writes the CSV row-by-row directly to the output buffer. This keeps server memory usage constant regardless of result set size — a full-season export of thousands of applications does not require buffering the entire dataset in memory.

### Character encoding

All CSV files include a UTF-8 BOM at byte position 0. This ensures Microsoft Excel opens the file with correct encoding without requiring a manual import wizard step, which is important for Spanish-language camper names containing accented characters.

### Library

No third-party CSV library is used. Output is produced with PHP's native `fputcsv()`, which handles quoting, escaping, and line endings automatically.

---

## Admin Reports Page

**Route:** `/admin/reports`
**Component:** `frontend/src/features/admin/pages/AdminReportsPage.tsx`
**Chart library:** Recharts

### Summary stat cards

Four counter cards display at the top of the page, populated from `GET /api/reports/summary`:

| Card | Value |
|---|---|
| Total Campers | `total_campers` |
| Accepted | `accepted_applications` |
| Rejected | `rejected_applications` |
| Acceptance Rate | `accepted / total * 100` (percentage, guards against division by zero) |

### Charts

Four Recharts visualisations are rendered below the stat cards:

| Chart | Type | Data source | Notes |
|---|---|---|---|
| Applications by Status | Vertical bar chart | `applications_by_status` map | Each bar uses a distinct color per status; bars with zero applications are filtered out |
| Acceptance Rate | Donut pie chart | `accepted_applications`, `rejected_applications`, remainder | Three slices: approved (green), rejected (red), other (gray). Center displays the acceptance rate percentage. |
| Applications Over Time | Line chart | `applications_over_time` | Monthly submission counts; x-axis labels format `2026-03` as `Mar 2026`. Draft applications excluded. |
| Enrollment Per Session | Horizontal bar chart | `sessions` | Two bars per session: capacity (light green) and enrolled (solid green). Displays at most 8 sessions. |

### CSV export buttons

Five download buttons are displayed in a responsive grid below the charts. Each button triggers `downloadReport(type)` in `admin.api.ts`, which fetches the relevant endpoint and triggers a browser file download without navigating away from the page.

| Button label | Report type | Endpoint called |
|---|---|---|
| All Applications | `applications` | `GET /api/reports/applications` |
| Accepted Only | `accepted` | `GET /api/reports/accepted-applicants` |
| Rejected Only | `rejected` | `GET /api/reports/rejected-applicants` |
| Mailing Labels | `mailing-labels` | `GET /api/reports/mailing-labels` |
| ID Labels | `id-labels` | `GET /api/reports/id-labels` |

All buttons are disabled while any download is in progress. The actively downloading button shows a spinner; other buttons are dimmed to 60% opacity.

---

## Application Status Coverage

The summary endpoint and status bar chart include all application statuses that exist in the system:

| Status | Color (chart) | Included in summary |
|---|---|---|
| `pending` | Amber `#f59e0b` | Yes |
| `under_review` | Blue `#3b82f6` | Yes |
| `approved` | Green `#16a34a` | Yes |
| `rejected` | Red `#dc2626` | Yes |
| `waitlisted` | Orange `#ea580c` | Yes |
| `cancelled` | Gray `#9ca3af` | Yes |

`waitlisted` was absent from the original reports page and was added as part of the bug fix campaign (BUG-103). All six statuses are now represented in both the `applications_by_status` map returned by the API and in the frontend `statusCounts` array used to render the bar chart. Bars with a value of zero are filtered out so they do not appear in the chart.

`pending_applications` in the summary counts both `pending` and `under_review` together as "awaiting action" for the convenience stat card; individual counts remain available in `applications_by_status`.

---

## Session Enrollment Reports

Session enrollment data is included in the `summary` endpoint response. It is not a separate download.

**Source query:** `CampSession::withCount('applications')->get()`

Each session object in the response contains:

| Field | Description |
|---|---|
| `id` | Camp session primary key |
| `name` | Session display name |
| `capacity` | Maximum camper capacity configured for the session |
| `enrolled` | Number of applications associated with the session (`applications_count`) |

**Important:** `enrolled` counts all applications associated with the session regardless of status, not only approved applications. This is a raw `withCount` of the `applications` relation. Capacity utilisation based on approved-only counts should be derived from the accepted applicants report filtered by `camp_session_id`.

The enrollment horizontal bar chart on `AdminReportsPage` renders both `capacity` and `enrolled` as overlaid bars so administrators can immediately see which sessions are approaching or at capacity.
