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
- [API Documentation](#api-documentation)
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

- ✅ User authentication with JWT tokens
- ✅ Role-based access control (Doctor/Patient)
- ✅ Time slot management with overlap detection
- ✅ Appointment booking system
- ✅ Doctor profiles and specialization search
- ✅ Doctor dashboard with analytics
- ✅ Comprehensive API documentation
- ✅ Error handling with custom error types

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
Represents both doctors and patients in the system.

| Field      | Type      | Description                 |
| ---------- | --------- | --------------------------- |
| `id`       | UUID      | Primary key                 |
| `email`    | String    | Unique email address        |
| `password` | String    | Bcrypt hashed password      |
| `name`     | String    | User's full name            |
| `role`     | Enum      | `DOCTOR` or `PATIENT`       |
| `createdAt`| DateTime  | Account creation timestamp  |
| `updatedAt`| DateTime  | Last update timestamp       |

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

```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
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
npm run dev
```

The server will start on `http://localhost:3000` with hot-reload enabled via nodemon. Modify any TypeScript file and changes will reload automatically.

### Production Build

```bash
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

The web app lives in [`frontend/`](./frontend) (Next.js App Router + Tailwind).

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev                        # http://localhost:3000
# or: npm run build && npm start   # production (standalone output)
```

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
- `password` (string, required): Min 6 characters
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

**Error Responses:**

| Status | Error                | Cause                           |
| ------ | -------------------- | ------------------------------- |
| 400    | Invalid input        | Missing/malformed fields        |
| 401    | Invalid email or password | Wrong credentials           |

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

_Last updated: March 30, 2026_

---

#### GET /api/slots

Get all available slots  
**Auth:** Public
**Response(200):**
```
{
  "message": "Available time slots retrieved successfully.",
  "slots": [
    {
      "id": "uuid-here",
      "doctorId": "uuid-here",
      "date": "2026-04-01T00:00:00.000Z",
      "startTime": "2026-04-01T09:00:00.000Z",
      "endTime": "2026-04-01T09:30:00.000Z",
      "isBooked": false,
      "createdAt": "2026-03-25T10:00:00Z",
      "doctor": {
        "user": {
          "name": "Dr. Name",
          "email": "drname@example.com"
        }
      }
    }
  ]
}
```

# Team Members

| Fullname          |
|:------------------|
| Efe Can Ezenoglu  |
| Hasan Kaan Doygun |
| Taha Turkay Aktas |
| Ahmet Kerem Ince  |
