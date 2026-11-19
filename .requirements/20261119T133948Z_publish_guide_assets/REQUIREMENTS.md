# Publish illustrated portal guide
## As Is
Approved guide adds 28 training screenshots in public/guide-images. Production asset builder rejects directories and does not prefix dynamic /guide-images/ URLs.
## To Be
Production serves the approved guide and all PNGs under /chapa/ with existing application behavior preserved.
## Requirements
1. Copy only reviewed regular PNG/JSON files in guide-images; reject other directories, symlinks and unsupported nested entries.
2. Prefix static and dynamic guide image paths with /chapa/ exactly once. Preserve bytes.
3. Verify real production HTTP for guide JS/CSS and all 28 images, plus existing origin, route and cookie boundaries.
4. Full regression, candidate/live checks, commit/push and verified encrypted backup offhost; no database/schema changes.
## Acceptance Criteria
1. Production asset build succeeds and each image HTTP response is byte-identical.
2. Generated guide JS references /chapa/guide-images/ and has no unprefixed root image URL.
3. Existing production isolation and guide browser tests pass.
4. Source, GitHub and live revision match; business data and credentials preserved.
## Principal Regression Test
node --test tests/chapa-production.test.mjs
Red: asset directory rejected. Extended existing real HTTP scenario validates prefixed guide JavaScript and every PNG, catching missing copy/prefix or changed bytes.
## Testing Plan
Production HTTP/assets and guide browser tests first, then full serial suite, candidate/live asset equality including all guide images, backup verification.
## Implementation Plan
Extend HTTP regression and observe red, add narrowly scoped guide asset copying/prefix, green; commit/package/build, full gate/push, backup/promote/live and offhost backup receipt.
Skill tdd applies. Serena/Lad unavailable. User authorized publication; approved guide requirements unchanged.
