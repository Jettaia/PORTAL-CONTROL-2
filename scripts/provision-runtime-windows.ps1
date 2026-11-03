param([string]$NodePath)
$ErrorActionPreference='Stop'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Execute este script como administrador do Windows. Nenhuma alteração realizada.' }
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$private=Join-Path $root 'secrets\pilot-local'
$launcher=Join-Path $private 'launcher'
$marker=Join-Path $private 'runtime-identity.json'
function Assert-WorkspacePath([string]$Target) {
 $full=[IO.Path]::GetFullPath($Target)
 if (-not $full.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -and $full -ne $root) {throw 'Destino fora do workspace.'}
 $cursor=$full
 while($cursor.Length -ge $root.Length) {
  if ((Test-Path -LiteralPath $cursor) -and (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {throw 'Destino/ancestral privado não pode ser redirecionamento.'}
  if($cursor -eq $root){break};$cursor=[IO.Path]::GetDirectoryName($cursor)
 }
}
foreach($target in @($private,$launcher,$marker,(Join-Path $private 'runtime-state'))) {Assert-WorkspacePath $target}
if (Test-Path -LiteralPath $marker) { throw 'Identidade já provisionada. Use o launcher; não reprovisione.' }
if (-not $NodePath) { $command=Get-Command node.exe -ErrorAction SilentlyContinue; if ($command) {$NodePath=$command.Source} else {$NodePath=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'} }
$NodePath=[IO.Path]::GetFullPath($NodePath)
if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw 'Informe -NodePath com o node.exe instalado.' }
foreach($target in @($root,$private,$NodePath)) { if (([IO.File]::GetAttributes($target) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'Destino de provisionamento não pode ser um redirecionamento.'} }
& $NodePath (Join-Path $root 'scripts\prepare-restricted-start.mjs')
if ($LASTEXITCODE -ne 0) {throw 'Bootstrap/backup falhou; conta Windows não alterada.'}
New-Item -ItemType Directory -Path $launcher -Force | Out-Null
$systemSid=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$adminSid=[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
function Set-PrivateAcl([string]$Target,[bool]$Directory,[Security.Principal.SecurityIdentifier]$ReadSid=$null,[Security.Principal.SecurityIdentifier]$ModifySid=$null) {
 if ($Directory) {$acl=[Security.AccessControl.DirectorySecurity]::new()} else {$acl=[Security.AccessControl.FileSecurity]::new()}
 $acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($identity.User,$systemSid,$adminSid)) {
  if ($Directory) {$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')} else {$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','Allow')}
  $acl.AddAccessRule($rule)
 }
 if ($ReadSid) {$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($ReadSid,'ReadAndExecute','Allow'))}
 if ($ModifySid) {$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($ModifySid,'Modify','ContainerInherit,ObjectInherit','None','Allow'))}
 Set-Acl -LiteralPath $Target -AclObject $acl
}
Set-PrivateAcl $launcher $true
$name='JettaControlRuntime'
$pendingFile=Join-Path $launcher 'pending-identity.json'
$credentialFile=Join-Path $launcher 'credential.xml'
$account=Get-LocalUser -Name $name -ErrorAction SilentlyContinue
if ($account) {
 if (-not (Test-Path -LiteralPath $pendingFile) -or -not (Test-Path -LiteralPath $credentialFile)) {throw 'Conta existente sem vínculo privado desta instalação; nenhum reset de senha será feito.'}
 $pending=Get-Content -LiteralPath $pendingFile -Raw | ConvertFrom-Json
 if ($pending.sid -ne $account.SID.Value -or $pending.principal -ne "$env:COMPUTERNAME\$name") {throw 'SID da conta parcial diverge; revisão administrativa obrigatória.'}
} else {
 $bytes=New-Object byte[] 48
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
 $password=ConvertTo-SecureString ([Convert]::ToBase64String($bytes)+'aA1!') -AsPlainText -Force
 $account=New-LocalUser -Name $name -Password $password -AccountNeverExpires -PasswordNeverExpires -UserMayNotChangePassword -Description 'Portal Control: runtime local restrito, sem funções administrativas'
 $credential=[Management.Automation.PSCredential]::new("$env:COMPUTERNAME\$name",$password)
 $credential | Export-Clixml -LiteralPath $credentialFile
 @{principal="$env:COMPUTERNAME\$name";sid=$account.SID.Value;status='OS_ACCOUNT_CREATED'} | ConvertTo-Json | Set-Content -LiteralPath $pendingFile -Encoding UTF8
}
$runtimeSid=$account.SID
$admins=Get-LocalGroup -SID $adminSid
if (Get-LocalGroupMember -Group $admins.Name | Where-Object {$_.SID -eq $runtimeSid}) {throw 'Conta runtime pertence a Administradores; nenhuma concessão SQL será feita.'}
$users=Get-LocalGroup -SID ([Security.Principal.SecurityIdentifier]::new('S-1-5-32-545'))
if (-not (Get-LocalGroupMember -Group $users.Name | Where-Object {$_.SID -eq $runtimeSid})) {Add-LocalGroupMember -Group $users.Name -Member $account}
foreach($file in @($credentialFile,$pendingFile)) {Set-PrivateAcl $file $false}
function Add-Access([string]$Target,[string]$Rights,[bool]$Inherit=$false,[bool]$Deny=$false) {
 if (([IO.File]::GetAttributes($Target) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'ACL não aceita redirecionamento.'}
 $acl=Get-Acl -LiteralPath $Target
 $kind=if($Deny){'Deny'}else{'Allow'}
 if ($Inherit) {$rule=[Security.AccessControl.FileSystemAccessRule]::new($runtimeSid,$Rights,'ContainerInherit,ObjectInherit','None',$kind)} else {$rule=[Security.AccessControl.FileSystemAccessRule]::new($runtimeSid,$Rights,$kind)}
 $acl.AddAccessRule($rule);Set-Acl -LiteralPath $Target -AclObject $acl
}
Add-Access $root 'ReadAndExecute'
foreach($directory in @('src','public','pilot-local','node_modules')) {
 $target=Join-Path $root $directory
 if (Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0}) {throw 'Código/dependências contém redirecionamento; revise ACL manualmente.'}
 Add-Access $target 'ReadAndExecute' $true
 Add-Access $target 'Write,Delete,DeleteSubdirectoriesAndFiles,ChangePermissions,TakeOwnership' $true $true
}
Add-Access $NodePath 'ReadAndExecute'
Add-Access $NodePath 'Write,Delete,ChangePermissions,TakeOwnership' $false $true
Add-Access (Join-Path $root 'package.json') 'Read'
Add-Access (Join-Path $root 'secrets') 'Traverse,ReadAttributes,ReadPermissions'
Add-Access $private 'Traverse,ReadAttributes,ReadPermissions'
Set-PrivateAcl (Join-Path $private 'runtime.json') $false $runtimeSid
$state=Join-Path $private 'runtime-state'
New-Item -ItemType Directory -Path $state -Force | Out-Null
Set-PrivateAcl $state $true $null $runtimeSid
& $NodePath (Join-Path $root 'scripts\provision-runtime-access.mjs')
if ($LASTEXITCODE -ne 0) {throw 'Provisionamento SQL não concluído; conta/credencial parcial preservadas para diagnóstico.'}
Set-PrivateAcl $marker $false $runtimeSid
$NodePath | Set-Content -LiteralPath (Join-Path $launcher 'node-path.txt') -Encoding UTF8
Set-PrivateAcl (Join-Path $launcher 'node-path.txt') $false
Write-Output 'Conta Windows padrão, ACLs e acesso SQL provisionados. Próximo: scripts/start-restricted-pilot.ps1 sob o mesmo usuário humano que executou este provisionamento.'
