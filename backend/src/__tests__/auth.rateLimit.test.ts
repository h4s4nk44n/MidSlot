import request from "supertest";
import app from "../index";

describe("POST /api/auth/login — strict rate limit (5 req / 15 min)", () => {
  it("returns 429 with Retry-After on the 6th request", async () => {
    const payload = { email: "ratelimit@test.com", password: "password123" };

    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send(payload);
    }

    const res = await request(app).post("/api/auth/login").send(payload);

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.error).toBe("Too Many Requests");
  });
});
