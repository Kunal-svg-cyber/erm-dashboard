# ADR-006: Fully serverless architecture on free-tier infrastructure

## Status
Accepted

## Context
This project was built under a hard constraint: no local installs, no paid services. That constraint shaped the architecture as much as any feature requirement did, and it's worth recording because it explains several choices that would otherwise look unusual (e.g. why AI features call Google's Gemini API instead of a self-hosted model, why there's no traditional backend server).

## Decision
Every piece of backend logic runs as either a Postgres function/trigger (schema-level) or a Supabase Edge Function (Deno-based serverless), deployed and edited entirely through browser-based dashboards — Supabase's SQL editor and function editor, GitHub's web file editor, Vercel's dashboard. Scheduled work (daily risk alerts) uses `pg_cron` rather than a persistent worker process. AI features (Athena, semantic search) call Google's Gemini API, which offers a genuinely free tier with no credit card requirement, rather than a self-hosted or paid model.

## Consequences
- Zero infrastructure to provision, patch, or monitor — there is no server that can go down independent of Supabase/Vercel/Google's own uptime.
- Debugging is harder than a local dev loop: several real bugs in this project (CORS headers missing on a new Edge Function, a deprecated Gemini model name, a Node.js WebSocket incompatibility in CI) were only discoverable by deploying and inspecting live logs or browser network requests, since there's no local reproduction step.
- Free-tier limits are real constraints, not just cost concerns — e.g. Supabase's free plan doesn't include the leaked-password-protection feature, which is why password strength is enforced client-side instead (a materially weaker guarantee than server-side breach-database checking).
- Vendor model names and APIs on the free tier changed multiple times during development (Gemini deprecated two different model identifiers within the build window), which is a maintenance cost this architecture accepts in exchange for zero infrastructure cost.
