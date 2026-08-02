# ADR-004: End-to-end tests drive the real deployed site; stress/Monte Carlo tools never write to the database

## Status
Accepted

## Context
Two related but separate concerns: (1) unit tests and RLS integration tests (ADR-003) both verify correctness at the logic and data layer, but neither one drives an actual browser through the actual UI — the 2FA bug in ADR-002 is a concrete example of a defect that only a full user-flow test would catch; (2) the Stress Testing and Monte Carlo tools intentionally model hypothetical scenarios ("what if a regulatory crackdown hit Compliance risks"), and it would be easy to accidentally treat that hypothetical data as real if it were persisted.

## Decision
Playwright drives a real headless browser against the live Vercel deployment in CI, using the same test accounts as the RLS integration tests, checking things like "the login form renders" and "a viewer role does not see the New Risk button in the actual rendered UI" — not just that the underlying permission is correct, but that the UI correctly reflects it.

Separately, Stress Testing and Monte Carlo simulation are architected as pure client-side, in-memory transforms of the currently loaded risk data. Neither tool ever calls `.insert()`, `.update()`, or persists anything. Applying a stress scenario clones the risk array, shifts likelihood/impact per category, and recomputes derived stats — the original data in the database is untouched regardless of what scenario is run.

## Consequences
- CI catches integration-level UI bugs (wrong button visible to wrong role, broken login flow) in addition to unit-level logic bugs and database-level permission bugs.
- Stress testing and Monte Carlo results can never accidentally corrupt real risk data, even under a misclick or a bug in the simulation code itself, since there is no write path from those tools to the database at all.
- The tradeoff: stress test results aren't saved anywhere and reset when the page is closed. If historical "what we tested and when" tracking becomes valuable later, that would need a deliberate, separate persistence layer — not a natural extension of the current one.
