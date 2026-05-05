/**
 * Jest setup — runs once before any test file is loaded.
 *
 * Loads .env.test so that `import "../index"` in test files can pass the
 * `assertRequiredEnv()` startup check (JWT_SECRET, etc).
 *
 * Wired in via jest.config.ts -> setupFiles.
 */
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.test") });
