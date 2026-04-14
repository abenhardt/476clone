# Camp Burnt Gin API Reference

**Version:** 1.0
**Base URL:** `/api`
**Authentication:** Bearer Token (Laravel Sanctum)
**Content Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Error Responses](#error-responses)
4. [Authentication Endpoints](#authentication-endpoints)
5. [User Profile Endpoints](#user-profile-endpoints)
6. [MFA Endpoints](#mfa-endpoints)
7. [Camp Endpoints](#camp-endpoints)
8. [Camp Session Endpoints](#camp-session-endpoints)
9. [Camper Endpoints](#camper-endpoints)
10. [Application Endpoints](#application-endpoints)
11. [Medical Record Endpoints](#medical-record-endpoints)
12. [Allergy Endpoints](#allergy-endpoints)
13. [Medication Endpoints](#medication-endpoints)
14. [Emergency Contact Endpoints](#emergency-contact-endpoints)
15. [Document Endpoints](#document-endpoints)
16. [Medical Provider Link Endpoints](#medical-provider-link-endpoints)
17. [Notification Endpoints](#notification-endpoints)
18. [Inbox Endpoints](#inbox-endpoints)
19. [Report Endpoints](#report-endpoints)

---

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {your-api-token}
```

Tokens are issued upon successful login or registration and should be stored securely by the client.

---

## Rate Limiting

The API implements tiered rate limiting to prevent abuse:

| Rate Limiter | Per Minute | Per Hour | Applies To |
|--------------|------------|----------|------------|
| `api` | 60 requests | - | General authenticated endpoints |
| `auth` | 5 requests | 20 requests | Login, registration, password reset |
| `mfa` | 3 requests | 10 requests | MFA setup, verify, disable |
| `provider-link` | 2 requests | 10 requests | Medical provider link access |
| `uploads` | 5 requests | 50 requests | Document uploads |
| `sensitive` | 10 requests | 100 requests | Document downloads, provider links |

Rate limits are tracked by:
- User ID (for authenticated requests)
- IP address (for unauthenticated requests)

When rate limited, the API returns a `429 Too Many Requests` response with a `Retry-After` header.

---

## Error Responses

All error responses follow a consistent JSON structure:

### Standard Error Response

```json
{
  "message": "Human-readable error message"
}
```

### Validation Error Response

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "field_name": [
      "Validation error message"
    ]
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request or business logic error |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource or endpoint not found |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Authentication Endpoints

### POST /auth/register

Register a new user account. Creates a parent account by default.

**Authentication Required:** No
**Rate Limiting:** `throttle:auth` (5/min, 20/hour)

#### Request Body

```json
{
  "name": "John Smith",
  "email": "john.smith@example.com",
  "password": "SecureP@ssw0rd123!",
  "password_confirmation": "SecureP@ssw0rd123!"
}
```

#### Validation Rules

- `name`: Required, string, max 255 characters
- `email`: Required, valid email, unique, max 255 characters
- `password`: Required, minimum 12 characters, must contain mixed case, numbers, symbols, and not be compromised
- `password_confirmation`: Required, must match password

#### Success Response (201 Created)

```json
{
  "message": "Account created successfully.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com",
      "email_verified_at": null,
      "mfa_enabled": false,
      "created_at": "2024-03-15T10:30:00.000000Z",
      "updated_at": "2024-03-15T10:30:00.000000Z"
    },
    "token": "1|aBcDeFgHiJkLmNoPqRsTuVwXyZ"
  }
}
```

#### Error Responses

**422 Unprocessable Entity** - Validation failed
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["This email address is already registered."],
    "password": ["The password must be at least 12 characters."]
  }
}
```

---

### POST /auth/login

Authenticate a user and issue an API token.

**Authentication Required:** No
**Rate Limiting:** `throttle:auth` (5/min, 20/hour)

#### Request Body

```json
{
  "email": "john.smith@example.com",
  "password": "SecureP@ssw0rd123!",
  "mfa_code": "123456"
}
```

#### Validation Rules

- `email`: Required, valid email format
- `password`: Required, string
- `mfa_code`: Optional, string, exactly 6 characters (required if MFA is enabled)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com",
      "mfa_enabled": false,
      "role": {
        "id": 2,
        "name": "parent"
      }
    },
    "token": "2|xYzAbCdEfGhIjKlMnOpQrStUvW"
  }
}
```

#### MFA Required Response (200 OK)

```json
{
  "success": true,
  "message": "MFA verification required.",
  "mfa_required": true
}
```

#### Error Responses

**401 Unauthorized** - Invalid credentials
```json
{
  "success": false,
  "message": "Invalid credentials.",
  "attempts_remaining": 3
}
```

**401 Unauthorized** - Account locked
```json
{
  "success": false,
  "message": "Too many failed login attempts. Account locked temporarily.",
  "lockout": true,
  "retry_after": 300
}
```

---

### POST /auth/logout

Log out the current user and revoke their token.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "message": "Logged out successfully."
}
```

---

### GET /user

Get the authenticated user's profile.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "name": "John Smith",
    "email": "john.smith@example.com",
    "email_verified_at": "2024-03-15T10:35:00.000000Z",
    "mfa_enabled": true,
    "created_at": "2024-03-15T10:30:00.000000Z",
    "updated_at": "2024-03-15T10:30:00.000000Z",
    "role": {
      "id": 2,
      "name": "parent"
    }
  }
}
```

---

### POST /auth/forgot-password

Send a password reset link to the given email address.

**Authentication Required:** No
**Rate Limiting:** `throttle:auth` (5/min, 20/hour)

#### Request Body

```json
{
  "email": "john.smith@example.com"
}
```

#### Validation Rules

- `email`: Required, valid email format

#### Success Response (200 OK)

```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Note:** The response is intentionally generic to prevent email enumeration attacks.

---

### POST /auth/reset-password

Reset the user's password using a reset token.

**Authentication Required:** No
**Rate Limiting:** `throttle:auth` (5/min, 20/hour)

#### Request Body

```json
{
  "token": "reset-token-from-email",
  "email": "john.smith@example.com",
  "password": "NewSecureP@ssw0rd123!",
  "password_confirmation": "NewSecureP@ssw0rd123!"
}
```

#### Validation Rules

- `token`: Required, string
- `email`: Required, valid email format
- `password`: Required, minimum 12 characters, must contain mixed case, numbers, symbols, and not be compromised
- `password_confirmation`: Required, must match password

#### Success Response (200 OK)

```json
{
  "message": "Password has been reset successfully."
}
```

#### Error Responses

**400 Bad Request** - Invalid or expired token
```json
{
  "message": "This password reset token is invalid or has expired."
}
```

---

## User Profile Endpoints

### GET /profile

Get the current user's profile information.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "name": "John Smith",
    "email": "john.smith@example.com",
    "email_verified_at": "2024-03-15T10:35:00.000000Z",
    "mfa_enabled": true,
    "created_at": "2024-03-15T10:30:00.000000Z",
    "updated_at": "2024-03-15T10:30:00.000000Z",
    "role": {
      "id": 2,
      "name": "parent"
    }
  }
}
```

---

### PUT /profile

Update the current user's profile information.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "name": "John A. Smith",
  "email": "john.a.smith@example.com"
}
```

#### Validation Rules

- `name`: Optional, string, max 255 characters
- `email`: Optional, valid email, unique (excluding current user), max 255 characters

#### Success Response (200 OK)

```json
{
  "message": "Profile updated successfully.",
  "data": {
    "id": 1,
    "name": "John A. Smith",
    "email": "john.a.smith@example.com",
    "email_verified_at": null,
    "mfa_enabled": true,
    "created_at": "2024-03-15T10:30:00.000000Z",
    "updated_at": "2024-03-16T14:20:00.000000Z"
  }
}
```

---

### GET /profile/prefill

Get pre-fill data for returning applicants.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

Returns commonly used data from previous applications to speed up the application process for returning families.

#### Success Response (200 OK)

```json
{
  "data": {
    "parent": {
      "name": "John Smith",
      "email": "john.smith@example.com"
    },
    "campers": [
      {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith",
        "date_of_birth": "2012-06-15",
        "gender": "Female"
      }
    ],
    "emergency_contacts": [
      {
        "name": "Jane Smith",
        "relationship": "Mother",
        "phone_primary": "555-0123",
        "phone_secondary": "555-0124",
        "email": "jane.smith@example.com",
        "is_primary": true,
        "is_authorized_pickup": true
      }
    ],
    "medical": {
      "physician_name": "Dr. Sarah Johnson",
      "physician_phone": "555-0200",
      "insurance_provider": "Blue Cross Blue Shield",
      "insurance_policy_number": "ABC123456789"
    }
  }
}
```

---

## MFA Endpoints

### POST /mfa/setup

Initialize MFA setup for the current user. Returns a QR code and secret for authenticator app setup.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:mfa` (3/min, 10/hour)

#### Success Response (200 OK)

```json
{
  "message": "MFA setup initialized. Scan the QR code with your authenticator app.",
  "data": {
    "qr_code": "data:image/svg+xml;base64,...",
    "secret": "JBSWY3DPEHPK3PXP",
    "recovery_codes": [
      "ABC123-DEF456",
      "GHI789-JKL012",
      "MNO345-PQR678",
      "STU901-VWX234",
      "YZA567-BCD890"
    ]
  }
}
```

#### Error Responses

**400 Bad Request** - MFA already enabled
```json
{
  "message": "MFA is already enabled for this account."
}
```

---

### POST /mfa/verify

Verify and enable MFA for the current user.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:mfa` (3/min, 10/hour)

#### Request Body

```json
{
  "code": "123456"
}
```

#### Validation Rules

- `code`: Required, string, exactly 6 characters

#### Success Response (200 OK)

```json
{
  "message": "MFA has been enabled successfully.",
  "data": {
    "recovery_codes": [
      "ABC123-DEF456",
      "GHI789-JKL012",
      "MNO345-PQR678",
      "STU901-VWX234",
      "YZA567-BCD890"
    ]
  }
}
```

#### Error Responses

**401 Unauthorized** - Invalid code
```json
{
  "message": "Invalid verification code."
}
```

---

### POST /mfa/disable

Disable MFA for the current user.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:mfa` (3/min, 10/hour)

#### Request Body

```json
{
  "code": "123456",
  "password": "SecureP@ssw0rd123!"
}
```

#### Validation Rules

- `code`: Required, string, exactly 6 characters
- `password`: Required, string

#### Success Response (200 OK)

```json
{
  "message": "MFA has been disabled."
}
```

#### Error Responses

**400 Bad Request** - Invalid credentials
```json
{
  "message": "Invalid verification code or password."
}
```

---

## Camp Endpoints

### GET /camps

List all camps. Non-admin users only see active camps.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "name": "Summer Adventure Camp 2024",
      "description": "A week-long outdoor adventure for kids aged 8-14.",
      "location": "Camp Burnt Gin Facility",
      "is_active": true,
      "created_at": "2024-01-10T09:00:00.000000Z",
      "updated_at": "2024-01-10T09:00:00.000000Z",
      "sessions": [
        {
          "id": 1,
          "name": "Session 1",
          "start_date": "2024-06-10",
          "end_date": "2024-06-14",
          "capacity": 50,
          "min_age": 8,
          "max_age": 14
        }
      ]
    }
  ]
}
```

---

### GET /camps/{id}

Get details of a specific camp.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camp ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "name": "Summer Adventure Camp 2024",
    "description": "A week-long outdoor adventure for kids aged 8-14.",
    "location": "Camp Burnt Gin Facility",
    "is_active": true,
    "created_at": "2024-01-10T09:00:00.000000Z",
    "updated_at": "2024-01-10T09:00:00.000000Z",
    "sessions": [
      {
        "id": 1,
        "name": "Session 1",
        "start_date": "2024-06-10",
        "end_date": "2024-06-14",
        "capacity": 50,
        "min_age": 8,
        "max_age": 14,
        "registration_opens_at": "2024-03-01T00:00:00.000000Z",
        "registration_closes_at": "2024-06-01T23:59:59.000000Z",
        "is_active": true
      }
    ]
  }
}
```

---

### POST /camps

Create a new camp.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "name": "Summer Adventure Camp 2024",
  "description": "A week-long outdoor adventure for kids aged 8-14.",
  "location": "Camp Burnt Gin Facility",
  "is_active": true
}
```

#### Validation Rules

- `name`: Required, string, max 255 characters
- `description`: Optional, string
- `location`: Optional, string, max 255 characters
- `is_active`: Optional, boolean

#### Success Response (201 Created)

```json
{
  "message": "Camp created successfully.",
  "data": {
    "id": 1,
    "name": "Summer Adventure Camp 2024",
    "description": "A week-long outdoor adventure for kids aged 8-14.",
    "location": "Camp Burnt Gin Facility",
    "is_active": true,
    "created_at": "2024-01-10T09:00:00.000000Z",
    "updated_at": "2024-01-10T09:00:00.000000Z"
  }
}
```

---

### PUT /camps/{id}

Update an existing camp.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camp ID (integer)

#### Request Body

```json
{
  "name": "Summer Adventure Camp 2024 - Updated",
  "description": "An exciting week-long outdoor adventure.",
  "is_active": false
}
```

#### Validation Rules

- `name`: Optional, string, max 255 characters
- `description`: Optional, string
- `location`: Optional, string, max 255 characters
- `is_active`: Optional, boolean

#### Success Response (200 OK)

```json
{
  "message": "Camp updated successfully.",
  "data": {
    "id": 1,
    "name": "Summer Adventure Camp 2024 - Updated",
    "description": "An exciting week-long outdoor adventure.",
    "location": "Camp Burnt Gin Facility",
    "is_active": false,
    "created_at": "2024-01-10T09:00:00.000000Z",
    "updated_at": "2024-03-15T14:30:00.000000Z"
  }
}
```

---

### DELETE /camps/{id}

Delete a camp.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camp ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Camp deleted successfully."
}
```

---

## Camp Session Endpoints

### GET /sessions

List all camp sessions. Supports filtering by camp and availability.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `camp_id`: Optional, integer - Filter by camp ID
- `available_only`: Optional, boolean - Show only sessions currently open for registration

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camp_id": 1,
      "name": "Session 1",
      "start_date": "2024-06-10",
      "end_date": "2024-06-14",
      "capacity": 50,
      "min_age": 8,
      "max_age": 14,
      "registration_opens_at": "2024-03-01T00:00:00.000000Z",
      "registration_closes_at": "2024-06-01T23:59:59.000000Z",
      "is_active": true,
      "created_at": "2024-01-10T09:30:00.000000Z",
      "updated_at": "2024-01-10T09:30:00.000000Z",
      "camp": {
        "id": 1,
        "name": "Summer Adventure Camp 2024"
      }
    }
  ]
}
```

---

### GET /sessions/{id}

Get details of a specific camp session.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Session ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camp_id": 1,
    "name": "Session 1",
    "start_date": "2024-06-10",
    "end_date": "2024-06-14",
    "capacity": 50,
    "min_age": 8,
    "max_age": 14,
    "registration_opens_at": "2024-03-01T00:00:00.000000Z",
    "registration_closes_at": "2024-06-01T23:59:59.000000Z",
    "is_active": true,
    "created_at": "2024-01-10T09:30:00.000000Z",
    "updated_at": "2024-01-10T09:30:00.000000Z",
    "camp": {
      "id": 1,
      "name": "Summer Adventure Camp 2024",
      "description": "A week-long outdoor adventure for kids aged 8-14.",
      "location": "Camp Burnt Gin Facility"
    }
  }
}
```

---

### POST /sessions

Create a new camp session.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camp_id": 1,
  "name": "Session 2",
  "start_date": "2024-06-17",
  "end_date": "2024-06-21",
  "capacity": 50,
  "min_age": 8,
  "max_age": 14,
  "registration_opens_at": "2024-03-01T00:00:00.000000Z",
  "registration_closes_at": "2024-06-10T23:59:59.000000Z",
  "is_active": true
}
```

#### Validation Rules

- `camp_id`: Required, must exist in camps table
- `name`: Required, string, max 255 characters
- `start_date`: Required, valid date
- `end_date`: Required, valid date, must be after start_date
- `capacity`: Required, integer, minimum 1
- `min_age`: Optional, integer, minimum 0
- `max_age`: Optional, integer, minimum 0, must be >= min_age
- `registration_opens_at`: Optional, valid date
- `registration_closes_at`: Optional, valid date, must be after registration_opens_at
- `is_active`: Optional, boolean

#### Success Response (201 Created)

```json
{
  "message": "Camp session created successfully.",
  "data": {
    "id": 2,
    "camp_id": 1,
    "name": "Session 2",
    "start_date": "2024-06-17",
    "end_date": "2024-06-21",
    "capacity": 50,
    "min_age": 8,
    "max_age": 14,
    "registration_opens_at": "2024-03-01T00:00:00.000000Z",
    "registration_closes_at": "2024-06-10T23:59:59.000000Z",
    "is_active": true,
    "created_at": "2024-01-10T10:00:00.000000Z",
    "updated_at": "2024-01-10T10:00:00.000000Z"
  }
}
```

---

### PUT /sessions/{id}

Update an existing camp session.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Session ID (integer)

#### Request Body

```json
{
  "capacity": 60,
  "is_active": true
}
```

#### Validation Rules

Same as POST /sessions, but all fields are optional.

#### Success Response (200 OK)

```json
{
  "message": "Camp session updated successfully.",
  "data": {
    "id": 2,
    "camp_id": 1,
    "name": "Session 2",
    "start_date": "2024-06-17",
    "end_date": "2024-06-21",
    "capacity": 60,
    "min_age": 8,
    "max_age": 14,
    "registration_opens_at": "2024-03-01T00:00:00.000000Z",
    "registration_closes_at": "2024-06-10T23:59:59.000000Z",
    "is_active": true,
    "created_at": "2024-01-10T10:00:00.000000Z",
    "updated_at": "2024-03-15T15:00:00.000000Z"
  }
}
```

---

### DELETE /sessions/{id}

Delete a camp session.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Session ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Camp session deleted successfully."
}
```

---

## Camper Endpoints

### GET /campers

List campers. Admins see all campers, parents see only their children.

**Authentication Required:** Yes
**Authorization:** Admin, Parent
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15",
      "gender": "Female",
      "created_at": "2024-03-15T11:00:00.000000Z",
      "updated_at": "2024-03-15T11:00:00.000000Z",
      "user": {
        "id": 1,
        "name": "John Smith",
        "email": "john.smith@example.com"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /campers

Create a new camper profile.

**Authentication Required:** Yes
**Authorization:** Admin, Parent
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "first_name": "Emily",
  "last_name": "Smith",
  "date_of_birth": "2012-06-15",
  "gender": "Female",
  "user_id": 1
}
```

#### Validation Rules

- `first_name`: Required, string, max 255 characters
- `last_name`: Required, string, max 255 characters
- `date_of_birth`: Required, valid date, must be before today
- `gender`: Optional, string, max 50 characters
- `user_id`: Required for admins, must exist in users table (automatically set to current user for parents)

#### Success Response (201 Created)

```json
{
  "message": "Camper created successfully.",
  "data": {
    "id": 1,
    "user_id": 1,
    "first_name": "Emily",
    "last_name": "Smith",
    "date_of_birth": "2012-06-15",
    "gender": "Female",
    "created_at": "2024-03-15T11:00:00.000000Z",
    "updated_at": "2024-03-15T11:00:00.000000Z"
  }
}
```

---

### GET /campers/{id}

Get details of a specific camper.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camper ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "user_id": 1,
    "first_name": "Emily",
    "last_name": "Smith",
    "date_of_birth": "2012-06-15",
    "gender": "Female",
    "created_at": "2024-03-15T11:00:00.000000Z",
    "updated_at": "2024-03-15T11:00:00.000000Z",
    "user": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com"
    },
    "applications": [
      {
        "id": 1,
        "status": "approved",
        "camp_session": {
          "id": 1,
          "name": "Session 1",
          "start_date": "2024-06-10",
          "end_date": "2024-06-14"
        }
      }
    ]
  }
}
```

---

### PUT /campers/{id}

Update a camper's profile.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camper ID (integer)

#### Request Body

```json
{
  "first_name": "Emily Jane",
  "gender": "Female"
}
```

#### Validation Rules

Same as POST /campers, but all fields are optional.

#### Success Response (200 OK)

```json
{
  "message": "Camper updated successfully.",
  "data": {
    "id": 1,
    "user_id": 1,
    "first_name": "Emily Jane",
    "last_name": "Smith",
    "date_of_birth": "2012-06-15",
    "gender": "Female",
    "created_at": "2024-03-15T11:00:00.000000Z",
    "updated_at": "2024-03-16T10:30:00.000000Z"
  }
}
```

---

### DELETE /campers/{id}

Delete a camper profile.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Camper ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Camper deleted successfully."
}
```

