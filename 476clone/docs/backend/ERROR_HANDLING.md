# Error Handling

This document provides comprehensive documentation of error handling patterns, HTTP status codes, error response formats, and troubleshooting guidance for the Camp Burnt Gin API.

---

## Table of Contents

1. [Error Handling Principles](#error-handling-principles)
2. [HTTP Status Codes](#http-status-codes)
3. [Error Response Format](#error-response-format)
4. [Validation Errors (422)](#validation-errors-422)
5. [Authentication Errors (401)](#authentication-errors-401)
6. [Authorization Errors (403)](#authorization-errors-403)
7. [Resource Not Found (404)](#resource-not-found-404)
8. [Server Errors (500)](#server-errors-500)
9. [Rate Limiting (429)](#rate-limiting-429)
10. [Business Logic Errors](#business-logic-errors)
11. [Error Logging](#error-logging)
12. [Client Handling Strategies](#client-handling-strategies)

---

## Error Handling Principles

| Principle | Implementation |
|-----------|----------------|
| Consistency | All errors use standardized JSON format |
| Clarity | Error messages are clear and actionable |
| Security | Sensitive information never exposed (production) |
| Debugging | Development mode provides stack traces |
| Logging | All errors logged for investigation |

### Error Categories

| Category | HTTP Range | Description |
|----------|------------|-------------|
| Client Errors | 400-499 | Request cannot be processed due to client issues |
| Server Errors | 500-599 | Request failed due to server issues |

---

## HTTP Status Codes

### Success Codes

| Code | Name | Usage | Example Endpoint |
|------|------|-------|------------------|
| 200 | OK | Successful GET, PUT, PATCH | GET /api/applications/{id} |
| 201 | Created | Successful POST | POST /api/applications |
| 204 | No Content | Successful DELETE | DELETE /api/documents/{id} |

### Client Error Codes

| Code | Name | Common Causes | When to Use |
|------|------|---------------|-------------|
| 400 | Bad Request | Invalid JSON, missing headers | Malformed request syntax |
| 401 | Unauthorized | Missing/expired token, invalid credentials | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions, parent accessing another's child | Authenticated but not authorized |
| 404 | Not Found | Invalid ID, deleted resource | Resource does not exist |
| 409 | Conflict | Duplicate application, race condition | Request conflicts with current state |
| 422 | Unprocessable Entity | Invalid email format, required field missing | Validation failed |
| 429 | Too Many Requests | Too many login attempts, API abuse | Rate limit exceeded |

### Server Error Codes

| Code | Name | Common Causes | Resolution |
|------|------|---------------|------------|
| 500 | Internal Server Error | Uncaught exception, database failure | Check logs, fix code |
| 502 | Bad Gateway | Database unreachable, external API failure | Check upstream services |
| 503 | Service Unavailable | Maintenance mode, overloaded | Wait and retry |
| 504 | Gateway Timeout | Long-running query, external API timeout | Optimize queries |

---

## Error Response Format

### Standard Structure

All error responses follow consistent JSON format:

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
| errors | Object | 422 only | Field-specific validation errors |

### Environment-Specific Responses

| Environment | Details Exposed | Example |
|-------------|-----------------|---------|
| Production (APP_DEBUG=false) | Generic message only | `{"message": "Server Error"}` |
| Development (APP_DEBUG=true) | Full stack trace | Includes exception, file, line, trace |

**Security:** Detailed error information only exposed when `APP_DEBUG=true`.

---

## Validation Errors (422)

**HTTP Status:** 422 Unprocessable Entity

Occurs when request data fails validation rules.

### Common Validation Patterns

| Error Type | Example Response |
|------------|------------------|
| Required field | `{"message": "The given data was invalid.", "errors": {"email": ["The email field is required."]}}` |
| Invalid format | `{"message": "The given data was invalid.", "errors": {"email": ["The email must be a valid email address."]}}` |
| Size constraint | `{"message": "The given data was invalid.", "errors": {"file": ["The file may not be greater than 10240 kilobytes."]}}` |
| Foreign key | `{"message": "The given data was invalid.", "errors": {"camp_session_id": ["The selected camp session id is invalid."]}}` |
| Uniqueness | `{"message": "The given data was invalid.", "errors": {"camper_id": ["This camper already has an application for this session."]}}` |

### Endpoint-Specific Examples

**POST /api/auth/register:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["The email has already been taken."],
    "password": ["The password confirmation does not match."]
  }
}
```

**POST /api/documents:**
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

## Authentication Errors (401)

**HTTP Status:** 401 Unauthorized

Authentication errors occur when credentials are invalid or tokens are missing/expired.

### Authentication Error Scenarios

| Scenario | Request | Response |
|----------|---------|----------|
| Missing token | `GET /api/applications` (no Authorization header) | `{"message": "Unauthenticated."}` |
| Invalid credentials | `POST /api/auth/login` with wrong password | `{"message": "Invalid credentials."}` |
| Expired token | Request with expired Bearer token | `{"message": "Token has expired."}` |
| Account locked | Login after failed attempts | `{"success": false, "message": "Account locked due to too many failed attempts. Try again in 14 minute(s).", "lockout": true, "retry_after": 840}` |

### MFA Flow

**MFA Required (200 OK, not an error):**
```json
{
  "mfa_required": true,
  "message": "Multi-factor authentication required."
}
```

Client should then POST to `/api/mfa/verify` with code.

---

## Authorization Errors (403)

**HTTP Status:** 403 Forbidden

Occurs when authenticated user lacks permission to perform action.

### Authorization Scenarios

| Scenario | Request | Response |
|----------|---------|----------|
| Insufficient permissions | Parent views another parent's camper: `GET /api/campers/999` | `{"message": "This action is unauthorized."}` |
| Role restriction | Parent attempts admin endpoint: `GET /api/reports/applications` | `{"message": "This action is unauthorized."}` |
| Resource ownership | Parent updates another's application: `PUT /api/applications/123` | `{"message": "This action is unauthorized."}` |
| Unscanned document | User downloads unscanned doc: `GET /api/documents/42/download` | `{"message": "This document has not been scanned for security threats and cannot be downloaded."}` |

---

## Resource Not Found (404)

**HTTP Status:** 404 Not Found

Resource does not exist or has been deleted.

### Not Found Scenarios

| Scenario | Example Request | Response |
|----------|-----------------|----------|
| Invalid ID | `GET /api/applications/99999` | `{"message": "Resource not found."}` |
| Deleted resource | `GET /api/campers/42` (deleted) | `{"message": "Resource not found."}` |
| Invalid route | `GET /api/invalid-endpoint` | `{"message": "Route not found."}` |
| Expired link | `GET /api/provider-access/expired_token` (410 Gone) | `{"message": "This link has expired or been revoked."}` |

---

## Server Errors (500)

**HTTP Status:** 500 Internal Server Error

Unexpected server-side issues.

### Production Response
```json
{
  "message": "Server Error"
}
```

### Development Response
```json
{
  "message": "SQLSTATE[HY000]: General error: 1364 Field 'required_field' doesn't have a default value",
  "exception": "Illuminate\\Database\\QueryException",
  "file": "/var/www/app/Models/Application.php",
  "line": 42,
  "trace": [...]
}
```

### Common Server Errors

| Error Type | Logged Message | Resolution |
|------------|----------------|------------|
| Database connection | `SQLSTATE[HY000] [2002] Connection refused` | Check database service, credentials |
| Service unavailable | `Service temporarily unavailable` | Check maintenance mode, system load |

---

## Rate Limiting (429)

**HTTP Status:** 429 Too Many Requests

Client exceeds request limits.

### Rate Limit Response
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42

{
  "message": "Too Many Attempts."
}
```

### Rate Limit Headers

All responses include:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707666240
Retry-After: 42
```

### Rate Limit Tiers

| Endpoint | Limit | Reset Period | Purpose |
|----------|-------|--------------|---------|
| /api/auth/login | 5 requests | 1 minute | Prevent brute force |
| /api/mfa/verify | 3 requests | 1 minute | Prevent MFA guessing |
| /api/provider-access/* | 2 requests | 1 minute | Limit unauthenticated access |
| /api/documents (upload) | 5 requests | 1 minute | Prevent abuse |
| All other endpoints | 60 requests | 1 minute | General protection |

---

## Business Logic Errors

Application-specific errors that violate business rules (typically 422).

### Common Business Rule Violations

| Rule | Response |
|------|----------|
| Duplicate application | `{"message": "The given data was invalid.", "errors": {"camper_id": ["This camper already has an application for this session."]}}` |
| Registration closed | `{"message": "Registration is not currently open for this session."}` |
| Age requirement | `{"message": "Camper does not meet age requirements for this session."}` |
| Application not editable | `{"message": "This application cannot be edited in its current state."}` |
| Missing signature | `{"message": "Application must be signed before submission."}` |

---

## Error Logging

All errors are logged to facilitate debugging and incident investigation.

### Log Channels

| Channel | Level | Usage | Location |
|---------|-------|-------|----------|
| stack | debug | All logs (development) | storage/logs/laravel.log |
| single | info | Single file (production) | storage/logs/laravel.log |
| daily | warning | Daily rotation (production) | storage/logs/laravel-YYYY-MM-DD.log |
| syslog | error | System log integration | /var/log/syslog |

### Log Monitoring Priorities

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

| Log Type | Retention Period | Storage Location |
|----------|------------------|------------------|
| Application logs | 90 days | storage/logs/ |
| Error logs | 1 year | storage/logs/ |
| Audit logs | 6 years | Database |
| Access logs | 30 days | Web server |

---

## Client Handling Strategies

### Recommended Patterns

**Retry Logic with Exponential Backoff:**
```javascript
async function apiRequest(url, options, retries = 3) {
  try {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      await sleep(retryAfter * 1000);
      return apiRequest(url, options, retries);
    }

    if (response.status === 500 && retries > 0) {
      await sleep(Math.pow(2, 4 - retries) * 1000);
      return apiRequest(url, options, retries - 1);
    }

    return response;
  } catch (error) {
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
  if (response.status === 422) {
    const data = await response.json();
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
    redirectToLogin();
  }

  return response;
}
```

---

## Cross-References

For related documentation, see:

- [API Reference](./API_REFERENCE.md) — Complete endpoint specifications
- [Authentication](./AUTHENTICATION.md) — Auth error details
- [Troubleshooting](./TROUBLESHOOTING.md) — Common issues and solutions
- [Testing](./TESTING.md) — Error testing strategies

---

**Document Status:** Authoritative
**Last Updated:** February 2026
**Version:** 1.0.0
