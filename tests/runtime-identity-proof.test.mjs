import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('launcher PowerShell calcula o mesmo HMAC UTF-8 do endpoint Node',()=>{
 const token='a'.repeat(64),challenge='b'.repeat(64);
 const helper=fileURLToPath(new URL('../scripts/runtime-identity-proof.ps1',import.meta.url));
 const command=`. '${helper.replaceAll("'","''")}'; Get-RuntimeIdentityProof -Token '${token}' -Challenge '${challenge}'`;
 const actual=execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',command],{encoding:'utf8',windowsHide:true}).trim();
 assert.equal(actual,crypto.createHmac('sha256',token).update(challenge).digest('hex'));
 assert.notEqual(actual,crypto.createHmac('sha256',Buffer.from(token,'hex')).update(challenge).digest('hex'));
});