---

## Application Endpoints

### GET /applications

List applications with search and filter support. Admins see all applications, parents see only their children's applications.

**Authentication Required:** Yes
**Authorization:** Admin, Parent
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `status`: Optional, string - Filter by status (pending, under_review, approved, rejected, waitlisted, cancelled)
- `camp_session_id`: Optional, integer - Filter by camp session
- `search`: Optional, string - Search by camper name or parent name/email
- `date_from`: Optional, date - Filter by submitted date (from)
- `date_to`: Optional, date - Filter by submitted date (to)
- `drafts_only`: Optional, boolean - Show only draft applications
- `sort`: Optional, string - Sort field (created_at, submitted_at, status, reviewed_at)
- `direction`: Optional, string - Sort direction (asc, desc)
- `per_page`: Optional, integer - Results per page (default: 15)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "camp_session_id": 1,
      "status": "approved",
      "is_draft": false,
      "notes": "Looking forward to camp!",
      "submitted_at": "2024-03-15T12:00:00.000000Z",
      "reviewed_at": "2024-03-16T09:00:00.000000Z",
      "reviewed_by": 2,
      "signature_name": "John Smith",
      "signed_at": "2024-03-15T12:00:00.000000Z",
      "created_at": "2024-03-15T11:30:00.000000Z",
      "updated_at": "2024-03-16T09:00:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith",
        "user": {
          "id": 1,
          "name": "John Smith",
          "email": "john.smith@example.com"
        }
      },
      "camp_session": {
        "id": 1,
        "name": "Session 1",
        "camp": {
          "id": 1,
          "name": "Summer Adventure Camp 2024"
        }
      },
      "reviewer": {
        "id": 2,
        "name": "Admin User"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /applications

Create a new camp application. Supports draft mode for saving incomplete applications.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camper_id": 1,
  "camp_session_id": 1,
  "notes": "Emily is excited to attend camp this summer.",
  "is_draft": false
}
```

#### Validation Rules

- `camper_id`: Required, must exist and belong to user (for parents)
- `camp_session_id`: Required, must exist, unique combination with camper_id
- `notes`: Optional, string, max 1000 characters
- `is_draft`: Optional, boolean (default: false)

#### Success Response (201 Created)

```json
{
  "message": "Application submitted successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "camp_session_id": 1,
    "status": "pending",
    "is_draft": false,
    "notes": "Emily is excited to attend camp this summer.",
    "submitted_at": "2024-03-15T12:00:00.000000Z",
    "created_at": "2024-03-15T12:00:00.000000Z",
    "updated_at": "2024-03-15T12:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    },
    "camp_session": {
      "id": 1,
      "name": "Session 1",
      "start_date": "2024-06-10",
      "end_date": "2024-06-14"
    }
  }
}
```

#### Draft Response (201 Created)

```json
{
  "message": "Application draft saved.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "camp_session_id": 1,
    "status": "pending",
    "is_draft": true,
    "notes": "Emily is excited to attend camp this summer.",
    "submitted_at": null,
    "created_at": "2024-03-15T12:00:00.000000Z",
    "updated_at": "2024-03-15T12:00:00.000000Z"
  }
}
```

---

### GET /applications/{id}

Get details of a specific application.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Application ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "camp_session_id": 1,
    "status": "approved",
    "is_draft": false,
    "notes": "Emily is excited to attend camp this summer.",
    "submitted_at": "2024-03-15T12:00:00.000000Z",
    "reviewed_at": "2024-03-16T09:00:00.000000Z",
    "reviewed_by": 2,
    "signature_name": "John Smith",
    "signature_data": "data:image/png;base64,...",
    "signed_at": "2024-03-15T12:00:00.000000Z",
    "signed_ip_address": "192.168.1.100",
    "created_at": "2024-03-15T11:30:00.000000Z",
    "updated_at": "2024-03-16T09:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    },
    "camp_session": {
      "id": 1,
      "name": "Session 1",
      "start_date": "2024-06-10",
      "end_date": "2024-06-14",
      "camp": {
        "id": 1,
        "name": "Summer Adventure Camp 2024"
      }
    },
    "reviewer": {
      "id": 2,
      "name": "Admin User"
    }
  }
}
```

