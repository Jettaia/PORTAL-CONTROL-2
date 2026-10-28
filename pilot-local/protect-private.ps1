param([Parameter(Mandatory=$true)][ValidatePattern('^[A-Za-z0-9_ .\\$-]{1,150}$')][string]$SqlServiceAccount)
$ErrorActionPreference='Stop'
$privateRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\secrets\pilot-local'))
$expectedRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))+[IO.Path]::DirectorySeparatorChar
if (-not $privateRoot.StartsWith($expectedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Destino privado divergente' }
$backupRoot=Join-Path $privateRoot 'backups'
New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach($target in @($privateRoot,$backupRoot)) { if (([IO.File]::GetAttributes($target) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Pasta privada nao pode ser um redirecionamento' } }
$ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid=New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$adminSid=New-Object Security.Principal.SecurityIdentifier('S-1-5-32-544')
$sqlSid=(New-Object Security.Principal.NTAccount($SqlServiceAccount)).Translate([Security.Principal.SecurityIdentifier])
function New-PrivateAcl {
 $acl=New-Object Security.AccessControl.DirectorySecurity
 $acl.SetAccessRuleProtection($true,$false)
 foreach($sid in @($ownerSid,$systemSid,$adminSid)) {
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
  $acl.AddAccessRule($rule)
 }
 return $acl
}
$privateAcl=New-PrivateAcl
$privateAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sqlSid,'Traverse','None','None','Allow')))
[IO.Directory]::SetAccessControl($privateRoot,$privateAcl)
$backupAcl=New-PrivateAcl
$backupAcl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($sqlSid,'Modify','ContainerInherit,ObjectInherit','None','Allow')))
[IO.Directory]::SetAccessControl($backupRoot,$backupAcl)
Write-Output 'Diretorio privado protegido; SQL Server tem acesso somente a travessia e backups.'
