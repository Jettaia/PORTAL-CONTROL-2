$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$private=Join-Path $root 'secrets\pilot-local'
$state=Join-Path $private 'runtime-state'
$session=Get-Content -LiteralPath (Join-Path $state 'session.json') -Raw | ConvertFrom-Json
if ($session.restricted -ne $true) {throw 'Sessão restrita não identificada.'}
New-Item -ItemType File -Path (Join-Path $state 'encerrar.sinal') -Force | Out-Null
for($i=0;$i -lt 40;$i++){if (-not (Get-Process -Id $session.pid -ErrorAction SilentlyContinue)) {break};Start-Sleep -Milliseconds 500}
if (Get-Process -Id $session.pid -ErrorAction SilentlyContinue) {throw 'HTTP não encerrou; nenhum processo foi forçado nem backup executado.'}
$node=(Get-Content -LiteralPath (Join-Path $private 'launcher\node-path.txt') -Raw).Trim()
& $node (Join-Path $root 'pilot-local\backup.mjs')
if ($LASTEXITCODE -ne 0) {throw 'HTTP encerrado, mas backup administrativo falhou.'}
Write-Output 'HTTP restrito encerrado e backup administrativo concluído.'