---

### PUT /applications/{id}

Update an application. Supports submitting drafts and editing submitted applications.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Application ID (integer)

#### Request Body

```json
{
  "notes": "Updated notes for the application.",
  "submit": true
}
```

#### Validation Rules

- `camper_id`: Optional, must exist and belong to user
- `camp_session_id`: Optional, must exist
- `notes`: Optional, string, max 1000 characters
- `submit`: Optional, boolean - Set to true to submit a draft

#### Success Response (200 OK)

```json
{
  "message": "Application updated successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "camp_session_id": 1,
    "status": "pending",
    "is_draft": false,
    "notes": "Updated notes for the application.",
    "submitted_at": "2024-03-16T10:00:00.000000Z",
    "created_at": "2024-03-15T11:30:00.000000Z",
    "updated_at": "2024-03-16T10:00:00.000000Z"
  }
}
```

---

### POST /applications/{id}/sign

Digitally sign an application.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Application ID (integer)

#### Request Body

```json
{
  "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "signature_name": "John Smith"
}
```

#### Validation Rules

- `signature_data`: Required, string (base64 encoded signature image)
- `signature_name`: Required, string, max 255 characters

#### Success Response (200 OK)

```json
{
  "message": "Application signed successfully.",
  "data": {
    "id": 1,
    "signature_name": "John Smith",
    "signed_at": "2024-03-15T12:30:00.000000Z",
    "signed_ip_address": "192.168.1.100"
  }
}
```

#### Error Responses

**400 Bad Request** - Already signed
```json
{
  "message": "Application has already been signed."
}
```

---

### POST /applications/{id}/review

Review and update the status of an application. Admin only.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Application ID (integer)

#### Request Body

```json
{
  "status": "approved",
  "notes": "Approved for Session 1. All requirements met."
}
```

#### Validation Rules

- `status`: Required, must be one of: pending, under_review, approved, rejected, waitlisted, cancelled
- `notes`: Optional, string, max 1000 characters

#### Success Response (200 OK)

```json
{
  "message": "Application reviewed successfully.",
  "data": {
    "id": 1,
    "status": "approved",
    "notes": "Approved for Session 1. All requirements met.",
    "reviewed_at": "2024-03-16T09:00:00.000000Z",
    "reviewed_by": 2
  }
}
```

**Note:** Approval automatically triggers acceptance letter generation and email notification. Rejection triggers rejection letter generation.

---

### DELETE /applications/{id}

Delete an application. Admin only.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Application ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Application deleted successfully."
}
```

---

## Medical Record Endpoints

### GET /medical-records

List all medical records. Admin and medical providers only.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "physician_name": "Dr. Sarah Johnson",
      "physician_phone": "555-0200",
      "insurance_provider": "Blue Cross Blue Shield",
      "insurance_policy_number": "ABC123456789",
      "special_needs": "None",
      "dietary_restrictions": "Vegetarian",
      "notes": "No known issues.",
      "created_at": "2024-03-15T13:00:00.000000Z",
      "updated_at": "2024-03-15T13:00:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /medical-records

Create a new medical record.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camper_id": 1,
  "physician_name": "Dr. Sarah Johnson",
  "physician_phone": "555-0200",
  "insurance_provider": "Blue Cross Blue Shield",
  "insurance_policy_number": "ABC123456789",
  "special_needs": "None",
  "dietary_restrictions": "Vegetarian",
  "notes": "No known issues."
}
```

