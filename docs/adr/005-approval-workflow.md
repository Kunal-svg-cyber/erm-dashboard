# ADR-005: Approval workflow is a queued table, not a database constraint

## Status
Accepted

## Context
The project needed a way to prevent an owner from unilaterally closing or downgrading a Critical risk — mirroring how real risk governance requires sign-off before certain state changes, not just permission to make the edit at all. A `CHECK` constraint or a stricter RLS `UPDATE` policy could technically block the write outright, but that would surface as an opaque database error with no path forward for the person trying to make a legitimate change.

## Decision
A separate `risk_approvals` table records the *requested* change (`requested_change` jsonb) alongside a snapshot of the risk's current state, with a `decision` column defaulting to `pending`. When an owner attempts to close or downgrade a Critical risk, the app inserts a request here instead of writing to `risks` directly. Admins see pending requests in the Admin panel and can approve (which applies the stored `requested_change` to the actual row) or reject.

## Consequences
- The owner gets a clear "submitted for approval" outcome instead of a blocked write with no explanation.
- Approval and application are two separate operations (`risk_approvals` insert, then a later `risks` update), so there's a real window where a request is pending — acceptable here since risk status changes aren't time-critical in the way, say, a financial transaction would be.
- This only gates two specific transitions (closing, downgrading out of Critical) for non-admins. It's deliberately narrow rather than a general-purpose workflow engine — broader approval rules would need real design work, not just adding more conditions to the existing check.
