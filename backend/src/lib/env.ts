/**
 * Fail-fast validation for required environment variables. Call once from the
 * server entry point AFTER `dotenv.config()` so .env values are loaded.
 */
export function assertRequiredEnv(): void {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set and at least 32 characters long. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
}
