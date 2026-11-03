$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'runtime-identity-proof.ps1')
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$private=Join-Path $root 'secrets\pilot-local'
$launcher=Join-Path $private 'launcher'
$marker=Get-Content -LiteralPath (Join-Path $private 'runtime-identity.json') -Raw | ConvertFrom-Json
if ($marker.status -ne 'PROVISIONED') {throw 'Identidade restrita não provisionada.'}
$credential=Import-Clixml -LiteralPath (Join-Path $launcher 'credential.xml')
if ($credential -isnot [Management.Automation.PSCredential] -or $credential.UserName -ne $marker.principal) {throw 'Credencial DPAPI não pertence à identidade provisionada.'}
$node=(Get-Content -LiteralPath (Join-Path $launcher 'node-path.txt') -Raw).Trim()
& $node (Join-Path $root 'scripts\prepare-restricted-start.mjs')
if ($LASTEXITCODE -ne 0) {throw 'Backup/bootstrap recusado; processo HTTP não iniciado.'}
$state=Join-Path $private 'runtime-state'
$entry=Join-Path $root 'pilot-local\serve-restricted.mjs'
$process=Start-Process -FilePath $node -ArgumentList @('"'+$entry+'"') -Credential $credential -LoadUserProfile -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $state 'stdout.log') -RedirectStandardError (Join-Path $state 'stderr.log')
$config=Get-Content -LiteralPath (Join-Path $private 'runtime.json') -Raw | ConvertFrom-Json
$url="http://127.0.0.1:$($config.port)/"
$ready=$false
for($i=0;$i -lt 20;$i++) {
 Start-Sleep -Milliseconds 500
 try {
  $challenge=[Guid]::NewGuid().ToString('N')+[Guid]::NewGuid().ToString('N')
  $reply=Invoke-RestMethod -Uri ($url+'pilot/identity/'+$challenge) -TimeoutSec 2
  $expected=Get-RuntimeIdentityProof -Token ([string]$config.token) -Challenge $challenge
  if ($reply.proof -eq $expected) {$ready=$true;break}
 }catch{}
 if ($process.HasExited) {break}
}
if (-not $ready) {throw 'HTTP restrito não ficou pronto; consulte somente os logs privados runtime-state.'}
Write-Output "Piloto sob conta Windows restrita: $url"