#### Validation Rules

- `camper_id`: Required, must exist, must be unique (one medical record per camper)
- `physician_name`: Optional, string, max 255 characters
- `physician_phone`: Optional, string, max 20 characters
- `insurance_provider`: Optional, string, max 255 characters
- `insurance_policy_number`: Optional, string, max 100 characters
- `special_needs`: Optional, string, max 5000 characters
- `dietary_restrictions`: Optional, string, max 2000 characters
- `notes`: Optional, string, max 5000 characters

#### Success Response (201 Created)

```json
{
  "message": "Medical record created successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "physician_name": "Dr. Sarah Johnson",
    "physician_phone": "555-0200",
    "insurance_provider": "Blue Cross Blue Shield",
    "insurance_policy_number": "ABC123456789",
    "special_needs": "None",
    "dietary_restrictions": "Vegetarian",
    "notes": "No known issues.",
    "created_at": "2024-03-15T13:00:00.000000Z",
    "updated_at": "2024-03-15T13:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    }
  }
}
```

---

### GET /medical-records/{id}

Get details of a specific medical record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medical Record ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "physician_name": "Dr. Sarah Johnson",
    "physician_phone": "555-0200",
    "insurance_provider": "Blue Cross Blue Shield",
    "insurance_policy_number": "ABC123456789",
    "special_needs": "None",
    "dietary_restrictions": "Vegetarian",
    "notes": "No known issues.",
    "created_at": "2024-03-15T13:00:00.000000Z",
    "updated_at": "2024-03-15T13:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    }
  }
}
```

---

### PUT /medical-records/{id}

Update a medical record.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medical Record ID (integer)

#### Request Body

```json
{
  "physician_phone": "555-0201",
  "notes": "Updated contact information."
}
```

#### Validation Rules

Same as POST /medical-records, but all fields are optional except camper_id.

#### Success Response (200 OK)

```json
{
  "message": "Medical record updated successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "physician_name": "Dr. Sarah Johnson",
    "physician_phone": "555-0201",
    "insurance_provider": "Blue Cross Blue Shield",
    "insurance_policy_number": "ABC123456789",
    "special_needs": "None",
    "dietary_restrictions": "Vegetarian",
    "notes": "Updated contact information.",
    "created_at": "2024-03-15T13:00:00.000000Z",
    "updated_at": "2024-03-16T11:00:00.000000Z"
  }
}
```

---

### DELETE /medical-records/{id}

Delete a medical record. Admin only.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medical Record ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Medical record deleted successfully."
}
```

---

## Allergy Endpoints

### GET /allergies

List all allergies. Admin and medical providers only.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "allergen": "Peanuts",
      "severity": "life_threatening",
      "reaction": "Anaphylaxis",
      "treatment": "EpiPen auto-injector. Call 911 immediately.",
      "created_at": "2024-03-15T13:30:00.000000Z",
      "updated_at": "2024-03-15T13:30:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /allergies

Create a new allergy record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camper_id": 1,
  "allergen": "Peanuts",
  "severity": "life_threatening",
  "reaction": "Anaphylaxis",
  "treatment": "EpiPen auto-injector. Call 911 immediately."
}
```

#### Validation Rules

- `camper_id`: Required, must exist and belong to user (for parents)
- `allergen`: Required, string, max 255 characters
- `severity`: Required, must be one of: mild, moderate, severe, life_threatening
- `reaction`: Optional, string, max 2000 characters
- `treatment`: Optional, string, max 2000 characters

#### Success Response (201 Created)

```json
{
  "message": "Allergy created successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "allergen": "Peanuts",
    "severity": "life_threatening",
    "reaction": "Anaphylaxis",
    "treatment": "EpiPen auto-injector. Call 911 immediately.",
    "created_at": "2024-03-15T13:30:00.000000Z",
    "updated_at": "2024-03-15T13:30:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    }
  }
}
```

---

### GET /allergies/{id}

Get details of a specific allergy.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Allergy ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "allergen": "Peanuts",
    "severity": "life_threatening",
    "reaction": "Anaphylaxis",
    "treatment": "EpiPen auto-injector. Call 911 immediately.",
    "created_at": "2024-03-15T13:30:00.000000Z",
    "updated_at": "2024-03-15T13:30:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    }
  }
}
```

---

### PUT /allergies/{id}

Update an allergy record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Allergy ID (integer)

#### Request Body

```json
{
  "severity": "severe",
  "treatment": "Updated treatment protocol."
}
```

#### Validation Rules

Same as POST /allergies, but all fields are optional.

#### Success Response (200 OK)

```json
{
  "message": "Allergy updated successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "allergen": "Peanuts",
    "severity": "severe",
    "reaction": "Anaphylaxis",
    "treatment": "Updated treatment protocol.",
    "created_at": "2024-03-15T13:30:00.000000Z",
    "updated_at": "2024-03-16T12:00:00.000000Z"
  }
}
```

---

### DELETE /allergies/{id}

Delete an allergy record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Allergy ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Allergy deleted successfully."
}
```

---

## Medication Endpoints

### GET /medications

List all medications. Admin and medical providers only.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "name": "Amoxicillin",
      "dosage": "250mg",
      "frequency": "Twice daily with meals",
      "purpose": "Antibiotic for bacterial infection",
      "prescribing_physician": "Dr. Sarah Johnson",
      "notes": "Complete full course even if symptoms improve.",
      "created_at": "2024-03-15T14:00:00.000000Z",
      "updated_at": "2024-03-15T14:00:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /medications

Create a new medication record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camper_id": 1,
  "name": "Amoxicillin",
  "dosage": "250mg",
  "frequency": "Twice daily with meals",
  "purpose": "Antibiotic for bacterial infection",
  "prescribing_physician": "Dr. Sarah Johnson",
  "notes": "Complete full course even if symptoms improve."
}
```

#### Validation Rules

- `camper_id`: Required, must exist and belong to user (for parents)
- `name`: Required, string, max 255 characters
- `dosage`: Required, string, max 100 characters
- `frequency`: Required, string, max 100 characters
- `purpose`: Optional, string, max 500 characters
- `prescribing_physician`: Optional, string, max 255 characters
- `notes`: Optional, string, max 2000 characters

#### Success Response (201 Created)

```json
{
  "message": "Medication created successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Amoxicillin",
    "dosage": "250mg",
    "frequency": "Twice daily with meals",
    "purpose": "Antibiotic for bacterial infection",
    "prescribing_physician": "Dr. Sarah Johnson",
    "notes": "Complete full course even if symptoms improve.",
    "created_at": "2024-03-15T14:00:00.000000Z",
    "updated_at": "2024-03-15T14:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    }
  }
}
```

---

### GET /medications/{id}

Get details of a specific medication.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medication ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Amoxicillin",
    "dosage": "250mg",
    "frequency": "Twice daily with meals",
    "purpose": "Antibiotic for bacterial infection",
    "prescribing_physician": "Dr. Sarah Johnson",
    "notes": "Complete full course even if symptoms improve.",
    "created_at": "2024-03-15T14:00:00.000000Z",
    "updated_at": "2024-03-15T14:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    }
  }
}
```

---

### PUT /medications/{id}

Update a medication record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medication ID (integer)

#### Request Body

```json
{
  "dosage": "500mg",
  "notes": "Dosage increased per physician recommendation."
}
```

#### Validation Rules

Same as POST /medications, but all fields are optional.

#### Success Response (200 OK)

```json
{
  "message": "Medication updated successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Amoxicillin",
    "dosage": "500mg",
    "frequency": "Twice daily with meals",
    "purpose": "Antibiotic for bacterial infection",
    "prescribing_physician": "Dr. Sarah Johnson",
    "notes": "Dosage increased per physician recommendation.",
    "created_at": "2024-03-15T14:00:00.000000Z",
    "updated_at": "2024-03-16T13:00:00.000000Z"
  }
}
```

---

### DELETE /medications/{id}

Delete a medication record.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Medication ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Medication deleted successfully."
}
```

---

## Emergency Contact Endpoints

### GET /emergency-contacts

List all emergency contacts. Admin and medical providers only.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "name": "Jane Smith",
      "relationship": "Mother",
      "phone_primary": "555-0123",
      "phone_secondary": "555-0124",
      "email": "jane.smith@example.com",
      "is_primary": true,
      "is_authorized_pickup": true,
      "created_at": "2024-03-15T14:30:00.000000Z",
      "updated_at": "2024-03-15T14:30:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /emergency-contacts

Create a new emergency contact.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### Request Body

```json
{
  "camper_id": 1,
  "name": "Jane Smith",
  "relationship": "Mother",
  "phone_primary": "555-0123",
  "phone_secondary": "555-0124",
  "email": "jane.smith@example.com",
  "is_primary": true,
  "is_authorized_pickup": true
}
```

#### Validation Rules

- `camper_id`: Required, must exist and belong to user (for parents)
- `name`: Required, string, max 255 characters
- `relationship`: Required, string, max 100 characters
- `phone_primary`: Required, string, max 20 characters
- `phone_secondary`: Optional, string, max 20 characters
- `email`: Optional, valid email, max 255 characters
- `is_primary`: Optional, boolean
- `is_authorized_pickup`: Optional, boolean

