# MediSlot 

**Medical appointment scheduling platform** — A full-featured backend API for managing doctor-patient appointments, time slots, and healthcare provider profiles.

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
  - [Time Slot Endpoints](#time-slot-endpoints)
  - [Appointment Endpoints](#appointment-endpoints)
  - [Receptionist Endpoints](#receptionist-endpoints)
  - [Admin Endpoints](#admin-endpoints)
  - [Doctor Endpoints](#doctor-endpoints)
  - [Health Check Endpoint](#health-check-endpoint)
- [Seed Data & Test Accounts](#seed-data--test-accounts)
- [Team Members](#team-members)

---

## Project Overview

MediSlot is a backend API designed to streamline medical appointment scheduling. It allows:

- **Patients** to browse available appointments and book slots with doctors
- **Doctors** to manage their availability by creating and updating time slots
- **Both roles** to view their appointment history and profile information
- **System administrators** to monitor health status and system availability

The platform is built as a RESTful API with TypeScript, Express.js, Prisma ORM, and PostgreSQL, providing a scalable foundation for healthcare scheduling applications.

### Key Features

- ✅ User authentication with JWT + refresh tokens
- ✅ Role-based access control (Admin / Doctor / Receptionist / Patient)
- ✅ Time slot management with overlap detection
- ✅ Appointment booking, cancellation, and completion
- ✅ Receptionist: book on behalf of patient, manage assigned doctors' slots
- ✅ Admin: user management, RBAC assignments, audit log
- ✅ Doctor profiles and specialization search
- ✅ Structured logging with pino (request IDs, redacted secrets)
- ✅ Next.js frontend with role-scoped dashboards
- ✅ Docker Compose for one-command local setup

---

## Tech Stack

| Layer          | Technology         | Version |
| -------------- | ------------------ | ------- |
| **Runtime**    | Node.js            | >= 18  |
| **Language**   | TypeScript         | ^5.x   |
| **Framework**  | Express.js         | ^5.2.1 |
| **ORM**        | Prisma             | ^6.19.2|
| **Database**   | PostgreSQL         | 12+    |
| **Auth**       | JWT (jsonwebtoken) | ^9.0.3 |
| **Hashing**    | bcrypt             | ^6.0.0 |
| **Validation** | Zod                | ^4.3.6 |
| **Testing**    | Jest               | ^30.0  |

---

## Architecture

### Design Rationale

**Express + Prisma + PostgreSQL** was chosen for the following reasons:

1. **Express.js**: Lightweight, flexible, and industry-standard Node.js framework with excellent middleware support
2. **Prisma**: Type-safe ORM that eliminates SQL boilerplate and provides excellent TypeScript integration
3. **PostgreSQL**: Robust relational database with strong ACID guarantees, essential for appointment data consistency
4. **JWT Authentication**: Stateless, scalable authentication mechanism ideal for REST APIs

### Folder Structure

```
src/
├── controllers/      # Route handlers & business logic
├── routes/          # Endpoint definitions
├── services/        # Business logic & database operations
├── middlewares/     # Auth, validation, error handling
├── validators/      # Zod schema validators
├── utils/          # Utility functions & error classes
├── types/          # TypeScript type definitions
├── lib/            # Prisma client initialization
├── generated/      # Auto-generated Prisma client
└── __tests__/      # Test files

prisma/
├── schema.prisma   # Data model definition
├── seed.ts         # Database seeding script
└── migrations/     # Database migration history
```

### Separation of Concerns

- **Controllers**: Parse requests, delegate to services, return responses
- **Services**: Pure business logic (auth, appointment booking)
- **Middlewares**: Authentication, authorization, error handling
- **Validators**: Input validation using Zod schemas
- **Utils**: Reusable error classes and helper functions

---

## Data Model

### Entity Relationship Diagram

<img width="836" height="606" alt="clean_erd_with_cardinality drawio" src="https://github.com/user-attachments/assets/5f686f70-30f3-4d88-83b4-1b0994569c10" />


### Models

#### **User**
Represents all users (Admin / Doctor / Receptionist / Patient).

| Field           | Type      | Description                                       |
| --------------- | --------- | ------------------------------------------------- |
| `id`            | UUID      | Primary key                                       |
| `email`         | String    | Unique email address                              |
| `password`      | String    | Bcrypt hashed password                            |
| `name`          | String    | User's full name                                  |
| `role`          | Enum      | `ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT`      |
| `failedLogins`  | Int       | Consecutive failed login counter (lockout)        |
| `lockedUntil`   | DateTime? | Account locked until this time (null = unlocked)  |
| `createdAt`     | DateTime  | Account creation timestamp                        |
| `updatedAt`     | DateTime  | Last update timestamp                             |

#### **Doctor**
Extended profile for doctor users.

| Field            | Type   | Description                        |
| ---------------- | ------ | ---------------------------------- |
| `id`             | UUID   | Primary key                        |
| `userId`         | UUID   | Foreign key to User (1:1)          |
| `specialization` | String | Medical specialty (e.g., Cardiology) |
| `bio`            | String | Professional biography             |

#### **TimeSlot**
Available appointment slots created by doctors.

| Field      | Type    | Description                        |
| ---------- | ------- | ---------------------------------- |
| `id`       | UUID    | Primary key                        |
| `doctorId` | UUID    | Foreign key to Doctor              |
| `date`     | Date    | Appointment date                   |
| `startTime`| DateTime| Slot start time                    |
| `endTime`  | DateTime| Slot end time (must be > start)    |
| `isBooked` | Boolean | Whether slot is booked             |
| `createdAt`| DateTime| Creation timestamp                 |

**Constraints:**
- Minimum duration: 15 minutes
- Maximum duration: 4 hours
- Slots cannot overlap for the same doctor on the same day
- Slots cannot be created in the past

#### **Appointment**
Booked appointments linking patients to doctor time slots.

| Field      | Type   | Description                        |
| ---------- | ------ | ---------------------------------- |
| `id`       | UUID   | Primary key                        |
| `patientId`| UUID   | Foreign key to User/Patient        |
| `doctorId` | UUID   | Foreign key to Doctor              |
| `timeSlotId`| UUID  | Foreign key to TimeSlot (1:1)      |
| `status`   | Enum   | `BOOKED`, `CANCELLED`, `COMPLETED` |
| `notes`    | String | Patient notes/symptoms             |
| `createdAt`| DateTime| Booking timestamp                  |
| `updatedAt`| DateTime| Last update timestamp              |

#### **ReceptionistAssignment** _(Part 2)_
Maps a receptionist user to a doctor they can act on behalf of.

| Field           | Type     | Description                       |
| --------------- | -------- | --------------------------------- |
| `id`            | UUID     | Primary key                       |
| `receptionistId`| UUID     | Foreign key to User (RECEPTIONIST)|
| `doctorId`      | UUID     | Foreign key to Doctor             |
| `createdAt`     | DateTime | Assignment creation timestamp     |

**Unique constraint:** `(receptionistId, doctorId)` — one assignment per pair.

#### **RefreshToken** _(Part 2)_
Persisted refresh tokens for the sliding-window auth flow.

| Field      | Type     | Description                       |
| ---------- | -------- | --------------------------------- |
| `id`       | UUID     | Primary key                       |
| `userId`   | UUID     | Foreign key to User               |
| `token`    | String   | Hashed refresh token (unique)     |
| `expiresAt`| DateTime | Token expiry                      |
| `createdAt`| DateTime | Issue timestamp                   |

#### **AuditLog** _(Part 2)_
Immutable log of significant actions for compliance.

| Field      | Type     | Description                              |
| ---------- | -------- | ---------------------------------------- |
| `id`       | UUID     | Primary key                              |
| `actorId`  | UUID?    | User who performed the action            |
| `action`   | String   | Action type (e.g. `SLOT_CREATE`)         |
| `targetType`| String  | Resource type (e.g. `TimeSlot`)          |
| `targetId` | String?  | ID of the affected resource              |
| `metadata` | JSON?    | Additional context (redacted secrets)    |
| `ip`       | String?  | Client IP                                |
| `userAgent`| String?  | Client user agent                        |
| `createdAt`| DateTime | Event timestamp                          |

---

## Setup Instructions

### Prerequisites

- **Node.js** >= 18 (download from [nodejs.org](https://nodejs.org))
- **PostgreSQL** 12+ (download from [postgresql.org](https://www.postgresql.org))
- **npm** or **yarn** package manager
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

Then edit `.env` with your PostgreSQL credentials:

```env
# Server Configuration
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/midslot?schema=public"

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

**Environment Variables Explained:**

| Variable         | Description                              | Example                |
| ---------------- | ---------------------------------------- | ---------------------- |
| `PORT`           | Server port                              | 3000                   |
| `DATABASE_URL`   | PostgreSQL connection string             | See step 3              |
| `JWT_SECRET`     | Secret key for signing JWT tokens        | any long random string  |
| `JWT_EXPIRES_IN` | JWT token expiration time                | 7d, 24h, etc.          |

### Step 4: Create & Configure PostgreSQL Database

```bash
# Connect to PostgreSQL with your admin credentials
psql -U postgres

# Create the database
CREATE DATABASE midslot;

# Exit psql
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

This will create all tables in the database.

### Step 7: Seed the Database (Optional but Recommended)

Populate the database with test data including doctors, patients, and sample appointments:

```bash
npx prisma db seed
```

This script creates:
- 1 admin account
- 2 receptionists with doctor assignments
- 3 doctors with different specializations
- 3 patients
- 15 available time slots
- 5 sample appointments

See [Seed Data](#seed-data--test-accounts) for login credentials.

---

## Running the Application

### Development Mode (with auto-reload)

```bash
cd backend
npm run dev
```

The server will start on `http://localhost:3000` with hot-reload enabled via nodemon. Modify any TypeScript file and changes will reload automatically.

### Production Build

```bash
cd backend
# Compile TypeScript to JavaScript
npm run build

# Run the compiled application
npm start
```

### Verification

Test the API is running:

```bash
curl http://localhost:3000/api/health
# Response: {"status":"ok"}
```

### Frontend (Next.js)

The web app lives in [`frontend/`](./frontend) — Next.js 15 App Router, Tailwind CSS v4, and the "Clinical Quiet" design system.

```bash
cd frontend
cp .env.example .env.local         # set NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev                        # http://localhost:3001
# or: npm run build && npm start
```

**Pages by role:**

| Role | Pages |
|------|-------|
| Patient | `/patient/doctors`, `/patient/doctors/[id]`, `/patient/appointments` |
| Doctor | `/doctor` (dashboard), `/doctor/appointments`, `/doctor/availability` |
| Receptionist | `/reception` (pick doctor), `/reception/doctors/[id]` (slots), `/reception/book` (3-step booking), `/reception/appointments` |
| Admin | `/admin` (users + assignments) |

---

## Run with Docker

The repo ships a three-service `docker-compose.yml` that runs **postgres**,
**backend** (Express API), and **frontend** (Next.js) on a private `medi`
network. One command boots the whole stack.

### Prerequisites

- [Docker Engine](https://docs.docker.com/engine/install/) 24+ (or Docker
  Desktop) with the Compose v2 plugin (`docker compose version` should print).
- ~2 GB free disk for images.
- Ports **3000** (backend) and **3001** (frontend) free on the host.

### 1. Clone & enter the repo

```bash
git clone https://github.com/<your-org>/MidSlot.git
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

First run takes a few minutes (npm installs + Next build). Subsequent runs
reuse cached layers. Add `-d` to run detached.

When the stack is healthy:
- **Frontend:** http://localhost:3001
- **Backend API:** http://localhost:3000/api
- **Health probe:** http://localhost:3000/api/health

The backend container runs `prisma migrate deploy` automatically on every
start, so the schema is always in sync with `backend/prisma/migrations/`.

### 4. Seed demo data (optional)

The compose stack does **not** run the Prisma seed automatically (it would
re-insert duplicates on every restart). Run it manually once:

```bash
docker compose exec backend npx prisma db seed
```

### 5. Common commands

```bash
docker compose logs -f backend         # tail backend logs
docker compose logs -f frontend        # tail frontend logs
docker compose ps                      # service status + health
docker compose restart backend         # restart a single service
docker compose down                    # stop containers (data preserved)
docker compose down -v                 # stop + WIPE the postgres volume
```

### Changing ports

Edit `.env`:

```
BACKEND_HOST_PORT=4000      # publish backend on host port 4000
FRONTEND_HOST_PORT=4001     # publish frontend on host port 4001
NEXT_PUBLIC_API_URL=http://localhost:4000   # MUST match BACKEND_HOST_PORT
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

Then **wipe the volume** (the existing one was initialised with the old
credentials and will not pick up the change):

```bash
docker compose down -v
docker compose up --build
```

To expose Postgres on the host (e.g. for `psql` or a GUI), uncomment the
`ports:` block in `docker-compose.yml` under the `postgres` service.

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `port is already allocated` | Something else is using 3000/3001. Set `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` in `.env`. |
| `JWT_SECRET must be set and at least 32 chars` (backend exits) | You didn't set `JWT_SECRET` in `.env`. Generate one and rebuild. |
| Frontend loads but every API call fails with CORS / 0-status | `NEXT_PUBLIC_API_URL` doesn't match the backend's host port. Update `.env` and `docker compose build frontend`. |
| Backend stuck on "waiting for postgres" | Postgres healthcheck is still failing. `docker compose logs postgres` for details; usually a stale volume — `docker compose down -v` and retry. |
| Schema drift / Prisma errors after pulling new code | Migrations didn't run. `docker compose restart backend` and watch logs. |

### Local (non-Docker) development

If you'd rather run things bare-metal:

```bash
cd backend  && cp .env.example .env  && npm install && npm run dev
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

You'll need a Postgres running on `localhost:5432` with a database matching
`DATABASE_URL` in `backend/.env`.

---

## Smoke Test

An automated smoke test verifies the full stack end-to-end via docker compose.

**Prerequisites:** `docker`, `curl`, `jq`

```bash
chmod +x scripts/smoke.sh
./scripts/smoke.sh
```

The script:
1. Runs `docker compose up --build`
2. Polls `/health` until the API is ready (90s timeout)
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

Most endpoints (except `/auth/register`, `/auth/login`, and `/health`) require JWT authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message",
  "statusCode": 400
}
```

---

## Authentication Endpoints

### POST `/auth/register`

Register a new user account (doctor or patient).

**Auth:** Public

**Request Body:**

```json
{
  "email": "ali.vural@example.com",
  "name": "Ali Vural",
  "password": "securePassword123",
  "role": "PATIENT"
}
```

**Fields:**
- `email` (string, required): Valid email address
- `name` (string, required): User's full name
- `password` (string, required): Min 8 characters with complexity (at least one uppercase, one lowercase, and one digit; cannot be a common password or contain your name/email)
- `role` (string, required): Either `"PATIENT"` or `"DOCTOR"`

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

| Status | Error                   | Cause                        |
| ------ | ----------------------- | ---------------------------- |
| 400    | Invalid input           | Missing/malformed fields     |
| 409    | Email already registered| Email already in use         |

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ali.vural@example.com",
    "name": "Ali Vural",
    "password": "securePassword123",
    "role": "PATIENT"
  }'
```

---

### POST `/auth/login`

Authenticate and receive a JWT token.

**Auth:** Public

**Request Body:**

**Account Lockout:**
After 5 consecutive failed login attempts, the account is locked for 15 minutes.
A locked account returns `423 Locked` with a `Retry-After` header indicating
the number of seconds until the lockout expires. The same status is returned
even if a subsequent request carries the correct password.

```json
{
  "email": "ali.vural@example.com",
  "password": "securePassword123"
}
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
**Note:** The refresh token is set as an httpOnly cookie (`refreshToken`) on
successful login and is never returned in the response body. Subsequent calls
to `/auth/refresh` and `/auth/logout` use this cookie automatically when the
client is configured with `credentials: "include"` (or equivalent).

**Audit:** Login attempts (success, failure, lockout) are recorded in the
audit log along with email, IP, and user-agent. Sensitive fields such as
passwords are never persisted to audit metadata.

**Error Responses:**

| Status | Error                | Cause                           |
| ------ | -------------------- | ------------------------------- |
| 400    | Invalid input        | Missing/malformed fields        |
| 401    | Invalid email or password | Wrong credentials           |
| 423    | Account temporarily locked | Too many failed login attempts  |

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ali.vural@example.com",
    "password": "securePassword123"
  }'
```

---

### GET `/admin/audit`

Read-only audit log viewer for administrators.

**Auth:** Admin only

**Query Parameters:**

| Parameter    | Type    | Description                                     |
| ------------ | ------- | ----------------------------------------------- |
| `page`       | integer | Page number (default 1, min 1)                  |
| `pageSize`   | integer | Items per page (default 20, min 1, max 100)     |
| `action`     | string  | Filter by action code (e.g. `login.success`)    |
| `actorId`    | uuid    | Filter by user who performed the action         |
| `targetType` | string  | Filter by target type (e.g. `Appointment`)      |
| `targetId`   | string  | Filter by target id                             |
| `from`       | ISO 8601| Lower bound on `createdAt` (inclusive)          |
| `to`         | ISO 8601| Upper bound on `createdAt` (exclusive)          |

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "action": "login.success",
      "targetType": "User",
      "targetId": "uuid",
      "metadata": { "email": "x@y.com", "role": "PATIENT" },
      "ip": "127.0.0.1",
      "userAgent": "curl/8.x",
      "createdAt": "2026-05-01T12:00:00.000Z",
      "actor": {
        "id": "uuid",
        "name": "Ali Vural",
        "email": "ali.vural@example.com",
        "role": "PATIENT"
      }
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 150, "totalPages": 8 }
}
```

Sensitive metadata (passwords, tokens) is automatically redacted before
storage; this endpoint never returns raw secrets.

---

### GET `/auth/me`

Get current authenticated user's profile.

**Auth:** Authenticated (all roles)

**Request:**

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200 OK):**

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

For doctors, the response includes:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "email": "ayse.yilmaz@medislot.com",
  "name": "Dr. Ayşe Yılmaz",
  "role": "DOCTOR",
  "createdAt": "2026-03-30T10:00:00.000Z",
  "doctor": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "specialization": "Cardiology",
    "bio": "Board-certified cardiologist with 15 years of experience..."
  }
}
```

**Error Responses:**

| Status | Error              | Cause                  |
| ------ | ------------------ | ---------------------- |
| 401    | Invalid or expired token | Token missing/invalid  |
| 404    | User not found     | User deleted after login |

**Example cURL:**

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### POST `/auth/refresh`

Rotate the refresh token and receive a new access token. The refresh token is
read from the `refreshToken` HttpOnly cookie set by `/auth/login`.

**Auth:** Cookie (`refreshToken`)

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "ali.vural@example.com",
    "name": "Ali Vural",
    "role": "PATIENT"
  }
}
```

A new `refreshToken` cookie is set on every successful call (token rotation).
On failure the cookie is cleared and `401` is returned.

**Error Responses:**

| Status | Error                       | Cause                             |
| ------ | --------------------------- | --------------------------------- |
| 401    | Refresh token missing       | Cookie absent                     |
| 401    | Invalid or expired token    | Token revoked, expired, or forged |

**Example cURL:**

```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  --cookie "refreshToken=YOUR_REFRESH_TOKEN"
```

---

### POST `/auth/logout`

Revoke the current refresh token and clear the cookie.

**Auth:** Cookie (`refreshToken`) — no access token required

**Response (204 No Content):** Empty body.

The server deletes the refresh token from the database (even if the cookie
was already expired or missing) and clears the cookie on the response.

**Example cURL:**

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  --cookie "refreshToken=YOUR_REFRESH_TOKEN"
```

---

## Time Slot Endpoints

### GET `/slots`

Get paginated available (unbooked) time slots. Supports filtering by doctor,
specialization, and date/range.

**Auth:** Public

**Query Parameters:**

| Parameter        | Type    | Default | Description |
| ---------------- | ------- | ------- | ----------- |
| `page`           | int     | `1`     | Page number (>= 1) |
| `pageSize`       | int     | `20`    | Items per page (1–100) |
| `doctorId`       | uuid    | —       | Filter by doctor id |
| `specialization` | string  | —       | Exact-match specialization filter |
| `date`           | ISO date | —      | Single-day filter (takes precedence over from/to) |
| `from`           | ISO datetime | —  | Start of range (inclusive) |
| `to`             | ISO datetime | —  | End of range (exclusive) |

**Response (200 OK):**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "doctorId": "550e8400-e29b-41d4-a716-446655440010",
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

**Example cURL:**

```bash
# First page, default page size
curl -X GET "http://localhost:3000/api/slots"

# Filter by doctor, single-day window
curl -X GET "http://localhost:3000/api/slots?doctorId=550e8400-e29b-41d4-a716-446655440010&date=2026-05-01&page=1&pageSize=10"

# Filter by specialization + datetime range
curl -X GET "http://localhost:3000/api/slots?specialization=Cardiology&from=2026-05-01T00:00:00Z&to=2026-05-08T00:00:00Z"
```

**Validation errors** return **400** with a list of `{ field, message }` entries.

---

### POST `/slots`

Create a new time slot (doctor only).

**Auth:** Doctor

**Request Body:**

```json
{
  "date": "2026-04-05",
  "startTime": "2026-04-05T14:00:00Z",
  "endTime": "2026-04-05T14:30:00Z"
}
```

**Fields:**
- `date` (ISO date, required): Date for the slot
- `startTime` (ISO datetime, required): Slot start time
- `endTime` (ISO datetime, required): Slot end time (must be > startTime)

**Constraints:**
- Duration must be between 15 minutes and 4 hours
- Cannot create slots in the past
- Cannot overlap with doctor's existing slots on the same day

**Response (201 Created):**

```json
{
  "message": "Time slot created successfully.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "doctorId": "550e8400-e29b-41d4-a716-446655440010",
    "date": "2026-04-05T00:00:00.000Z",
    "startTime": "2026-04-05T14:00:00.000Z",
    "endTime": "2026-04-05T14:30:00.000Z",
    "isBooked": false,
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error                              | Cause                        |
| ------ | ---------------------------------- | ---------------------------- |
| 400    | Invalid input                      | Missing/malformed fields     |
| 400    | Start time must be before end time | Invalid time order           |
| 400    | Cannot create slots in the past    | Past date/time               |
| 400    | Slot duration must be between...   | Duration out of range        |
| 401    | Authentication required            | No/invalid token             |
| 403    | Access denied. Required role: DOCTOR | User is not a doctor      |
| 404    | Doctor profile not found           | User is not a complete doctor |
| 409    | Time slot overlaps with...         | Overlapping slot exists      |

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/slots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "date": "2026-04-05",
    "startTime": "2026-04-05T14:00:00Z",
    "endTime": "2026-04-05T14:30:00Z"
  }'
```

---

### PUT `/slots/:id`

Update an existing time slot (doctor only).

**Auth:** Doctor

**URL Parameters:**
- `id` (uuid, required): The slot ID to update

**Request Body (all optional):**

```json
{
  "date": "2026-04-06",
  "startTime": "2026-04-06T15:00:00Z",
  "endTime": "2026-04-06T15:30:00Z",
  "isBooked": false
}
```

**Response (200 OK):**

```json
{
  "message": "Time slot updated successfully.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "doctorId": "550e8400-e29b-41d4-a716-446655440010",
    "date": "2026-04-06T00:00:00.000Z",
    "startTime": "2026-04-06T15:00:00.000Z",
    "endTime": "2026-04-06T15:30:00.000Z",
    "isBooked": false,
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error                           | Cause                        |
| ------ | ------------------------------- | ---------------------------- |
| 400    | Invalid input                   | Malformed request            |
| 400    | Start time must be before...    | Invalid time order           |
| 401    | Authentication required         | No/invalid token             |
| 403    | Access denied. Required role... | User is not a doctor         |
| 404    | Slot not found                  | Invalid slot ID              |
| 409    | Update fails: Overlaps with...  | New time overlaps with another |

**Example cURL:**

```bash
curl -X PUT http://localhost:3000/api/slots/550e8400-e29b-41d4-a716-446655440101 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "startTime": "2026-04-06T15:00:00Z",
    "endTime": "2026-04-06T15:30:00Z"
  }'
```

---

### DELETE `/slots/:id`

Delete a time slot (doctor only).

**Auth:** Doctor

**URL Parameters:**
- `id` (uuid, required): The slot ID to delete

**Response (200 OK):**

```json
{
  "message": "Time slot deleted successfully."
}
```

**Error Responses:**

| Status | Error                    | Cause                  |
| ------ | ------------------------ | ---------------------- |
| 401    | Authentication required  | No/invalid token       |
| 403    | Access denied            | User is not a doctor   |
| 404    | Slot not found           | Invalid slot ID        |

**Example cURL:**

```bash
curl -X DELETE http://localhost:3000/api/slots/550e8400-e29b-41d4-a716-446655440101 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Appointment Endpoints

### POST `/appointments`

Book a new appointment (patient only).

**Auth:** Patient

**Request Body:**

```json
{
  "timeSlotId": "550e8400-e29b-41d4-a716-446655440100",
  "notes": "I have been experiencing chest pain for the past week."
}
```

**Fields:**
- `timeSlotId` (uuid, required): The time slot to book
- `notes` (string, optional): Patient's symptoms or notes for the doctor

**Response (201 Created):**

```json
{
  "message": "Appointment booked successfully.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440200",
    "patientId": "550e8400-e29b-41d4-a716-446655440000",
    "doctorId": "550e8400-e29b-41d4-a716-446655440010",
    "timeSlotId": "550e8400-e29b-41d4-a716-446655440100",
    "status": "BOOKED",
    "notes": "I have been experiencing chest pain for the past week.",
    "createdAt": "2026-03-30T10:00:00.000Z",
    "updatedAt": "2026-03-30T10:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error                      | Cause                      |
| ------ | -------------------------- | -------------------------- |
| 400    | Invalid input              | Missing/malformed fields   |
| 400    | This slot is already booked | Slot already booked        |
| 401    | Authentication required    | No/invalid token           |
| 404    | Time slot not found        | Invalid timeSlotId         |

**Example cURL:**

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "timeSlotId": "550e8400-e29b-41d4-a716-446655440100",
    "notes": "I have been experiencing chest pain for the past week."
  }'
```

---

### GET `/appointments/me`

Paginated list of appointments scoped to the authenticated caller:
- **PATIENT** — their own appointments
- **DOCTOR** — appointments assigned to them
- **RECEPTIONIST** — appointments for doctors they are assigned to
- **ADMIN** — all appointments

**Auth:** Authenticated

**Query Parameters:**

| Parameter  | Type     | Default | Description |
| ---------- | -------- | ------- | ----------- |
| `page`     | int      | `1`     | Page number |
| `pageSize` | int      | `20`    | Items per page (1–100) |
| `status`   | enum     | —       | `BOOKED` \| `CANCELLED` \| `COMPLETED` |
| `from`     | ISO datetime | — | Only slots starting on/after this time |
| `to`       | ISO datetime | — | Only slots starting before this time |

**Example cURL:**

```bash
curl -X GET "http://localhost:3000/api/appointments/me?status=BOOKED&from=2026-04-01T00:00:00Z&page=1&pageSize=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### PATCH `/appointments/:id/cancel`

Cancel a booked appointment.

**Auth:** Authenticated — caller must be the patient, the doctor, or a receptionist assigned to the doctor

**URL Parameters:**
- `id` (uuid, required): Appointment ID

**Response (200 OK):**

```json
{
  "message": "Appointment cancelled successfully.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440200",
    "status": "CANCELLED",
    "updatedAt": "2026-05-01T12:00:00.000Z"
  }
}
```

The corresponding `TimeSlot.isBooked` is set back to `false` in the same transaction.

**Error Responses:**

| Status | Error                                       | Cause                                   |
| ------ | ------------------------------------------- | --------------------------------------- |
| 401    | Authentication required                     | No/invalid token                        |
| 403    | Not authorized to cancel this appointment   | Caller is not the patient, doctor, or assigned receptionist |
| 404    | Appointment not found                       | Invalid ID                              |
| 409    | Cannot cancel an appointment that is already CANCELLED/COMPLETED | Already in terminal state |

**Example cURL:**

```bash
curl -X PATCH http://localhost:5000/api/appointments/550e8400-e29b-41d4-a716-446655440200/cancel \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### PATCH `/appointments/:id/complete`

Mark an appointment as completed. Only callable once the slot's `endTime` has passed.

**Auth:** Doctor (must own the appointment) or Receptionist assigned to that doctor

**URL Parameters:**
- `id` (uuid, required): Appointment ID

**Response (200 OK):**

```json
{
  "message": "Appointment marked as completed.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440200",
    "status": "COMPLETED",
    "updatedAt": "2026-05-01T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Status | Error                                                    | Cause                               |
| ------ | -------------------------------------------------------- | ----------------------------------- |
| 400    | Cannot complete an appointment before its end time       | Slot end time has not passed yet    |
| 401    | Authentication required                                  | No/invalid token                    |
| 403    | Only the assigned doctor or receptionist can complete... | Wrong role or not assigned          |
| 404    | Appointment not found                                    | Invalid ID                          |
| 409    | Cannot complete an appointment that is already CANCELLED/COMPLETED | Already in terminal state |

**Example cURL:**

```bash
curl -X PATCH http://localhost:5000/api/appointments/550e8400-e29b-41d4-a716-446655440200/complete \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN_HERE"
```

---

## Receptionist Endpoints

All endpoints below require `Authorization: Bearer <token>` with a `RECEPTIONIST` role.

### GET `/receptionist/doctors`

List doctors the authenticated receptionist is assigned to.

**Auth:** Receptionist

**Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "specialization": "Cardiology",
    "bio": "Board-certified cardiologist...",
    "user": { "id": "...", "name": "Dr. Ayşe Yılmaz", "email": "ayse.yilmaz@medislot.com" }
  }
]
```

**Example cURL:**

```bash
curl http://localhost:5000/api/receptionist/doctors \
  -H "Authorization: Bearer RECEPTIONIST_TOKEN"
```

---

### GET `/receptionist/doctors/:doctorId/slots`

All time slots (booked and available) for an assigned doctor.

**Auth:** Receptionist (must be assigned to the doctor)

**Response (200 OK):** Array of `TimeSlot` objects (same shape as `GET /doctors/:id/slots` but includes booked slots).

**Example cURL:**

```bash
curl http://localhost:5000/api/receptionist/doctors/DOCTOR_ID/slots \
  -H "Authorization: Bearer RECEPTIONIST_TOKEN"
```

---

### POST `/receptionist/doctors/:doctorId/slots`

Create a new time slot for an assigned doctor.

**Auth:** Receptionist (must be assigned to the doctor)

**Request Body:**

```json
{
  "startTime": "2026-05-10T09:00:00Z",
  "endTime": "2026-05-10T09:30:00Z"
}
```

**Response (201 Created):** `{ "message": "...", "data": TimeSlot }`

**Error Responses:**

| Status | Error                   | Cause                                  |
| ------ | ----------------------- | -------------------------------------- |
| 400    | Invalid input           | Missing/malformed fields               |
| 400    | Cannot book past slots  | Start time in the past                 |
| 403    | Not assigned to doctor  | Receptionist not assigned to this doctor |
| 409    | Slot overlaps           | Overlapping slot exists for that doctor |

---

### DELETE `/receptionist/slots/:slotId`

Delete an unbooked slot managed by the receptionist's assigned doctor.

**Auth:** Receptionist

**Response (200 OK):** `{ "message": "Slot deleted successfully." }`

**Error Responses:** 403 if not assigned, 404 if slot not found, 409 if slot is already booked.

---

### GET `/receptionist/patients`

Patient search typeahead — returns up to 25 patients matching the query.

**Auth:** Receptionist

**Query Parameters:**

| Parameter | Type   | Description                                           |
| --------- | ------ | ----------------------------------------------------- |
| `search`  | string | Min 2 chars. Case-insensitive match on name **or** email |
| `limit`   | int    | Max results (default 10, capped at 25)               |

**Response (200 OK):**

```json
[
  { "id": "...", "name": "Ali Vural", "email": "ali.vural@example.com" }
]
```

**Example cURL:**

```bash
curl "http://localhost:5000/api/receptionist/patients?search=ali&limit=10" \
  -H "Authorization: Bearer RECEPTIONIST_TOKEN"
```

---

### GET `/receptionist/appointments`

Paginated, filterable list of appointments across all assigned doctors.

**Auth:** Receptionist

**Query Parameters:**

| Parameter  | Type   | Default | Description |
| ---------- | ------ | ------- | ----------- |
| `page`     | int    | `1`     | Page number |
| `pageSize` | int    | `20`    | Items per page (1–100) |
| `status`   | enum   | —       | `BOOKED` \| `CANCELLED` \| `COMPLETED` |
| `doctorId` | uuid   | —       | Filter to one assigned doctor |
| `date`     | date   | —       | Single-day filter (ISO date) |

**Response (200 OK):**

```json
{
  "items": [...],
  "page": 1,
  "pageSize": 20,
  "total": 42,
  "totalPages": 3
}
```

**Example cURL:**

```bash
curl "http://localhost:5000/api/receptionist/appointments?status=BOOKED&page=1" \
  -H "Authorization: Bearer RECEPTIONIST_TOKEN"
```

---

### POST `/receptionist/appointments`

Book an appointment on behalf of a patient.

**Auth:** Receptionist (must be assigned to the doctor whose slot is being booked)

**Request Body:**

```json
{
  "timeSlotId": "550e8400-e29b-41d4-a716-446655440100",
  "patientId": "550e8400-e29b-41d4-a716-446655440000",
  "notes": "Patient reports chest pain."
}
```

**Response (201 Created):** Same shape as `POST /appointments`.

**Error Responses:** 400 if slot is already booked or in the past, 403 if not assigned to doctor, 404 if slot or patient not found.

---

### PATCH `/receptionist/appointments/:id/cancel`

Cancel an appointment managed by an assigned doctor (receptionist-scoped alias for cancel).

**Auth:** Receptionist (must be assigned to the appointment's doctor)

**Response (200 OK):** Same shape as `PATCH /appointments/:id/cancel`.

---

## Admin Endpoints

### GET `/admin/users`

Paginated list of users (admin only). Supports role filter and name/email search.

**Auth:** Admin

**Query Parameters:**

| Parameter  | Type   | Default | Description |
| ---------- | ------ | ------- | ----------- |
| `page`     | int    | `1`     | Page number |
| `pageSize` | int    | `20`    | Items per page (1–100) |
| `role`     | enum   | —       | `DOCTOR` \| `PATIENT` \| `ADMIN` \| `RECEPTIONIST` |
| `q`        | string | —       | Case-insensitive partial match against name **or** email |

**Response (200 OK):**

```json
{
  "items": [
    { "id": "...", "email": "...", "name": "...", "role": "DOCTOR", "createdAt": "..." }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

**Example cURL:**

```bash
curl -X GET "http://localhost:3000/api/admin/users?role=DOCTOR&q=smith&page=1&pageSize=20" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Doctor Endpoints

### GET `/doctors`

Paginated doctor list with optional name search and specialization filter.

**Auth:** Authenticated

**Query Parameters:**

| Parameter        | Type   | Default | Description |
| ---------------- | ------ | ------- | ----------- |
| `page`           | int    | `1`     | Page number (>= 1) |
| `pageSize`       | int    | `20`    | Items per page (1–100) |
| `q`              | string | —       | Case-insensitive partial match on doctor name |
| `specialization` | string | —       | Exact-match specialization filter |

**Response (200 OK):**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "specialization": "Cardiology",
      "user": { "id": "...", "name": "Dr. Ayşe Yılmaz", "email": "ayse.yilmaz@medislot.com" }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1,
  "totalPages": 1
}
```

**Example cURL:**

```bash
# Name search + specialization, first page
curl -X GET "http://localhost:3000/api/doctors?q=smi&specialization=cardiology&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### GET `/doctors/:id`

Get a specific doctor's profile.

**Auth:** Authenticated

**URL Parameters:**
- `id` (uuid, required): The doctor ID

**Response (200 OK):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "specialization": "Cardiology",
  "bio": "Board-certified cardiologist with 15 years of experience...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "Dr. Ayşe Yılmaz",
    "email": "ayse.yilmaz@medislot.com"
  }
}
```

**Error Responses:**

| Status | Error                   | Cause               |
| ------ | ----------------------- | ------------------- |
| 401    | Authentication required | No/invalid token    |
| 404    | Doctor not found        | Invalid doctor ID   |
| 500    | Internal server error   | Database error      |

**Example cURL:**

```bash
curl -X GET http://localhost:3000/api/doctors/550e8400-e29b-41d4-a716-446655440010 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### GET `/doctors/:id/slots`

Get available time slots for a specific doctor.

**Auth:** Authenticated

**URL Parameters:**
- `id` (uuid, required): The doctor ID

**Query Parameters:**

| Parameter | Type | Description                  |
| --------- | ---- | ---------------------------- |
| `date`    | date | Filter slots by date (optional, ISO format) |

**Response (200 OK):**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "doctorId": "550e8400-e29b-41d4-a716-446655440010",
    "date": "2026-04-02T00:00:00.000Z",
    "startTime": "2026-04-02T09:00:00.000Z",
    "endTime": "2026-04-02T10:00:00.000Z",
    "isBooked": false,
    "createdAt": "2026-03-30T10:00:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "doctorId": "550e8400-e29b-41d4-a716-446655440010",
    "date": "2026-04-07T00:00:00.000Z",
    "startTime": "2026-04-07T11:00:00.000Z",
    "endTime": "2026-04-07T11:30:00.000Z",
    "isBooked": false,
    "createdAt": "2026-03-30T10:00:00.000Z"
  }
]
```

**Notes:**
- Only returns unbooked slots
- Only returns future slots (startTime > now)
- Results sorted by date and start time ascending

**Error Responses:**

| Status | Error                   | Cause              |
| ------ | ----------------------- | ------------------ |
| 401    | Authentication required | No/invalid token   |
| 500    | Internal server error   | Database error     |

**Example cURL (without date filter):**

```bash
curl -X GET http://localhost:3000/api/doctors/550e8400-e29b-41d4-a716-446655440010/slots \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Example cURL (with date filter):**

```bash
curl -X GET "http://localhost:3000/api/doctors/550e8400-e29b-41d4-a716-446655440010/slots?date=2026-04-02" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

### GET `/doctors/dashboard`

Get doctor's dashboard with appointment analytics and statistics.

**Auth:** Doctor only

**Response (200 OK):**

```json
{
  "upcomingAppointments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440200",
      "patientId": "550e8400-e29b-41d4-a716-446655440000",
      "doctorId": "550e8400-e29b-41d4-a716-446655440010",
      "timeSlotId": "550e8400-e29b-41d4-a716-446655440100",
      "status": "BOOKED",
      "notes": "Routine cardiac checkup.",
      "createdAt": "2026-03-30T10:00:00.000Z",
      "updatedAt": "2026-03-30T10:00:00.000Z",
      "patient": {
        "name": "Ali Vural",
        "email": "ali.vural@example.com"
      },
      "timeSlot": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "doctorId": "550e8400-e29b-41d4-a716-446655440010",
        "date": "2026-04-02T00:00:00.000Z",
        "startTime": "2026-04-02T09:00:00.000Z",
        "endTime": "2026-04-02T09:30:00.000Z",
        "isBooked": true,
        "createdAt": "2026-03-30T10:00:00.000Z"
      }
    }
  ],
  "todaySlots": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440102",
      "doctorId": "550e8400-e29b-41d4-a716-446655440010",
      "date": "2026-03-30T00:00:00.000Z",
      "startTime": "2026-03-30T14:00:00.000Z",
      "endTime": "2026-03-30T14:30:00.000Z",
      "isBooked": true,
      "createdAt": "2026-03-30T10:00:00.000Z"
    }
  ],
  "stats": {
    "totalAppointments": 10,
    "completedAppointments": 7,
    "cancelledAppointments": 1,
    "availableSlots": 5
  }
}
```

**Fields:**
- `upcomingAppointments`: Next 10 appointments for this doctor (future, booked status)
- `todaySlots`: Time slots scheduled for today
- `stats`: Key metrics for the doctor's appointments and availability

**Error Responses:**

| Status | Error                       | Cause                       |
| ------ | --------------------------- | --------------------------- |
| 401    | Authentication required     | No/invalid token            |
| 403    | Access denied. Required role: DOCTOR | User is not a doctor |
| 404    | Doctor profile not found    | User registered but not as doctor |
| 500    | Internal server error       | Database error              |

**Example cURL:**

```bash
curl -X GET http://localhost:3000/api/doctors/dashboard \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN_HERE"
```

---

## Health Check Endpoint

### GET `/health`

Health check endpoint for monitoring server availability.

**Auth:** Public

**Response (200 OK):**

```json
{
  "status": "ok"
}
```

**Example cURL:**

```bash
curl http://localhost:3000/api/health
```

---

## Seed Data & Test Accounts

The database can be pre-populated with test data by running:

```bash
npx prisma db seed
```

This creates the following accounts (you can use these for testing):

### Admin Account

| Email                    | Password              | Name                  |
| ------------------------ | --------------------- | --------------------- |
| `admin@medislot.com`     | `Admin@MediSlot2026!` | System Administrator  |

> **Security note:** Change the admin password immediately in any non-development environment.

### Receptionist Accounts

| Email                           | Password      | Name          | Assigned Doctors                              |
| ------------------------------- | ------------- | ------------- | --------------------------------------------- |
| `fatma.celik@medislot.com`      | `Password123!`| Fatma Çelik   | Dr. Ayşe Yılmaz (Cardiology), Dr. Mehmet Kaya (Dermatology) |
| `emre.sahin@medislot.com`       | `Password123!`| Emre Şahin    | Dr. Zeynep Demir (General Practice)           |

### Doctor Accounts

All doctors have the specialization and bio fields populated.

| Email                           | Password      | Name              | Specialization  |
| ------------------------------- | ------------- | ----------------- | --------------- |
| `ayse.yilmaz@medislot.com`      | `Password123!`| Dr. Ayşe Yılmaz   | Cardiology      |
| `mehmet.kaya@medislot.com`      | `Password123!`| Dr. Mehmet Kaya   | Dermatology     |
| `zeynep.demir@medislot.com`     | `Password123!`| Dr. Zeynep Demir  | General Practice|

### Patient Accounts

| Email                        | Password      | Name           |
| ----------------------------- | ------------- | -------------- |
| `ali.vural@example.com`      | `Password123!`| Ali Vural      |
| `can.ozkan@example.com`      | `Password123!`| Can Özkan      |
| `deniz.arslan@example.com`   | `Password123!`| Deniz Arslan   |

### Sample Data Included

- **15 time slots**: Mix of past, today, and future slots across all doctors
- **5 appointments**: Examples of booked (current), completed (past), and cancelled statuses
- **3 receptionist assignments**: Fatma assigned to 2 doctors, Emre assigned to 1 doctor
- **Complete doctor profiles**: All doctors have specialization and bio information

### Testing Workflow

1. **Register or use seeded account:**
   ```bash
   # Option A: Use seeded account
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "ali.vural@example.com",
       "password": "Password123!"
     }'
   
   # Option B: Create new account
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "newuser@example.com",
       "name": "New User",
       "password": "MySecurePassword123",
       "role": "PATIENT"
     }'
   ```

2. **Save the JWT token:** Use the `token` from the response for subsequent requests

3. **Browse available slots:**
   ```bash
   curl http://localhost:3000/api/slots
   ```

4. **Book an appointment:**
   ```bash
   curl -X POST http://localhost:3000/api/appointments \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "timeSlotId": "SOME_SLOT_ID",
       "notes": "I am experiencing headaches"
     }'
   ```

---

## Environment Variables

Create a `.env.example` file or use the provided one as reference. Here's the complete list:

```env
# Server Configuration
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/midslot?schema=public"

# JWT Configuration
JWT_SECRET=midslot-super-secret-key-2026
JWT_EXPIRES_IN=7d
```

### Production Considerations

For production deployment:

1. **Change `JWT_SECRET`** to a strong random string (min 32 characters)
2. **Change `JWT_EXPIRES_IN`** for your security needs (e.g., `24h` for shorter duration)
3. **Use environment-specific databases** (never use dev credentials)
4. **Enable HTTPS** (use a reverse proxy like nginx)
5. **Add rate limiting** to prevent abuse
6. **Enable CORS** if frontend is on different origin
7. **Set up monitoring** and error tracking

---

---

## Development Tips

### Running Tests

```bash
npm test
```

### Code Quality

```bash
# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Database Management

```bash
# Generate new Prisma client after schema changes
npm run prisma:generate

# Create a new migration
npm run prisma:migrate

# Reset database (deletes all data)
npx prisma migrate reset

# View database with Prisma Studio
npx prisma studio
```

### Debugging

- Check logs in the terminal where `npm run dev` is running
- All endpoints use structured error handling with status codes
- The `/api/health` endpoint can be used to verify the server is responsive

---

## License

ISC

---

## Support

For questions or issues, please contact the development team or open an issue on the GitHub repository.

**Repository:** https://github.com/h4s4nk44n/MidSlot

---

_Last updated: May 4, 2026_

## Team Members

| Fullname           | Student ID  |
|:-------------------|:------------|
| Efe Can Ezenoglu   |             |
| Hasan Kaan Doygun  |             |
| Taha Turkay Aktas  |             |
| Ahmet Kerem Ince   |             |
