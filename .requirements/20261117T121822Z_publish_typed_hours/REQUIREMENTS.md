# Publish typed hours

## As Is
Approved typed-hour controls replace the old datetime-local fields. Three adjacent browser tests still fill the now-hidden composed value or use the old label.

## To Be
Existing browser scenarios operate the visible date and time controls and retain their original assertions. Publish authorized local implementation to production and GitHub.

## Requirements
1. Update only stale test interactions; preserve payload, permissions, layout and success assertions.
2. Pass full regression, SQL bootstrap and production candidate/live checks before completion.
3. Preserve production data and credentials, verify encrypted backup and copy it offhost.

## Acceptance Criteria
1. All three browser scenarios pass using visible date/time fields, without forcing hidden inputs or changing timeouts.
2. Full regression has no failures or excluded tests; production serves the packaged assets.
3. Backup verified, SQL container not restarted, database not reset.

## Principal Regression Test
node --test --test-concurrency=1 integration/pc04-model-a-ui.test.mjs integration/pc04-planned-ui.test.mjs integration/tablets-provider-ui.test.mjs
Red: hidden inputs are not editable / old label no longer identifies an input. Green: real form submission and existing UI/payload assertions pass. This corrects test fixtures for an approved interface; production behavior stays unchanged.

## Testing Plan
Capture red, update visible-control interactions, run the same tests then full serial gate. New tests/pc04-hours-ui.test.mjs exercises invalid hours, midnight crossing, creation/edit/manual, responsive layout and permission locks.

## Implementation Plan
Update three fixtures to fill date and time separately, preserving date/time values. Commit, package, build, candidate verification, push, backup, deploy, live verification and offhost backup copy.

Serena and Lad are not available in this environment. User authorized deployment; no product requirements are being changed.

## Evidence
Initial full run: 488/494 passed, three stale field interactions and three missing Chromium executable failures. Focused red reproduced all three stale interactions. Updated tests passed 3/3 with assertions preserved. Installed required Playwright Chromium runtime locally without dependency changes.
