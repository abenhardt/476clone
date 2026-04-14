# System Architecture and Implementation Overview

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Engines and Runtime Environment](#2-system-engines-and-runtime-environment)
3. [Full System Architecture](#3-full-system-architecture)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Backend Implementation](#5-backend-implementation)
6. [Frontend–Backend Communication](#6-frontendbackend-communication)
7. [Example Workflow](#7-example-workflow)
8. [Questions a Professor Might Ask](#8-questions-a-professor-might-ask)
9. [One-Minute Architecture Explanation](#9-one-minute-architecture-explanation)

---

## 1. System Overview

### 1.1 What the System Does

This system is a full-stack web application designed to manage camp registration,
medical records, document handling, messaging, and administrative operations for
a residential summer camp. It supports four user roles — applicants (parents),
administrators, super administrators, and medical staff — each with a distinct
interface and access level.

The system provides:

- An applicant portal for submitting camper applications and uploading documents
- An administrative dashboard for reviewing applications, managing campers, and
  communicating with applicants
- A medical portal for recording incidents, visits, and health restrictions
- A messaging and notification system for internal communication
- A dynamic form builder for configuring application forms without code changes

### 1.2 How Users Interact with the System

Users access the system through a web browser. The browser loads the frontend
application, which presents the user interface. When a user performs an action —
such as submitting a form or uploading a file — the frontend sends an HTTP
request to the backend API. The backend processes the request, interacts with
the database, and returns a response. The frontend then updates the interface
to reflect the result.

### 1.3 High-Level Architecture Diagram

```
+---------------------------+
|        Web Browser        |
|   (User's Device)         |
+---------------------------+
             |
             | HTTPS Requests / Responses
             |
+---------------------------+
|   Frontend Application    |
|   (React, TypeScript)     |
|   Served via Vite / CDN   |
+---------------------------+
             |
             | REST API calls (JSON over HTTPS)
             |
+---------------------------+
|   Backend API             |
|   (Laravel 12, PHP 8.2)   |
+---------------------------+
             |
             | SQL Queries
             |
+---------------------------+
|   Database                |
|   (MySQL 8.0)             |
+---------------------------+
```

**Explanation:**

- The **User** opens the application in a web browser.
- The **Frontend Application** runs inside the browser and handles everything
  the user sees and interacts with.
- The **Backend API** runs on a server. It receives requests from the frontend,
  applies business rules, enforces security, and reads or writes data.
- The **Database** stores all persistent data — user accounts, camper records,
  medical information, documents, and messages.

---

## 2. System Engines and Runtime Environment

### 2.1 Frontend Runtime Engine

| Component | Engine / Tool | Description |
|---|---|---|
| JavaScript Runtime | V8 (Google Chrome Engine) | Executes all JavaScript and TypeScript code inside the browser. Every modern browser includes a JavaScript engine; Chrome and Edge use V8. |
| Build Engine | Vite 5 | Compiles TypeScript and JSX source files into optimized JavaScript bundles that the browser can load. Also powers the development server with instant hot-reload. |
| Package Manager | npm / pnpm | Manages third-party libraries and dependencies for the frontend project. |
| UI Framework | React 18 | A JavaScript library for building user interfaces using a component-based model. |
| Type System | TypeScript 5 | A superset of JavaScript that adds static type checking, improving reliability and developer tooling. |

### 2.2 Backend Runtime Engine

| Component | Engine / Tool | Description |
|---|---|---|
| Backend Runtime | PHP 8.2 | The programming language and runtime that powers the server-side application. PHP is executed by the server on every incoming request. |
| Backend Framework | Laravel 12 | A full-featured PHP framework that provides routing, middleware, ORM (Eloquent), validation, authentication, and more. |
| Development Server | PHP Built-in Server (via `php artisan serve`) | A lightweight HTTP server used during development to serve the Laravel application locally. |
| Authentication Engine | Laravel Sanctum 4.2 | Provides API token-based authentication. Tokens are issued on login and attached to every subsequent API request. |
| Database Engine | MySQL 8.0 | A relational database management system that stores all application data in structured tables with SQL query support. |
| ORM Engine | Eloquent (built into Laravel) | An Object-Relational Mapper that allows backend code to interact with the database using PHP objects rather than raw SQL. |

### 2.3 Why These Were Chosen

- **React** is the industry-leading UI framework with a large ecosystem, strong
  component model, and excellent TypeScript support.
- **Vite** was chosen over older tools like Webpack because it starts instantly
  and rebuilds in milliseconds, greatly improving developer productivity.
- **Laravel** was chosen because it provides a complete, structured backend
  framework with authentication, routing, validation, and database management
  out of the box — reducing the amount of custom infrastructure code required.
- **MySQL** is a mature, widely deployed relational database with strong support
  for structured data, transactions, and foreign key constraints.
- **TypeScript** was chosen to catch programming errors at compile time, making
  the codebase more maintainable and reducing runtime bugs.

---

## 3. Full System Architecture

### 3.1 Detailed Architecture Diagram

```
                        User (Web Browser)
                               |
                               | HTTPS
                               |
               +---------------+----------------+
               |      Frontend Application      |
               |   React + TypeScript + Vite    |
               |                                |
               |  +----------+  +-----------+  |
               |  |  Pages   |  |Components |  |
               |  +----------+  +-----------+  |
               |  +-----------+ +-----------+  |
               |  |  Routing  | |   State   |  |
               |  | (Routes)  | |  (Redux)  |  |
               |  +-----------+ +-----------+  |
               |  +---------------------------+ |
               |  |   API Layer (Axios)       | |
               +--+---------------------------+-+
                               |
                               | JSON over HTTPS (REST API)
                               |
               +---------------+----------------+
               |         Backend API            |
               |       Laravel 12 / PHP 8.2     |
               |                                |
               |  +--------+  +-------------+  |
               |  | Routes |->| Middleware  |  |
               |  +--------+  | (Auth/RBAC) |  |
               |              +------+------+  |
               |                     |          |
               |              +------v------+  |
               |              |Controllers  |  |
               |              +------+------+  |
               |                     |          |
               |  +----------+  +----v------+  |
               |  | Services |<-|  Models   |  |
               |  | (Logic)  |  | (Eloquent)|  |
               |  +----------+  +-----+-----+  |
               +----------------+-----+---------+
                                      |
                                      | SQL
                                      |
               +----------------------+----------+
               |         MySQL 8.0 Database      |
               |  Tables: users, applications,   |
               |  campers, medical_records,       |
               |  documents, conversations, ...   |
               +----------------------------------+
```

### 3.2 Layer Responsibilities

| Layer | Technology | Responsibilities |
|---|---|---|
| **Presentation Layer** | React, Tailwind CSS | Renders the user interface; handles all visual output and user input |
| **State Management** | Redux Toolkit | Maintains application-wide state (logged-in user, cached data) |
| **API Communication** | Axios | Sends HTTP requests to the backend and processes responses |
| **Routing (Frontend)** | React Router | Maps browser URLs to specific page components |
| **API Entry** | Laravel Routes | Maps incoming HTTP requests to specific controller methods |
| **Security Layer** | Laravel Sanctum, Middleware | Verifies authentication tokens; enforces role-based access control |
| **Business Logic** | Laravel Controllers + Services | Processes requests, validates input, applies rules |
| **Data Layer** | Eloquent ORM + Models | Translates between PHP objects and database tables |
| **Persistence** | MySQL 8.0 | Stores and retrieves all structured application data |

---

## 4. Frontend Implementation

### 4.1 Frontend Role

The frontend is responsible for everything the user sees and interacts with
directly. Its core responsibilities are:

1. **Rendering the user interface** — displaying pages, forms, tables, and
   dashboards appropriate for the user's role.
2. **Collecting user input** — forms for login, registration, applications,
   document uploads, and medical data entry.
3. **Communicating with the backend** — translating user actions into HTTP API
   requests and updating the interface based on the backend's responses.
4. **Managing state** — keeping track of the logged-in user, their role, form
   data in progress, and cached server responses.
5. **Enforcing routing** — ensuring that each URL displays the correct page and
   that unauthorized users cannot access protected areas.

### 4.2 Frontend Technologies

#### React 18

React is a JavaScript library for building user interfaces. The core concept
is the **component** — a self-contained unit of UI that can be composed with
other components to build complex pages. React uses a virtual DOM to efficiently
update only the parts of the page that have changed, rather than reloading the
entire page. React 18 introduces concurrent rendering, which improves
responsiveness for complex interfaces.

#### TypeScript 5 (Strict Mode)

TypeScript extends JavaScript with a static type system. Every variable,
function parameter, and API response is assigned a type. The TypeScript compiler
catches type errors before the code runs, preventing an entire category of
runtime bugs. Strict mode enables the most thorough type checking available.

#### Vite 5

Vite is a modern frontend build tool and development server. During development,
it serves files using native ES modules, which allows changes to appear in the
browser almost instantly (hot module replacement). For production, it bundles
and optimizes all files using Rollup. Vite replaced older tools such as Webpack
because of its significantly faster startup and rebuild times.

#### Tailwind CSS 3

Tailwind is a utility-first CSS framework. Rather than writing custom CSS
stylesheets, developers compose styles by applying small, single-purpose CSS
classes directly to HTML elements. All color values, spacing, and typography
are driven by CSS custom properties (design tokens), ensuring visual consistency
across the application.

#### Redux Toolkit

Redux Toolkit is the official, opinionated toolset for managing global
application state in React. It provides a centralized store that holds data
shared across many components — such as the currently authenticated user and
their permissions. The auth token is manually persisted to `localStorage` under
key `auth_token`, allowing state to survive page refreshes. The 30-minute
Sanctum token expiration on the backend enforces session timeout.

#### React Router

React Router maps URLs to page components. It enables navigation between pages
without full page reloads (single-page application behavior) and enforces
protected routes that redirect unauthenticated users to the login page.

#### i18next

i18next is an internationalization framework. All user-visible strings in the
application are stored in translation files (`en.json`, `es.json`) rather than
being written directly into components. This allows the interface to be
presented in English or Spanish without code changes.

#### Framer Motion 12

Framer Motion is an animation library for React. It provides declarative
animation variants (`pageEntry`, `staggerContainer`, `staggerChild`) used
consistently throughout the application for page transitions, list animations,
and modal reveals.

### 4.3 Frontend Architecture

#### Project Structure

```
frontend/src/
 |
 +-- core/
 |    +-- routing/          # Application route definitions and guards
 |    +-- layouts/          # Shell layouts (AdminLayout, ApplicantLayout, etc.)
 |
 +-- features/
 |    +-- auth/             # Login, logout, auth state slice
 |    |    +-- store/       # authSlice.ts (Redux)
 |    |    +-- pages/       # LoginPage.tsx
 |    |
 |    +-- admin/            # Admin-role pages and API
 |    |    +-- pages/       # Dashboard, camper management, documents
 |    |    +-- api/         # admin.api.ts
 |    |
 |    +-- medical/          # Medical staff pages and API
 |    |    +-- pages/       # Records, incidents, visits, follow-ups
 |    |    +-- api/         # medical.api.ts
 |    |
 |    +-- parent/           # Applicant (parent) pages and API
 |    |    +-- pages/       # Application form, documents, dashboard
 |    |    +-- api/         # applicant.api.ts
 |    |
 |    +-- messaging/        # Inbox, conversations
 |         +-- api/         # messaging.api.ts
 |
 +-- shared/
 |    +-- constants/        # routes.ts (URL constants), role definitions
 |    +-- hooks/            # Custom React hooks
 |    +-- types/            # Shared TypeScript interfaces
 |
 +-- ui/
 |    +-- components/       # Reusable UI components (Button, Modal, Table, etc.)
 |
 +-- assets/
      +-- styles/
           +-- design-tokens.css   # All CSS variables (colors, spacing)
```

#### Why This Structure

The **feature module** pattern groups all code related to a single domain
(admin, medical, applicant) together. This means that when a developer needs
to work on the medical portal, all relevant pages, API calls, and types are
in one location. The `shared/` and `ui/` directories hold code that is used
by more than one feature, preventing duplication. The `core/` directory holds
infrastructure code — routing and layouts — that governs how the entire
application is assembled.

### 4.4 User Interface Components

The application is built on the principle of **component-based design**:
complex pages are assembled from small, reusable building blocks.

| Component Type | Description |
|---|---|
| **Form components** | Controlled input fields, dropdowns, date pickers, and file upload zones used across all data-entry pages |
| **Table components** | Paginated, filterable data tables used on admin list pages (campers, applications, documents) |
| **Dashboard widgets** | Statistic cards and activity feeds used on admin and medical dashboards |
| **Modal components** | Overlay dialogs for confirming actions, entering data, or displaying details without navigating away |
| **Navigation menus** | Role-specific sidebars and top navigation bars that adapt based on the logged-in user's role |
| **Document upload components** | Drag-and-drop file upload zones with progress indicators |

Each component is written once and reused wherever needed. This ensures visual
and behavioral consistency and reduces the effort required to make
application-wide changes.

---

## 5. Backend Implementation

### 5.1 Backend Role

The backend is the server-side application that the frontend communicates with.
It is never seen directly by the user. Its responsibilities are:

1. **Receiving requests** — listening for HTTP requests from the frontend and
   routing them to the correct handler.
2. **Authentication** — verifying that the request includes a valid token and
   identifying which user is making the request.
3. **Authorization (RBAC)** — enforcing role-based access control to ensure
   that users can only perform actions permitted by their role.
4. **Validating input** — checking that all submitted data meets the required
   format and constraints before processing.
5. **Applying business logic** — executing the rules of the application (e.g.,
   calculating form completion status, checking document eligibility).
6. **Database interaction** — reading and writing data to the MySQL database
   via Eloquent models.
7. **Returning responses** — sending structured JSON responses back to the
   frontend with the result of the operation.

### 5.2 Backend Technologies

#### Laravel 12

Laravel is a PHP framework that provides a complete application structure
including routing, middleware, controllers, Eloquent ORM, validation, events,
queues, and more. It follows the MVC (Model–View–Controller) architectural
pattern adapted for REST APIs.

#### PHP 8.2

PHP is the server-side programming language. PHP 8.2 introduces typed class
properties, readonly classes, fibers, and improved performance. PHP runs on the
server and is never sent to the browser.

#### Laravel Sanctum 4.2

Sanctum provides token-based API authentication. When a user logs in, the
backend creates a personal access token and returns it to the frontend. The
frontend stores this token in `localStorage` (key: `auth_token`) and attaches it to the
`Authorization` header of every subsequent request. Sanctum verifies the
token on each request.

#### Eloquent ORM

Eloquent is Laravel's built-in Object-Relational Mapper. Each database table
has a corresponding PHP class called a Model. Developers interact with the
database by calling methods on these model classes rather than writing raw SQL.
Eloquent handles query building, relationships (one-to-many, many-to-many),
and casting sensitive fields (encrypted casts for PHI — Protected Health
Information).

#### MySQL 8.0

MySQL is the relational database system. Data is organized into tables with
defined columns and data types. Laravel migrations define the database schema
in PHP code, which allows the database structure to be version-controlled and
reproduced consistently across environments.

### 5.3 Backend Architecture

#### Request Lifecycle Diagram

```
Client HTTP Request
        |
        | (e.g., POST /api/applicant/documents)
        |
+-------v---------+
|   routes/api.php |   <-- Defines all API endpoints and their middleware groups
+-------+---------+
        |
        | Middleware Stack
        |
+-------v-----------+
|  auth:sanctum     |   <-- Verifies the Bearer token; rejects if invalid
+-------+-----------+
        |
+-------v-----------+
|  Role Middleware  |   <-- Confirms the user has the required role
+-------+-----------+
        |
+-------v-----------+
|  Controller       |   <-- Receives the request; delegates to services/models
|  (e.g., Document  |
|   RequestController)|
+-------+-----------+
        |
        | Uses FormRequest classes for input validation
        |
+-------v-----------+
|  FormRequest      |   <-- Validates and sanitizes incoming data
+-------+-----------+
        |
+-------v-----------+
|  Service Layer    |   <-- Complex business logic separated from the controller
|  (e.g., FormBuilderService, SystemNotificationService)
+-------+-----------+
        |
+-------v-----------+
|  Eloquent Models  |   <-- PHP classes representing database tables
+-------+-----------+
        |
        | SQL
        |
+-------v-----------+
|  MySQL Database   |   <-- Reads/writes persistent data
+-------------------+
        |
        | Eloquent result (PHP object / collection)
        |
+-------v-----------+
|  JSON Response    |   <-- Controller formats and returns the HTTP response
+-------------------+
```

#### Backend Structural Components

| Component | Location | Purpose |
|---|---|---|
| **Routes** | `routes/api.php` | Maps HTTP methods and URL paths to controller methods; applies middleware |
| **Middleware** | `app/Http/Middleware/` | Cross-cutting concerns: authentication, CORS, role checking |
| **Controllers** | `app/Http/Controllers/` | Handle requests; orchestrate services and models; return responses |
| **FormRequests** | `app/Http/Requests/` | Validate and authorize incoming request data |
| **Models** | `app/Models/` | Represent database tables; define relationships and attribute casting |
| **Services** | `app/Services/` | Encapsulate complex business logic (e.g., `FormBuilderService`) |
| **Policies** | `app/Policies/` | Define per-model authorization rules (who can view, create, update, delete) |
| **Migrations** | `database/migrations/` | Version-controlled database schema definitions |
| **Seeders** | `database/seeders/` | Populate the database with initial or test data |
| **Enums** | `app/Enums/` | Define valid states for fields (e.g., `DocumentRequestStatus`, `IncidentSeverity`) |

---

## 6. Frontend–Backend Communication

### 6.1 Communication Protocol

The frontend and backend communicate exclusively through a **REST API** using
the **HTTP/HTTPS protocol**. All data is exchanged in **JSON format**. The
frontend uses the **Axios** library to construct and send HTTP requests and to
parse responses.

Every request that requires authentication includes an `Authorization` header:

```
Authorization: Bearer <token>
```

The token is read from `localStorage` (key: `auth_token`) and injected into every request by the
centralized Axios configuration (`frontend/src/api/axios.config.ts`).

### 6.2 Data Flow Diagram

```
+---------------------+
|  User Action        |  e.g., clicks "Submit Application"
+----------+----------+
           |
           v
+----------+----------+
|  React Component    |  Calls an API function (e.g., submitApplication())
+----------+----------+
           |
           v
+----------+----------+
|  API Module         |  Constructs the HTTP request using Axios
|  (applicant.api.ts) |  POST /api/applicant/applications
+----------+----------+
           |
           | HTTPS Request (JSON body, Authorization header)
           |
           v
+----------+----------+
|  Laravel Routes     |  Matches the URL; applies middleware
+----------+----------+
           |
           v
+----------+----------+
|  Auth Middleware    |  Validates the Bearer token via Sanctum
+----------+----------+
           |
           v
+----------+----------+
|  Controller Method  |  Validates input; calls service or model
+----------+----------+
           |
           v
+----------+----------+
|  Database (MySQL)   |  INSERT / UPDATE / SELECT
+----------+----------+
           |
           | SQL Result
           |
           v
+----------+----------+
|  JSON Response      |  e.g., { "id": 42, "status": "submitted" }
|  (HTTP 200/201)     |
+----------+----------+
           |
           | HTTPS Response
           |
           v
+----------+----------+
|  React Component    |  Updates local state; re-renders the UI
+---------------------+
```

### 6.3 API Module Organization

Each feature area has a dedicated API module file that contains all the
functions the frontend uses to communicate with the backend for that feature:

| Module | File | Examples |
|---|---|---|
| Applicant | `applicant.api.ts` | `submitApplication()`, `uploadDocument()`, `getDocumentRequests()` |
| Admin | `admin.api.ts` | `listApplications()`, `approveDocument()`, `createDocumentRequest()` |
| Medical | `medical.api.ts` | `getMedicalRecord()`, `createIncident()`, `addMedication()` |
| Messaging | `messaging.api.ts` | `getConversations()`, `sendMessage()`, `markAsRead()` |
| Forms | `forms.api.ts` | `getActiveFormSchema()`, `createFormSection()`, `publishFormDefinition()` |

---

## 7. Example Workflow

### 7.1 User Login

This walkthrough demonstrates what happens when a user submits the login form.

**Step 1 — User Action (Frontend)**
The user enters their email and password into the login form and clicks
"Sign In". The `LoginPage` React component captures this input.

**Step 2 — API Request (Frontend)**
The frontend calls `login({ email, password })` from the auth API module.
Axios sends a `POST` request to `/api/login` with the credentials as a JSON
body. No `Authorization` header is included because the user does not yet
have a token.

**Step 3 — Route and Middleware (Backend)**
Laravel's router matches `POST /api/login` to `AuthController::login()`.
This route does not require the `auth:sanctum` middleware because it is the
login endpoint itself.

**Step 4 — Validation and Authentication (Backend)**
The controller validates that the email and password are present. It then
queries the `users` table to find a matching user and verifies the password
against the stored bcrypt hash. If the credentials are invalid, a `401
Unauthorized` response is returned.

**Step 5 — Token Issuance (Backend)**
If credentials are valid, Sanctum creates a new personal access token for
the user and stores it in the `personal_access_tokens` table. The controller
returns a JSON response containing the token and the user's role.

**Step 6 — State Update (Frontend)**
The frontend receives the token and user object. The Redux auth slice stores
the user's information in the global state. The token is written to `localStorage`
under key `auth_token`. Axios is configured to attach the token to all future
requests. React Router redirects the user to their role-appropriate dashboard.

```
User submits login form
        |
        v
POST /api/login  (email + password)
        |
        v
AuthController validates credentials
        |
        v
Sanctum issues token --> stored in personal_access_tokens table
        |
        v
Response: { token, user, role }
        |
        v
Redux stores user in state; token written to localStorage (auth_token)
        |
        v
User is redirected to dashboard
```

### 7.2 Document Upload by Applicant

**Step 1 (Frontend):** The applicant selects a file using the document upload
component and clicks "Upload". The component calls `uploadDocumentRequest(id, file)`
from the applicant API module.

**Step 2 (Frontend):** Axios sends a `POST` request to
`/api/applicant/document-requests/{id}/upload` with the file as a
`multipart/form-data` body and the `Authorization: Bearer <token>` header.

**Step 3 (Backend):** Sanctum validates the token. The router directs the
request to `DocumentRequestController::applicantUpload()`.

**Step 4 (Backend):** The controller verifies that this document request belongs
to the authenticated applicant (authorization check via Policy). It then stores
the file and updates the `document_requests` table record with the new status
(`uploaded`) and the file path.

**Step 5 (Backend):** The `SystemNotificationService` creates or appends to an
inbox thread notifying the applicant that their upload was received.

**Step 6 (Frontend):** The frontend receives a `200 OK` response and re-fetches
the document list, updating the UI to show the new status.

---

## 8. Common Technical Questions

**Q: What frontend framework was used?**
React 18 with TypeScript 5 in strict mode. React was chosen for its
component model, large ecosystem, and excellent TypeScript integration.

**Q: What backend framework was used?**
Laravel 12 (PHP 8.2). Laravel provides routing, authentication, validation,
an ORM, and middleware out of the box, which accelerated development of a
secure REST API.

**Q: What engines power the system?**
The frontend is powered by the V8 JavaScript engine (inside the browser) and
built with Vite 5. The backend is powered by the PHP 8.2 runtime. Data is
stored in MySQL 8.0, queried through the Eloquent ORM.

**Q: How are components structured?**
The frontend follows a feature module architecture: each domain (admin,
medical, applicant) has its own folder containing its pages, API functions,
and types. Shared UI components live in a dedicated `ui/` directory. The
backend is structured as controllers, services, models, and policies,
following the MVC pattern.

**Q: How does the frontend communicate with the backend?**
Through a REST API over HTTPS. The frontend uses Axios to send JSON requests
with a Bearer token in the `Authorization` header. The backend uses Laravel
Sanctum to validate the token on every protected request.

**Q: How is authentication handled?**
On login, the backend issues a personal access token via Laravel Sanctum.
The frontend stores this token in `localStorage` (key: `auth_token`) and attaches it to every
API request. The backend validates the token on every protected endpoint.

**Q: How is role-based access control enforced?**
On the backend, each API route specifies which roles are permitted via
middleware. Laravel Policies further restrict which specific records a user
can view or modify. On the frontend, React Router guards redirect unauthorized
users to a login or error page before any component renders.

**Q: How is sensitive medical data protected?**
Fields classified as Protected Health Information (PHI) are stored using
Laravel's `encrypted` cast, which encrypts the value before writing to the
database and decrypts it when reading. All traffic uses HTTPS to prevent
interception in transit.

**Q: Why was Vite chosen over Webpack?**
Vite uses native ES modules for development serving, which eliminates the
bundle step during development. This results in near-instant server startup
and sub-millisecond hot reloads, significantly improving developer productivity
compared to Webpack-based toolchains.

**Q: How is the database schema managed?**
Database tables are defined using Laravel migrations — PHP files that describe
schema changes. Migrations are version-controlled alongside the application
code and can be run with `php artisan migrate` to reproduce the schema on any
environment.

---

## 9. One-Minute Architecture Explanation

> This section provides a concise, spoken-style explanation suitable for
> directly answering "Explain how your system works."

---

The system is a full-stack web application with a clear separation between
a browser-based frontend and a server-side backend API.

The **frontend** is built with React and TypeScript and runs entirely inside
the user's browser. It is compiled from source code by Vite into a set of
optimized JavaScript files. When a user opens the application, the browser
downloads these files and React constructs the interface. Redux manages
global state — such as who is logged in — and React Router handles navigation
between pages. When the user takes an action, the frontend sends an HTTP
request to the backend using Axios.

The **backend** is built with Laravel 12 on PHP 8.2 and runs on a server.
It exposes a REST API — a set of URL endpoints that the frontend calls.
Every request passes through middleware that verifies the user's identity
using a token issued by Laravel Sanctum. Controllers receive the request,
validate the input, and apply business rules. Eloquent models translate
between PHP objects and the MySQL database, where all data is stored
persistently.

The two halves of the system communicate exclusively through HTTP requests
and JSON responses — the frontend never touches the database directly, and
the backend never generates HTML for the browser. This separation makes the
system modular: the frontend and backend can be developed, tested, and
deployed independently.

In short: the user sees React, React talks to Laravel, Laravel talks to
MySQL, and MySQL stores everything.

---


