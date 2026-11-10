# As Is
Production runs 0439998. Current revision bf68522 includes migrations 41 and 42. Bootstrap integration asserts obsolete migration count 40; red run returned actual count 42.
# To Be
Publish authorized current changes with verified backup, preserved data and focused live verification.
# Requirements
1. Correct bootstrap test expected migration count to 42, matching current manifest.
2. Apply migrations 41 and 42 transactionally with API stopped and verify preserved tables, catalog and credentials.
3. Publish candidate after tests, retaining previous image for rollback.
# Acceptance Criteria
1. Disposable bootstrap integration passes without weakened assertions.
2. Existing data hashes remain equal except the single coordinator catalog insertion.
3. HTTPS, authenticated reads, grouped exports, new assets and receipt import authorization pass.
# Principal Regression Test
CHAPA_SQL_TESTS=YES node --test integration/chapa-bootstrap.integration.mjs. Red observed: expected 40, actual 42. Exercises actual SQL schema creation and credential preservation.
# Testing Plan
Full regression; disposable bootstrap/coordinator/receipt-import/statement integrations; candidate and public read-only checks. No operational payment or receipt creation.
# Implementation Plan
Correct obsolete expected count, rerun bootstrap; package/build; rehearse migrations with rollback; backup; stop API; apply verified migrations; promote; validate and record.

## Validation corrections
The full inventory exposed two validation defects: preview app lacks the newly introduced statement catalog (503, reproduced by real navigation); 12 MiB browser file transfer exceeds its global 4s test timeout. Add the empty catalog route to the read-only preview and give only setInputFiles 30s, retaining payload and all assertions. Principal red commands: node --test --test-concurrency=1 integration/fin03-import-ui.test.mjs integration/preview-ui.test.mjs. Preview is not packaged into production.

## Linux PDF runtime compatibility
Red production-image proof: Node 20.19.2 SQL runtime cannot execute PDF.js 6 (Promise.withResolvers absent). Preserve proven Debian/OpenSSL SQL runtime and run PDF parsing in an isolated child using the image's existing official Node 24 binary. Preserve default worker behavior locally. Docker saves the official binary before replacing the SQL node symlink; sets RECEIPT_PDF_NODE for PDF children. Require QR, offline Portuguese OCR, splitting and authenticated SQL/export proofs on the rebuilt image. Existing receipt PDF tests must also pass with RECEIPT_PDF_NODE set to the local node binary. No requirement or business behavior changes. Serena/Lad tools unavailable; Node fork execPath and advanced IPC serialization verified in official Node documentation.

## Verification before promotion
- Full inventory at concurrency 2: 482 pass, zero fail/skip/TODO/cancel; syntax PASS; pilot/SQL connection 7 pass.
- Disposable SQL integrations: bootstrap 1 pass; coordinator/import/grouped statement 3 pass.
- External PDF runtime: 5 existing PDF tests pass plus dedicated subprocess/recovery regression pass.
- Linux candidate: migrations 41/42 rehearsed twice and rolled back; 72 tables/423 rows preserved (coordinator catalog addition separately checked).
- Candidate authenticated queries, grouped exports XLSX/PDF, receipt authorization, assets and credentials/data preservation PASS.
- Linux image under production 512MiB/1CPU/read-only/tmpfs constraints: Chromium, QR, offline Portuguese OCR and split PDF PASS.
- Docker/Node references: https://docs.docker.com/reference/cli/docker/compose/up/ ; https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options