#### Success Response (201 Created)

```json
{
  "message": "Emergency contact created successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Jane Smith",
    "relationship": "Mother",
    "phone_primary": "555-0123",
    "phone_secondary": "555-0124",
    "email": "jane.smith@example.com",
    "is_primary": true,
    "is_authorized_pickup": true,
    "created_at": "2024-03-15T14:30:00.000000Z",
    "updated_at": "2024-03-15T14:30:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    }
  }
}
```

---

### GET /emergency-contacts/{id}

Get details of a specific emergency contact.

**Authentication Required:** Yes
**Authorization:** Admin, Medical Provider, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Emergency Contact ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Jane Smith",
    "relationship": "Mother",
    "phone_primary": "555-0123",
    "phone_secondary": "555-0124",
    "email": "jane.smith@example.com",
    "is_primary": true,
    "is_authorized_pickup": true,
    "created_at": "2024-03-15T14:30:00.000000Z",
    "updated_at": "2024-03-15T14:30:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    }
  }
}
```

---

### PUT /emergency-contacts/{id}

Update an emergency contact.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Emergency Contact ID (integer)

#### Request Body

```json
{
  "phone_primary": "555-9999",
  "is_authorized_pickup": false
}
```

#### Validation Rules

Same as POST /emergency-contacts, but all fields are optional.

#### Success Response (200 OK)

```json
{
  "message": "Emergency contact updated successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "name": "Jane Smith",
    "relationship": "Mother",
    "phone_primary": "555-9999",
    "phone_secondary": "555-0124",
    "email": "jane.smith@example.com",
    "is_primary": true,
    "is_authorized_pickup": false,
    "created_at": "2024-03-15T14:30:00.000000Z",
    "updated_at": "2024-03-16T14:00:00.000000Z"
  }
}
```

---

### DELETE /emergency-contacts/{id}

Delete an emergency contact.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Emergency Contact ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Emergency contact deleted successfully."
}
```

---

## Document Endpoints

### GET /documents

List documents accessible to the current user.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

Admins see all documents. Parents see documents related to their children. Other users see only documents they uploaded.

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "documentable_type": "App\\Models\\Camper",
      "documentable_id": 1,
      "document_type": "Medical Form",
      "file_name": "medical_form.pdf",
      "file_path": "documents/2024/03/medical_form_abc123.pdf",
      "file_size": 245678,
      "mime_type": "application/pdf",
      "uploaded_by": 1,
      "scan_passed": true,
      "scan_result": "clean",
      "scanned_at": "2024-03-15T15:01:00.000000Z",
      "created_at": "2024-03-15T15:00:00.000000Z",
      "updated_at": "2024-03-15T15:01:00.000000Z",
      "documentable": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith"
      },
      "uploader": {
        "id": 1,
        "name": "John Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /documents

Upload a new document.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:uploads` (5/min, 50/hour)

#### Request Body (multipart/form-data)

```
file: [binary file data]
documentable_type: "App\\Models\\Camper"
documentable_id: 1
document_type: "Medical Form"
```

#### Validation Rules

- `file`: Required, must be PDF, JPEG, JPG, PNG, GIF, DOC, or DOCX, max 10 MB
- `documentable_type`: Optional, must be one of: App\\Models\\Camper, App\\Models\\MedicalRecord, App\\Models\\Application
- `documentable_id`: Required if documentable_type is provided, must exist
- `document_type`: Optional, string, max 100 characters

#### Success Response (201 Created)

```json
{
  "message": "Document uploaded successfully.",
  "data": {
    "id": 1,
    "documentable_type": "App\\Models\\Camper",
    "documentable_id": 1,
    "document_type": "Medical Form",
    "file_name": "medical_form.pdf",
    "file_path": "documents/2024/03/medical_form_abc123.pdf",
    "file_size": 245678,
    "mime_type": "application/pdf",
    "uploaded_by": 1,
    "scan_passed": null,
    "scan_result": null,
    "scanned_at": null,
    "created_at": "2024-03-15T15:00:00.000000Z",
    "updated_at": "2024-03-15T15:00:00.000000Z"
  }
}
```

**Note:** Documents are automatically scanned for malware. The `scan_passed` field will be `null` until scanning completes.

---

### GET /documents/{id}

Get metadata for a specific document.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Document ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "documentable_type": "App\\Models\\Camper",
    "documentable_id": 1,
    "document_type": "Medical Form",
    "file_name": "medical_form.pdf",
    "file_path": "documents/2024/03/medical_form_abc123.pdf",
    "file_size": 245678,
    "mime_type": "application/pdf",
    "uploaded_by": 1,
    "scan_passed": true,
    "scan_result": "clean",
    "scanned_at": "2024-03-15T15:01:00.000000Z",
    "created_at": "2024-03-15T15:00:00.000000Z",
    "updated_at": "2024-03-15T15:01:00.000000Z",
    "documentable": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith",
      "date_of_birth": "2012-06-15"
    },
    "uploader": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com"
    }
  }
}
```

---

### GET /documents/{id}/download

Download a document file.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

#### URL Parameters

- `id`: Document ID (integer)

#### Success Response (200 OK)

Returns the file as a binary stream with appropriate headers:
- `Content-Type`: Original file MIME type
- `Content-Disposition`: attachment; filename="original_filename.pdf"

#### Error Responses

**403 Forbidden** - Failed security check
```json
{
  "message": "Document failed security check and cannot be downloaded."
}
```

**403 Forbidden** - Pending security review (non-admin)
```json
{
  "message": "Document is pending security review. Contact an administrator."
}
```

---

### DELETE /documents/{id}

Delete a document.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Document ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Document deleted successfully."
}
```

---

## Medical Provider Link Endpoints

### GET /provider-links

List provider links accessible to the current user.

**Authentication Required:** Yes
**Authorization:** Admin, Parent
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

Admins see all links. Parents see only links for their children.

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_id": 1,
      "provider_name": "Dr. Sarah Johnson",
      "provider_email": "dr.johnson@medicalcenter.com",
      "expires_at": "2024-03-22T15:00:00.000000Z",
      "is_used": false,
      "accessed_at": null,
      "revoked_at": null,
      "revoked_by": null,
      "created_by": 1,
      "created_at": "2024-03-15T15:00:00.000000Z",
      "updated_at": "2024-03-15T15:00:00.000000Z",
      "camper": {
        "id": 1,
        "first_name": "Emily",
        "last_name": "Smith",
        "user": {
          "id": 1,
          "name": "John Smith"
        }
      },
      "creator": {
        "id": 1,
        "name": "John Smith"
      }
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1
  }
}
```

---

### POST /provider-links

Create and send a new medical provider link.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

#### Request Body

```json
{
  "camper_id": 1,
  "provider_name": "Dr. Sarah Johnson",
  "provider_email": "dr.johnson@medicalcenter.com"
}
```

#### Validation Rules

- `camper_id`: Required, must exist and belong to user (for parents)
- `provider_name`: Required, string, max 255 characters
- `provider_email`: Required, valid email, max 255 characters

#### Success Response (201 Created)

```json
{
  "message": "Provider link created and sent successfully.",
  "data": {
    "id": 1,
    "camper_id": 1,
    "provider_name": "Dr. Sarah Johnson",
    "provider_email": "dr.johnson@medicalcenter.com",
    "expires_at": "2024-03-22T15:00:00.000000Z",
    "is_used": false,
    "created_by": 1,
    "created_at": "2024-03-15T15:00:00.000000Z",
    "updated_at": "2024-03-15T15:00:00.000000Z"
  }
}
```

**Note:** A secure, time-limited link is automatically sent to the provider's email address. The link expires in 7 days and can only be used once.

---

### GET /provider-links/{id}

Get details of a specific provider link.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

#### URL Parameters

- `id`: Provider Link ID (integer)

#### Success Response (200 OK)

```json
{
  "data": {
    "id": 1,
    "camper_id": 1,
    "provider_name": "Dr. Sarah Johnson",
    "provider_email": "dr.johnson@medicalcenter.com",
    "expires_at": "2024-03-22T15:00:00.000000Z",
    "is_used": true,
    "accessed_at": "2024-03-16T10:00:00.000000Z",
    "revoked_at": null,
    "created_by": 1,
    "created_at": "2024-03-15T15:00:00.000000Z",
    "updated_at": "2024-03-16T10:00:00.000000Z",
    "camper": {
      "id": 1,
      "first_name": "Emily",
      "last_name": "Smith"
    },
    "creator": {
      "id": 1,
      "name": "John Smith"
    }
  }
}
```

---

### POST /provider-links/{id}/revoke

Revoke a provider link.

**Authentication Required:** Yes
**Authorization:** Admin, Parent (own children only)
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

#### URL Parameters

- `id`: Provider Link ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "Provider link revoked successfully."
}
```

#### Error Responses

**400 Bad Request** - Already revoked
```json
{
  "message": "Link has already been revoked."
}
```

---

### POST /provider-links/{id}/resend

Regenerate and resend a provider link. Admin only.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:sensitive` (10/min, 100/hour)

#### URL Parameters

- `id`: Provider Link ID (integer)

#### Success Response (200 OK)

