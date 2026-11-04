// Restore only into a fresh, explicitly generated disposable database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {productionConfig} from './config.mjs';
import {connectionString} from '../src/auth-db.js';
const input=JSON.parse(fs.readFileSync('/run/bootstrap/bootstrap.json','utf8'));
const cfg=productionConfig(input.runtime);
const db=await odbc.connect(connectionString({...cfg,database:'master',sqlAuth:{user:'sa',password:input.saPassword}}));
const name='JETTA_CHAPA_RESTORE_PROOF_20261104';
try{
 const row=(await db.query(`SELECT (SELECT COUNT(*) FROM [${name}].Seguranca.Usuario) Users,(SELECT COUNT(*) FROM [${name}].Operacao.Contratacao) Contracts,c.SaltHex,c.SenhaHashHex FROM [${name}].Seguranca.Credencial c WHERE UsuarioId=${Number(input.admin.id)}`))[0];
 assert.equal(Number(row.Users),1);assert.equal(Number(row.Contracts),0);assert.equal(row.SaltHex,input.admin.saltHex);assert.equal(row.SenhaHashHex,input.admin.passwordHashHex);
 console.log(JSON.stringify({restored:true,checkdb:'PASS',adminCredentialPreserved:true,operationalRows:0}));
}finally{await db.close();}
