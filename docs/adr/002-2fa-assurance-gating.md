# ADR-002: Two-factor authentication gated by session assurance level, not session presence

## Status
Accepted

## Context
Supabase marks a user "signed in" the moment their password is verified — before checking whether that account also requires a second factor. The first implementation listened for that "signed in" auth event and immediately rendered the dashboard, which meant the 2FA prompt (built and functionally correct in isolation) never actually ran: the parent component had already switched views before the child got a chance to challenge the user.

This is a subtle bug because both halves work when tested independently — the password check works, the 2FA challenge works — the failure is only visible in the full login sequence.

## Decision
Authentication state is now checked in two dimensions, not one: whether a session exists (`session !== null`), and separately, whether that session has reached the required assurance level (`supabase.auth.mfa.getAuthenticatorAssuranceLevel()`, comparing `currentLevel` against `nextLevel`). The dashboard only renders when both are true. A dedicated `MFAChallenge` component sits between the auth gate and the dashboard, shown whenever a session exists but assurance level hasn't been reached yet.

## Consequences
- Login is genuinely two-step for any account with a verified TOTP factor — password success alone is not sufficient to reach the dashboard.
- The fix required restructuring which component owns the "what do I render" decision (moved from the login form itself to the top-level auth gate), not just patching the symptom.
- This is the kind of bug unit tests wouldn't catch, since each piece was individually correct — it's specifically why the Playwright end-to-end tests (ADR-004) exist: to verify full user flows, not just isolated logic.