```json
{
  "message": "New provider link generated and sent.",
  "data": {
    "id": 2,
    "camper_id": 1,
    "provider_name": "Dr. Sarah Johnson",
    "provider_email": "dr.johnson@medicalcenter.com",
    "expires_at": "2024-03-23T16:00:00.000000Z",
    "is_used": false,
    "created_by": 2,
    "created_at": "2024-03-16T16:00:00.000000Z",
    "updated_at": "2024-03-16T16:00:00.000000Z"
  }
}
```

**Note:** Since tokens are hashed and cannot be retrieved, this generates a completely new link.

---

### GET /provider-access/{token}

Access the provider form via secure token. No authentication required.

**Authentication Required:** No
**Rate Limiting:** `throttle:provider-link` (2/min, 10/hour)

#### URL Parameters

- `token`: Secure access token (string)

#### Success Response (200 OK)

```json
{
  "data": {
    "camper_name": "Emily Smith",
    "medical_record": {
      "physician_name": "Dr. Sarah Johnson",
      "physician_phone": "555-0200",
      "insurance_provider": "Blue Cross Blue Shield",
      "insurance_policy_number": "ABC123456789"
    },
    "allergies": [
      {
        "allergen": "Peanuts",
        "severity": "life_threatening",
        "reaction": "Anaphylaxis",
        "treatment": "EpiPen auto-injector. Call 911 immediately."
      }
    ],
    "medications": [
      {
        "name": "Amoxicillin",
        "dosage": "250mg",
        "frequency": "Twice daily with meals"
      }
    ]
  }
}
```

#### Error Responses

**404 Not Found** - Invalid token
```json
{
  "message": "Invalid link."
}
```

**403 Forbidden** - Link revoked, expired, or used
```json
{
  "message": "This link has been revoked."
}
```

---

### POST /provider-access/{token}/submit

Submit medical information via provider link. No authentication required.

**Authentication Required:** No
**Rate Limiting:** `throttle:provider-link` (2/min, 10/hour)

#### URL Parameters

- `token`: Secure access token (string)

#### Request Body

```json
{
  "medical_record": {
    "special_needs": "None reported",
    "notes": "Patient is cleared for all camp activities."
  },
  "allergies": [
    {
      "allergen": "Bee stings",
      "severity": "moderate",
      "reaction": "Local swelling and itching",
      "treatment": "Antihistamine as needed"
    }
  ],
  "medications": [
    {
      "name": "Ibuprofen",
      "dosage": "200mg",
      "frequency": "As needed for pain",
      "purpose": "Pain management"
    }
  ]
}
```

#### Success Response (200 OK)

```json
{
  "message": "Medical information submitted successfully."
}
```

#### Error Responses

**403 Forbidden** - Invalid or expired link
```json
{
  "message": "Invalid or expired link."
}
```

**422 Unprocessable Entity** - Validation failed
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "allergies.0.allergen": ["The allergen field is required."]
  }
}
```

---

### POST /provider-access/{token}/upload

Upload a document via provider link. No authentication required.

**Authentication Required:** No
**Rate Limiting:** `throttle:provider-link` (2/min, 10/hour)

#### URL Parameters

- `token`: Secure access token (string)

#### Request Body (multipart/form-data)

```
file: [binary file data]
document_type: "Medical Assessment"
```

#### Validation Rules

- `file`: Required, must be PDF, JPEG, JPG, or PNG, max 10 MB
- `document_type`: Optional, string, max 100 characters

#### Success Response (201 Created)

```json
{
  "message": "Document uploaded successfully.",
  "data": {
    "id": 5,
    "document_type": "Medical Assessment",
    "file_name": "assessment.pdf",
    "file_size": 156789,
    "created_at": "2024-03-16T11:00:00.000000Z"
  }
}
```

---

## Notification Endpoints

### GET /notifications

List notifications for the current user.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `unread_only`: Optional, boolean - Show only unread notifications

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "type": "App\\Notifications\\ApplicationSubmittedNotification",
      "notifiable_type": "App\\Models\\User",
      "notifiable_id": 1,
      "data": {
        "message": "Your application for Emily Smith has been submitted for Session 1.",
        "application_id": 1,
        "camper_name": "Emily Smith",
        "session_name": "Session 1"
      },
      "read_at": null,
      "created_at": "2024-03-15T12:01:00.000000Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 15,
    "total": 1,
    "unread_count": 1
  }
}
```

---

### PUT /notifications/{id}/read

Mark a notification as read.

**Authentication Required:** Yes
**Authorization:** Any authenticated user (own notifications only)
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `id`: Notification ID (UUID string)

#### Success Response (200 OK)

```json
{
  "message": "Notification marked as read."
}
```

---

### PUT /notifications/read-all

Mark all notifications as read.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:api` (60/min)

#### Success Response (200 OK)

```json
{
  "message": "All notifications marked as read."
}
```

---

## Inbox Endpoints

The Inbox Messaging System provides HIPAA-compliant internal messaging for secure communication between parents, administrators, and medical providers. All messages are immutable for audit trail integrity, and access is strictly controlled via role-based authorization policies.

### System Characteristics

- **Message Immutability:** Messages cannot be edited or permanently deleted (HIPAA compliance)
- **Audit Logging:** All operations are logged with full request context
- **Idempotent Message Sending:** Duplicate prevention via optional idempotency keys
- **Automatic Read Tracking:** Messages are marked as read when viewed
- **File Attachments:** Up to 5 attachments per message (10MB each)
- **Participant Management:** Admin-controlled participant addition/removal

### Authorization Rules

| Operation | Parent | Admin | Medical Provider |
|-----------|--------|-------|------------------|
| Create conversation with admin | Yes | Yes | No |
| Create conversation with parent | No | Yes | No |
| Create conversation with medical provider | No | Yes | No |
| View own conversations | Yes | Yes | Yes |
| View all conversations | No | Yes | No |
| Send message in conversation | Yes (if participant) | Yes | Yes (if participant) |
| Archive conversation (creator) | Yes | Yes | Yes |
| Delete conversation | No | Yes | No |
| Add participant | No | Yes | No |
| Remove participant | No | Yes | No |
| Leave conversation | Yes (except creator) | Yes (except creator) | Yes (except creator) |

---

### GET /inbox/conversations

List conversations for the authenticated user. Returns paginated results ordered by most recent activity.

**Authentication Required:** Yes
**Authorization:** Any authenticated user (sees only their own conversations)
**Rate Limiting:** `throttle:60,1` (60/min)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_archived` | boolean | No | Include archived conversations (default: false) |
| `per_page` | integer | No | Results per page (default: 25, max: 100) |

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subject": "Questions about Emily's medical form",
      "created_by_id": 1,
      "application_id": 5,
      "camper_id": 3,
      "camp_session_id": 2,
      "last_message_at": "2024-03-16T14:30:00.000000Z",
      "is_archived": false,
      "created_at": "2024-03-15T10:00:00.000000Z",
      "updated_at": "2024-03-16T14:30:00.000000Z",
      "creator": {
        "id": 1,
        "name": "John Smith",
        "email": "john.smith@example.com"
      },
      "participants": [
        {
          "id": 1,
          "name": "John Smith",
          "role": {
            "id": 2,
            "name": "parent"
          }
        },
        {
          "id": 2,
          "name": "Admin User",
          "role": {
            "id": 1,
            "name": "admin"
          }
        }
      ],
      "lastMessage": {
        "id": 42,
        "body": "I've reviewed the form and it looks complete.",
        "sender_id": 2,
        "created_at": "2024-03-16T14:30:00.000000Z",
        "sender": {
          "id": 2,
          "name": "Admin User"
        }
      },
      "unread_count": 1
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 3,
    "per_page": 25,
    "total": 67,
    "unread_count": 5
  }
}
```

---

### POST /inbox/conversations

Create a new conversation. Parents can only create conversations with administrators. Admins can create conversations with any users. Medical providers cannot initiate conversations.

**Authentication Required:** Yes
**Authorization:** Admin (anyone), Parent (admins only), Medical Provider (never)
**Rate Limiting:** `throttle:5,60` (5/min)

#### Request Body

```json
{
  "subject": "Questions about Emily's medical form",
  "participant_ids": [2, 3],
  "application_id": 5,
  "camper_id": 3,
  "camp_session_id": 2
}
```

#### Validation Rules

| Field | Rules | Description |
|-------|-------|-------------|
| `subject` | Required, string, max 255 characters | Conversation subject line |
| `participant_ids` | Required, array, min 1, max 10 | User IDs of participants (excluding creator) |
| `participant_ids.*` | Required, integer, exists in users table, distinct | Individual participant validation |
| `application_id` | Nullable, integer, exists in applications table | Optional link to application |
| `camper_id` | Nullable, integer, exists in campers table | Optional link to camper |
| `camp_session_id` | Nullable, integer, exists in camp_sessions table | Optional link to camp session |

#### Business Rules

- Creator is automatically added as a participant
- Cannot create conversation with only yourself
- Maximum 10 participants per conversation
- Parents can only add admin participants
- Medical providers can only be added to camper-related conversations (by admins)

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Conversation created successfully",
  "data": {
    "id": 1,
    "subject": "Questions about Emily's medical form",
    "created_by_id": 1,
    "application_id": 5,
    "camper_id": 3,
    "camp_session_id": 2,
    "last_message_at": null,
    "is_archived": false,
    "created_at": "2024-03-15T10:00:00.000000Z",
    "updated_at": "2024-03-15T10:00:00.000000Z",
    "creator": {
      "id": 1,
      "name": "John Smith"
    },
    "participants": [
      {
        "id": 1,
        "name": "John Smith"
      },
      {
        "id": 2,
        "name": "Admin User"
      }
    ]
  }
}
```

