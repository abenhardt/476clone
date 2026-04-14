# INBOX System Documentation

This document provides comprehensive documentation for the secure INBOX messaging system, consolidating architecture, security implementation, policy registration, and refactoring details for the Camp Burnt Gin API.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Security Implementation](#security-implementation)
4. [Policy Registration System](#policy-registration-system)
5. [Message Lifecycle](#message-lifecycle)
6. [Implementation Details](#implementation-details)
7. [Refactoring and Optimization](#refactoring-and-optimization)
8. [Testing and Validation](#testing-and-validation)
9. [Cross-References](#cross-references)

---

## System Overview

The INBOX system provides secure, policy-controlled messaging between parents, administrators, and medical providers within the Camp Burnt Gin application. It ensures HIPAA-compliant communication for PHI-containing messages.

### Key Features

- Policy-based access control (ownership, role-based, inbox-type filtering)
- PHI-safe messaging with audit logging
- Multi-participant support (parent, admin, provider)
- Message threading and status tracking
- Secure message deletion (soft delete)
- Medical provider integration via secure links

### Core Models

| Model | Purpose |
|-------|---------|
| InboxMessage | Message content, metadata, relationships |
| InboxParticipant | User participation and read status |
| Policy\InboxMessagePolicy | Authorization rules |

---

## Architecture

### Database Schema

**inbox_messages Table:**

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| subject | VARCHAR(255) | Message subject |
| body | TEXT | Message content |
| sender_id | BIGINT | User who sent (NULL for system) |
| inbox_type | ENUM | parent, admin, provider |
| related_type | VARCHAR(255) | Polymorphic parent type |
| related_id | BIGINT | Polymorphic parent ID |
| parent_message_id | BIGINT | Thread parent (NULL for root) |
| is_system_generated | BOOLEAN | System vs user message |
| deleted_at | TIMESTAMP | Soft delete |

**inbox_participants Table:**

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Primary key |
| inbox_message_id | BIGINT | Message reference |
| user_id | BIGINT | Participant user |
| is_read | BOOLEAN | Read status |
| read_at | TIMESTAMP | When marked read |

### Relationships

```php
// InboxMessage Model
public function sender(): BelongsTo
{
    return $this->belongsTo(User::class, 'sender_id');
}

public function participants(): HasMany
{
    return $this->hasMany(InboxParticipant::class);
}

public function parentMessage(): BelongsTo
{
    return $this->belongsTo(InboxMessage::class, 'parent_message_id');
}

public function replies(): HasMany
{
    return $this->hasMany(InboxMessage::class, 'parent_message_id');
}

public function related(): MorphTo
{
    return $this->morphTo();
}
```

### Inbox Types

| Type | Description | Typical Participants |
|------|-------------|---------------------|
| parent | Parent-initiated messages | Parent, Admin |
| admin | Admin-initiated messages | Admin, Parent |
| provider | Medical provider messages | Provider, Admin, Parent |

---

## Security Implementation

### Security Audit Findings and Mitigations

**Critical Issues Addressed:**

| Issue | Severity | Mitigation |
|-------|----------|------------|
| Mass assignment vulnerability | Critical | Added $fillable whitelist, removed $guarded = [] |
| Missing policy authorization | Critical | Implemented InboxMessagePolicy with granular rules |
| Insufficient input validation | High | Added comprehensive FormRequest validation |
| PHI logging risk | High | Implemented audit logging for all PHI access |
| SQL injection risk | Medium | Used parameterized queries, Eloquent ORM |

### Policy-Based Authorization

**InboxMessagePolicy Rules:**

| Action | Authorization Logic |
|--------|---------------------|
| viewAny | Authenticated users can list their own messages |
| view | User is participant OR admin OR owns related entity |
| create | Authenticated user with valid inbox_type |
| update | Sender only (within 15 minutes of creation) |
| delete | Sender OR admin |

**Ownership Validation:**

```php
private function isParticipant(User $user, InboxMessage $message): bool
{
    return $message->participants()
        ->where('user_id', $user->id)
        ->exists();
}

private function ownsRelatedEntity(User $user, InboxMessage $message): bool
{
    if (!$message->related) return false;

    // For Camper: check ownership
    if ($message->related instanceof Camper) {
        return $message->related->user_id === $user->id;
    }

    // For Application: check via camper
    if ($message->related instanceof Application) {
        return $message->related->camper->user_id === $user->id;
    }

    return false;
}
```

### Input Validation

**StoreInboxMessageRequest:**

```php
public function rules(): array
{
    return [
        'subject' => 'required|string|max:255',
        'body' => 'required|string|max:10000',
        'inbox_type' => ['required', Rule::in(['parent', 'admin', 'provider'])],
        'related_type' => 'nullable|string',
        'related_id' => 'nullable|integer|exists_with_type',
        'participant_ids' => 'nullable|array',
        'participant_ids.*' => 'integer|exists:users,id',
        'parent_message_id' => 'nullable|integer|exists:inbox_messages,id',
    ];
}
```

### Audit Logging

All INBOX operations logged via AuditPhiAccess middleware:

| Action | Logged Fields |
|--------|---------------|
| View message | user_id, inbox_message_id, ip_address, timestamp |
| Create message | user_id, inbox_message_id, participants |
| Mark read | user_id, inbox_message_id, timestamp |
| Delete message | user_id, inbox_message_id, deleted_at |

---

## Policy Registration System

### Policy Registration Audit Findings

**Issues Identified:**

| Issue | Impact | Resolution |
|-------|--------|------------|
| Duplicate policy registrations | Performance degradation | Removed duplicates, single registration per model |
| Missing InboxMessagePolicy registration | Authorization failures | Added to AuthServiceProvider |
| Inconsistent policy naming | Confusion, errors | Standardized Policy namespace |
| No policy test coverage | Unverified authorization | Created comprehensive policy tests |

### Corrected Policy Registration

**AuthServiceProvider::policies() Array:**

```php
protected $policies = [
    Application::class => ApplicationPolicy::class,
    Camper::class => CamperPolicy::class,
    CampSession::class => CampSessionPolicy::class,
    Document::class => DocumentPolicy::class,
    EmergencyContact::class => EmergencyContactPolicy::class,
    InboxMessage::class => InboxMessagePolicy::class,  // Added
    MedicalProviderLink::class => MedicalProviderLinkPolicy::class,
    MedicalRecord::class => MedicalRecordPolicy::class,
    Notification::class => NotificationPolicy::class,
    User::class => UserPolicy::class,
];
```

**Verification Command:**

```php
php artisan tinker
>>> Gate::getPolicyFor(InboxMessage::class);  // Returns InboxMessagePolicy instance
```

---

## Message Lifecycle

### Message Creation Flow

```
User Creates Message → Validate Input (422 if fails)
    ↓
Authorize via Policy (403 if unauthorized)
    ↓
Create InboxMessage Record
    ↓
Create InboxParticipant Records (sender + recipients)
    ↓
If Related Entity: Link via polymorphic relationship
    ↓
If Reply: Set parent_message_id
    ↓
Log to Audit Trail
    ↓
Queue Notification to Participants
    ↓
Return 201 with Message
```

### Message Reading Flow

```
User Requests Message List → GET /api/inbox
    ↓
Authorize viewAny (Policy filters to user's messages)
    ↓
Return Messages with:
  - Unread count
  - Participant list
  - Related entity details
    ↓
User Views Message → GET /api/inbox/{id}
    ↓
Authorize view (403 if not participant/admin/owner)
    ↓
Mark as Read (update InboxParticipant)
    ↓
Log PHI Access
    ↓
Return Message with Replies
```

### Message Deletion Flow

```
User Deletes Message → DELETE /api/inbox/{id}
    ↓
Authorize delete (sender OR admin)
    ↓
Soft Delete (set deleted_at timestamp)
    ↓
Keep InboxParticipant records (audit trail)
    ↓
Log Deletion
    ↓
Return 204 No Content
```

---

## Implementation Details

### Key Endpoints

| Endpoint | Method | Purpose | Authorization |
|----------|--------|---------|---------------|
| /api/inbox | GET | List user's messages | Authenticated |
| /api/inbox | POST | Create new message | Authenticated, valid inbox_type |
| /api/inbox/{id} | GET | View message details | Participant/Admin/Owner |
| /api/inbox/{id} | PATCH | Mark as read | Participant |
| /api/inbox/{id} | DELETE | Soft delete message | Sender/Admin |
| /api/inbox/{id}/replies | GET | Get message thread | Participant/Admin/Owner |

### Controller Implementation

**InboxMessageController Key Methods:**

```php
public function index(Request $request)
{
    $messages = InboxMessage::whereHas('participants', function ($query) use ($request) {
        $query->where('user_id', $request->user()->id);
    })
    ->with(['sender', 'participants.user', 'related'])
    ->orderBy('created_at', 'desc')
    ->paginate(15);

    return response()->json($messages);
}

public function store(StoreInboxMessageRequest $request)
{
    $this->authorize('create', InboxMessage::class);

    $message = InboxMessage::create([
        'subject' => $request->subject,
        'body' => $request->body,
        'sender_id' => $request->user()->id,
        'inbox_type' => $request->inbox_type,
        'related_type' => $request->related_type,
        'related_id' => $request->related_id,
        'parent_message_id' => $request->parent_message_id,
    ]);

    // Add participants
    $participantIds = $request->participant_ids ?? [];
    if (!in_array($request->user()->id, $participantIds)) {
        $participantIds[] = $request->user()->id;
    }

    foreach ($participantIds as $userId) {
        InboxParticipant::create([
            'inbox_message_id' => $message->id,
            'user_id' => $userId,
            'is_read' => $userId === $request->user()->id,
        ]);
    }

    return response()->json($message, 201);
}
```

### Notification Integration

**Message Notification Job:**

```php
dispatch(new SendInboxMessageNotification($message, $participants))
    ->onQueue('notifications');
```

**Notification Content:**
- Email notification to unread participants
- In-app notification badge update
- Subject line and preview text
- Link to message in application

---

## Refactoring and Optimization

### Refactoring Summary

**Changes Implemented:**

| Category | Changes |
|----------|---------|
| Code Quality | Removed code duplication, extracted helper methods |
| Performance | Added eager loading, database indexes |
| Security | Implemented policies, input validation, audit logging |
| Maintainability | Improved naming, added documentation |
| Testing | Comprehensive test coverage |

### Performance Optimizations

**Database Indexes Added:**

```sql
CREATE INDEX idx_inbox_messages_sender ON inbox_messages(sender_id);
CREATE INDEX idx_inbox_messages_type ON inbox_messages(inbox_type);
CREATE INDEX idx_inbox_messages_related ON inbox_messages(related_type, related_id);
CREATE INDEX idx_inbox_participants_user ON inbox_participants(user_id);
CREATE INDEX idx_inbox_participants_message ON inbox_participants(inbox_message_id);
CREATE INDEX idx_inbox_participants_unread ON inbox_participants(user_id, is_read);
```

**Eager Loading:**

```php
// Before (N+1 queries)
$messages = InboxMessage::all();
foreach ($messages as $message) {
    echo $message->sender->name;  // Separate query
    echo $message->participants->count();  // Separate query
}

// After (Optimized)
$messages = InboxMessage::with(['sender', 'participants.user', 'related'])->get();
```

### Code Quality Improvements

**Before:**
```php
// Duplicated authorization logic in multiple methods
if ($request->user()->id !== $message->sender_id && !$request->user()->isAdmin()) {
    abort(403);
}
```

**After:**
```php
// Centralized in Policy
$this->authorize('delete', $message);
```

---

## Testing and Validation

### Test Coverage

| Test Category | Coverage | Test Count |
|--------------|----------|------------|
| Unit Tests | Policy authorization | 12 tests |
| Feature Tests | Endpoint functionality | 18 tests |
| Integration Tests | End-to-end workflows | 8 tests |
| Security Tests | Authorization, validation | 15 tests |

### Key Test Scenarios

**Authorization Tests:**
- Parent can view own messages
- Parent cannot view others' messages
- Admin can view all messages
- Provider can view via secure link
- Unauthorized access returns 403

**Validation Tests:**
- Required fields enforced
- Max lengths respected
- Enum values validated
- Polymorphic relationships validated
- Duplicate prevention

**Functional Tests:**
- Message creation with participants
- Thread/reply functionality
- Mark as read/unread
- Soft delete preservation
- Notification dispatching

### Manual Testing Checklist

- [ ] Create parent-to-admin message
- [ ] Create admin-to-parent message
- [ ] Create provider message via secure link
- [ ] View message as participant
- [ ] Attempt view as non-participant (should fail)
- [ ] Mark message as read
- [ ] Reply to message (threading)
- [ ] Delete message (soft delete)
- [ ] Verify audit logs created
- [ ] Check notification emails sent

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — INBOX endpoints
- [Authentication](./AUTHENTICATION.md) — Policy details
- [Audit Logging](./AUDIT_LOGGING.md) — PHI access tracking
- [Data Model](./DATA_MODEL.md) — Database schema
- [Security](./SECURITY.md) — Security implementation
- [Testing](./TESTING.md) — Test coverage details

---

**Document Status:** Authoritative - Consolidated from 6 INBOX documents
**Last Updated:** February 2026
**Version:** 2.0.0 (Consolidated)
**Supersedes:** INBOX_SYSTEM_ARCHITECTURE.md, INBOX_SECURITY_AUDIT_REPORT.md, INBOX_POLICY_REGISTRATION_AUDIT_REPORT.md, INBOX_SYSTEM_SECTIONS_8_11.md, INBOX_REFACTOR_SUMMARY.md, INBOX_IMPLEMENTATION_SUMMARY.md
