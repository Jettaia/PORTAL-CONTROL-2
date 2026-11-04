// Private, pre-publication verification. Restores the imported ADMIN in finally.
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {productionConfig} from './config.mjs';
import {connectionString} from '../src/auth-db.js';
import {hashPassword} from '../src/security.js';
const input=JSON.parse(fs.readFileSync('/run/bootstrap/bootstrap.json','utf8'));
const cfg=productionConfig(input.runtime),id=Number(input.admin.id);
const db=await odbc.connect(connectionString({...cfg,sqlAuth:{user:'sa',password:input.saPassword}}));
const password=crypto.randomBytes(24).toString('base64url')+'!aA2',salt=crypto.randomBytes(16).toString('hex');
const headers={'host':'app.jettatransportes.com.br','x-forwarded-proto':'https','origin':cfg.publicOrigin,'x-jetta-request':'web','content-type':'application/json'};
const request=(p,options={})=>new Promise((resolve,reject)=>{
 const req=http.request('http://10.203.88.3:3211/chapa'+p,{method:options.method||'GET',headers:{...headers,...options.headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end(options.body);
});
const checks=[];
await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;');
try{
 const state=(await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Usuario) Users,(SELECT COUNT(*) FROM Operacao.Contratacao) Contracts,(SELECT COUNT(*) FROM Seguranca.SessaoWeb) Sessions'))[0];
 assert.equal(Number(state.Users),1);assert.equal(Number(state.Contracts),0);assert.equal(Number(state.Sessions),0);
 await db.query(`UPDATE Seguranca.Credencial SET SaltHex='${salt}',SenhaHashHex='${hashPassword(password,salt)}',Falhas=0,BloqueadoAteUtc=NULL WHERE UsuarioId=${id}`);
 assert.equal((await request('/api/auth/me')).status,401);checks.push('anonymous-denied');
 assert.equal((await request('/api/auth/login',{method:'POST',headers:{origin:'https://invalid.example'},body:JSON.stringify({email:input.admin.email,senha:password})})).status,403);checks.push('cross-origin-denied');
 const login=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:input.admin.email,senha:password})});
 assert.equal(login.status,200,await login.clone().text());
 const cookie=login.headers.get('set-cookie');assert.match(cookie,/__Secure-jetta_chapa_session=/);assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Path=\/chapa/);checks.push('login-secure-cookie');
 const sessionCookie=cookie.split(';')[0];
 for(const endpoint of ['/api/auth/me','/api/pc01/usuarios','/api/pc04/catalogo','/api/pc04/contratacoes','/api/financeiro/catalogo','/api/financeiro/contratacoes']){
  const response=await request(endpoint,{headers:{cookie:sessionCookie}});assert.equal(response.status,200,endpoint+' '+await response.clone().text());
 }checks.push('authenticated-admin-catalogs');
 assert.equal((await request('/api/pc01/usuarios',{method:'POST',headers:{cookie:sessionCookie},body:'{}'})).status,400);checks.push('invalid-write-rejected');
 assert.equal((await request('/api/auth/logout',{method:'POST',headers:{cookie:sessionCookie},body:'{}'})).status,200);
 assert.equal((await request('/api/auth/me',{headers:{cookie:sessionCookie}})).status,401);checks.push('logout-revoked');
 for(let i=0;i<14;i++){
  const r=await request('/api/auth/login',{method:'POST',body:JSON.stringify({email:'nonexistent@chapa.invalid',senha:'invalid'})});
  if(r.status===429){checks.push('login-rate-limited');break;}
 }
 assert.ok(checks.includes('login-rate-limited'));
 const enc=(await db.query("SELECT encrypt_option E FROM sys.dm_exec_connections WHERE session_id=@@SPID"))[0];assert.equal(enc.E,'TRUE');checks.push('sql-tls-certificate-validated');
}catch(error){console.error('STAGING_FAILURE',error.message);throw error;}finally{
 await db.query(`UPDATE Seguranca.Credencial SET SaltHex='${input.admin.saltHex}',SenhaHashHex='${input.admin.passwordHashHex}',Falhas=0,BloqueadoAteUtc=NULL WHERE UsuarioId=${id};DELETE FROM Seguranca.SessaoWeb;`);
 const restored=(await db.query(`SELECT SaltHex,SenhaHashHex FROM Seguranca.Credencial WHERE UsuarioId=${id}`))[0];
 assert.equal(restored.SaltHex,input.admin.saltHex);assert.equal(restored.SenhaHashHex,input.admin.passwordHashHex);
 await db.close();
}
checks.push('original-admin-credential-restored','test-sessions-removed');
console.log(JSON.stringify({status:'PASS',checks}));
