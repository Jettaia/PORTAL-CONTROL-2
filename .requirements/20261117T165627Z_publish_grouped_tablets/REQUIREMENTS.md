# Publish grouped tablets
## As Is
Approved grouped tablet layout replaces the old heading. Full gate red: 517/518 pass; reload-navigation waits for removed heading Tablets cadastrados.
## To Be
Existing reload scenario recognizes the initialized grouped screen and keeps all navigation/reload/logout assertions. Publish latest authorized source to GitHub and production.
## Requirements
1. Update only the obsolete UI locator in both tablet visits.
2. Preserve all route, refreshed data, denial and logout assertions.
3. Pass focused and full gates, candidate/live checks and verified encrypted backup copied offhost; preserve data and credentials.
## Acceptance Criteria
1. Visible Buscar tablet searchbox is present before and after reload.
2. Existing assertions pass unchanged, no forced controls, exclusions or timeout changes.
3. GitHub and production revision match, live assets identical and business table hashes preserved.
## Principal Regression Test
node --test integration/reload-navigation-ui.test.mjs
Red in full gate: removed heading times out. Green: updated visible screen locator and complete real browser scenario pass.
## Testing Plan
Focused reload and grouped-tablet tests, full serial regression, disposable SQL checks already passed, candidate/live smoke and backup verification.
## Implementation Plan
Replace two heading locators with the grouped-screen searchbox, run focused then complete suite, commit/package/build, push, backup/deploy/live and save receipt.
User authorized publication. Skill tdd applies to this fixture correction; Serena/Lad unavailable. No product requirement or backend/schema changes.
