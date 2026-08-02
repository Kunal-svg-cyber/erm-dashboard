# ADR-003: RLS policies are verified against the live database in CI, not assumed correct

## Status
Accepted

## Context
ADR-001 established that authorization lives in PostgreSQL RLS policies rather than the frontend. But writing a policy and knowing it's correct are different things — a typo, a missing `with check` clause, or a permissive default left over from debugging can silently reopen a hole that no amount of frontend testing would ever surface, since the frontend was never the thing enforcing the rule in the first place.

## Decision
Three dedicated test accounts (one per role: admin, owner, viewer) sign in via `supabase-js` in a CI job on every push, and a small set of assertions run directly against the real deployed Supabase project: a viewer cannot insert a risk, an owner cannot update a risk they don't own, an admin can update or delete any risk, and read access remains open to all signed-in roles as designed. These are integration tests, not mocks — they exercise the actual policies, not a simulation of them.

## Consequences
- A regression in RLS policies (e.g. from a future schema migration) fails CI immediately, rather than being discovered manually or, worse, in production.
- Test credentials are stored as GitHub Actions secrets and 2FA is deliberately left off those three accounts, since the automated client can't solve a TOTP challenge.
- These tests run against the same database the real app uses. A test risk with a fixed ID is created and torn down within the test run to avoid polluting real data.
