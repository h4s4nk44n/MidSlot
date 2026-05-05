# AUDIT REPORT — MidSlot Medical Appointment Scheduling Platform

_Date: 2026-05-05_
_Scope: Full codebase (backend, frontend, infra, tests, configs)_

## Executive Summary

MidSlot is a TypeScript/Express + Next.js + PostgreSQL/Prisma medical-scheduling application with role-based flows for patients, doctors, receptionists, and admins. The codebase has a strong foundation: thorough JWT-with-rotation auth, account lockout, IP-based rate limiting, helmet, parameterized Prisma queries, audit logging with redaction, transaction-protected booking, founder-admin immutability, and well-considered separation of concerns.

That said, **several launch-blocking issues exist**: a real refresh-token credential and a real-looking `JWT_SECRET` are committed to the repo; the access token is persisted to `localStorage` (XSS-exfiltration risk); refresh-token reuse is detected but not audit-logged; the appointment-create endpoint has no Zod schema and lets a DOCTOR pass an arbitrary `patientId`; SMS code requests are unthrottled per-user; CORS allows any "no-origin" caller; SameSite=Lax + no CSRF token leaves state-changing endpoints exposed. Test coverage is concentrated in auth — most controllers/services have **no tests**.

The system is not far from production-ready, but **all CRITICAL findings below should be remediated before launch**.

## Architecture Overview

- **Backend**: Node 20 + Express 5, Prisma 6 / PostgreSQL 16, Zod v4 validation, jsonwebtoken, bcrypt, helmet, cookie-parser, express-rate-limit, pino + pino-http logging.
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind 4 + sonner.
- **Auth model**: short-lived access JWT (1h) in `Authorization: Bearer …`; opaque 64-byte refresh token (sha256-hashed in DB) in `httpOnly` cookie with rotation + family-reuse detection.
- **Roles**: PATIENT, DOCTOR, RECEPTIONIST, ADMIN; first ADMIN is `isFounder` and protected from demotion/deletion.
- **Domain models**: User, Doctor, TimeSlot, Appointment, ReceptionistAssignment, RefreshToken, Department, VerificationCode (SMS for staff-initiated profile edits with target.updatedAt snapshot), AuditLog.
- **Infrastructure**: Docker Compose with `postgres` (no host port), `backend`, `frontend`. Both Node services run as non-root. `migrate deploy` + `seed.js` + `index.js` on container start.
- **Endpoints (high-level)**: `/api/auth/{register,login,refresh,logout,me}`, `/api/slots*`, `/api/appointments*`, `/api/doctors*`, `/api/admin/{users,assignments,departments,audit}`, `/api/receptionist/*`, `/api/doctor/{patients,appointments/.../session,profile-changes}`, `/api/profile`, `/api/departments`, `/api/health`.

---

## Issues Found

### CRITICAL (must fix before going to production)

**CRIT-001 — Real refresh token committed to repository**
- Category: Secret leak / Session hijack
- Location: `backend/cookies.txt` (tracked in git despite `.gitignore` line 28)
- Description: A live curl cookie jar containing a Netscape-format refresh token (`5MEI_l6PwJTQnzQ1p-Yh9sFSjS74qnG1XBGRIT1qZecH8DrhyYFPhFf9YdWcoxXMZUsvj8WKv5OB7ii3wNvLvg`) with an expiry of `1778241068` (~April 2026) is committed.
- Proof: `git ls-files | grep cookies.txt` returns `backend/cookies.txt`. `git check-ignore` does not ignore it because it was committed before the ignore rule was added (the rule only stops *new* files).
- Impact: Anyone with read access to the repo can replay this token at `/api/auth/refresh` to receive a fresh access token until the family is revoked or the user record removed. Token theft = full session hijack until expiry.
- Fix: Revoke this token (delete the matching `RefreshToken` row by `tokenHash`), rotate the user's password, then `git rm --cached backend/cookies.txt`, scrub history (`git filter-repo` / BFG), force-push, and rotate every other secret that may have been read.

