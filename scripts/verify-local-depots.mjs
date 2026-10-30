// Read-only verification of the installed pilot; never prints secrets or hashes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {connectPilot} from '../pilot-local/database.mjs';
const cfg=pilotConfig(JSON.parse(fs.readFileSync(new URL('../secrets/pilot-local/runtime.json',import.meta.url),'utf8')));
const db=await connectPilot(cfg.database,cfg.server);
try{
 const marker=(await db.query("SELECT CONVERT(varchar(64),value) V FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE'"))[0].V;assert.equal(marker,cfg.pilotInstance);
 const users=await db.query('SELECT UsuarioId,Email,Perfil,Ativo FROM Seguranca.Usuario');assert.equal(users.length,1);assert.equal(users[0].Email,'guilherme.ribeiro@jettatransportes.com.br');assert.equal(users[0].Perfil,'ADMIN');assert.equal(Number(users[0].Ativo),1);
 assert.equal(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Credencial'))[0].N),1);
 assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.tables WHERE name IN('Filial','UsuarioFilial','PrestadorFilial')"))[0].N),0);
 assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.columns WHERE name LIKE '%Filial%'"))[0].N),0);
 assert.equal(Number((await db.query("SELECT COUNT(*) N FROM sys.sql_modules WHERE definition LIKE '%Filial%'"))[0].N),0);
 const tables=await db.query("SELECT s.name S,t.name T FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name IN('Cadastro','Operacao','Financeiro') ORDER BY s.name,t.name");
 for(const t of tables){assert.match(t.S+t.T,/^[A-Za-z0-9_]+$/);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM [${t.S}].[${t.T}]`))[0].N),0,t.S+'.'+t.T);}
 assert.equal(Number((await db.query('SELECT COUNT(*) N FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1'))[0].N),0);
 const url=`http://127.0.0.1:${cfg.port}`,challenge=crypto.randomBytes(32).toString('hex'),identity=await(await fetch(url+'/pilot/identity/'+challenge)).json();assert.equal(identity.proof,crypto.createHmac('sha256',cfg.token).update(challenge).digest('hex'));
 const health=await fetch(url+'/api/health');assert.equal(health.status,200);
 const html=await(await fetch(url)).text();assert.ok(html.includes('b24cCentroCusto'));assert.ok(!/filia(?:l|is)/i.test(html));
 console.log(JSON.stringify({status:'PASS',administratorOnly:true,credentialPresent:true,emptyBusinessTables:tables.length,oldEntityRemoved:true,constraintsTrusted:true,pilotIdentity:'PASS',health:200,url}));
}finally{await db.close();}
