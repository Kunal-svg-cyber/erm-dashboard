# ADR-001: Authorization enforced at the database layer, not the application layer

## Status
Accepted

## Context
Most internal tools implement permissions by hiding UI elements based on the current user's role — a viewer doesn't see the "Edit" button, so the application appears secure. But that's enforcement in the wrong layer: any direct API call, misconfigured route, or frontend bug bypasses it entirely, since the database itself never checks who's asking.

## Decision
Every read and write to the `risks`, `profiles`, `category_thresholds`, and related tables is authorized via PostgreSQL Row-Level Security (RLS) policies, evaluated by the database on every query regardless of which client issued it. The three-tier role model (`admin` / `owner` / `viewer`) is encoded as policies, not as conditional rendering.

## Consequences
- A compromised or buggy frontend cannot leak unauthorized writes — the database refuses the query independent of what the UI allowed the user to attempt.
- Policies must be written and tested carefully; RLS bugs (e.g. a missing `search_path`, or a permissive `using (true)` left in from testing) are a real risk surface. See ADR-003 for how this is verified in CI.
- All Supabase client calls can safely use the public `anon` key from the frontend, since the database is the actual enforcement point rather than a trusted-frontend assumption.