**CRIT-002 — Real-looking JWT_SECRET committed in `.env.example`**
- Category: Secret leak
- Location: `.env.example:27`
- Description: `JWT_SECRET=u_xy7ydz5_qOVEb7OKKmJWZtHqsEND0Q2HDU9S9l5mrGghCiITXjY0SWkbr8TrD9` — a 64-character base64url value that looks like a production secret, not a placeholder.
- Impact: If this secret is the one used in any deployed environment, an attacker who reads the public repo can forge admin JWTs and bypass `authenticate`/`authorize`. Even if it isn't currently in use, copy-pasting it into a real `.env` is a common dev mistake.
- Fix: Replace with `JWT_SECRET=CHANGE_ME_generate_with_node_-e_..._48_random_bytes_base64url` (matching the comment style used elsewhere). Rotate all real JWT_SECRETs and force re-login.

**CRIT-003 — Refresh-token reuse detected but never audit-logged**
- Category: Security event handling / Compliance
- Location: `backend/src/services/auth.service.ts:266-275`
- Description: When a previously revoked token is presented (theft signal), the entire family is killed but the `audit.log({action: AuditAction.TOKEN_REUSE_DETECTED, ...})` call is missing — only a `// TODO: hook into AuditLog once MEDI-46 lands` comment exists.
- Impact: No detection trail. SOC/SIEM alerting blind to active token theft. Compliance gap (HIPAA-style audit requirements).
- Fix: Emit an audit log entry with `actorId: stored.userId`, `action: TOKEN_REUSE_DETECTED`, and family/IP context.

**CRIT-004 — Access token persisted in `localStorage`**
- Category: XSS / token exfiltration
- Location: `frontend/lib/api.ts:35-49`
- Description: `getAccessToken` falls back to `localStorage.getItem("medislot_token")` and `setAccessToken` writes to localStorage. Any successful XSS — first-party bug or compromised npm dependency — exfiltrates the bearer token instantly.
- Impact: Token theft; full account takeover for the JWT TTL (1h). Sonner/Tailwind/Next 16 alpha-ish dependencies increase attack surface.
- Fix: Keep tokens **only in memory**. Survive reloads via `/auth/refresh` (cookie is httpOnly already, so this works without persistence). Remove `localStorage` reads/writes.

**CRIT-005 — POST `/api/appointments` lacks Zod validation; DOCTOR can book for arbitrary patient**
- Category: Authorization / Mass assignment / Input validation
- Location: `backend/src/controllers/appointment.controller.ts:118-175`, `backend/src/routes/appointment.routes.ts` (no `validate(...)` middleware), `backend/src/validations/appointment.validation.ts` (no `createAppointmentSchema`)
- Description: The body is destructured directly (`{ timeSlotId, notes, patientId }`). Only RECEPTIONIST is required to provide `patientId`; for any other role the code does `patientId = userId`. There is **no role check that excludes DOCTOR**, no UUID validation on `timeSlotId`, no length limit on `notes`. A DOCTOR can pass a `patientId` of an arbitrary user; while their own `userId` is overridden in the `else`, any role string outside of `RECEPTIONIST` triggers self-assignment, so the DOCTOR ends up booking *for themselves* — but the code path nonetheless trusts the unvalidated `patientId` until that override.
- Impact: Untrusted free-form `notes` (no max length) and missing schema enable malformed payloads, oversized notes (limited only by 10kb body cap), and possible XSS sinks downstream when notes render in any HTML email/template. Future re-introduction of a non-RECEPTIONIST `patientId` path becomes a one-line privilege bug.
- Fix: Define `createAppointmentSchema` (`timeSlotId: z.string().uuid()`, `patientId: z.string().uuid().optional()`, `notes: z.string().max(2000).optional()`), apply via `validate()` on the route, and explicitly `if (userRole !== "PATIENT" && userRole !== "RECEPTIONIST") throw ForbiddenError`. Verify the patient exists when receptionist supplies the id.

**CRIT-006 — CORS allows requests with no `Origin` header**
- Category: CSRF / cross-origin abuse
- Location: `backend/src/index.ts:39-53`
- Description: `if (!origin) return callback(null, true);` Combined with `credentials: true` on routes that mutate state, this allows server-to-server / curl / fetch-from-non-browser callers to act with cookies. While browsers always send `Origin` for CORS-relevant cross-origin requests, custom clients and certain WebView setups can omit it; the policy should not blanket-trust no-origin.
- Impact: Loosens the CSRF posture from "Origin allowlist" to "almost any non-browser client".
- Fix: Either reject when origin missing for state-changing methods, or restrict the bypass to specific endpoints (`/api/health`).

