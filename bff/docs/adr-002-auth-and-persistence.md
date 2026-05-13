# ADR-002: Authentication, Persistence and Rate Limiting

## Status

Accepted

## Context

ADR-001 fixed the public API contract. ADR-002 covers the production-grade
implementation details for authentication, storage and abuse protection,
replacing the early in-memory `ArenaStore`.

## Decisions

### Password hashing — Argon2id

- Library: `argon2` (node-argon2, native binding).
- Variant: `argon2id` (default work factors from the library, tuned by `argon2.defaults`).
- Rationale: argon2id is the OWASP-recommended primitive for password storage,
  resistant to GPU and side-channel attacks. We never log or echo hashes
  (pino-redact catches `passwordHash` and `password`).

### Tokens — short-lived access + long-lived refresh

- Access token: HS256 JWT, 15 min default (`JWT_ACCESS_TTL_SECONDS`).
- Refresh token: HS256 JWT, 30 days default (`JWT_REFRESH_TTL_SECONDS`).
- Both tokens share a per-session `jti` (UUID).
- `session:{jti}` is stored in Redis (or in-process Map when Redis is absent)
  with the refresh TTL. Auth middleware rejects tokens whose `jti` is no longer
  active.
- `/auth/refresh` rotates `jti`: the old session is revoked atomically before
  a new pair is issued, so refresh tokens are single-use.
- `/auth/logout` revokes the current `jti`. Replaying the same refresh token
  after logout returns `401`.
- Secrets `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are required to be
  ≥ 32 chars and distinct; missing values fail-fast at startup
  (`src/config/env.ts`).

### Persistence — Postgres + Prisma

- Source of truth: PostgreSQL accessed through `@prisma/client`.
- Prisma schema lives in [`bff/prisma/schema.prisma`](../prisma/schema.prisma).
- Critical indexes:
  - `Submission(sprintId, mentorScore desc, likesCount desc)` — efficiency sort.
  - `Submission(sprintId, likesCount desc, mentorScore desc)` — likes sort.
  - `UNIQUE(SolutionLike.userId, submissionId)` — guarantees idempotent likes.
  - `UNIQUE(Submission.userId, sprintId)` — one submission per user/sprint.
- The BFF uses the dedicated `bff` Postgres schema (see Prisma). ADR-001's API
  contract guarantees that the frontend never observes raw persistence shapes.

### Rate limiting — Redis-backed, fail-open in dev

- `express-rate-limit` with `rate-limit-redis` store.
- Limits (per IP unless noted):
  - `login` — 5 / minute.
  - `register` — 3 / hour.
  - `refresh` — 30 / minute.
  - `like` (per authenticated user) — 30 / minute.
  - `submission` (per authenticated user) — 30 / hour.
- `RATE_LIMIT_DISABLED=true` is only accepted outside of production.

### Error contract

- `src/middleware/errorHandler.ts` normalizes responses to
  `{ code, message, details?, requestId }`.
- Mappings:
  - `ZodError` → `400 VALIDATION_ERROR`.
  - `AppError` → its declared status + code.
  - `PrismaClientKnownRequestError` `P2002` → `409 CONFLICT`.
  - `PrismaClientKnownRequestError` `P2025` → `404 NOT_FOUND`.
  - Anything else → `500 INTERNAL_ERROR`, with no stack/secret leakage.
- Every request has `x-request-id` echoed back; logs are correlated via
  pino's child logger (`req.log`).

## Consequences

- Horizontal scaling is safe: sessions and rate-limit counters live in Redis.
- Replaying a refresh token after rotation always fails (single-use refresh).
- A stale access token cannot survive logout for longer than its 15-min TTL,
  and is rejected immediately on subsequent calls because its `jti` is gone.
- Integration tests exercise the full auth flow against real Postgres
  (testcontainers) + in-memory Redis (`ioredis-mock`).
