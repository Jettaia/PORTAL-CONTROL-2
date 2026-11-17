# Publish depot transfer
## As Is
Local authorized depot transfer requires migration 46. Production still runs f5ff477 with migration 45. Local startup checks the new schema; production startup needs the same check.
## To Be
Deploy tested source and additive migration, preserving all existing records, credentials and number reservations.
## Requirements
1. Production startup must call the same migration-readiness guard as local startup.
2. Apply migration transactionally with exact target identity, PC04 lock, source hash verification, idempotency and before/after table hashes.
3. Rollback may keep additive schema; old allocator is allowed only while no transferred-number reservation exists.
4. Commit/push latest source, full regression, disposable SQL proof, verified encrypted backup and offhost copy, candidate/live API and asset checks.
## Acceptance Criteria
1. Missing migration refuses startup; installed migration permits startup.
2. Rehearsal rollback restores schema/data; double apply preserves all preexisting table hashes.
3. Automated rollback refuses old reader after first transfer. Never delete reservations/events.
4. GitHub and live revision match; all checks pass and existing business data/credentials remain equal.
## Principal Regression Test
Existing tests/pc04-depot-change.test.mjs and tests/pc04-depot-change-ui.test.mjs plus CONTRACT_DEPOT_SQL_TESTS=YES node --test integration/contract-depot-change.integration.mjs. New startup call reuses existing tested readiness guard; production image startup and live verification prove installed path. No new product rule.
## Testing Plan
Full serial regression, SQL transfer/concurrency/audit rollback and bootstrap, migration rehearse/repeat/apply preserving rows, production image readiness and authenticated read-only smoke.
## Implementation Plan
Wire existing guard into production startup and update migration count. Commit/package/build, rehearse migration, gate tests, push, stop only API, backup, migrate, candidate/start/live, copy backup and write private receipt.
User authorized production deployment. Skills migration and tdd apply; Serena/Lad unavailable in tool catalog. No destructive reset.