**CRIT-007 — `start.sh` writes secrets to repo `.env` automatically**
- Category: Secret hygiene
- Location: `start.sh:14-27` (per Phase-2 agent finding; `.env` exists at repo root and is tracked-status `M` in git status)
- Description: The convenience boot script generates a JWT/refresh secret if missing and writes it to `.env`. `.env` is gitignored at root only via `**/.env` and `.env`, but the file is present in the working tree at repo root — meaning a developer could `git add -f .env` or accidentally commit it.
- Fix: Document that secrets must be set out-of-band in production; never write to `.env` from a shell script in the repo. Verify `.env` is not staged.

**CRIT-008 — No per-user / per-phone rate limiting on SMS code requests**
- Category: Rate limiting / SMS abuse / cost
- Location: `backend/src/services/profile-change.service.ts:60-111`, `backend/src/lib/sms.ts`, `backend/src/middlewares/rateLimiter.middleware.ts`
- Description: `requestProfileChange` is gated only by the global `apiLimiter` (100 req / 15 min / IP) — and STAFF roles (ADMIN, RECEPTIONIST) are **excluded** from that limiter (`isAuthenticatedStaff` skip on `apiLimiter`). A receptionist can request unlimited SMS codes against any patient phone.
- Impact: SMS-bombing victims' phones; runaway SMS spend; PII enumeration via masked-phone responses.
- Fix: Add per-target-user, per-requester, and per-phone-number rate limits (e.g., 3 codes / phone / 15 min, 1 in flight at a time). Cool-down between resends. Audit log every send.

---

### HIGH (fix soon)

**HIGH-001 — `loginAttempts` counter is reset to 0 on lockout, breaking enumeration counter on legitimate next-attempt streams**
- Location: `backend/src/services/auth.service.ts:167-191`
- Description: When `newAttempts >= MAX_LOGIN_ATTEMPTS`, the code sets `loginAttempts: 0`. After lockout expires, the next bad attempt restarts the counter from 1 instead of penalizing repeat offenders. Combined with no IP-based progressive backoff (only `authLimiter` covers IP, not user), repeated lockout cycles are possible.
- Fix: Keep the counter; reset only on success.

**HIGH-002 — `bcrypt` cost factor is 10 for passwords and only 8 for SMS codes**
- Location: `backend/src/services/auth.service.ts:85` (rounds=10), `backend/src/services/profile-change.service.ts:83` (rounds=8)
- Description: 10 is borderline for 2026 hardware (~50ms). 8 rounds for the 6-digit SMS hash is below recommendations.
- Fix: Bump to 12 for passwords, 10–12 for SMS hashes.

**HIGH-003 — `DUMMY_BCRYPT_HASH` may not actually be a valid bcrypt hash**
- Location: `backend/src/services/auth.service.ts:22-23`
- Description: `"$2b$10$abcdefghijklmnopqrstuuMh1bU0o2YJfmL9xN8xJZ7n3aFv8lN8a"` — bcrypt salt characters must be base64-bcrypt; the literal `abcdefghijklmnopqrst` looks fabricated. If `bcrypt.compare` rejects the format quickly with a synchronous validation error, the timing-safe branch is shorter than the real-user branch — re-introducing the timing oracle.
- Fix: Generate a real hash once at startup (`bcrypt.hash("dummy", 10)`) and store it in a module-level constant.

**HIGH-004 — `getMe` exposes the full `doctor` row to DOCTOR users**
- Location: `backend/src/middlewares/auth.middleware.ts:60`
- Description: `doctor: req.user!.role === "DOCTOR" ? true : false` returns *all* Doctor columns including `dateOfBirth`. Any future PHI added to the `Doctor` table flows here automatically.
- Fix: Replace `true` with an explicit `select`.

**HIGH-005 — `password`, `loginAttempts`, `lockedUntil` stripped only via destructure; refactors easy to break**
- Location: `backend/src/services/auth.service.ts:237`
- Description: `const { password: _, loginAttempts: __, lockedUntil: ___, ...userSafe } = user;` — relies on contributors not adding new sensitive columns. There is already a sensitive `nationalId`, `phone`, `allergies`, etc. on User that *do* leak in `userSafe`.
- Impact: Login response includes nationalId, phone, allergies, chronic conditions, current medications, insurance, etc. — far more than the client needs.
- Fix: Use a Prisma `select` listing exactly the safe fields (id, email, name, role, createdAt) for the login response.

