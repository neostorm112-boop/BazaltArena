# ADR-001: API Contract and Domain Invariants

## Status

Accepted

## Context

- Frontend already depends on a stable data shape for auth, profile, hall of fame, sprint submissions, and metrics.
- Internal persistence (Prisma models) must not leak raw DB shape to the public client contract.

## Decision

- Public contract is versioned REST: `/api/v1/*`.
- BFF owns DTO mapping and validation, and is the only API used by the React client and admin.
- Postgres (Prisma, `bff` schema) is the source of truth for domain entities; admin workflows go through BFF `/api/v1/admin`.

## Invariants

1. `solution` like is idempotent: one user can like a solution at most once.
2. `submission` requires `repoUrl`; `demoUrl` is optional.
3. Hall sorting is deterministic:
   - `efficiency`: by `mentorScore` desc, then `likes` desc.
   - `likes`: by `likes` desc, then `mentorScore` desc.
4. Auth tokens are Bearer JWT and can be revoked through logout.
5. Error responses follow `{ code, message, details? }`.

## Consequences

- Frontend integration remains stable even if internal Prisma models evolve behind the same DTOs.
- Additional endpoints can evolve behind `/api/v2` without breaking existing clients.
