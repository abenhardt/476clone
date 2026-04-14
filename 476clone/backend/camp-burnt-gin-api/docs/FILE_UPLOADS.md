# File Uploads

This document provides comprehensive documentation for the document management and file upload system in the Camp Burnt Gin API. It covers upload security, validation, storage, scanning, and download procedures for handling sensitive medical documents and supporting files.

---

## Table of Contents

1. [Overview](#overview)
2. [Document Model](#document-model)
3. [Supported File Types](#supported-file-types)
4. [Upload Process](#upload-process)
5. [Security Validation](#security-validation)
6. [File Storage](#file-storage)
7. [Security Scanning](#security-scanning)
8. [Document Download](#document-download)
9. [Document Deletion](#document-deletion)
10. [Polymorphic Associations](#polymorphic-associations)
11. [Authorization and Access Control](#authorization-and-access-control)
12. [Error Handling](#error-handling)

---

## Overview

The document management system provides secure file upload, storage, and retrieval capabilities for sensitive medical documents and supporting files. The system implements multiple layers of security validation to protect against malicious file uploads while ensuring HIPAA-compliant handling of Protected Health Information (PHI).

### Key Features

- MIME type validation against allowed types
- File size limits (10 MB maximum)
- Extension validation
- Security scanning for malicious content
- Polymorphic associations (attach to campers, medical records, applications)
- Access control via policies
- Audit logging for PHI document access
- Quarantine-based approval workflow for manual review

### Security Principles

| Principle | Implementation |
|-----------|----------------|
| Defense in Depth | Multiple validation layers (MIME, size, extension, content) |
| Least Privilege | Access restricted via policy authorization |
| Fail Secure | Unscanned or suspicious files blocked by default |
| Audit Trail | All document access logged to audit_logs table |
| Data Protection | Files stored outside web root with random filenames |

---

## Document Model

### Database Schema

```sql
CREATE TABLE documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    documentable_type VARCHAR(255) NULL,
    documentable_id BIGINT UNSIGNED NULL,
    uploaded_by BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(100) NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NOT NULL,
    disk VARCHAR(50) NOT NULL DEFAULT 'local',
    path VARCHAR(500) NOT NULL,
    is_scanned BOOLEAN NOT NULL DEFAULT FALSE,
    scan_passed BOOLEAN NULL,
    scanned_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    INDEX idx_documentable (documentable_type, documentable_id),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_scan_status (is_scanned, scan_passed),

    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);
```

### Model Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| id | Integer | Primary key |
| documentable_type | String | Polymorphic parent model class |
| documentable_id | Integer | Polymorphic parent model ID |
| uploaded_by | Integer | User ID who uploaded the file |
| document_type | String | Category (medical, legal, identification, etc.) |
| original_filename | String | Original filename from upload |
| stored_filename | String | UUID-based stored filename |
| mime_type | String | Detected MIME type |
| file_size | Integer | File size in bytes |
| disk | String | Storage disk (local, s3, etc.) |
| path | String | Full storage path |
| is_scanned | Boolean | Whether security scan completed |
| scan_passed | Boolean | Scan result (null = pending) |
| scanned_at | Timestamp | When scan completed |

### Model Relationships

**Uploader:**
```php
public function uploader(): BelongsTo
{
    return $this->belongsTo(User::class, 'uploaded_by');
}
```

**Polymorphic Parent:**
```php
public function documentable(): MorphTo
{
    return $this->morphTo();
}
```

---

## Supported File Types

### Allowed MIME Types

| Category | MIME Type | Extension(s) |
|----------|-----------|--------------|
| PDF | `application/pdf` | .pdf |
| JPEG Image | `image/jpeg` | .jpg, .jpeg |
| PNG Image | `image/png` | .png |
| GIF Image | `image/gif` | .gif |
| Word Document | `application/msword` | .doc |
| Word Document (Modern) | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | .docx |

**Constant Definition:**
```php
// In Document model
public const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
```

### File Size Limit

**Maximum File Size:** 10 MB (10,485,760 bytes)

**Constant Definition:**
```php
public const MAX_FILE_SIZE = 10485760; // 10 MB in bytes
```

**Rationale:**
- Medical documents are typically under 10 MB
- Prevents resource exhaustion attacks
- Balances usability with security
- Server upload limits must be configured accordingly

---

## Upload Process

### Upload Endpoint

```
POST /api/documents
```

**Content-Type:** `multipart/form-data`

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | File | Yes | File upload (max 10 MB) |
| documentable_type | String | Yes | Parent model class (Camper, MedicalRecord, Application) |
| documentable_id | Integer | Yes | Parent model ID |
| document_type | String | No | Category (medical, legal, identification) |

**Example Request:**
```http
POST /api/documents HTTP/1.1
Authorization: Bearer {token}
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="medical_form.pdf"
Content-Type: application/pdf

[Binary file content]
------WebKitFormBoundary
Content-Disposition: form-data; name="documentable_type"

App\Models\MedicalRecord
------WebKitFormBoundary
Content-Disposition: form-data; name="documentable_id"

10
------WebKitFormBoundary
Content-Disposition: form-data; name="document_type"

medical
------WebKitFormBoundary--
```

### Upload Flow

```
1. Client uploads file via multipart/form-data
      │
      ▼
2. Controller receives request
      │
      ▼
3. Form Request validates file and parameters
      │
      ├─► Validation fails: HTTP 422
      │
      └─► Validation passes
            │
            ▼
4. Policy checks authorization
      │
      ├─► Unauthorized: HTTP 403
      │
      └─► Authorized
            │
            ▼
5. DocumentService validates MIME type
      │
      ├─► Invalid type: HTTP 422
      │
      └─► Valid type
            │
            ▼
6. DocumentService validates file size
      │
      ├─► Too large: HTTP 422
      │
      └─► Valid size
            │
            ▼
7. System generates UUID filename
      │
      ▼
8. System stores file to disk
      │
      ▼
9. System creates Document record
      │
      ▼
10. System queues security scan (async)
      │
      ▼
11. Controller returns HTTP 201 with document metadata
```

### Upload Response

**Success (HTTP 201):**
```json
{
  "success": true,
  "document": {
    "id": 42,
    "documentable_type": "App\\Models\\MedicalRecord",
    "documentable_id": 10,
    "uploaded_by": 5,
    "document_type": "medical",
    "original_filename": "medical_form.pdf",
    "stored_filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf",
    "mime_type": "application/pdf",
    "file_size": 245789,
    "is_scanned": false,
    "scan_passed": null,
    "created_at": "2026-02-11T14:30:00.000000Z",
    "updated_at": "2026-02-11T14:30:00.000000Z"
  }
}
```

**Validation Error (HTTP 422):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "file": ["The file field is required."]
  }
}
```

---

## Security Validation

### Validation Layers

The system implements multiple validation layers to prevent malicious file uploads:

#### Layer 1: Request Validation

**Form Request Class:** `StoreDocumentRequest`

```php
public function rules(): array
{
    return [
        'file' => [
            'required',
            'file',
            'max:10240', // 10 MB in kilobytes
            'mimes:pdf,jpg,jpeg,png,gif,doc,docx',
        ],
        'documentable_type' => 'required|string',
        'documentable_id' => 'required|integer',
        'document_type' => 'nullable|string|max:100',
    ];
}
```

#### Layer 2: MIME Type Validation

**Service Method:** `DocumentService::validateMimeType()`

```php
protected function validateMimeType(UploadedFile $file): bool
{
    return in_array($file->getMimeType(), Document::ALLOWED_MIME_TYPES);
}
```

**Purpose:** Verify the actual file content type matches allowed types, preventing MIME type spoofing.

#### Layer 3: File Size Validation

**Service Method:** `DocumentService::validateFileSize()`

```php
protected function validateFileSize(UploadedFile $file): bool
{
    return $file->getSize() <= Document::MAX_FILE_SIZE;
}
```

**Purpose:** Enforce file size limit to prevent resource exhaustion.

#### Layer 4: Extension Validation

**Performed during:** Security scan

```php
$dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'com', 'pif', 'scr'];
$extension = pathinfo($document->stored_filename, PATHINFO_EXTENSION);

if (in_array(strtolower($extension), $dangerousExtensions)) {
    return false; // Scan fails
}
```

**Purpose:** Block known dangerous file extensions that could be executed on server.

#### Layer 5: Content Validation

**Performed during:** Security scan

```php
$dangerousMimeTypes = [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-httpd-php',
    'application/x-sh',
    'text/x-php',
    'text/x-shellscript',
];

if (in_array($document->mime_type, $dangerousMimeTypes)) {
    return false; // Scan fails
}
```

**Purpose:** Block executable and script files that could compromise the server.

---

## File Storage

### Storage Configuration

**Default Storage:** Local disk

**Storage Location:** `storage/app/documents/`

**Configuration:** `config/filesystems.php`

```php
'disks' => [
    'local' => [
        'driver' => 'local',
        'root' => storage_path('app'),
        'throw' => false,
    ],
],
```

### Filename Generation

Files are stored with UUID-based filenames to prevent:
- Filename enumeration attacks
- Path traversal attacks
- Original filename conflicts

**Generation Method:**
```php
protected function generateFilename(UploadedFile $file): string
{
    $extension = $file->getClientOriginalExtension();
    return Str::uuid().'.'.$extension;
}

// Example output: a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
```

### Storage Path Structure

Files are organized by entity type and date:

```
storage/app/documents/
├── medical_record/
│   ├── 2026/
│   │   ├── 01/
│   │   │   ├── a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf
│   │   │   └── b2c3d4e5-f6a7-8901-bcde-f12345678901.pdf
│   │   └── 02/
│   │       └── c3d4e5f6-a7b8-9012-cdef-123456789012.pdf
├── camper/
│   └── 2026/
│       └── 02/
│           └── d4e5f6a7-b8c9-0123-def0-234567890123.jpg
└── application/
    └── 2026/
        └── 02/
            └── e5f6a7b8-c9d0-1234-ef01-345678901234.docx
```

**Path Format:** `documents/{entity_type}/{year}/{month}/{uuid}.{ext}`

### Storage Security

| Security Measure | Implementation |
|-----------------|----------------|
| Outside web root | Files stored in `storage/app/`, not `public/` |
| Random filenames | UUID prevents enumeration |
| Access control | Download requires authorization check |
| No direct access | Files not accessible via direct URL |

---

## Security Scanning

### Scan Process

Security scanning is performed asynchronously after file upload to avoid blocking the upload response.

**Scan Dispatch:**
```php
protected function queueSecurityScan(Document $document): void
{
    dispatch(function () use ($document) {
        $scanPassed = $this->performSecurityScan($document);

        $document->update([
            'is_scanned' => true,
            'scan_passed' => $scanPassed,
            'scanned_at' => now(),
        ]);
    })->afterResponse();
}
```

### Scan Implementation

**Current Implementation:** Basic validation checks

```php
protected function performSecurityScan(Document $document): ?bool
{
    // Check for dangerous extensions
    $dangerousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'js', 'vbs', 'com', 'pif', 'scr'];
    $extension = pathinfo($document->stored_filename, PATHINFO_EXTENSION);

    if (in_array(strtolower($extension), $dangerousExtensions)) {
        return false;
    }

    // Check for dangerous MIME types
    $dangerousMimeTypes = [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-httpd-php',
        'application/x-sh',
        'text/x-php',
        'text/x-shellscript',
    ];

    if (in_array($document->mime_type, $dangerousMimeTypes)) {
        return false;
    }

    // Return null = requires manual review
    // This implements quarantine-based approval
    return null;
}
```

### Scan Results

| Result | scan_passed Value | Meaning | Download Access |
|--------|------------------|---------|-----------------|
| Pending | `null` | Scan not yet completed | Admin only |
| Passed | `true` | File approved for download | All authorized users |
| Failed | `false` | Dangerous file detected | No access (quarantined) |

### Manual Approval

Administrators can manually approve or reject documents after review:

**Approve Document:**
```php
public function approveDocument(Document $document): void
{
    $document->update([
        'is_scanned' => true,
        'scan_passed' => true,
        'scanned_at' => now(),
    ]);
}
```

**Reject Document:**
```php
public function rejectDocument(Document $document): void
{
    $document->update([
        'is_scanned' => true,
        'scan_passed' => false,
        'scanned_at' => now(),
    ]);
}
```

### Production Scanning Integration

**HIPAA Compliance Note:**

The current implementation uses a quarantine-based manual approval system. For production deployment with automated virus scanning, integrate one of the following solutions:

**Recommended Solutions:**

1. **ClamAV** (Open Source)
   - Install ClamAV daemon
   - Use `clamav/clamav` PHP package
   - Scan files during upload or in background job

2. **VirusTotal API** (Cloud-Based)
   - Upload file hash or full file to VirusTotal
   - Receive scan results from 70+ antivirus engines
   - Requires API key

3. **AWS GuardDuty Malware Protection**
   - Automatic S3 bucket scanning
   - Integration with AWS CloudWatch for alerts
   - Enterprise-grade threat detection

4. **Microsoft Defender for Cloud**
   - Azure-based file scanning
   - Real-time threat detection
   - Integration with Azure Storage

---

## Document Download

### Download Endpoint

```
GET /api/documents/{id}/download
```

**Authorization:** User must be authorized to view the parent entity (documentable).

### Download Flow

```
1. Client requests document download
      │
      ▼
2. Controller receives request
      │
      ▼
3. Policy checks authorization
      │
      ├─► Unauthorized: HTTP 403
      │
      └─► Authorized
            │
            ▼
4. System checks scan status
      │
      ├─► Not scanned and user not admin: HTTP 403
      ├─► Scan failed: HTTP 403
      │
      └─► Scan passed or user is admin
            │
            ▼
5. System logs document access to audit_logs
      │
      ▼
6. System streams file to client
      │
      ▼
7. Client receives file with original filename
```

### Download Response

**Success:**
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="medical_form.pdf"
Content-Length: 245789

[Binary file content]
```

**Not Scanned (HTTP 403):**
```json
{
  "message": "This document has not been scanned for security threats and cannot be downloaded."
}
```

**Scan Failed (HTTP 403):**
```json
{
  "message": "This document failed security screening and has been quarantined."
}
```

---

## Document Deletion

### Delete Endpoint

```
DELETE /api/documents/{id}
```

**Authorization:** User must be the uploader or an administrator.

### Delete Flow

```
1. Client requests document deletion
      │
      ▼
2. Controller receives request
      │
      ▼
3. Policy checks authorization
      │
      ├─► Unauthorized: HTTP 403
      │
      └─► Authorized
            │
            ▼
4. System deletes file from disk
      │
      ▼
5. System deletes Document record from database
      │
      ▼
6. System logs deletion to audit_logs
      │
      ▼
7. Controller returns HTTP 204 No Content
```

### Delete Response

**Success:**
```http
HTTP/1.1 204 No Content
```

**Not Found (HTTP 404):**
```json
{
  "message": "Document not found."
}
```

---

## Polymorphic Associations

Documents can be attached to multiple entity types using polymorphic relationships.

### Supported Entities

| Entity | Model Class | Use Case |
|--------|-------------|----------|
| Camper | `App\Models\Camper` | Identification documents, photos |
| Medical Record | `App\Models\MedicalRecord` | Medical forms, insurance cards |
| Application | `App\Models\Application` | Supporting documentation |

### Association Examples

**Attach to Medical Record:**
```http
POST /api/documents
{
  "file": [binary],
  "documentable_type": "App\\Models\\MedicalRecord",
  "documentable_id": 10,
  "document_type": "medical"
}
```

**Attach to Camper:**
```http
POST /api/documents
{
  "file": [binary],
  "documentable_type": "App\\Models\\Camper",
  "documentable_id": 5,
  "document_type": "identification"
}
```

### Retrieve Associated Documents

**Via Eloquent Relationship:**
```php
// In MedicalRecord model
public function documents(): MorphMany
{
    return $this->morphMany(Document::class, 'documentable');
}

// Usage
$medicalRecord = MedicalRecord::find(10);
$documents = $medicalRecord->documents;
```

**Via API:**
```
GET /api/medical-records/10
```

**Response includes documents:**
```json
{
  "id": 10,
  "camper_id": 5,
  "physician_name": "Dr. Smith",
  "documents": [
    {
      "id": 42,
      "original_filename": "medical_form.pdf",
      "file_size": 245789,
      "mime_type": "application/pdf",
      "created_at": "2026-02-11T14:30:00.000000Z"
    }
  ]
}
```

---

## Authorization and Access Control

### Document Policy

**Policy Class:** `DocumentPolicy`

**Authorization Rules:**

| Action | Rule |
|--------|------|
| View | User owns parent entity OR user is admin OR user is medical provider (via link) |
| Upload | User owns parent entity OR user is admin |
| Download | User can view document AND scan passed (or user is admin) |
| Delete | User uploaded document OR user is admin |

**Policy Methods:**

```php
// View document metadata
public function view(User $user, Document $document): bool
{
    return $user->isAdmin() || $this->ownsDocumentable($user, $document);
}

// Download document file
public function download(User $user, Document $document): bool
{
    if (!$this->view($user, $document)) {
        return false;
    }

    // Admins can download unscanned files
    if ($user->isAdmin()) {
        return true;
    }

    // Non-admins require scan pass
    return $document->is_scanned && $document->scan_passed === true;
}

// Delete document
public function delete(User $user, Document $document): bool
{
    return $user->isAdmin() || $document->uploaded_by === $user->id;
}
```

### Access Logging

All document access is logged to the audit_logs table via the `AuditPhiAccess` middleware.

**Logged Events:**
- Document upload (create)
- Document view (view)
- Document download (view)
- Document deletion (delete)

---

## Error Handling

### Common Upload Errors

| Error | HTTP Status | Message | Resolution |
|-------|-------------|---------|------------|
| File too large | 422 | File size exceeds maximum allowed | Reduce file size or split into multiple files |
| Invalid file type | 422 | File type not allowed | Convert to PDF or supported image format |
| Missing file | 422 | The file field is required | Include file in multipart/form-data request |
| Invalid parent | 422 | The documentable_id is invalid | Ensure parent entity exists and user has access |
| Storage failure | 500 | Failed to store file | Check disk space and permissions |
| Database failure | 500 | Failed to create document record | Check database connection |

### Server Configuration

**PHP Configuration:**

Ensure `php.ini` allows file uploads and sufficient size limits:

```ini
file_uploads = On
upload_max_filesize = 12M
post_max_size = 12M
max_execution_time = 60
memory_limit = 256M
```

**Web Server Configuration:**

**Nginx:**
```nginx
client_max_body_size 12M;
```

**Apache:**
```apache
LimitRequestBody 12582912
```

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Document endpoints and authentication
- [Security](./SECURITY.md) — File upload security and validation
- [Audit Logging](./AUDIT_LOGGING.md) — Document access audit trail
- [Roles and Permissions](./ROLES_AND_PERMISSIONS.md) — Document authorization rules
- [Troubleshooting](./TROUBLESHOOTING.md) — Common upload issues

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
