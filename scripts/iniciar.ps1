$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path '.env')) { throw 'Copie .env.example para .env e configure ADMIN_DIAGNOSTIC_TOKEN.' }
node --version
npm start
