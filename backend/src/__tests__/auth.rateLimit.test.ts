import request from "supertest";
import app from "../index";

describe("POST /api/auth/login — strict rate limit (5 req / 15 min)", () => {
  // .env.test sets DISABLE_RATE_LIMIT=true so other tests can hammer the
  // login endpoint to exercise lockout. This test specifically needs the
  // limiter active, so flip it off only for this describe.
  let prevDisable: string | undefined;
  beforeAll(() => {
    prevDisable = process.env.DISABLE_RATE_LIMIT;
    delete process.env.DISABLE_RATE_LIMIT;
  });
  afterAll(() => {
    if (prevDisable === undefined) {
      delete process.env.DISABLE_RATE_LIMIT;
    } else {
      process.env.DISABLE_RATE_LIMIT = prevDisable;
    }
  });

  it("returns 429 with Retry-After on the 6th request", async () => {
    // Use a unique payload per test run so the rolling-window counter
    // (keyed on IP) starts fresh. supertest assigns a fresh ephemeral port,
    // but the IP-keyed limiter persists across tests, so include a random
    // email to avoid colliding with previous runs.
    const payload = {
      email: `ratelimit-${Date.now()}@test.com`,
      password: "password123",
    };

    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send(payload);
    }

    const res = await request(app).post("/api/auth/login").send(payload);

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.error).toBe("Too Many Requests");
  });
});
