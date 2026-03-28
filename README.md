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
├── middlewares/     # Express middleware
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/          # Shared utilities
└── index.ts        # Application entry point
prisma/
└── schema.prisma   # Database schema
```

### API Endpoints

| Method | Path          | Description  |
| ------ | ------------- | ------------ |
| GET    | `/api/health` | Health check |

# Team Members

| Fullname          |
|:------------------|
| Ahmet Kerem Ince  |
| Efe Can Ezenoglu  |
| Hasan Kaan Doygun |
| Onur Pinarbasi    |
| Taha Turkay Aktas |