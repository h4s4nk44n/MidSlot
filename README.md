# MediSlot

## MediSlot Backend

Medical appointment scheduling platform — backend API built with Express, TypeScript, and Prisma.

### Properties

- Runtime: `Node.js` + `TypeScript`
- Framework: `Express.js`
- ORM: `Prisma`
- Authorization: `JWT`

### Prerequisites

- Node.js >= 18
- PostgreSQL
- npm

### Getting Started

```bash
# Install dependencies
npm install

# Copy and configure environment variables
# Edit .env with your actual PostgreSQL credentials
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start dev server with hot reload   |
| `npm run build`      | Compile TypeScript to `dist/`      |
| `npm start`          | Run compiled production build      |
| `npm run lint`       | Run ESLint                         |
| `npm run lint:fix`   | Run ESLint with auto-fix           |
| `npm run format`     | Format code with Prettier          |

### Project Structure

```
src/
├── controllers/    # Request handlers
├── middlewares/    # Express middleware
├── routes/         # Route definitions
├── services/       # Business logic
├── types/          # Used structures
├── utils/          # Shared utilities
├── validations/    # Validation logic
├── validators/     # Validator handlers
└── index.ts        # Application entry point
prisma/
└── schema.prisma   # Database schema
```

### API Endpoints

| Method |        Path         |     Description     |
|:------:|:-------------------:|:-------------------:|
|  GET   |    `/api/health`    |    Health check     |
|  POST  |    `/api/login`     |    Login action     |
|  POST  |   `/api/register`   |   Register action   |
|  GET   |      `/api/me`      |    Personal data    |
|  GET   |    `/api/slots`     |    Retrive slots    |
|  POST  |    `/api/slots`     |    Add to slots     |
|  PUT   |  `/api/slots/:id`   | Update slot with id |
| DELETE |  `/api/slots/:id`   | Delete slot with id |

### Endpoint Formats

#### GET /api/health

Get health status  
**Auth:** Public  
**Response(200):**
```
json

{
  "status": "ok"
}
```

---

#### POST /api/register

Register new user  
**Auth:** Public  
**Request:**
```
json

{
  "email": "John@Doe.com",
  "name": "John Doe",
  "password": "secret123",
  "role": "PATIENT"
}
```

**Response(201):**
```
{
  "id": "uuid-here",
  "email": "user@example.com",
  "name": "Ali Vural",
  "role": "PATIENT",
  "createdAt": "2026-03-25T10:00:00Z"
}
```

---

#### POST /api/login

Login user  
**Auth:** Public  
**Request:**
```
json

{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response(200):**
```
{
  "token": "jwt-token-here",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "role": "PATIENT"
  }
}
```

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
