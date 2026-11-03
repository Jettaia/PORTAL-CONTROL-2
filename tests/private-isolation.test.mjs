import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {assertPrivateIsolation} from '../pilot-local/private-isolation.mjs';

test('isolamento privado recusa arquivos legíveis e diretório de backup, aceita ausentes',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portal-isolation-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.doesNotThrow(()=>assertPrivateIsolation(dir));
 const file=path.join(dir,'administrator.json');fs.writeFileSync(file,'synthetic');
 assert.throws(()=>assertPrivateIsolation(dir),/material administrativo/);fs.unlinkSync(file);
 fs.mkdirSync(path.join(dir,'backups'));
 assert.throws(()=>assertPrivateIsolation(dir),/diretório de backups/);
});

test('isolamento privado usa abertura real e aceita arquivo cuja ACL Windows nega leitura',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portal-acl-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'administrator.json');fs.writeFileSync(file,'synthetic');
 const quote=value=>"'"+value.replaceAll("'","''")+"'";
 const command=`$ErrorActionPreference='Stop';$target=${quote(file)};$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[IO.File]::GetAccessControl($target);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'ReadData','Deny'));[IO.File]::SetAccessControl($target,$acl);`;
 execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',command],{encoding:'utf8',windowsHide:true});
 assert.throws(()=>fs.openSync(file,'r'),error=>['EACCES','EPERM'].includes(error.code));
 assert.doesNotThrow(()=>assertPrivateIsolation(dir));
});