#### Error Responses

**403 Forbidden** - Parent attempting to message non-admin
```json
{
  "success": false,
  "error": "You do not have permission to perform this action"
}
```

**422 Unprocessable Entity** - Validation failed
```json
{
  "success": false,
  "errors": {
    "participant_ids": ["Maximum 10 participants allowed per conversation"],
    "subject": ["The subject field is required."]
  }
}
```

---

### GET /inbox/conversations/{conversation}

Get details of a specific conversation including participants and metadata.

**Authentication Required:** Yes
**Authorization:** Conversation participants + Admin
**Rate Limiting:** `throttle:60,1` (60/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "subject": "Questions about Emily's medical form",
    "created_by_id": 1,
    "application_id": 5,
    "camper_id": 3,
    "camp_session_id": 2,
    "last_message_at": "2024-03-16T14:30:00.000000Z",
    "is_archived": false,
    "created_at": "2024-03-15T10:00:00.000000Z",
    "updated_at": "2024-03-16T14:30:00.000000Z",
    "creator": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com"
    },
    "participants": [
      {
        "id": 1,
        "name": "John Smith",
        "role": {
          "id": 2,
          "name": "parent"
        }
      },
      {
        "id": 2,
        "name": "Admin User",
        "role": {
          "id": 1,
          "name": "admin"
        }
      }
    ],
    "lastMessage": {
      "id": 42,
      "body": "I've reviewed the form and it looks complete.",
      "sender_id": 2,
      "created_at": "2024-03-16T14:30:00.000000Z",
      "sender": {
        "id": 2,
        "name": "Admin User"
      }
    }
  },
  "meta": {
    "unread_count": 1
  }
}
```

#### Error Responses

**403 Forbidden** - Not a participant
```json
{
  "success": false,
  "error": "You do not have permission to view this conversation"
}
```

**404 Not Found** - Conversation does not exist
```json
{
  "message": "Resource not found."
}
```

---

### POST /inbox/conversations/{conversation}/archive

Archive a conversation. Archived conversations are hidden from default listings but remain accessible.

**Authentication Required:** Yes
**Authorization:** Conversation creator + Admin
**Rate Limiting:** `throttle:20,1` (20/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Conversation archived successfully",
  "data": {
    "id": 1,
    "subject": "Questions about Emily's medical form",
    "is_archived": true,
    "updated_at": "2024-03-17T09:00:00.000000Z"
  }
}
```

#### Error Responses

**403 Forbidden** - Not creator or admin
```json
{
  "success": false,
  "error": "Only the conversation creator or an administrator can archive this conversation"
}
```

**Note:** Archived conversations cannot receive new messages. They must be unarchived first.

---

### POST /inbox/conversations/{conversation}/unarchive

Unarchive a conversation, returning it to active status.

**Authentication Required:** Yes
**Authorization:** Conversation creator + Admin
**Rate Limiting:** `throttle:20,1` (20/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Conversation unarchived successfully",
  "data": {
    "id": 1,
    "subject": "Questions about Emily's medical form",
    "is_archived": false,
    "updated_at": "2024-03-17T10:00:00.000000Z"
  }
}
```

---

### POST /inbox/conversations/{conversation}/participants

Add a participant to an existing conversation. Admin only.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:10,60` (10/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Request Body

```json
{
  "user_id": 5
}
```

#### Validation Rules

| Field | Rules | Description |
|-------|-------|-------------|
| `user_id` | Required, integer, exists in users table | User ID to add as participant |

#### Business Rules

- User cannot already be a participant
- Medical providers can only be added to camper-linked conversations
- Maximum 10 participants per conversation (enforced at creation)
- User will receive notification of being added

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Participant added successfully"
}
```

#### Error Responses

**403 Forbidden** - Not admin
```json
{
  "success": false,
  "error": "Only administrators can add participants"
}
```

**400 Bad Request** - User already participant
```json
{
  "success": false,
  "error": "User is already a participant in this conversation"
}
```

**400 Bad Request** - Medical provider on non-camper conversation
```json
{
  "success": false,
  "error": "Medical providers can only be added to camper-related conversations"
}
```

---

### DELETE /inbox/conversations/{conversation}/participants/{user}

Remove a participant from a conversation. Admin only. Cannot remove conversation creator.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:10,60` (10/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)
- `user`: User ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Participant removed successfully"
}
```

#### Error Responses

**403 Forbidden** - Not admin
```json
{
  "success": false,
  "error": "Only administrators can remove participants"
}
```

**400 Bad Request** - Attempting to remove creator
```json
{
  "success": false,
  "error": "Cannot remove the conversation creator"
}
```

**Note:** Removed participants lose access to all conversation messages and cannot rejoin without admin intervention.

---

### POST /inbox/conversations/{conversation}/leave

Leave a conversation as a participant. Creator cannot leave their own conversation.

**Authentication Required:** Yes
**Authorization:** Conversation participants (except creator)
**Rate Limiting:** `throttle:10,60` (10/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Left conversation successfully"
}
```

#### Error Responses

**403 Forbidden** - Not a participant
```json
{
  "success": false,
  "error": "You are not a participant in this conversation"
}
```

**403 Forbidden** - Creator attempting to leave
```json
{
  "success": false,
  "error": "Conversation creator cannot leave. Please archive the conversation instead."
}
```

**Note:** After leaving, you lose access to all conversation messages. You cannot rejoin without admin intervention.

---

### DELETE /inbox/conversations/{conversation}

Soft delete a conversation. Admin only. Conversation remains in database for audit purposes but is hidden from all users.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

#### Error Responses

**403 Forbidden** - Not admin
```json
{
  "success": false,
  "error": "Only administrators can delete conversations"
}
```

**Note:** Soft deletion preserves conversation for HIPAA compliance. Permanent deletion is not allowed.

---

### GET /inbox/conversations/{conversation}/messages

List messages in a conversation. Returns paginated results ordered from oldest to newest.

**Authentication Required:** Yes
**Authorization:** Conversation participants + Admin
**Rate Limiting:** `throttle:60,1` (60/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `per_page` | integer | No | Results per page (default: 25, max: 100) |

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "conversation_id": 1,
      "sender_id": 1,
      "body": "I have a question about the medical form requirements.",
      "idempotency_key": "msg_abc123def456",
      "created_at": "2024-03-15T10:15:00.000000Z",
      "updated_at": "2024-03-15T10:15:00.000000Z",
      "sender": {
        "id": 1,
        "name": "John Smith",
        "role": {
          "id": 2,
          "name": "parent"
        }
      },
      "attachments": [
        {
          "id": 5,
          "file_name": "medical_form_question.pdf",
          "file_size": 156789,
          "mime_type": "application/pdf",
          "created_at": "2024-03-15T10:15:00.000000Z"
        }
      ],
      "is_read": true,
      "read_at": "2024-03-15T11:00:00.000000Z"
    },
    {
      "id": 2,
      "conversation_id": 1,
      "sender_id": 2,
      "body": "I've reviewed the form and it looks complete. Let me know if you need anything else.",
      "idempotency_key": "msg_xyz789uvw012",
      "created_at": "2024-03-16T14:30:00.000000Z",
      "updated_at": "2024-03-16T14:30:00.000000Z",
      "sender": {
        "id": 2,
        "name": "Admin User",
        "role": {
          "id": 1,
          "name": "admin"
        }
      },
      "attachments": [],
      "is_read": false,
      "read_at": null
    }
  ],
  "meta": {
    "current_page": 1,
    "last_page": 1,
    "per_page": 25,
    "total": 2,
    "unread_count": 1
  }
}
```

---

### POST /inbox/conversations/{conversation}/messages

Send a new message in a conversation. Supports optional file attachments and idempotency protection.

**Authentication Required:** Yes
**Authorization:** Active conversation participants
**Rate Limiting:** `throttle:20,1` (20/min)

#### URL Parameters

- `conversation`: Conversation ID (integer)

#### Request Body (multipart/form-data)

```
body: "I have a question about the medical form requirements."
attachments[]: [binary file data] (optional, max 5 files)
idempotency_key: "msg_abc123def456" (optional)
```

#### Validation Rules

| Field | Rules | Description |
|-------|-------|-------------|
| `body` | Required, string, max 65535 characters | Message content |
| `attachments` | Nullable, array, max 5 files | File attachments |
| `attachments.*` | File, max 10MB, mimes: pdf,jpeg,png,gif,doc,docx | Individual file validation |
| `idempotency_key` | Nullable, string, max 64 characters | Duplicate prevention key |

#### Business Rules

- Cannot send messages to archived conversations
- Must be an active participant
- Attachments are scanned for malware
- Duplicate messages (same idempotency_key) return original message
- All participants are notified of new messages

#### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "id": 1,
    "conversation_id": 1,
    "sender_id": 1,
    "body": "I have a question about the medical form requirements.",
    "idempotency_key": "msg_abc123def456",
    "created_at": "2024-03-15T10:15:00.000000Z",
    "updated_at": "2024-03-15T10:15:00.000000Z",
    "sender": {
      "id": 1,
      "name": "John Smith"
    },
    "attachments": [
      {
        "id": 5,
        "file_name": "medical_form_question.pdf",
        "file_size": 156789,
        "mime_type": "application/pdf",
        "created_at": "2024-03-15T10:15:00.000000Z"
      }
    ]
  }
}
```

#### Error Responses