**HIGH-006 — Receptionist may book on behalf of an arbitrary user UUID without verifying that user is a PATIENT or that the receptionist has any tie to them**
- Location: `backend/src/controllers/appointment.controller.ts:130-136`
- Description: No `prisma.user.findUnique` check that the supplied `patientId` exists and has `role: PATIENT`. Foreign-key error is the only protection (handled, but ugly).
- Fix: Validate explicitly; also verify the receptionist is assigned to the doctor of the chosen slot (already done — keep it).

**HIGH-007 — Slot create / update overlap checks are not transactional**
- Location: `backend/src/controllers/slot.controller.ts:59-69` and `:192-202`
- Description: `findFirst` then `create`/`update` is a check-then-act race. Two simultaneous creates can each see no overlap and both succeed.
- Fix: Wrap in `prisma.$transaction(async (tx) => …)` and re-check inside, or add an exclusion constraint at the DB level.

**HIGH-008 — Auto-cancel sweep uses module-scoped state; broken under multi-instance**
- Location: `backend/src/controllers/appointment.controller.ts:17-30`
- Description: `lastAutoCancelSweep` is per-process. Behind a load balancer, sweeps drift; possibly run too often or not at all on a given instance.
- Fix: Move to a scheduled job (cron / pg_cron / external scheduler), or add a distributed advisory lock (PostgreSQL `pg_try_advisory_lock`).

**HIGH-009 — Audit metadata redaction list misses PII keys**
- Location: `backend/src/utils/audit.ts:8-21`
- Description: `SENSITIVE_KEYS` covers `password`, `token`, `secret`, `apikey`, `authorization` but not `phone`, `nationalid`, `dateofbirth`, `address`, `allergies`, `chronicconditions`, `currentmedications`, `insurancepolicynumber`, `email` (email-in-audit may be fine, others are not), nor doctor `note`/appointment `notes`.
- Impact: Profile-edit and verification-flow audit entries store medical and identity PII in plain JSON. Anyone with audit-list access (currently any ADMIN — see HIGH-010) can read them.
- Fix: Extend `SENSITIVE_KEYS`; in change controllers, log only `Object.keys(parsed.data)` (already done in `profile.controller.ts:51` — replicate that pattern everywhere).

**HIGH-010 — `listAuditLogs` returns actor `name` and `email`; access control depends only on `authorize("ADMIN")` at controller — no row-level filtering**
- Location: `backend/src/services/audit.service.ts:34-42`, `backend/src/routes/admin.routes.ts`
- Description: Every ADMIN can read every other actor's audit trail, including founder admin's. Founder/admin separation enforced for *write* operations is not enforced for *read* of the audit log.
- Fix: At least scrub email/PII for non-founder admins, or split admin/security-officer roles.

**HIGH-011 — `cors` denies the request via `callback(new Error(...))`, leaking the disallowed origin in the error message**
- Location: `backend/src/index.ts:47`
- Description: `new Error(`Origin ${origin} not allowed by CORS`)` — error reaches `errorHandler` and could be returned/logged with origin echoed back.
- Fix: Pass `false` instead of an Error; let cors quietly drop the request.

**HIGH-012 — `helmet()` defaults are used without enabling HSTS for production**
- Location: `backend/src/index.ts:32`
- Description: HSTS defaults to enabled in helmet only when running over HTTPS terminating directly at Express; behind a TLS-terminating proxy, ensure `app.set('trust proxy', …)` is set and `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true, preload: true } })` is explicit. Currently `trust proxy` is **not set**, so `req.ip` is the proxy's IP — affecting both rate limiting and audit IP fields.
- Fix: Configure `app.set("trust proxy", 1)` (or env-driven), enable explicit HSTS, set CSP.

