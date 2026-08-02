# Architecture Decision Records

Short records of significant technical decisions made on this project — what was decided, why, and what it costs. Written after the fact where useful (including documenting real bugs found during development), not as upfront design theater.

| ADR | Title |
|---|---|
| [001](./001-rls-authorization.md) | Authorization enforced at the database layer, not the application layer |
| [002](./002-2fa-assurance-gating.md) | Two-factor authentication gated by session assurance level, not session presence |
| [003](./003-rls-integration-tests.md) | RLS policies are verified against the live database in CI, not assumed correct |
| [004](./004-e2e-tests-and-simulation-design.md) | End-to-end tests drive the real deployed site; stress/Monte Carlo tools never write to the database |
| [005](./005-approval-workflow.md) | Approval workflow is a queued table, not a database constraint |
| [006](./006-serverless-free-tier.md) | Fully serverless architecture on free-tier infrastructure |