**403 Forbidden** - Not a participant
```json
{
  "success": false,
  "error": "You are not a participant in this conversation"
}
```

**403 Forbidden** - Conversation archived
```json
{
  "success": false,
  "error": "Cannot send messages to archived conversations"
}
```

**422 Unprocessable Entity** - File too large
```json
{
  "success": false,
  "error": "File size exceeds 10MB limit"
}
```

**Note:** Messages are immutable after creation. They cannot be edited or permanently deleted.

---

### GET /inbox/messages/{message}

Get details of a specific message. Automatically marks message as read for the requesting user.

**Authentication Required:** Yes
**Authorization:** Conversation participants + Admin
**Rate Limiting:** `throttle:60,1` (60/min)

#### URL Parameters

- `message`: Message ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "conversation_id": 1,
    "sender_id": 1,
    "body": "I have a question about the medical form requirements.",
    "idempotency_key": "msg_abc123def456",
    "created_at": "2024-03-15T10:15:00.000000Z",
    "updated_at": "2024-03-15T10:15:00.000000Z",
    "sender": {
      "id": 1,
      "name": "John Smith",
      "email": "john.smith@example.com",
      "role": {
        "id": 2,
        "name": "parent"
      }
    },
    "attachments": [
      {
        "id": 5,
        "documentable_type": "App\\Models\\Message",
        "documentable_id": 1,
        "document_type": "Message Attachment",
        "file_name": "medical_form_question.pdf",
        "file_size": 156789,
        "mime_type": "application/pdf",
        "uploaded_by": 1,
        "scan_passed": true,
        "created_at": "2024-03-15T10:15:00.000000Z"
      }
    ]
  }
}
```

**Note:** This endpoint automatically marks the message as read for the requesting user. The read receipt is recorded with timestamp in the `message_reads` table.

---

### GET /inbox/messages/unread-count

Get total count of unread messages for the authenticated user across all conversations.

**Authentication Required:** Yes
**Authorization:** Any authenticated user
**Rate Limiting:** `throttle:60,1` (60/min)

#### Success Response (200 OK)

```json
{
  "success": true,
  "unread_count": 12
}
```

**Note:** Unread count includes only messages in active (non-archived) conversations where the user is an active participant.

---

### GET /inbox/messages/{message}/attachments/{document}

Download a message attachment. Enforces security checks before allowing download.

**Authentication Required:** Yes
**Authorization:** Conversation participants + Admin
**Rate Limiting:** `throttle:10,60` (10/min)

#### URL Parameters

- `message`: Message ID (integer)
- `document`: Document ID (integer)

#### Success Response (200 OK)

Returns the file as a binary stream with appropriate headers:
- `Content-Type`: Original file MIME type
- `Content-Disposition`: attachment; filename="original_filename.pdf"

#### Error Responses

**403 Forbidden** - Not a participant
```json
{
  "success": false,
  "error": "You do not have permission to access this attachment"
}
```

**404 Not Found** - Attachment not found
```json
{
  "success": false,
  "error": "Attachment not found"
}
```

**403 Forbidden** - Failed security check
```json
{
  "success": false,
  "error": "Document failed security check and cannot be downloaded"
}
```

**Note:** All attachments are scanned for malware before being allowed for download.

---

### DELETE /inbox/messages/{message}

Soft delete a message. Admin only. Message remains in database for audit purposes but is hidden from participants.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### URL Parameters

- `message`: Message ID (integer)

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

#### Error Responses

**403 Forbidden** - Not admin
```json
{
  "success": false,
  "error": "Only administrators can delete messages"
}
```

**Note:** Messages cannot be edited or permanently deleted for HIPAA compliance. Soft deletion is used for moderation purposes only.

---

## Report Endpoints

All report endpoints require admin authorization.

### GET /reports/applications

Generate applications report with filtering.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `status`: Optional, string - Filter by application status
- `camp_session_id`: Optional, integer - Filter by camp session
- `date_from`: Optional, date - Filter by submitted date (from)
- `date_to`: Optional, date - Filter by submitted date (to)

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": 1,
      "camper_name": "Emily Smith",
      "parent_name": "John Smith",
      "parent_email": "john.smith@example.com",
      "camp_name": "Summer Adventure Camp 2024",
      "session_name": "Session 1",
      "session_dates": "June 10-14, 2024",
      "status": "approved",
      "submitted_at": "2024-03-15T12:00:00.000000Z",
      "reviewed_at": "2024-03-16T09:00:00.000000Z"
    }
  ],
  "summary": {
    "total_applications": 150,
    "pending": 25,
    "under_review": 10,
    "approved": 100,
    "rejected": 10,
    "waitlisted": 5,
    "cancelled": 0
  }
}
```

---

### GET /reports/accepted

Generate list of accepted applicants.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `camp_session_id`: Optional, integer - Filter by camp session

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "camper_id": 1,
      "camper_name": "Emily Smith",
      "age": 12,
      "parent_name": "John Smith",
      "parent_email": "john.smith@example.com",
      "parent_phone": "555-0123",
      "session_name": "Session 1",
      "session_dates": "June 10-14, 2024",
      "special_needs": "None",
      "dietary_restrictions": "Vegetarian",
      "allergies_count": 1,
      "medications_count": 0
    }
  ],
  "total": 100
}
```

---

### GET /reports/rejected

Generate list of rejected applicants.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `camp_session_id`: Optional, integer - Filter by camp session

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "camper_id": 5,
      "camper_name": "Michael Johnson",
      "age": 15,
      "parent_name": "Sarah Johnson",
      "parent_email": "sarah.johnson@example.com",
      "session_name": "Session 1",
      "session_dates": "June 10-14, 2024",
      "rejection_reason": "Age requirement not met",
      "rejected_at": "2024-03-16T14:00:00.000000Z"
    }
  ],
  "total": 10
}
```

---

### GET /reports/mailing-labels

Generate mailing labels data.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `status`: Optional, string - Filter by application status
- `camp_session_id`: Optional, integer - Filter by camp session

#### Validation Rules

- `status`: Optional, string
- `camp_session_id`: Optional, must exist in camp_sessions table

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "name": "John Smith",
      "address_line_1": "123 Main Street",
      "address_line_2": "Apt 4B",
      "city": "Springfield",
      "state": "IL",
      "postal_code": "62701",
      "country": "USA"
    }
  ],
  "total": 100
}
```

---

### GET /reports/id-labels

Generate identification labels for accepted campers.

**Authentication Required:** Yes
**Authorization:** Admin only
**Rate Limiting:** `throttle:api` (60/min)

#### Query Parameters

- `camp_session_id`: Required, integer - Camp session ID

#### Validation Rules

- `camp_session_id`: Required, must exist in camp_sessions table

#### Success Response (200 OK)

```json
{
  "data": [
    {
      "camper_name": "Emily Smith",
      "age": 12,
      "cabin_number": "12",
      "session_name": "Session 1",
      "allergies": "Peanuts (life-threatening)",
      "emergency_contact": "Jane Smith - 555-0123"
    }
  ],
  "total": 50
}
```

---

## Appendix

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| admin | System administrator | Full access to all endpoints and resources |
| parent | Parent/guardian of campers | Can manage own profile, children, and applications |
| medical | Medical provider | Read-only access to medical information, emergency contacts |

### Application Status Values

| Status | Description |
|--------|-------------|
| pending | Application submitted, awaiting review |
| under_review | Application is being reviewed by staff |
| approved | Application accepted, camper admitted |
| rejected | Application declined |
| waitlisted | Application on waiting list |
| cancelled | Application cancelled by parent or admin |

### Allergy Severity Values

| Severity | Description |
|----------|-------------|
| mild | Minor reaction, minimal intervention needed |
| moderate | Noticeable reaction, may require treatment |
| severe | Serious reaction, requires immediate intervention |
| life_threatening | Anaphylaxis risk, requires emergency medical care |

### Document MIME Types

Allowed document types for upload:

- PDF: `application/pdf`
- JPEG: `image/jpeg`
- PNG: `image/png`
- GIF: `image/gif`
- DOC: `application/msword`
- DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

Maximum file size: 10 MB (10,485,760 bytes)

### Common Error Messages

| Message | Cause | Resolution |
|---------|-------|------------|
| "Authentication required." | No or invalid token | Include valid Bearer token in Authorization header |
| "Access denied." | Insufficient permissions | User lacks required role or resource ownership |
| "Resource not found." | Invalid ID or deleted resource | Verify resource ID and existence |
| "Too Many Requests" | Rate limit exceeded | Wait for rate limit reset period |
| "The given data was invalid." | Validation failed | Review validation errors in response |

### Security Considerations

1. **Token Storage**: Store API tokens securely. Never expose them in client-side code or version control.

2. **HTTPS Only**: All API requests must use HTTPS in production. HTTP requests will be rejected.

3. **Rate Limiting**: Respect rate limits to prevent account suspension. Implement exponential backoff for failed requests.

4. **PHI Data**: Medical records, allergies, and medications contain Protected Health Information (PHI). Handle with HIPAA compliance requirements.

5. **File Upload Security**: All uploaded files are automatically scanned for malware. Files with failed security checks cannot be downloaded.

6. **Provider Links**: Medical provider links are single-use, time-limited, and token-based. Tokens are hashed and cannot be retrieved after creation.

7. **MFA**: Multi-factor authentication is strongly recommended for all user accounts, especially administrators.

---

**Document Version:** 1.0
**Last Updated:** 2024-03-16
**API Version:** 1.0
