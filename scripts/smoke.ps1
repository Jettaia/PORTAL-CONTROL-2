$ErrorActionPreference = 'Stop'
$r=Invoke-RestMethod http://127.0.0.1:3210/api/health
$r | Format-List
if($r.status -ne 'UP'){throw 'Health FAIL'}
Write-Host 'HEALTH PASS'
Write-Host 'Diagnostico SQL: no navegador http://127.0.0.1:3210 use token do .env.'
