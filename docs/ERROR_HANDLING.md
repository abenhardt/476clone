# Error Handling

This document provides comprehensive documentation of error handling patterns, HTTP status codes, error response formats, and troubleshooting guidance for the Camp Burnt Gin API. It serves as a reference for developers integrating with the API and support personnel diagnosing issues.

---

## Table of Contents

1. [Overview](#overview)
2. [HTTP Status Codes](#http-status-codes)
3. [Error Response Format](#error-response-format)
4. [Validation Errors](#validation-errors)
5. [Authentication Errors](#authentication-errors)
6. [Authorization Errors](#authorization-errors)
7. [Resource Not Found Errors](#resource-not-found-errors)
8. [Server Errors](#server-errors)
9. [Rate Limiting Errors](#rate-limiting-errors)
10. [Business Logic Errors](#business-logic-errors)
11. [Error Logging](#error-logging)
12. [Client Error Handling Strategies](#client-error-handling-strategies)

---

## Overview

The Camp Burnt Gin API implements consistent, predictable error handling across all endpoints. All error responses follow a standardized JSON format that provides clear, actionable information to API consumers.

### Error Handling Principles

| Principle | Description |
|-----------|-------------|
| Consistency | All errors use standardized response format |
| Clarity | Error messages are clear and actionable |
| Security | Sensitive information is never exposed in errors |
| Debugging | Development mode provides additional detail |
| Logging | All errors are logged for investigation |

### Error Categories

| Category | HTTP Status Range | Description |
|----------|------------------|-------------|
| Client Errors | 400-499 | Request cannot be processed due to client issues |
| Server Errors | 500-599 | Request failed due to server issues |
| Success | 200-299 | Request processed successfully (not errors) |

---

## HTTP Status Codes

The API uses standard HTTP status codes to indicate the success or failure of requests.

### Success Codes

| Code | Name | Usage | Example |
|------|------|-------|---------|
| 200 | OK | Successful GET, PUT, PATCH request | Retrieve application |
| 201 | Created | Successful POST request | Create new application |
| 204 | No Content | Successful DELETE request | Delete document |

### Client Error Codes

| Code | Name | Usage | Common Causes |
|------|------|-------|---------------|
| 400 | Bad Request | Malformed request syntax | Invalid JSON, missing required headers |
| 401 | Unauthorized | Authentication required or failed | Missing token, expired token, invalid credentials |
| 403 | Forbidden | Authenticated but not authorized | Insufficient permissions, parent accessing another's child |
| 404 | Not Found | Resource does not exist | Invalid ID, deleted resource |
| 409 | Conflict | Request conflicts with current state | Duplicate application, race condition |
| 422 | Unprocessable Entity | Validation failed | Invalid email format, required field missing |
| 429 | Too Many Requests | Rate limit exceeded | Too many login attempts, API abuse |

### Server Error Codes

| Code | Name | Usage | Common Causes |
|------|------|-------|---------------|
| 500 | Internal Server Error | Unexpected server error | Uncaught exception, database failure |
| 502 | Bad Gateway | Upstream service failed | Database unreachable, external API failure |
| 503 | Service Unavailable | Service temporarily down | Maintenance mode, overloaded |
| 504 | Gateway Timeout | Request timeout | Long-running query, external API timeout |

---

## Error Response Format

All error responses follow a consistent JSON structure.

### Standard Error Response

```json
{
  "message": "Human-readable error description",
  "errors": {
    "field_name": ["Specific validation error"],
    "another_field": ["Another validation error"]
  }
}
```

### Response Fields

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| message | String | Yes | High-level error description |
| errors | Object | For 422 only | Field-specific validation errors |

### Environment-Specific Responses

**Production:**
```json
{
  "message": "Server Error"
}
```

**Development:**
```json
{
  "message": "Server Error",
  "exception": "Illuminate\\Database\\QueryException",
  "file": "/var/www/app/Models/Application.php",
  "line": 42,
  "trace": [...]
}
```

**Important:** Detailed error information is only exposed in development mode (APP_DEBUG=true).

---

## Validation Errors

HTTP Status: **422 Unprocessable Entity**

Validation errors occur when request data fails validation rules.

### Response Format

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": [
      "The email field is required."
    ],
    "password": [
      "The password must be at least 8 characters.",
      "The password must contain at least one uppercase letter."
    ],
    "camper_id": [
      "The camper id must be an integer.",
      "The selected camper id is invalid."
    ]
  }
}
```

### Common Validation Errors

**Required Field Missing:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "first_name": ["The first name field is required."]
  }
}
```

**Invalid Format:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email must be a valid email address."]
  }
}
```

**Value Out of Range:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "file": ["The file may not be greater than 10240 kilobytes."]
  }
}
```

**Foreign Key Constraint:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "camp_session_id": ["The selected camp session id is invalid."]
  }
}
```

**Uniqueness Violation:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "camper_id": ["This camper already has an application for this session."]
  }
}
```

### Validation Error Examples by Endpoint

**POST /api/auth/register**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."],
    "password": ["The password confirmation does not match."]
  }
}
```

**POST /api/applications**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "camper_id": ["The camper id field is required."],
    "camp_session_id": ["The camp session id field is required."]
  }
}
```

**POST /api/documents**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "file": [
      "The file field is required.",
      "The file must be a file of type: pdf, jpg, jpeg, png, gif, doc, docx."
    ]
  }
}
```

---

## Authentication Errors

HTTP Status: **401 Unauthorized**

Authentication errors occur when credentials are invalid or tokens are missing/expired.

### Missing Authentication Token

**Request:**
```http
GET /api/applications HTTP/1.1
Host: api.campburntgin.org
```

**Response:**
```http
HTTP/1.1 401 Unauthorized

{
  "message": "Unauthenticated."
}
```

### Invalid Credentials

**Request:**
```http
POST /api/auth/login HTTP/1.1

{
  "email": "user@example.com",
  "password": "wrongpassword"
}
```

**Response:**
```http
HTTP/1.1 401 Unauthorized

{
  "message": "Invalid credentials."
}
```

### Expired Token

**Request:**
```http
GET /api/applications HTTP/1.1
Authorization: Bearer expired_token_here
```

**Response:**
```http
HTTP/1.1 401 Unauthorized

{
  "message": "Token has expired."
}
```

### MFA Required

**Request:**
```http
POST /api/auth/login HTTP/1.1

{
  "email": "user@example.com",
  "password": "correctpassword"
}
```

**Response:**
```http
HTTP/1.1 200 OK

{
  "mfa_required": true,
  "message": "Multi-factor authentication required."
}
```

**Note:** This is not an error, but requires additional MFA code submission.

### Account Locked

**Request:**
```http
POST /api/auth/login HTTP/1.1

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```http
HTTP/1.1 403 Forbidden

{
  "success": false,
  "message": "Account locked due to too many failed attempts. Try again in 14 minute(s).",
  "lockout": true,
  "retry_after": 840
}
```

---

## Authorization Errors

HTTP Status: **403 Forbidden**

Authorization errors occur when an authenticated user lacks permission to perform an action.

### Insufficient Permissions

**Request (Parent attempting to view another parent's camper):**
```http
GET /api/campers/999 HTTP/1.1
Authorization: Bearer valid_parent_token
```

**Response:**
```http
HTTP/1.1 403 Forbidden

{
  "message": "This action is unauthorized."
}
```

### Role Restriction

**Request (Parent attempting admin-only endpoint):**
```http
GET /api/reports/applications HTTP/1.1
Authorization: Bearer valid_parent_token
```

**Response:**
```http
HTTP/1.1 403 Forbidden

{
  "message": "This action is unauthorized."
}
```

### Resource Ownership Violation

**Request (Parent attempting to update another parent's application):**
```http
PUT /api/applications/123 HTTP/1.1
Authorization: Bearer valid_parent_token

{
  "notes": "Updated notes"
}
```

**Response:**
```http
HTTP/1.1 403 Forbidden

{
  "message": "This action is unauthorized."
}
```

### Document Access Denied

**Request (User attempting to download unscanned document):**
```http
GET /api/documents/42/download HTTP/1.1
Authorization: Bearer valid_token
```

**Response:**
```http
HTTP/1.1 403 Forbidden

{
  "message": "This document has not been scanned for security threats and cannot be downloaded."
}
```

---

## Resource Not Found Errors

HTTP Status: **404 Not Found**

Resource not found errors occur when the requested resource does not exist.

### Invalid Resource ID

**Request:**
```http
GET /api/applications/99999 HTTP/1.1
Authorization: Bearer valid_token
```

**Response:**
```http
HTTP/1.1 404 Not Found

{
  "message": "Resource not found."
}
```

### Deleted Resource

**Request (Attempting to access deleted camper):**
```http
GET /api/campers/42 HTTP/1.1
Authorization: Bearer valid_token
```

**Response:**
```http
HTTP/1.1 404 Not Found

{
  "message": "Resource not found."
}
```

### Invalid Route

**Request:**
```http
GET /api/invalid-endpoint HTTP/1.1
Authorization: Bearer valid_token
```

**Response:**
```http
HTTP/1.1 404 Not Found

{
  "message": "Route not found."
}
```

### Expired Provider Link

**Request:**
```http
GET /api/provider-access/expired_token HTTP/1.1
```

**Response:**
```http
HTTP/1.1 410 Gone

{
  "message": "This link has expired or been revoked."
}
```

---

## Server Errors

HTTP Status: **500 Internal Server Error**

Server errors indicate unexpected issues on the server side.

### Generic Server Error (Production)

**Response:**
```http
HTTP/1.1 500 Internal Server Error

{
  "message": "Server Error"
}
```

### Server Error (Development)

**Response:**
```http
HTTP/1.1 500 Internal Server Error

{
  "message": "SQLSTATE[HY000]: General error: 1364 Field 'required_field' doesn't have a default value",
  "exception": "Illuminate\\Database\\QueryException",
  "file": "/var/www/app/Models/Application.php",
  "line": 42,
  "trace": [
    {
      "file": "/var/www/vendor/laravel/framework/src/Illuminate/Database/Connection.php",
      "line": 712,
      "function": "runQueryCallback"
    }
  ]
}
```

### Database Connection Error

**Response:**
```http
HTTP/1.1 500 Internal Server Error

{
  "message": "Server Error"
}
```

**Logged Error:**
```
[2026-02-11 14:30:00] production.ERROR: SQLSTATE[HY000] [2002] Connection refused
```

### Service Unavailable

**Response:**
```http
HTTP/1.1 503 Service Unavailable

{
  "message": "Service temporarily unavailable. Please try again later."
}
```

---

## Rate Limiting Errors

HTTP Status: **429 Too Many Requests**

Rate limiting errors occur when a client exceeds request limits.

### Rate Limit Exceeded

**Request (6th login attempt within 1 minute):**
```http
POST /api/auth/login HTTP/1.1

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "message": "Too Many Attempts."
}
```

### Rate Limit Headers

All responses include rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707666240
Retry-After: 42
```

### Rate Limit Tiers

| Endpoint | Limit | Reset Period |
|----------|-------|--------------|
| /api/auth/login | 5 requests | 1 minute |
| /api/mfa/verify | 3 requests | 1 minute |
| /api/provider-access/* | 2 requests | 1 minute |
| /api/documents (upload) | 5 requests | 1 minute |
| All other endpoints | 60 requests | 1 minute |

---

## Business Logic Errors

Business logic errors occur when a request violates application-specific rules.

### Application Already Exists

**Request:**
```http
POST /api/applications HTTP/1.1

{
  "camper_id": 5,
  "camp_session_id": 2
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity

{
  "message": "The given data was invalid.",
  "errors": {
    "camper_id": ["This camper already has an application for this session."]
  }
}
```

### Session Registration Closed

**Request:**
```http
POST /api/applications HTTP/1.1

{
  "camper_id": 5,
  "camp_session_id": 10
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity

{
  "message": "Registration is not currently open for this session."
}
```

### Camper Age Requirement Not Met

**Request:**
```http
POST /api/applications HTTP/1.1

{
  "camper_id": 5,
  "camp_session_id": 3
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity

{
  "message": "Camper does not meet age requirements for this session."
}
```

### Application Not Editable

**Request (Attempting to edit approved application):**
```http
PUT /api/applications/42 HTTP/1.1

{
  "notes": "Updated notes"
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity

{
  "message": "This application cannot be edited in its current state."
}
```

### Missing Signature

**Request (Attempting to submit unsigned application):**
```http
PUT /api/applications/42 HTTP/1.1

{
  "is_draft": false
}
```

**Response:**
```http
HTTP/1.1 422 Unprocessable Entity

{
  "message": "Application must be signed before submission."
}
```

---

## Error Logging

All errors are logged to facilitate debugging and incident investigation.

### Log Channels

**Configuration:** `config/logging.php`

| Channel | Level | Usage |
|---------|-------|-------|
| stack | debug | All logs (development) |
| single | info | Single file (production) |
| daily | warning | Daily rotation (production) |
| syslog | error | System log integration |

### Log Format

**Single Line:**
```
[2026-02-11 14:30:45] production.ERROR: SQLSTATE[HY000]: General error {"user_id":5,"exception":"..."}
```

**Structured:**
```
[2026-02-11 14:30:45] production.ERROR: User authentication failed
{
  "email": "user@example.com",
  "ip": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "exception": "Illuminate\\Auth\\AuthenticationException"
}
```

### Error Log Monitoring

**Critical Errors (Immediate Alert):**
- Database connection failures
- Audit log write failures
- File storage failures
- External service unavailable

**Warning Errors (Daily Review):**
- Failed authentication attempts
- Authorization denials
- Validation failures
- Rate limit violations

### Log Retention

| Log Type | Retention Period | Storage |
|----------|------------------|---------|
| Application logs | 90 days | storage/logs/ |
| Error logs | 1 year | storage/logs/ |
| Audit logs | 6 years | Database |
| Access logs | 30 days | Web server |

---

## Client Error Handling Strategies

### Recommended Client Patterns

**Retry Logic:**
```javascript
async function apiRequest(url, options, retries = 3) {
  try {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limit - use Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      await sleep(retryAfter * 1000);
      return apiRequest(url, options, retries);
    }

    if (response.status === 500 && retries > 0) {
      // Server error - exponential backoff
      await sleep(Math.pow(2, 4 - retries) * 1000);
      return apiRequest(url, options, retries - 1);
    }

    return response;
  } catch (error) {
    // Network error - retry with backoff
    if (retries > 0) {
      await sleep(Math.pow(2, 4 - retries) * 1000);
      return apiRequest(url, options, retries - 1);
    }
    throw error;
  }
}
```

**Validation Error Display:**
```javascript
async function handleValidationErrors(response) {
  const data = await response.json();

  if (response.status === 422) {
    // Display field-specific errors
    Object.keys(data.errors).forEach(field => {
      const errors = data.errors[field];
      displayFieldError(field, errors.join(' '));
    });
  }
}
```

**Token Refresh:**
```javascript
async function apiRequestWithAuth(url, options) {
  const token = getAuthToken();

  if (isTokenExpired(token)) {
    // Token expired - redirect to login
    redirectToLogin();
    return;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Token invalid - redirect to login
    redirectToLogin();
  }

  return response;
}
```

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Complete endpoint specifications
- [Authentication and Authorization](./AUTHENTICATION_AND_AUTHORIZATION.md) — Auth error details
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and solutions
- [Testing](./TESTING.md) — Error testing strategies

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
