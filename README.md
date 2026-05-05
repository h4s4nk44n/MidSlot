# MediSlot

**Medical appointment scheduling platform** — A full-featured backend API for managing doctor–patient appointments, time slots, healthcare provider profiles, in-person clinical sessions, and patient medical records.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Data Model](#data-model)
- [Setup Instructions](#setup-instructions)
- [Running the Application](#running-the-application)
- [Run with Docker](#run-with-docker)
- [Smoke Test](#smoke-test)
- [API Documentation](#api-documentation)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Profile Endpoints](#profile-endpoints)
  - [Time Slot Endpoints](#time-slot-endpoints)
  - [Appointment Endpoints](#appointment-endpoints)
  - [Doctor Endpoints](#doctor-endpoints)
  - [Doctor – Patient & Session Endpoints](#doctor--patient--session-endpoints)
  - [Receptionist Endpoints](#receptionist-endpoints)
  - [Admin Endpoints](#admin-endpoints)
  - [Department Endpoints](#department-endpoints)
  - [Health Check Endpoint](#health-check-endpoint)
- [Security & Hardening](#security--hardening)
- [Environment Variables](#environment-variables)
- [Seed Data & Test Accounts](#seed-data--test-accounts)
- [Development Tips](#development-tips)
- [Team Members](#team-members)

---

## Project Overview

MediSlot is a backend API that streamlines medical appointment scheduling for an entire clinic. It allows:

- **Patients** to browse doctors by specialization, book/cancel appointments, and maintain a rich medical profile (allergies, chronic conditions, medications, blood type, insurance, emergency contact, …)
- **Doctors** to manage their availability, see today's roster, run an in-person session lifecycle (`start → end`), record clinical notes during the session window, and update patient medical fields
- **Receptionists** to book/cancel/manage appointments on behalf of patients for the doctors they are assigned to, search patients by name/email, and request verified profile changes via SMS code
- **Admins** to manage users (CRUD, activate/deactivate, role transitions), curate the department dictionary, manage receptionist assignments, browse the immutable audit log, and edit user profiles directly or via the verified change flow
- **Operators** to monitor liveness via `/api/health` and run the included end-to-end smoke test

The platform is built as a RESTful API with TypeScript, Express 5, Prisma 6, and PostgreSQL, hardened with helmet, CORS, rate-limiting, refresh-token rotation, account lockout, structured logging, and an immutable audit trail.

### Key Features

- ✅ User authentication with short-lived access JWT + rotating refresh-token cookie (HttpOnly, SameSite, single-use, family chain)
- ✅ `/auth/verify` lightweight non-rotating endpoint for frontend Edge middleware
- ✅ Account lockout after 5 failed logins (15 min cooldown, `423` + `Retry-After`)
- ✅ Role-based access control (Admin / Doctor / Receptionist / Patient) with route-level `authorize()` guards
- ✅ Time slot management with overlap detection (Serializable transaction)
- ✅ Atomic appointment booking — `updateMany(isBooked: false → true)` + unique `Appointment.timeSlotId` to prevent double-booking under load
- ✅ Receptionist on-behalf workflow: book / cancel / manage slots only for assigned doctors
- ✅ Doctor in-person session lifecycle: `startedAt` / `endedAt`, clinical notes editable only inside `[start, end + 10 min]`
- ✅ Auto-cancellation sweep: `BOOKED` flips to `CANCELLED` if the doctor never opens a session within 1 h after the slot's `endTime`
- ✅ Staff-initiated profile changes verified by 6-digit SMS-style code (bcrypt-hashed, single-use, max 5 attempts, stale-payload protection)
- ✅ Rich patient medical profile (phone, address, emergency contact, blood type, allergies, chronic conditions, current medications, insurance, national ID)
- ✅ Curated **Department** dictionary with admin CRUD
- ✅ Doctor profile fields: title, specialization, bio, gender, date of birth (used for patient filters)
- ✅ Admin role lifecycle: grant / revoke / transfer; founder admin cannot be demoted
- ✅ Immutable **AuditLog** with founder-only actor-email visibility, redacted secrets, indexed queries
- ✅ Helmet (HSTS in prod, safe defaults), strict CORS allow-list with safe-method bypass for no-Origin requests, JSON body size limit (10 KB)
- ✅ Per-route rate limiting (auth: 5 / 15 min, API: 100 / 15 min, staff bypass)
- ✅ Structured logging with **pino** + **pino-http** (request ID, redacted secrets, correct level by status code)
- ✅ Trust-proxy aware (real client IP behind reverse proxy / CDN)
- ✅ Next.js 15 frontend with role-scoped dashboards
- ✅ Docker Compose for one-command local setup; multi-stage backend image with non-root runtime user and built-in healthcheck
- ✅ Automated `scripts/smoke.sh` end-to-end test

---

## Tech Stack

| Layer            | Technology              | Version    |
| ---------------- | ----------------------- | ---------- |
| **Runtime**      | Node.js                 | >= 20      |
| **Language**     | TypeScript              | ^5.9       |
| **Framework**    | Express.js              | ^5.2       |
| **ORM**          | Prisma                  | ^6.19      |
| **Database**     | PostgreSQL              | 16         |
| **Auth**         | jsonwebtoken            | ^9.0       |
| **Hashing**      | bcrypt                  | ^6.0       |
| **Validation**   | Zod                     | ^4.3       |
| **Security**     | helmet, cors, express-rate-limit, cookie-parser | latest |
| **Logging**      | pino, pino-http, pino-pretty | ^10 / ^11 / ^13 |
| **Testing**      | Jest + supertest        | ^30 / ^7   |
| **Lint/Format**  | ESLint, Prettier        | ^9 / ^3    |
| **Frontend**     | Next.js (App Router) + Tailwind v4 | 15 |

---

## Architecture

### Design Rationale

**Express 5 + Prisma + PostgreSQL** was chosen for the following reasons:

1. **Express.js 5** — lightweight, async-aware, industry standard; excellent middleware ecosystem (helmet, cors, rate-limit, cookie-parser).
2. **Prisma** — type-safe ORM with first-class TypeScript integration, declarative migrations, and Serializable-isolation transactions that we lean on heavily for slot overlap and atomic booking.
3. **PostgreSQL 16** — robust ACID guarantees, partial/composite indexes, JSONB metadata for the audit log.
4. **JWT access + rotating refresh-cookie** — short-lived bearer for API calls, long-lived HttpOnly cookie for session continuity, family chain for replay detection.

### Folder Structure

```
backend/
├── src/
│   ├── controllers/        # Thin HTTP handlers, delegate to services
│   ├── routes/             # Endpoint definitions per resource
│   ├── services/           # Business logic, transactions, audit emission
│   ├── middlewares/        # auth, authorize, validate, rate-limit, error, requestLogger
│   ├── validators/         # Zod schemas (auth)
│   ├── validations/        # Zod schemas (per-resource: slot, appointment, admin, audit, doctor, profile, receptionist, department)
│   ├── utils/              # AppError classes, token helpers, audit helpers
│   ├── types/              # TypeScript types
│   ├── lib/                # Prisma client, logger, env assertion
│   ├── generated/          # Auto-generated Prisma client
│   ├── __tests__/          # Jest tests (auth, audit, refresh, lockout, pagination, schema)
│   └── index.ts            # App bootstrap (helmet, cors, parsers, routes, error handler)
├── prisma/
│   ├── schema.prisma       # Data model
│   ├── seed.ts             # Idempotent seed with prod guard
│   └── migrations/         # Migration history
├── scripts/
│   └── smoke.sh            # End-to-end docker compose smoke test
├── Dockerfile              # Multi-stage build, non-root, healthcheck
├── jest.config.ts / jest.setup.ts
└── eslint.config.mjs
```

### Separation of Concerns

- **Controllers** — parse request, validate via Zod, delegate to services, return JSON.
- **Services** — business logic, Prisma calls, transactions, audit log emission.
- **Middlewares** — `authenticate` (JWT), `authorize(...roles)`, `validate(schema)`, `apiLimiter` / `authLimiter`, `requestLogger`, central `errorHandler`.
- **Validators / validations** — Zod schemas; password complexity rules, ISO date parsing, page/pageSize bounds, etc.
- **Utils** — typed `AppError` subclasses (BadRequest, Unauthorized, Forbidden, NotFound, Conflict, Locked, …), refresh-token helpers, audit helpers.

---

## Data Model

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o| Doctor                        : "1:1 (optional)"
    User ||--o{ Appointment                   : "patient"
    User ||--o{ RefreshToken                  : "owns"
    User ||--o{ AuditLog                      : "actor"
    User ||--o{ ReceptionistAssignment        : "receptionist"
    User ||--o{ ReceptionistAssignment        : "assignedBy"
    User ||--o{ VerificationCode              : "target"
    User ||--o{ VerificationCode              : "requester"

    Doctor ||--o{ TimeSlot                    : "owns"
    Doctor ||--o{ Appointment                 : "treats"
    Doctor ||--o{ ReceptionistAssignment      : "covered by"

    TimeSlot ||--o| Appointment               : "1:1 booking"

    User {
        uuid       id PK
        string     email           "unique"
        string     password        "bcrypt hash"
        string     name
        Role       role            "ADMIN|DOCTOR|RECEPTIONIST|PATIENT"
        int        loginAttempts
        datetime   lockedUntil
        boolean    isActive
        boolean    isFounder       "founder admin protection"
        string     phone
        datetime   dateOfBirth
        Gender     gender          "MALE|FEMALE|OTHER|UNDISCLOSED"
        string     address
        string     city
        string     country
        string     emergencyContactName
        string     emergencyContactPhone
        string     emergencyContactRelation
        BloodType  bloodType       "A_POS..O_NEG|UNKNOWN"
        string     allergies
        string     chronicConditions
        string     currentMedications
        string     nationalId      "unique nullable"
        string     insuranceProvider
        string     insurancePolicyNumber
        datetime   createdAt
        datetime   updatedAt
    }

    Doctor {
        uuid     id PK
        uuid     userId FK "unique"
        string   title          "Dr.|Prof. Dr.|..."
        string   specialization "free text"
        string   bio
        datetime dateOfBirth
        Gender   gender
    }

    TimeSlot {
        uuid     id PK
        uuid     doctorId FK
        datetime date
        datetime startTime
        datetime endTime
        boolean  isBooked      "atomic claim flag"
        datetime createdAt
    }

    Appointment {
        uuid              id PK
        uuid              patientId FK
        uuid              doctorId FK
        uuid              timeSlotId FK "unique 1:1"
        AppointmentStatus status        "BOOKED|CANCELLED|COMPLETED"
        string            notes         "patient note at booking"
        string            doctorNote    "clinical, window-gated"
        datetime          startedAt     "session opened"
        datetime          endedAt       "session closed -> COMPLETED"
        datetime          createdAt
        datetime          updatedAt
    }

    ReceptionistAssignment {
        uuid     id PK
        uuid     receptionistId FK
        uuid     doctorId FK
        uuid     assignedByUserId FK
        datetime assignedAt
    }

    RefreshToken {
        uuid     id PK
        uuid     userId FK
        string   tokenHash      "unique bcrypt hash"
        string   familyId       "rotation chain"
        datetime issuedAt
        datetime expiresAt
        datetime revokedAt
        uuid     replacedById   "unique, next in chain"
        string   userAgent
        string   ip
    }

    Department {
        uuid     id PK
        string   name           "unique"
        datetime createdAt
    }

    VerificationCode {
        uuid     id PK
        uuid     targetUserId FK
        uuid     requesterId FK
        string   purpose        "profile_edit_by_doctor|...receptionist"
        string   codeHash       "bcrypt 6-digit code"
        json     payload        "pending changes"
        datetime targetUpdatedAtSnapshot "stale-payload check"
        int      attempts
        int      maxAttempts    "default 5"
        datetime expiresAt
        datetime consumedAt     "single-use marker"
    }

    AuditLog {
        uuid     id PK
        uuid     actorId FK     "nullable, SetNull"
        string   action         "login.success|appointment.book|..."
        string   targetType
        string   targetId
        json     metadata       "secrets redacted"
        string   ip
        string   userAgent
        datetime createdAt
    }
```

> The `Department` table is a curated dictionary used by frontend pickers. It is intentionally **not** a foreign key from `Doctor.specialization` — deleting a department leaves existing doctors untouched.

### System Architecture

```mermaid
flowchart LR
    subgraph Client
        Browser[Next.js 15<br/>App Router]
    end

    subgraph Edge["Express 5"]
        direction TB
        Helmet[helmet<br/>HSTS / CSP]
        CORS[CORS allow-list<br/>credentials: true]
        BodyLimit[10 KB body limit]
        Cookies[cookie-parser]
        RL[rate-limiters<br/>auth: 5/15min<br/>api: 100/15min]
        Logger[pino-http<br/>request ID]
        Auth[authenticate<br/>JWT Bearer]
        RBAC[authorize&#40;...roles&#41;]
        Validate[Zod validate]
        Routes[Route handlers]
        ErrorHandler[central errorHandler<br/>Prisma + AppError mapping]
    end

    subgraph Domain
        Services[Services<br/>auth · slot · appointment ·<br/>doctor · receptionist · admin ·<br/>profile · profile-change · audit]
        AuditEmit[Audit emitter<br/>redacted metadata]
    end

    subgraph Data
        Prisma[(Prisma Client<br/>Serializable txns<br/>updateMany atomic claim)]
        Postgres[(PostgreSQL 16)]
    end

    Browser -->|Bearer token + refresh cookie| Helmet
    Helmet --> CORS --> BodyLimit --> Cookies --> RL --> Logger --> Auth --> RBAC --> Validate --> Routes
    Routes --> Services
    Services --> Prisma
    Services --> AuditEmit
    AuditEmit --> Prisma
    Prisma <--> Postgres
    Routes -.->|errors| ErrorHandler
    Services -.->|throws AppError / Prisma err| ErrorHandler
    ErrorHandler -->|JSON body| Browser
```

### Auth & Refresh-Token Rotation Flow

```mermaid
sequenceDiagram
    autonumber
    participant C  as Client (Next.js)
    participant API as Express API
    participant DB  as PostgreSQL

    C->>API: POST /auth/login {email, password}
    API->>DB: findUser + bcrypt.compare
    alt credentials OK
        API->>DB: insert RefreshToken (tokenHash, familyId)
        API-->>C: 200 {token: accessJWT}<br/>Set-Cookie: refreshToken (HttpOnly)
    else 5th failure
        API->>DB: User.lockedUntil = now + 15min
        API-->>C: 423 Locked + Retry-After
    end

    Note over C,API: Later — access token near expiry

    C->>API: POST /auth/refresh<br/>Cookie: refreshToken
    API->>DB: lookup tokenHash<br/>check revokedAt, expiresAt
    alt valid
        API->>DB: revoke old + insert new<br/>(replacedById chain, same familyId)
        API-->>C: 200 {token: newAccessJWT}<br/>Set-Cookie: refreshToken (rotated)
    else replay / unknown / expired
        API-->>C: 401 + clear cookie
    end

    C->>API: POST /auth/logout (cookie)
    API->>DB: delete RefreshToken
    API-->>C: 204 + clear cookie
```

### Appointment Booking — Race-Safe Path

```mermaid
sequenceDiagram
    autonumber
    participant P1 as Patient A
    participant P2 as Patient B
    participant API as Express API
    participant DB  as PostgreSQL

    par Concurrent booking attempts on the same slot
        P1->>API: POST /appointments {timeSlotId}
        P2->>API: POST /appointments {timeSlotId}
    end

    API->>DB: updateMany TimeSlot set isBooked true where isBooked false
    Note over DB: Only one updateMany affects a row.<br/>The other returns count 0.
    API->>DB: insert Appointment with unique timeSlotId

    alt Winner
        DB-->>API: 1 row updated, insert OK
        API->>DB: AuditLog appointment.book
        API-->>P1: 201 Created
    else Loser
        DB-->>API: 0 rows updated OR P2002 unique violation
        API-->>P2: 409 Slot already booked
    end
```

### Enums

- `Role` — `DOCTOR | PATIENT | ADMIN | RECEPTIONIST`
- `AppointmentStatus` — `BOOKED | CANCELLED | COMPLETED`
- `Gender` — `MALE | FEMALE | OTHER | UNDISCLOSED`
- `BloodType` — `A_POSITIVE | A_NEGATIVE | B_POSITIVE | B_NEGATIVE | AB_POSITIVE | AB_NEGATIVE | O_POSITIVE | O_NEGATIVE | UNKNOWN`

### Models

#### **User**
Represents all users (Admin / Doctor / Receptionist / Patient). Includes the patient medical profile (nullable on non-patient roles, harmless on others).

| Field                       | Type        | Description                                                  |
| --------------------------- | ----------- | ------------------------------------------------------------ |
| `id`                        | UUID        | Primary key                                                  |
| `email`                     | String      | Unique email address                                         |
| `password`                  | String      | Bcrypt hash                                                  |
| `name`                      | String      | Full name                                                    |
| `role`                      | Enum        | `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT` (indexed)       |
| `loginAttempts`             | Int         | Consecutive failed logins (default 0)                        |
| `lockedUntil`               | DateTime?   | Lockout expiry (null = unlocked)                             |
| `isActive`                  | Boolean     | Soft-disable flag (indexed, default `true`)                  |
| `isFounder`                 | Boolean     | True for the seeded founder admin; cannot be demoted         |
| `phone`                     | String?     | Contact phone (E.164 recommended)                            |
| `dateOfBirth`               | DateTime?   | Patient DOB                                                  |
| `gender`                    | Enum        | `MALE / FEMALE / OTHER / UNDISCLOSED` (default UNDISCLOSED)  |
| `address`, `city`, `country`| String?     | Postal address                                               |
| `emergencyContactName/Phone/Relation` | String? | Emergency contact                                       |
| `bloodType`                 | Enum        | `A_POSITIVE … O_NEGATIVE / UNKNOWN` (default UNKNOWN)        |
| `allergies`                 | String?     | Free text                                                    |
| `chronicConditions`         | String?     | Free text                                                    |
| `currentMedications`        | String?     | Free text                                                    |
| `nationalId`                | String?     | Unique nullable — no two patients share                      |
| `insuranceProvider`         | String?     | Insurance provider                                           |
| `insurancePolicyNumber`     | String?     | Policy number                                                |
| `createdAt` / `updatedAt`   | DateTime    | Timestamps                                                   |

#### **Doctor**
Extended profile for doctor users.

| Field            | Type      | Description                                            |
| ---------------- | --------- | ------------------------------------------------------ |
| `id`             | UUID      | Primary key                                            |
| `userId`         | UUID      | FK to User (1:1, `onDelete: Cascade`)                  |
| `title`          | String?   | e.g. `Prof. Dr.`, `Assoc. Prof. Dr.`, `Dr.`            |
| `specialization` | String?   | Free-text (kept free so deleting a Department doesn't orphan rows) |
| `bio`            | String?   | Professional biography                                 |
| `dateOfBirth`    | DateTime? | Used to compute age for patient-facing filters         |
| `gender`         | Enum      | Default `UNDISCLOSED`; patient filter excludes UNDISCLOSED unless "Any gender" is selected (indexed) |

#### **TimeSlot**

| Field      | Type     | Description                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `id`       | UUID     | Primary key                                             |
| `doctorId` | UUID     | FK to Doctor (`onDelete: Cascade`)                      |
| `date`     | DateTime | Day the slot belongs to                                 |
| `startTime`| DateTime | Slot start                                              |
| `endTime`  | DateTime | Slot end (must be `> startTime`)                        |
| `isBooked` | Boolean  | Atomic claim flag — flipped during booking              |
| `createdAt`| DateTime | Creation timestamp                                      |

**Constraints / behavior**
- Duration: **15 min – 4 h**
- Cannot create or update slots in the past
- Slot creation/update runs in a Serializable transaction to prevent overlapping slots for the same doctor
- Booked slots cannot be edited or deleted (cancel the appointment first)

Indexes: `doctorId`, `date`, `(doctorId, date)`.

#### **Appointment**

| Field        | Type      | Description                                                            |
| ------------ | --------- | ---------------------------------------------------------------------- |
| `id`         | UUID      | Primary key                                                            |
| `patientId`  | UUID      | FK to User (PATIENT)                                                   |
| `doctorId`   | UUID      | FK to Doctor                                                           |
| `timeSlotId` | UUID      | **Unique** FK to TimeSlot (1:1, `onDelete: Cascade`)                   |
| `status`     | Enum      | `BOOKED`, `CANCELLED`, `COMPLETED`                                     |
| `notes`      | String?   | Patient-supplied note at booking                                       |
| `doctorNote` | String?   | Doctor's clinical note. Editable only inside `[startedAt, endedAt+10 min]`. Visible to admin/reception and the patient |
| `startedAt`  | DateTime? | Set when doctor opens the in-person session                            |
| `endedAt`    | DateTime? | Set when doctor closes the session — also flips status to `COMPLETED`  |
| `createdAt` / `updatedAt` | DateTime | Timestamps                                                |

**Auto-cancel rule:** If `startedAt` is still null **1 hour after** `slot.endTime`, the appointment is flipped to `CANCELLED` on the next debounced sweep (≤ 1 / minute, triggered from `GET /appointments/me`).

#### **ReceptionistAssignment**
Maps a receptionist user to a doctor they can act on behalf of.

| Field              | Type     | Description                                  |
| ------------------ | -------- | -------------------------------------------- |
| `id`               | UUID     | Primary key                                  |
| `receptionistId`   | UUID     | FK to User (RECEPTIONIST)                    |
| `doctorId`         | UUID     | FK to Doctor                                 |
| `assignedByUserId` | UUID     | FK to User (admin who assigned)              |
| `assignedAt`       | DateTime | Assignment creation timestamp                |

**Unique constraint:** `(receptionistId, doctorId)` — one assignment per pair.

#### **RefreshToken**
Persisted refresh tokens for the rotating-cookie auth flow.

| Field          | Type      | Description                                                       |
| -------------- | --------- | ----------------------------------------------------------------- |
| `id`           | UUID      | Primary key                                                       |
| `userId`       | UUID      | FK to User (`onDelete: Cascade`)                                  |
| `tokenHash`    | String    | **Unique** bcrypt hash of the raw token (raw token never stored)  |
| `familyId`     | String    | Rotation chain identifier (replay detection)                      |
| `issuedAt`     | DateTime  | When the token was issued                                         |
| `expiresAt`    | DateTime  | TTL (default 7 d)                                                 |
| `revokedAt`    | DateTime? | Soft-revocation timestamp                                         |
| `replacedById` | UUID?     | Unique — points to the next token in the rotation chain           |
| `userAgent`    | String?   | Client UA (truncated to 500 chars)                                |
| `ip`           | String?   | Client IP                                                         |

#### **Department**
Curated dictionary of hospital departments / specializations.

| Field      | Type     | Description                  |
| ---------- | -------- | ---------------------------- |
| `id`       | UUID     | Primary key                  |
| `name`     | String   | **Unique** department name   |
| `createdAt`| DateTime | Creation timestamp           |

`Doctor.specialization` is intentionally a free string so deleting a Department does not orphan existing doctors; this table is the source of truth for pickers/filters.

#### **VerificationCode**
One-time verification codes used by the staff-initiated profile-change flow.

| Field                    | Type      | Description                                                |
| ------------------------ | --------- | ---------------------------------------------------------- |
| `id`                     | UUID      | Primary key                                                |
| `targetUserId`           | UUID      | The patient whose profile will be modified (SMS recipient) |
| `requesterId`            | UUID      | The staff member who initiated the change                  |
| `purpose`                | String    | `profile_edit_by_receptionist` \| `profile_edit_by_doctor` |
| `codeHash`               | String    | Bcrypt hash of the 6-digit code                            |
| `payload`                | JSON      | Pending change-set, applied verbatim on verify             |
| `targetUpdatedAtSnapshot`| DateTime? | `User.updatedAt` at issue time — used to reject stale payloads |
| `attempts`               | Int       | Default `0`                                                |
| `maxAttempts`            | Int       | Default `5`                                                |
| `expiresAt`              | DateTime  | Code TTL                                                   |
| `consumedAt`             | DateTime? | Marks code as used (single-use)                            |

#### **AuditLog**
Immutable log of significant actions for compliance.

| Field        | Type     | Description                                          |
| ------------ | -------- | ---------------------------------------------------- |
| `id`         | UUID     | Primary key                                          |
| `actorId`    | UUID?    | User who performed the action (`SetNull` on delete)  |
| `action`     | String   | Action code (e.g. `login.success`, `appointment.book`, `slot.create`, `user.role_change`, `assignment.add` …) |
| `targetType` | String?  | Resource type (e.g. `Appointment`, `TimeSlot`, `User`) |
| `targetId`   | String?  | ID of the affected resource                          |
| `metadata`   | JSON?    | Extra context (before/after, reason). Secrets redacted |
| `ip`         | String?  | Client IP                                            |
| `userAgent`  | String?  | Client UA (truncated to 500 chars)                   |
| `createdAt`  | DateTime | Event timestamp                                      |

Indexes optimize the common queries: `(actorId, createdAt)`, `(action, createdAt)`, `(targetType, targetId)`, `createdAt`.

---

## Setup Instructions

### Prerequisites

- **Node.js** >= 20 (download from [nodejs.org](https://nodejs.org))
- **PostgreSQL** 14+ (we run 16 in Docker; download from [postgresql.org](https://www.postgresql.org))
- **npm** package manager
- **Git** for cloning the repository

### Step 1: Clone the Repository

```bash
git clone https://github.com/h4s4nk44n/MidSlot.git
cd MidSlot/MidSlot
```

### Step 2: Install Dependencies

The repo is split into `backend/` (Express API) and `frontend/` (Next.js).
Install each subproject's dependencies:

```bash
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 3: Configure Environment Variables

Each subproject has its own `.env`:

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
```

Then edit `backend/.env`. The example file ships with placeholder secrets — **change them**:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/midslot?schema=public"

# JWT — generate with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_SECRET=<at least 32 chars>
JWT_EXPIRES_IN=1h

# Refresh token — separate secret recommended
REFRESH_TOKEN_SECRET=<at least 32 chars>
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:5173
```

See [Environment Variables](#environment-variables) for the full list (including `TRUST_PROXY`, `CLINIC_TIMEZONE`, `DISABLE_RATE_LIMIT`).

### Step 4: Create & Configure PostgreSQL Database

```bash
psql -U postgres
CREATE DATABASE midslot;
\q
```

### Step 5: Generate Prisma Client

```bash
cd backend
npm run prisma:generate
```

### Step 6: Run Database Migrations

```bash
npm run prisma:migrate
```

This creates all tables, indexes and constraints.

### Step 7: Seed the Database (Optional but Recommended)

```bash
npx prisma db seed
```

The seed script is idempotent (skips when users already exist) and refuses to run in `NODE_ENV=production` unless `SEED_PRODUCTION=true` is set explicitly. Passwords come from `SEED_ADMIN_PASSWORD` / `SEED_USER_PASSWORD` env vars (with safe development defaults). It creates:

- **20** departments (Cardiology, Dermatology, Endocrinology, ENT, Family Medicine, Gastroenterology, General Practice, General Surgery, Gynecology, Internal Medicine, Neurology, Obstetrics, Oncology, Ophthalmology, Orthopedics, Pediatrics, Psychiatry, Pulmonology, Radiology, Urology)
- **1** founder admin
- **3** receptionists (one is intentionally unassigned)
- **18** doctors across all specializations (3 main + 15 additional)
- **8** patients (3 main + 5 additional)
- **3** receptionist→doctor assignments
- **15** time slots (mix of past, today, and future)
- **5** appointments (past completed, past cancelled, today booked, future booked)

See [Seed Data & Test Accounts](#seed-data--test-accounts) for credentials.

---

## Running the Application

### Development Mode (with auto-reload)

```bash
cd backend
npm run dev
```

The server starts on `http://localhost:3000` with hot-reload via nodemon.

### Production Build

```bash
cd backend
npm run build      # tsc → dist/
npm start          # node dist/index.js
```

### Verification

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

### Frontend (Next.js)

The web app lives in [`frontend/`](./frontend) — Next.js 15 App Router, Tailwind CSS v4, "Clinical Quiet" design system.

```bash
cd frontend
cp .env.example .env.local         # set NEXT_PUBLIC_API_URL=http://localhost:3000/api
npm install
npm run dev                        # http://localhost:3001
# or: npm run build && npm start
```

**Pages by role:**

| Role          | Pages |
|---------------|-------|
| Patient       | `/patient/doctors`, `/patient/doctors/[id]`, `/patient/appointments`, `/patient/profile` |
| Doctor        | `/doctor` (dashboard), `/doctor/appointments`, `/doctor/availability`, `/doctor/patients`, session views |
| Receptionist  | `/reception` (pick doctor), `/reception/doctors/[id]` (slots), `/reception/book` (3-step booking), `/reception/appointments`, `/reception/users` |
| Admin         | `/admin` (users + assignments + departments + audit) |

---

## Run with Docker

The repo ships a three-service `docker-compose.yml` that runs **postgres**, **backend** (Express API) and **frontend** (Next.js) on a private `medi` network. One command boots the whole stack.

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 24+ (or Docker Desktop) with the Compose v2 plugin (`docker compose version` should print).
- ~2 GB free disk for images.
- Ports **3000** (backend) and **3001** (frontend) free on the host.

### 1. Clone & enter the repo

```bash
git clone https://github.com/h4s4nk44n/MidSlot.git
cd MidSlot
```

### 2. Create your env file

```bash
cp .env.example .env
```

Then **edit `.env`** — at minimum set a real `JWT_SECRET` (generate with
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).
Defaults work for everything else on a local machine.

### 3. Build & start

```bash
docker compose up --build
```

First run takes a few minutes (npm installs + Next build). Subsequent runs reuse cached layers. Add `-d` to run detached.

When the stack is healthy:
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000/api
- **Health probe:** http://localhost:3000/api/health

The backend container runs `prisma migrate deploy` automatically on every start, so the schema is always in sync with `backend/prisma/migrations/`. The seed runs automatically inside the container entrypoint as well — it is idempotent and skips when data already exists.

### 4. Common commands

```bash
docker compose logs -f backend          # tail backend logs
docker compose logs -f frontend         # tail frontend logs
docker compose ps                       # service status + health
docker compose restart backend          # restart a single service
docker compose down                     # stop containers (data preserved)
docker compose down -v                  # stop + WIPE the postgres volume
```

### Changing ports

Edit `.env`:

```
BACKEND_HOST_PORT=4000      # publish backend on host port 4000
FRONTEND_HOST_PORT=4001     # publish frontend on host port 4001
NEXT_PUBLIC_API_URL=http://localhost:4000/api   # MUST match BACKEND_HOST_PORT
```

> ⚠️ `NEXT_PUBLIC_API_URL` is **baked into the frontend bundle at build time**.
> If you change it you must rebuild: `docker compose build frontend`.

### Changing DB credentials

Edit `.env`:

```
POSTGRES_USER=midslot
POSTGRES_PASSWORD=a-strong-password
POSTGRES_DB=midslot_prod
```

Then **wipe the volume** (the existing one was initialised with the old credentials and will not pick up the change):

```bash
docker compose down -v
docker compose up --build
```

To expose Postgres on the host (e.g. for `psql` or a GUI), set `POSTGRES_HOST_PORT` in `.env` and uncomment the `ports:` block in `docker-compose.yml` under the `postgres` service.

### Container hardening

The backend `Dockerfile` is a multi-stage build:
1. **deps** — install dev+prod deps
2. **builder** — compile TypeScript, generate Prisma client, compile seed
3. **runtime** — production deps only, runs as the unprivileged `app` user
4. Built-in `HEALTHCHECK` hits `/api/health` every 10 s

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `port is already allocated` | Something else is using 3000/3001. Set `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` in `.env`. |
| `JWT_SECRET must be set and at least 32 chars` (backend exits) | You didn't set `JWT_SECRET` in `.env`. Generate one and rebuild. |
| Frontend loads but every API call fails with CORS / 0-status | `NEXT_PUBLIC_API_URL` doesn't match the backend's host port, or `ALLOWED_ORIGINS` doesn't include the frontend origin. Update `.env` and `docker compose build frontend`. |
| Backend stuck on "waiting for postgres" | Postgres healthcheck is still failing. `docker compose logs postgres` for details; usually a stale volume — `docker compose down -v` and retry. |
| Schema drift / Prisma errors after pulling new code | Migrations didn't run. `docker compose restart backend` and watch logs. |

### Local (non-Docker) development

If you'd rather run things bare-metal:

```bash
cd backend  && cp .env.example .env  && npm install && npm run dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

You'll need a Postgres running on `localhost:5432` with a database matching `DATABASE_URL` in `backend/.env`.

---

## Smoke Test

An automated smoke test verifies the full stack end-to-end via docker compose.

**Prerequisites:** `docker`, `curl`, `jq`

```bash
chmod +x backend/scripts/smoke.sh
./backend/scripts/smoke.sh
```

The script:
1. Runs `docker compose up --build`
2. Polls `/api/health` until the API is ready (90 s timeout)
3. Logs in as the seeded admin and captures an access token
4. Calls `GET /admin/users` and asserts a non-empty user list
5. Calls `GET /doctors` and `GET /appointments/me`
6. Always tears down with `docker compose down -v` on exit

Exit code `0` = all steps passed. Each step prints `[PASS]` / `[FAIL]`.

---

## API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

Most endpoints (except `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/verify`, `/auth/logout`, `/health`, `/slots` (GET) and `/departments` (GET)) require JWT authentication. Include the access token in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

The refresh token is delivered/rotated as an **HttpOnly, SameSite, Secure-in-prod cookie** named `refreshToken` and is automatically read by `/auth/refresh`, `/auth/verify` and `/auth/logout` when the client sends `credentials: "include"`.

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

Validation errors include `issues` with field-level details. The error handler also maps Prisma errors: `P2002 → 409`, `P2025 → 404`, `P2003 → 400`.

---

## Authentication Endpoints

### POST `/auth/register`

Register a new user account (doctor or patient). **Rate-limited** to 5 / 15 min per IP.

**Auth:** Public

**Request Body:**

```json
{
  "email": "ali.vural@example.com",
  "name": "Ali Vural",
  "password": "SecurePassword123",
  "role": "PATIENT"
}
```

**Fields:**
- `email` (string, required) — valid email
- `name` (string, required)
- `password` (string, required) — min 8 chars; at least one upper, one lower, one digit; cannot be a common password; cannot contain your name or email
- `role` (string, required) — `"PATIENT"` or `"DOCTOR"`

**Response (201 Created):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "ali.vural@example.com",
  "name": "Ali Vural",
  "role": "PATIENT",
  "createdAt": "2026-03-30T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Error                    | Cause                    |
| ------ | ------------------------ | ------------------------ |
| 400    | Invalid input            | Missing/malformed fields |
| 409    | Email already registered | Email already in use     |
| 429    | Too many requests        | Rate limit hit           |

---

### POST `/auth/login`

Authenticate and receive a short-lived access JWT. The refresh token is set as an HttpOnly cookie and is **never returned in the response body**.

**Auth:** Public · **Rate-limited:** 5 / 15 min per IP

**Account Lockout:** After 5 consecutive failed login attempts, the account is locked for 15 minutes. A locked account returns `423 Locked` with a `Retry-After` header — the same status is returned even if a subsequent request carries the correct password.

**Request Body:**

```json
{ "email": "ali.vural@example.com", "password": "SecurePassword123" }
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ali.vural@example.com",
    "name": "Ali Vural",
    "role": "PATIENT",
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
}
```

A `refreshToken` cookie is set on the response.

**Audit:** `login.success`, `login.failure`, and `login.locked` events are recorded with email, IP, user-agent. Sensitive fields are never persisted.

**Error Responses:**

| Status | Error                       | Cause                          |
| ------ | --------------------------- | ------------------------------ |
| 400    | Invalid input               | Missing/malformed fields       |
| 401    | Invalid email or password   | Wrong credentials              |
| 423    | Account temporarily locked  | Too many failed attempts       |
| 429    | Too many requests           | Rate limit hit                 |

---

### POST `/auth/refresh`

Rotate the refresh token and receive a new access token. The refresh token is read from the `refreshToken` HttpOnly cookie set by `/auth/login`.

**Auth:** Cookie (`refreshToken`)

**Response (200 OK):** same shape as `/auth/login`. A new `refreshToken` cookie is set on every successful call (single-use rotation; the old token is marked revoked and chained via `replacedById`). On failure the cookie is cleared and `401` is returned.

**Error Responses:**

| Status | Error                       | Cause                             |
| ------ | --------------------------- | --------------------------------- |
| 401    | Refresh token missing       | Cookie absent                     |
| 401    | Invalid or expired token    | Token revoked, expired, or forged |

---

### POST `/auth/verify`

Lightweight, **non-rotating** verification of the refresh cookie. Used by the frontend Edge middleware to confirm the cookie is real and learn the user's role before serving role-shell UI. Calling `/auth/verify` on every navigation is safe and idempotent.

**Auth:** Cookie (`refreshToken`)

**Response (200 OK):**

```json
{ "user": { "id": "uuid", "role": "PATIENT" } }
```

**Errors:** `401` if cookie missing, unknown, revoked, or expired.

---

### POST `/auth/logout`

Revoke the current refresh token and clear the cookie.

**Auth:** Cookie (`refreshToken`) — no access token required

**Response (204 No Content):** empty body. The server deletes the refresh token from the database (even if the cookie is missing/expired) and clears the cookie on the response.

---

### GET `/auth/me`

Get the current authenticated user's profile.

**Auth:** Authenticated (all roles)

**Response (200 OK):** patient response example

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "ali.vural@example.com",
  "name": "Ali Vural",
  "role": "PATIENT",
  "createdAt": "2026-03-30T10:00:00.000Z",
  "doctor": null
}
```

For doctors, `doctor` is populated with **only safe fields** (no PHI):

```json
{
  "doctor": {
    "id": "uuid",
    "title": "Dr.",
    "specialization": "Cardiology",
    "bio": "Board-certified cardiologist..."
  }
}
```

**Errors:** `401` invalid/expired token · `404` user deleted after login.

---

## Profile Endpoints

### GET `/profile`

Return the authenticated user's full profile (including patient medical fields).

**Auth:** Authenticated

### PATCH `/profile`

Update the authenticated user's own profile (name, phone, address, emergency contact, blood type, allergies, chronic conditions, current medications, insurance, …). Validated by Zod; sensitive fields like role/email/password are not editable here.

**Auth:** Authenticated · **Body:** partial profile JSON

**Errors:** `400` invalid input · `401` unauthenticated.

---

## Time Slot Endpoints

### GET `/slots`

Get paginated available (unbooked) time slots. Supports filtering by doctor, specialization, and date/range.

**Auth:** Public

**Query Parameters:**

| Parameter        | Type         | Default | Description |
| ---------------- | ------------ | ------- | ----------- |
| `page`           | int          | `1`     | Page number (>= 1) |
| `pageSize`       | int          | `20`    | Items per page (1–100) |
| `doctorId`       | uuid         | —       | Filter by doctor id |
| `specialization` | string       | —       | Exact-match specialization filter |
| `date`           | ISO date     | —       | Single-day filter (takes precedence over from/to) |
| `from`           | ISO datetime | —       | Start of range (inclusive) |
| `to`             | ISO datetime | —       | End of range (exclusive) |

**Response (200 OK):**

```json
{
  "items": [
    {
      "id": "uuid",
      "doctorId": "uuid",
      "date": "2026-04-02T00:00:00.000Z",
      "startTime": "2026-04-02T09:00:00.000Z",
      "endTime": "2026-04-02T10:00:00.000Z",
      "isBooked": false,
      "doctor": {
        "specialization": "Cardiology",
        "user": { "name": "Dr. Ayşe Yılmaz", "email": "ayse.yilmaz@medislot.com" }
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 47,
  "totalPages": 3
}
```

---

### POST `/slots`

Create a new time slot. Runs in a Serializable transaction to detect overlap.

**Auth:** Doctor

**Body:** `{ "date": "2026-04-05", "startTime": "...Z", "endTime": "...Z" }`

**Constraints:** duration 15 min – 4 h, not in the past, no overlap on the same day.

**Errors:** `400` invalid input · `401/403` unauthenticated/forbidden · `404` doctor profile not found · `409` overlapping slot.

---

### PUT `/slots/:id`

Update an existing **unbooked** slot. Booked slots cannot be modified — cancel the appointment first.

**Auth:** Doctor · **Errors:** same as `POST /slots` plus `404` if slot not found.

---

### DELETE `/slots/:id`

Delete an unbooked slot owned by the doctor.

**Auth:** Doctor · **Errors:** `403` not owner · `404` not found · `409` slot is booked.

---

## Appointment Endpoints

### POST `/appointments`

Book a new appointment. Booking is **atomic**: the slot is claimed via `updateMany(isBooked: false → true)` and a unique `Appointment.timeSlotId` constraint guarantees only one winner under concurrency.

**Auth:** Patient (self-booking) or Receptionist (on behalf — see receptionist section)

**Body:**

```json
{
  "timeSlotId": "uuid",
  "notes": "I have been experiencing chest pain for the past week."
}
```

For receptionists, `patientId` is also required and the receptionist must be assigned to the slot's doctor.

**Response (201):** appointment object with `status: "BOOKED"`. An audit entry `appointment.book` is emitted.

**Errors:** `400` invalid input or slot already booked / in the past · `403` receptionist not assigned · `404` slot or patient not found.

---

### GET `/appointments/me`

Paginated list of appointments scoped to the caller:

- **PATIENT** — their own appointments
- **DOCTOR** — appointments assigned to them
- **RECEPTIONIST** — appointments for doctors they are assigned to
- **ADMIN** — all appointments

Triggers the debounced auto-cancel sweep (≤ 1 / minute) that flips stale `BOOKED` appointments to `CANCELLED`.

**Auth:** Authenticated

**Query Parameters:**

| Parameter  | Type         | Default | Description |
| ---------- | ------------ | ------- | ----------- |
| `page`     | int          | `1`     | Page number |
| `pageSize` | int          | `20`    | Items per page (1–100) |
| `status`   | enum         | —       | `BOOKED` \| `CANCELLED` \| `COMPLETED` |
| `from`     | ISO datetime | —       | Slots starting on/after this time |
| `to`       | ISO datetime | —       | Slots starting before this time |

---

### PATCH `/appointments/:id/cancel`

Cancel a booked appointment. The corresponding `TimeSlot.isBooked` is set back to `false` in the same transaction.

**Auth:** Authenticated — caller must be the patient, the doctor, or a receptionist assigned to that doctor.

**Errors:** `403` not authorised · `404` not found · `409` already in terminal state.

---

### PATCH `/appointments/:id/complete`

Mark an appointment as completed. Only callable once `slot.endTime` has passed.

**Auth:** Doctor (must own the appointment) or Receptionist assigned to that doctor.

**Errors:** `400` slot end time hasn't passed · `403` wrong role / not assigned · `404` not found · `409` already terminal.

> Note: in normal flow a doctor will end the in-person session via `POST /doctor/appointments/:id/end`, which also flips status to `COMPLETED`. `PATCH /appointments/:id/complete` is the back-office equivalent.

---

## Doctor Endpoints

### GET `/doctors`

Paginated doctor list with optional name search, specialization filter and patient-side demographic filters.

**Auth:** Authenticated

| Parameter        | Type         | Default | Description |
| ---------------- | ------------ | ------- | ----------- |
| `page`           | int          | `1`     | Page number |
| `pageSize`       | int          | `20`    | 1–100 |
| `q`              | string       | —       | Name partial match (case-insensitive) |
| `specialization` | string       | —       | Exact match |
| `title`          | string       | —       | Exact title match (e.g. `Prof. Dr.`) |
| `gender`         | enum         | —       | `MALE / FEMALE / OTHER` (UNDISCLOSED hidden unless caller passes "any") |
| `ageMin`         | int          | —       | Minimum age (uses `Doctor.dateOfBirth`) |
| `ageMax`         | int          | —       | Maximum age |

**Response (200 OK):** paginated list with `{ id, title, specialization, user: { id, name, email } }`.

---

### GET `/doctors/:id`

Get a specific doctor's full profile (including bio, title, gender, dateOfBirth).

**Auth:** Authenticated · **Errors:** `404` not found.

---

### GET `/doctors/:id/slots`

Get **available** future time slots for a specific doctor (ordered chronologically). Optional `?date=YYYY-MM-DD` filter.

**Auth:** Authenticated.

---

### GET `/doctors/dashboard`

Doctor's dashboard with appointment analytics.

**Auth:** Doctor only

**Response (200 OK):**

```json
{
  "upcomingAppointments": [ /* next 10 booked future appts incl. patient + timeSlot */ ],
  "todaySlots":           [ /* today's slots */ ],
  "stats": {
    "totalAppointments": 10,
    "completedAppointments": 7,
    "cancelledAppointments": 1,
    "availableSlots": 5
  }
}
```

---

## Doctor – Patient & Session Endpoints

All endpoints below live under `/api/doctor/*` and require `DOCTOR` role.

### GET `/doctor/patients`
Patients with active/booked appointments with the calling doctor.

### GET `/doctor/patients/:id/profile`
Full patient profile (contact, demographics, medical history) — limited to patients the doctor has a treatment relationship with.

### PATCH `/doctor/patients/:id/profile/medical`
Doctor updates patient medical fields (`allergies`, `chronicConditions`, `currentMedications`). Audited.

### Profile-change verification flow (doctor-initiated)

For sensitive non-medical edits (e.g. address, phone, emergency contact) the doctor must first **request a one-time code** that the patient receives via SMS, and then **verify** it before the change is applied:

- **POST `/doctor/patients/:id/profile-changes/request`**
  Body: pending change-set. Generates a 6-digit code (bcrypt-hashed in DB), records `targetUpdatedAtSnapshot`, and "sends" it to the patient. Audited.
- **POST `/doctor/profile-changes/:requestId/verify`**
  Body: `{ "code": "123456" }`. Increments `attempts`; rejects after `maxAttempts` (5) or expiry; rejects if patient profile was modified since issue (stale payload). Applies the change atomically and marks the code consumed.

### Session lifecycle (in-person visit)

| Endpoint                                       | Verb  | What it does                                                              |
| ---------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| `/doctor/appointments/:id/session`             | GET   | Returns session state (`startedAt`, `endedAt`, `doctorNote`, status)      |
| `/doctor/appointments/:id/start`               | POST  | Doctor opens session — sets `startedAt`. Required before clinical notes.  |
| `/doctor/appointments/:id/end`                 | POST  | Doctor closes session — sets `endedAt` and flips status to `COMPLETED`.   |
| `/doctor/appointments/:id/note`                | PUT   | Write/edit `doctorNote`. **Server-gated to `[startedAt, endedAt + 10 min]`.** |
| `/doctor/appointments/:id/session/patient`     | PATCH | Update patient profile fields while session is open                       |

The auto-cancel rule uses these timestamps: if `startedAt` is null **1 hour after** `slot.endTime`, the appointment flips to `CANCELLED`.

---

## Receptionist Endpoints

All endpoints below require `Authorization: Bearer <token>` with a `RECEPTIONIST` role.

### Patient & user search

| Endpoint                                    | Verb  | Description |
| ------------------------------------------- | ----- | ----------- |
| `/receptionist/patients`                    | GET   | Patient typeahead — `?search=<min 2 chars>&limit=<≤25>`, case-insensitive on name/email |
| `/receptionist/users`                       | GET   | Broader user list (e.g. for admin-like browsing) |
| `/receptionist/users/:id`                   | GET   | Detail for a single user |

### Profile-change verification flow (receptionist-initiated)

| Endpoint                                                            | Verb  | Description |
| ------------------------------------------------------------------- | ----- | ----------- |
| `/receptionist/users/:id/profile-changes/request`                   | POST  | Stage a profile change set, send 6-digit code to patient |
| `/receptionist/profile-changes/:requestId/verify`                   | POST  | Verify the code and apply the staged changes (single-use, max 5 attempts, stale-payload rejected) |

### Doctor management

| Endpoint                                                         | Verb   | Description |
| ---------------------------------------------------------------- | ------ | ----------- |
| `/receptionist/doctors`                                          | GET    | Doctors the receptionist is assigned to |
| `/receptionist/doctors/:doctorId/slots`                          | GET    | All slots for an assigned doctor (booked **and** available) |
| `/receptionist/doctors/:doctorId/slots`                          | POST   | Create slot for assigned doctor (`startTime`, `endTime`) |
| `/receptionist/doctors/:doctorId/appointments`                   | GET    | Appointments for an assigned doctor |
| `/receptionist/slots/:slotId`                                    | DELETE | Delete unbooked slot (403 if not assigned, 409 if booked) |

### Appointments on behalf

| Endpoint                                          | Verb   | Description |
| ------------------------------------------------- | ------ | ----------- |
| `/receptionist/appointments`                      | GET    | Paginated, filterable list across all assigned doctors (`page`, `pageSize`, `status`, `doctorId`, `date`) |
| `/receptionist/appointments`                      | POST   | Book an appointment on behalf of a patient (must be assigned to the doctor; `patientId`, `timeSlotId`, optional `notes`) |
| `/receptionist/appointments/:id/cancel`           | PATCH  | Cancel an appointment for an assigned doctor |

---

## Admin Endpoints

All endpoints below require `Authorization: Bearer <token>` with an `ADMIN` role.

### User management

| Endpoint                                | Verb   | Description |
| --------------------------------------- | ------ | ----------- |
| `/admin/users`                          | GET    | Paginated users — `?role`, `?q` (name/email partial), `?active`, `?page`, `?pageSize` |
| `/admin/users/:id`                      | GET    | Full user detail |
| `/admin/users/:id`                      | PATCH  | Edit fields (role, isActive, doctor sub-fields). Emits separate audit entries per logical change |
| `/admin/users/:id`                      | DELETE | Delete user (audited) |
| `/admin/users/:id/profile`              | PATCH  | Edit user profile directly **or** initiate the staff verification-code flow |

### Admin-role lifecycle (founder admin protected)

| Endpoint                                        | Verb | Description |
| ----------------------------------------------- | ---- | ----------- |
| `/admin/users/:id/admin/grant`                  | POST | Promote user to ADMIN |
| `/admin/users/:id/admin/revoke`                 | POST | Demote ADMIN → PATIENT (cannot revoke founder) |
| `/admin/users/:id/admin/transfer`               | POST | Hand admin role to target; current admin → PATIENT |

### Receptionist assignments

| Endpoint                            | Verb   | Description |
| ----------------------------------- | ------ | ----------- |
| `/admin/assignments`                | GET    | All receptionist→doctor assignments |
| `/admin/assignments`                | POST   | Create assignment (`receptionistId`, `doctorId`) |
| `/admin/assignments/:id`            | DELETE | Remove assignment |

### Audit log

#### GET `/admin/audit`

Read-only audit log viewer.

| Parameter    | Type     | Description                                  |
| ------------ | -------- | -------------------------------------------- |
| `page`       | int      | Default 1                                    |
| `pageSize`   | int      | Default 20, max 100                          |
| `action`     | string   | e.g. `login.success`, `appointment.book`     |
| `actorId`    | uuid     | Filter by user who performed the action      |
| `targetType` | string   | e.g. `Appointment`, `User`, `TimeSlot`       |
| `targetId`   | string   | Filter by target id                          |
| `from`       | ISO 8601 | Lower bound on `createdAt` (inclusive)       |
| `to`         | ISO 8601 | Upper bound on `createdAt` (exclusive)       |

**Response (200 OK):** paginated `{ data, meta }`. Sensitive metadata (passwords, tokens) is automatically redacted before storage; founder admins see actor email/name in full while non-founder admins see a redacted view.

---

## Department Endpoints

### GET `/departments`
List the curated specialization dictionary used by pickers/filters.
**Auth:** Public.

### POST `/departments`
Create a new department (`{ "name": "Neurology" }`).
**Auth:** Admin · **Errors:** `409` duplicate name.

### DELETE `/departments/:id`
Remove a department. Existing `Doctor.specialization` strings are kept untouched (it's a dictionary, not a foreign key).
**Auth:** Admin · **Errors:** `404` not found.

---

## Health Check Endpoint

### GET `/health`

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

Public liveness probe — used by Docker `HEALTHCHECK` and the smoke test. Does not query the database; if you need a deeper readiness probe, use `prisma migrate deploy` exit code from the entrypoint or a dedicated readiness endpoint.

---

## Security & Hardening

| Concern             | Implementation |
| ------------------- | -------------- |
| **Transport hdrs**  | `helmet` defaults; HSTS (1 y, includeSubDomains, preload) when `NODE_ENV=production` |
| **CORS**            | Strict allow-list from `ALLOWED_ORIGINS`; `credentials: true`; refuses no-Origin requests for state-changing methods (POST/PUT/PATCH/DELETE) |
| **Body limits**     | `express.json({ limit: "10kb" })`, `urlencoded({ limit: "10kb" })` — payload-DoS protection |
| **Cookie**          | `refreshToken` is HttpOnly, SameSite=Lax, Secure in prod; never returned in body |
| **JWT**             | Short-lived access token (default `1h`), separate `REFRESH_TOKEN_SECRET` recommended; `assertRequiredEnv()` enforces `JWT_SECRET` ≥ 32 chars at boot |
| **Refresh rotation**| Single-use, family chain via `replacedById`; revocation is soft (`revokedAt`); `/auth/verify` is intentionally non-rotating |
| **Account lockout** | 5 failed attempts → 15 min lock; same `423` returned even on subsequent correct password (prevents lock-state oracle) |
| **Rate limiting**   | `authLimiter` 5/15 min on `/auth/login` & `/auth/register`; global `apiLimiter` 100/15 min (skips `/health` and ADMIN/RECEPTIONIST staff); custom 429 with `Retry-After`; bypassable via `DISABLE_RATE_LIMIT=true` for tests |
| **Trust proxy**     | `app.set("trust proxy", TRUST_PROXY ?? 1)` so `req.ip`, rate-limit keys, and audit IPs reflect the real client behind a reverse proxy |
| **Password policy** | Min 8 chars, upper+lower+digit, no common passwords, must not contain name/email |
| **RBAC**            | Per-route `authorize(...roles)` middleware; role-aware scoping in services |
| **Slot integrity**  | Serializable transactions for create/update; one transaction aborts cleanly on overlap |
| **Booking integrity** | `updateMany(isBooked: false → true)` + unique `Appointment.timeSlotId` — no double booking |
| **Audit log**       | Immutable append-only; secrets redacted; founder-only actor visibility for sensitive log views |
| **Logging**         | `pino` + `pino-http` with request ID, level mapped from status code (5xx = error, 4xx = warn) |
| **Container**       | Multi-stage build, non-root `app` user, built-in healthcheck |
| **Seed**            | Idempotent; refuses prod unless `SEED_PRODUCTION=true`; never prints plaintext passwords |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable                  | Required | Default              | Description |
| ------------------------- | -------- | -------------------- | ----------- |
| `PORT`                    | no       | `3000`               | Backend listen port |
| `NODE_ENV`                | no       | `development`        | `development` / `production` (toggles HSTS & error verbosity) |
| `DATABASE_URL`            | **yes**  | —                    | PostgreSQL connection string |
| `JWT_SECRET`              | **yes**  | —                    | ≥ 32 chars; enforced at boot |
| `JWT_EXPIRES_IN`          | no       | `1h`                 | Access-token TTL |
| `REFRESH_TOKEN_SECRET`    | no       | falls back to `JWT_SECRET` | Use a separate secret in prod |
| `REFRESH_TOKEN_EXPIRES_IN`| no       | `7d`                 | Refresh-token TTL |
| `ALLOWED_ORIGINS`         | no       | `http://localhost:3001,http://localhost:5173` | Comma-separated CORS allow-list |
| `TRUST_PROXY`             | no       | `1`                  | `app.set("trust proxy", …)` value (number or pattern) |
| `DISABLE_RATE_LIMIT`      | no       | unset                | Set to `true` to skip rate-limiters in tests |
| `CLINIC_TIMEZONE`         | no       | runtime tz           | IANA timezone for "today" checks (e.g. `Europe/Istanbul`) |
| `SEED_PRODUCTION`         | no       | unset                | Must be `true` to seed in `NODE_ENV=production` |
| `SEED_ADMIN_PASSWORD`     | no       | dev default          | Override admin seed password |
| `SEED_USER_PASSWORD`      | no       | dev default          | Override seed password for non-admin users |

### Root (`./.env` — Docker Compose only)

| Variable                | Default                       | Description |
| ----------------------- | ----------------------------- | ----------- |
| `POSTGRES_USER`         | `postgres`                    | Bundled Postgres user |
| `POSTGRES_PASSWORD`     | `postgres`                    | Bundled Postgres password |
| `POSTGRES_DB`           | `midslot`                     | Bundled DB name |
| `POSTGRES_HOST_PORT`    | (commented)                   | Optional host port for Postgres |
| `BACKEND_HOST_PORT`     | `3000`                        | Host port to publish backend on |
| `FRONTEND_HOST_PORT`    | `3001`                        | Host port to publish frontend on |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:3000/api`   | **Baked into the frontend bundle at build time** |
| `JWT_ACCESS_TTL`        | `1h`                          | Access TTL (compose sets `JWT_EXPIRES_IN`) |
| `JWT_REFRESH_TTL`       | `7d`                          | Refresh TTL |
| `CLINIC_TIMEZONE`       | `Europe/Istanbul`             | IANA timezone |

---

## Seed Data & Test Accounts

Run inside the backend folder (or via `docker compose exec backend npx prisma db seed`):

```bash
npx prisma db seed
```

Idempotent — will skip if data already exists. In production it requires `SEED_PRODUCTION=true` plus explicit `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD`.

### Founder Admin

| Email                | Password              | Name                  |
| -------------------- | --------------------- | --------------------- |
| `admin@medislot.com` | `Admin@MediSlot2026!` | System Administrator  |

> **Security note:** the founder admin is marked `isFounder=true` and **cannot be demoted** by other admins (it can only be transferred via `/admin/users/:id/admin/transfer`). Change the password immediately in any non-development environment.

### Receptionists (3)

| Email                      | Password       | Name           | Assigned Doctors                                              |
| -------------------------- | -------------- | -------------- | ------------------------------------------------------------- |
| `fatma.celik@medislot.com` | `Password123!` | Fatma Çelik    | Dr. Ayşe Yılmaz (Cardiology), Dr. Mehmet Kaya (Dermatology)  |
| `emre.sahin@medislot.com`  | `Password123!` | Emre Şahin     | Dr. Zeynep Demir (Family Medicine)                            |
| `burcu.ozturk@medislot.com`| `Password123!` | Burcu Öztürk   | (intentionally unassigned — useful for testing 403 paths)     |

### Doctors (18)

All doctors share the same password (`Password123!` by default, or `SEED_USER_PASSWORD` if provided) and have populated `title`, `gender`, `dateOfBirth`, `bio`, plus full address / emergency-contact / blood-type / national-ID fields.

| Email                          | Name           | Title              | Specialization        | Gender | City     |
| ------------------------------ | -------------- | ------------------ | --------------------- | ------ | -------- |
| `ayse.yilmaz@medislot.com`     | Ayşe Yılmaz    | Prof. Dr.          | Cardiology            | F      | Istanbul |
| `mehmet.kaya@medislot.com`     | Mehmet Kaya    | Assoc. Prof. Dr.   | Dermatology           | M      | Ankara   |
| `zeynep.demir@medislot.com`    | Zeynep Demir   | Specialist Dr.     | Family Medicine       | F      | Izmir    |
| `selim.korkmaz@medislot.com`   | Selim Korkmaz  | Prof. Dr.          | Endocrinology         | M      | Istanbul |
| `pinar.aydin@medislot.com`     | Pinar Aydin    | Assoc. Prof. Dr.   | ENT (Otolaryngology)  | F      | Istanbul |
| `murat.dogan@medislot.com`     | Murat Dogan    | Specialist Dr.     | Gastroenterology      | M      | Ankara   |
| `elif.senturk@medislot.com`    | Elif Senturk   | Assoc. Prof. Dr.   | Gynecology            | F      | Izmir    |
| `burak.kilic@medislot.com`     | Burak Kilic    | Prof. Dr.          | Internal Medicine     | M      | Antalya  |
| `hande.aksoy@medislot.com`     | Hande Aksoy    | Assoc. Prof. Dr.   | Neurology             | F      | Ankara   |
| `cem.tekin@medislot.com`       | Cem Tekin      | Prof. Dr.          | Oncology              | M      | Istanbul |
| `sevda.polat@medislot.com`     | Sevda Polat    | Specialist Dr.     | Ophthalmology         | F      | Izmir    |
| `onur.erdem@medislot.com`      | Onur Erdem     | Assoc. Prof. Dr.   | Orthopedics           | M      | Ankara   |
| `gizem.cetin@medislot.com`     | Gizem Cetin    | Specialist Dr.     | Pediatrics            | F      | Istanbul |
| `tolga.bozkurt@medislot.com`   | Tolga Bozkurt  | Assoc. Prof. Dr.   | Psychiatry            | M      | Izmir    |
| `ece.yildiz@medislot.com`      | Ece Yildiz     | Specialist Dr.     | Pulmonology           | F      | Ankara   |
| `baris.acar@medislot.com`      | Baris Acar     | Assoc. Prof. Dr.   | Radiology             | M      | Istanbul |
| `nazli.karaca@medislot.com`    | Nazli Karaca   | Specialist Dr.     | Urology               | F      | Izmir    |
| `ozan.simsek@medislot.com`     | Ozan Simsek    | Prof. Dr.          | General Surgery       | M      | Istanbul |

> The Department dictionary contains a few specializations (e.g. Obstetrics, General Practice) for which no doctor is currently seeded — useful for testing empty-result UI states.

### Patients (8)

All patients share the same password (`Password123!` by default). Each has a populated medical profile (blood type, allergies, chronic conditions, current medications, insurance) so the doctor patient-detail and session views render with realistic data.

| Email                        | Name           | Gender | DOB        | Blood | Allergies       | Chronic Conditions | Current Medications          | Insurance        |
| ---------------------------- | -------------- | ------ | ---------- | ----- | --------------- | ------------------ | ---------------------------- | ---------------- |
| `ali.vural@example.com`      | Ali Vural      | M      | 1990-06-12 | A+    | Penicillin      | Mild asthma        | Salbutamol inhaler as needed | SGK              |
| `can.ozkan@example.com`      | Can Ozkan      | M      | 1985-11-30 | O−    | —               | Type 2 diabetes    | Metformin 500mg, twice daily | Allianz          |
| `deniz.arslan@example.com`   | Deniz Arslan   | F      | 1998-03-08 | B+    | Pollen, peanuts | —                  | —                            | Anadolu Sigorta  |
| `berna.aktas@example.com`    | Berna Aktas    | F      | 1991-04-21 | A−    | Sulfa drugs     | Hypothyroidism     | Levothyroxine 75mcg daily    | Axa Sigorta      |
| `tugce.kose@example.com`     | Tugce Kose     | F      | 1996-09-14 | O+    | —               | —                  | —                            | SGK              |
| `hakan.aslan@example.com`    | Hakan Aslan    | M      | 1978-12-05 | B+    | Latex           | Hypertension       | Amlodipine 5mg daily         | Allianz          |
| `yusuf.gunes@example.com`    | Yusuf Gunes    | M      | 2001-05-18 | AB+   | —               | —                  | —                            | SGK              |
| `irem.tan@example.com`       | Irem Tan       | F      | 1987-08-02 | O−    | Shellfish       | Migraine           | Sumatriptan as needed        | Anadolu Sigorta  |

### Other seeded data

- **20 Departments** — full Turkish-clinic specialization dictionary
- **3 Receptionist→Doctor assignments**
- **15 Time slots** — past (completed/cancelled), today (booked/available), future (booked/available)
- **5 Appointments** — covers all status transitions (2 completed, 1 cancelled, 1 booked-today, 1 booked-future)

### Testing Workflow

1. **Login as a seeded user**

   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -c cookies.txt \
     -d '{"email":"ali.vural@example.com","password":"Password123!"}'
   ```

   Save `token` from the response and the `refreshToken` cookie (jar) for `/auth/refresh`.

2. **Browse available slots**

   ```bash
   curl "http://localhost:3000/api/slots?specialization=Cardiology"
   ```

3. **Book an appointment**

   ```bash
   curl -X POST http://localhost:3000/api/appointments \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"timeSlotId":"SOME_SLOT_ID","notes":"I am experiencing headaches"}'
   ```

4. **Refresh the access token**

   ```bash
   curl -X POST http://localhost:3000/api/auth/refresh -b cookies.txt -c cookies.txt
   ```

---

## Development Tips

### Running Tests

```bash
cd backend
npm run test:setup        # apply migrations to .env.test database
npm test                  # jest --runInBand --forceExit
npm run test:reset        # wipe & re-create test DB
```

Test files live in `backend/src/__tests__/`:
- `auth.lockout.test.ts` — login lockout / 423 behaviour
- `auth.rateLimit.test.ts` — 429 + `Retry-After` headers
- `auth.refreshFlow.test.ts` — rotation, replay detection
- `audit.flow.test.ts`, `audit.helper.test.ts` — audit emission & redaction
- `pagination.test.ts` — common pagination contract
- `schema.test.ts` — Prisma schema sanity

Tests load `.env.test` via `dotenv-cli` and run with `DISABLE_RATE_LIMIT=true` where appropriate.

### Code Quality

```bash
npm run lint
npm run lint:fix
npm run format
```

### Database Management

```bash
npm run prisma:generate                # regenerate client after schema edit
npm run prisma:migrate                 # create + apply a new migration in dev
npx prisma migrate deploy              # apply pending migrations (production)
npx prisma migrate reset               # ⚠ wipe & re-apply (deletes data)
npx prisma studio                      # GUI on localhost:5555
```

### Debugging

- Logs are JSON via pino (or pretty in dev via `pino-pretty`). Each request gets an `X-Request-ID` (echoed if the client sent one) you can grep against.
- The `/api/health` endpoint is a pure liveness probe.
- The audit log (`/admin/audit`) is the fastest way to reconstruct what happened during a session.

### Production Considerations

For production deployment make sure to:

1. **Generate strong `JWT_SECRET` and `REFRESH_TOKEN_SECRET`** — distinct, ≥ 32 chars each.
2. **Set `NODE_ENV=production`** — enables HSTS via helmet and stricter error responses.
3. **Configure `ALLOWED_ORIGINS`** to the exact frontend hostnames (no wildcards).
4. **Set `TRUST_PROXY`** to match your infrastructure (single ingress, multiple hops, …).
5. **Set `CLINIC_TIMEZONE`** if the server's runtime timezone differs from the clinic's.
6. **Run behind TLS** — terminate at the reverse proxy / load balancer; the refresh cookie sets `Secure` automatically when `NODE_ENV=production`.
7. **Provision a dedicated production database** and never reuse dev credentials.
8. **Set `SEED_PRODUCTION=true` only on first deploy**, with `SEED_ADMIN_PASSWORD`/`SEED_USER_PASSWORD`. Remove these env vars afterwards.
9. **Wire up centralised log aggregation** for the pino JSON output.
10. **Schedule a job to prune old refresh tokens and consumed/expired verification codes** (the schema keeps them for audit; periodic deletion is recommended).

---

## License

ISC

---

## Support

For questions or issues, please contact the development team or open an issue on the GitHub repository.

**Repository:** https://github.com/h4s4nk44n/MidSlot

---

_Last updated: May 6, 2026_

## Team Members

| Fullname           | Student ID  |
|:-------------------|:------------|
| Efe Can Ezenoglu   |             |
| Hasan Kaan Doygun  |             |
| Taha Turkay Aktas  |             |
| Ahmet Kerem Ince   |             |