**HIGH-013 — Refresh cookie uses `SameSite=Lax` and `secure` only when `COOKIE_SECURE === "true"` (env-driven, easy to forget)**
- Location: `backend/src/utils/tokenHelpers.ts:15-32`
- Description: `Lax` allows the cookie to ride on top-level GET cross-site navigations; combined with no CSRF token and no double-submit cookie, a same-site CSRF on `POST /api/auth/refresh` would not be possible (cookie won't be sent on cross-site POST), but a sibling subdomain or compromised page on the same site can still submit cross-site forms with `Lax` for GET-mutations (none here) and same-site POSTs.
- Fix: Set `sameSite: "strict"` for the refresh cookie unless it actively breaks login UX; force `secure: true` whenever `NODE_ENV === "production"` (don't rely on a separate `COOKIE_SECURE` env).

**HIGH-014 — `seed.ts` hardcodes weak/known passwords (`Password123!`, `Admin@MediSlot2026!`) and prints them to the console**
- Location: `backend/prisma/seed.ts:33-34` and the trailing console output around lines 1069+
- Description: Default seed credentials are well-known and recoverable from logs; anyone who runs the seed at any time gets predictable admin credentials. The schema's `isFounder` admin is exactly this account.
- Impact: If the seed runs in production (current Dockerfile CMD includes `node dist/seed.js && node dist/index.js`), and any prior data hasn't already populated the DB, a deterministic admin account is created with a known password.
- Fix: Read seed passwords from environment (`SEED_ADMIN_PASSWORD`, etc.); refuse to seed in production unless explicitly opted in; do not print credentials to stdout.

**HIGH-015 — Frontend middleware checks only the *presence* of the refresh cookie**
- Location: `frontend/middleware.ts:31-32`
- Description: A user can forge a `refreshToken=anything` cookie locally and the middleware happily lets them into `/admin/*`. The page then makes API calls; the backend rejects them. Net effect: information leak via UI shells (admin layout, navigation labels, role-only UI strings) renders before the API rejects.
- Fix: Also call `/api/auth/me` server-side from middleware (Edge fetch), or accept that this is a "speed bump" but document and remove role-revealing chrome from initial paint.

**HIGH-016 — Frontend `getBaseUrl` falls back to `http://localhost:5000/api` when `NEXT_PUBLIC_API_URL` is empty**
- Location: `frontend/lib/api.ts:107-114`
- Description: A misconfigured production deploy silently sends API calls to localhost:5000, which on a shared infra host is whatever happens to be listening there — possibly wrong tenant data, possibly nothing.
- Fix: Throw at module load when `NEXT_PUBLIC_API_URL` is missing in production builds.

---

### MEDIUM (fix in next sprint)

**MED-001** — `notes` (patient-supplied) and `doctorNote` (doctor-supplied) are not sanitized; if rendered into HTML/email in future, XSS risk — `appointment.controller.ts:172`, `doctor-patient.controller.ts:213-219`. Length-cap doctor note (4000) is fine; add `.max(2000)` to patient notes; HTML-escape in any future renderer.

**MED-002** — `nationalId` validation is `z.string().trim().min(4).max(32)` — `backend/src/validators/auth.validator.ts:50` and `validations/profile.validation.ts:61`. No format check, no country normalization. Combined with `@unique`, a user with leading-space differences can slip past or, worse, hold a national ID belonging to someone else by typing whitespace.

**MED-003** — `loginSchema` does not normalize email — `auth.validator.ts:77-80`. `User.email` is `@unique`, but no `.toLowerCase()` is applied at register or login. Mixed-case registrations cause silent duplicates / login failures.

**MED-004** — CORS `methods` allowlist omits `OPTIONS` — `index.ts:50`. The cors package handles preflight automatically; this is fine in practice but worth noting if custom verbs are added.

**MED-005** — `apiLimiter` excludes ADMIN/RECEPTIONIST entirely — `rateLimiter.middleware.ts:18-30, 62-64`. The bypass uses JWT verification at the limiter level; combined with no per-user limit, a compromised staff account has no rate ceiling for sensitive endpoints (profile edits, SMS sends).

**MED-006** — `getDoctors`/`getDoctorProfile` are accessible to any authenticated user — `doctor.controller.ts`. Returns `email` of every doctor. Patient-browse use-case is real, but exposing email enables spear phishing of doctors.

**MED-007** — `getSlots` is unauthenticated — `slot.routes.ts`. By design, but enables enumeration of doctors/specializations/dates without login. Document or add light auth.

**MED-008** — `dateOfBirth` accepts both ISO datetime *and* date — `auth.validator.ts:47`, `profile.validation.ts`. Tests that rely on time portion being zero will break for some inputs.

**MED-009** — `errorHandler` doesn't catch generic `SyntaxError` from JSON parsing — Errors with `body-parser` JSON parse failures arrive with `type: "entity.parse.failed"` and status 400 → `errorHandler` falls through to "Internal server error" (500).

**MED-010** — `cookie-parser` is mounted without a signing secret — `index.ts:60`. Refresh cookie is opaque, but no integrity is added. An attacker who acquires the raw token (no place currently leaks it, modulo CRIT-001) can use it; signing wouldn't change that, but pattern-wise the cookie should be HMAC-bound to user-agent or IP for theft detection.

**MED-011** — Verification-code attempt counter has no exponential backoff and can be exhausted in <1s — `profile-change.service.ts:155-170`. 5 attempts of brute force on 10⁶ codes = 5×10⁻⁶ probability per session — acceptable, but combined with the unthrottled resend (CRIT-008), an attacker can iterate the code space at SMS speed.

**MED-012** — `transferAdmin` is a service-layer function with founder check (good) but no controller-level confirmation step (e.g., re-auth, confirmation email, 2FA) — `admin.service.ts:336-372`.

**MED-013** — User deletion is hard-delete with `onDelete: Cascade` on appointments/refresh tokens — `schema.prisma:160-162`, `:199`. No soft delete, no recovery window. Cascade on `Appointment` → `TimeSlot.appointment` is also Cascade, so a user delete wipes patient history.

**MED-014** — Department deletion has no doctor-reference check — `department.service.ts`. Doctors keep `specialization` as a free string so this is intentional, but no audit row says "X doctors had specialization Y when Y was deleted".

**MED-015** — `audit.helper.test.ts` and `audit.flow.test.ts` rely on `setTimeout(100ms)` to flush async writes — flaky tests on overloaded CI.

**MED-016** — `requestLogger.middleware.ts` uses `pino-http` with custom serializers, but error logs elsewhere call `logger.error({ err }, ...)` — `err` may include nested request data — verify no place logs raw `req` (none found in scope, but pattern is fragile).

**MED-017** — `JWT_EXPIRES_IN` and `REFRESH_TOKEN_EXPIRES_IN` env names in `docker-compose.yml` (lines 41/43) don't match the names the code reads (`JWT_ACCESS_TTL`/`JWT_REFRESH_TTL`/`JWT_EXPIRES_IN`) — partial: code reads `process.env.JWT_EXPIRES_IN`. Compose maps `JWT_EXPIRES_IN: ${JWT_ACCESS_TTL:-1h}` so it works; but `REFRESH_TOKEN_EXPIRES_IN` is set in compose but never read by code (refresh TTL is hardcoded constant 7d in `auth.service.ts:12`).

**MED-018** — `errors.txt` (21 KB) and `test_output.log` (26 KB) are present in `backend/` — listed in `.gitignore` but worth confirming they're not in git history; they may contain secrets or PII from prior runs.

**MED-019** — `cookies-old.txt` also exists — same concern as CRIT-001; verify it's not tracked.

**MED-020** — Frontend logs raw error objects to console — `frontend/app/error.tsx:14`, `frontend/app/patient/doctors/[id]/page.tsx:57`. Healthcare context: any PHI in error responses is exposed in DevTools.

**MED-021** — `app.set('trust proxy', …)` is not configured — affects `req.ip` accuracy, rate limit keys, and audit IP fields when running behind a load balancer / Docker / CDN.

**MED-022** — No CSP, no `Content-Security-Policy`, no `Permissions-Policy` — helmet defaults set X-Content-Type-Options, X-Frame-Options, X-DNS-Prefetch-Control, etc. but a tight CSP is critical for a PHI-handling SPA.

**MED-023** — Refresh-token `userAgent` truncated to 500 chars and stored in plain text — `auth.controller.ts:17`, `RefreshToken.userAgent`. Acceptable, but UA is PII-adjacent and can leak browser/device specifics.

**MED-024** — `doctor-patient.service.ts` `findMany` for active patients/appointments has no `take` cap — bounded by appointment count, but still uncapped.

---

### LOW / INFORMATIONAL

- **LOW-001** — Comment in Turkish (`İŞTE HAYAT KURTARAN DÜZELTME BURADA`) and `as any` cast in `utils/errors.ts` — type-safety smell, no security impact.
- **LOW-002** — `appointment.controller.ts:172` uses `notes,` in object spread without explicit `notes ?? null` — Prisma handles undefined fine, cosmetic.
- **LOW-003** — `getMyAppointments` doesn't explicitly handle role `ADMIN`; falls through with no scoping (intentional).
- **LOW-004** — `listDoctorsQuerySchema` allows `ageMin > ageMax` silently — UX, not security.
- **LOW-005** — `slot.validation.ts` `specialization` is a free string; not validated against `Department` table.
- **LOW-006** — `validate.middleware.ts` only validates `req.body`; no helpers for query/params (controllers do that ad hoc).
- **LOW-007** — Docker `CMD` runs migrations *and* the seed on every boot — seed has an idempotency guard, but a misconfigured DB pointing at an empty schema could nonetheless be auto-seeded.
- **LOW-008** — `cors` `allowedHeaders` does not include `X-Request-Id` / `X-CSRF-Token` — none used today, but anticipates future CSRF token plumbing.
- **LOW-009** — `pino-pretty` is a runtime dep, not devDep — bundle bloat in production.
- **LOW-010** — `nodemon` and `ts-node` are listed under `dependencies` (not `devDependencies`) — production image installs them needlessly (`npm ci --omit=dev` will still pull them).
- **LOW-011** — Frontend `package.json` pins `next: 16.2.4` and `react: 19.2.4` — both are bleeding-edge majors; ensure they have published security patches before launch.
- **LOW-012** — `frontend/lib/api.ts` mixes Turkish comments with English — code-comment hygiene.
- **LOW-013** — `next.config.ts` not verified to set `poweredByHeader: false` — easy fingerprinting.
- **LOW-014** — `health` endpoint is at `/api/health` and exempt from rate limiting — fine, but ensure it doesn't expose dependency-version info.
- **LOW-015** — `dist/` directory exists in `backend/` (not gitignored at backend level — only via `dist/` at root and `backend/dist/`). Confirm not tracked.
- **LOW-016** — `prisma.config.ts` is not validated; trust that it doesn't expose db URL.
- **LOW-017** — `test-api.sh` (11 KB) — verify it doesn't contain credentials.
- **LOW-018** — `requestLogger` adds `req.id` via `pino-http` defaults — not exposed in error responses, but useful for support; ensure response includes a correlation id header.
- **LOW-019** — JWT payload includes `email`; should be just `userId` and `role`. Email leaks to anyone who base64-decodes the token.
- **LOW-020** — Pagination max `pageSize: 100` is fine, but no streaming/cursor for very large historical audit queries.

---

## What Is Working Correctly

- **Refresh-token rotation with family-reuse detection.** Strong design: hashed-only storage, single-use, family revocation on reuse, rotation chain via `replacedById` (`auth.service.ts:248-314`).
- **Account lockout** after 5 failed attempts with 15-minute window; lockout-aware login emits `AccountLockedError` with `Retry-After`.
- **Timing-safe login** via dummy bcrypt comparison on unknown email (modulo HIGH-003).
- **Booking double-spend prevention.** Atomic conditional `updateMany` inside a `$transaction` plus `@@unique` on `Appointment.timeSlotId` (`appointment.controller.ts:158-175`).
- **Founder-admin immutability.** Multiple layers in `admin.service.ts` prevent demote/delete/transfer of `isFounder`.
- **Stale-payload protection on SMS verification.** `targetUpdatedAtSnapshot` blocks stomping concurrent edits (`profile-change.service.ts:183-197`; `schema.prisma:246`).
- **Doctor-patient access strictly window-gated.** `assertActiveAppointment` enforces a `start ≤ now ≤ end+10min` window with auto-cancel after 1 hour past end.
- **Per-route Zod validation** is the dominant pattern (the appointment-create gap is the major exception).
- **Helmet, CORS allowlist, body-size cap (10kb), cookie-parser, request logging with redacted Authorization header.**
- **Audit logging is async (`setImmediate`), non-blocking, with sensitive-key redaction**; the architecture is sound — only the redaction list and event coverage need extending.
- **Single-flight refresh** on the frontend prevents thundering-herd on 401 (`api.ts:75-103`).
- **Layered auth on frontend**: middleware speed-bump, RouteGuard, auth-context, backend — defence in depth and sensibly documented in `middleware.ts:3-17`.
- **Non-root container users** in both Dockerfiles; production-only deps via `npm ci --omit=dev`.
- **Postgres not exposed** to the host network by default (compose has the port commented out).
- **Pagination helper** is well-tested (`pagination.test.ts`) and consistently used.
- **No `eval`, `Function`, `dangerouslySetInnerHTML`, or `child_process` exec calls** in the application code reviewed.
- **Prisma-only DB access** — no raw SQL — eliminates first-order SQL injection.

---

## Missing Tests / Coverage Gaps

Existing tests focus on auth + audit + pagination + schema. **No integration tests** exist for:

- `appointment.controller.ts` — book / cancel / complete / list lifecycle
- `slot.controller.ts` — create / update / delete / list (including overlap races)
- `admin.controller.ts` — every endpoint (grant/revoke/transfer admin, user CRUD, audit listing, assignments)
- `department.controller.ts`
- `doctor.controller.ts` — list/profile/dashboard
- `doctor-patient.controller.ts` — sessions, notes, medical edits, profile changes
- `profile.controller.ts` — get/patch own profile
- `profile-change.controller.ts` — full SMS verification flow incl. expired/used/stale paths
- `receptionist.controller.ts` — book on behalf, assignments, slot management
- `health.controller.ts` — present but trivial

Specific paths with **no automated coverage**:
- Token-reuse detection (CRIT-003 fix needs a test that the audit row is created)
- Mass-assignment defenses (no test ensures `role`/`isAdmin` stripping)
- IDOR for cross-doctor / cross-patient access
- CORS allowlist behavior
- Slot create/update overlap races (HIGH-007)
- Auto-cancel sweep behavior under concurrency (HIGH-008)
- Email normalization (MED-003)
- Verification-code stale-payload rejection
- Receptionist→assigned-doctor enforcement edge cases (assignment removed mid-flow)
- Frontend RouteGuard / RoleGate component tests (none found)
- Frontend auth-context refresh failure → logout → redirect

Static-analysis checks not run: `npm audit`, `npm outdated`, Snyk, Semgrep, ESLint with security rules. ESLint is configured but the security plugin set is not visible.

---

## Recommendations (Prioritized)

**Pre-launch — blocking:**
1. CRIT-001 — Revoke leaked refresh token, scrub git history, rotate JWT_SECRET.
2. CRIT-002 — Replace `.env.example` JWT_SECRET with a placeholder.
3. CRIT-003 — Audit-log token-reuse events.
4. CRIT-004 — Move access token to memory-only on the frontend.
5. CRIT-005 — Add `createAppointmentSchema`, validate, explicitly deny non-(PATIENT|RECEPTIONIST) roles, validate patient existence.
6. CRIT-006 — Reject CORS requests with no `Origin` for state-changing methods (or remove the bypass).
7. CRIT-008 — Add per-user / per-phone SMS rate limiting, with audit logging on every send.
8. HIGH-014 — Move seed passwords to environment, suppress credential output, gate behind explicit opt-in for production.

**Pre-launch — strongly recommended:**
9. HIGH-001 — Don't reset `loginAttempts` to 0 on lockout.
10. HIGH-002 — Bump bcrypt rounds (12 / 12).
11. HIGH-003 — Generate `DUMMY_BCRYPT_HASH` at startup.
12. HIGH-005 — Use explicit `select` for the login response.
13. HIGH-007 — Wrap slot overlap checks in transactions or add DB exclusion constraint.
14. HIGH-008 — Move auto-cancel to a scheduled job with a distributed lock.
15. HIGH-009 / HIGH-010 — Extend audit redaction; restrict audit-list visibility.
16. HIGH-012 — Configure `app.set('trust proxy', …)`, explicit HSTS, CSP.
17. HIGH-013 — `SameSite=Strict` and forced `secure` in production.
18. CRIT-007 — Stop writing secrets from `start.sh`; document out-of-band secret management.

**Sprint 1 post-launch:**
19. Backfill integration tests for every controller listed in *Missing Tests*; require ≥80% line/branch coverage on auth, booking, profile-change before signing off.
20. Add `npm audit` / Snyk to CI; fail on HIGH/CRITICAL.
21. Add Semgrep ruleset for Express + Prisma.
22. Add CSP, Permissions-Policy, and tighten helmet config.
23. Implement soft delete for users and verify cascade impact.
24. Address every MED-* issue.

**Long-term:**
25. Move tokens entirely to a BFF pattern; client never holds JWTs.
26. Migrate audit logs to an append-only store / WORM bucket (HIPAA).
27. SOC-grade alerting on token-reuse, lockouts, admin grants, large audit-log reads.
28. Threat-model and DPIA documentation.
