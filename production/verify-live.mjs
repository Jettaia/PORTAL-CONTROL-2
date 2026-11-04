// Fresh QA session for the preserved ADMIN, revoked and removed in finally.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {productionConfig} from './config.mjs';
import {connectionString} from '../src/auth-db.js';
import {hashToken} from '../src/security.js';
const input=JSON.parse(fs.readFileSync('/run/bootstrap/bootstrap.json','utf8'));
const cfg=productionConfig(input.runtime);
const db=await odbc.connect(connectionString({...cfg,sqlAuth:{user:'sa',password:input.saPassword}}));
const token=crypto.randomBytes(32).toString('hex'),hash=hashToken(token),checks=[];
try{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;');
 const row=(await db.query(`SELECT SaltHex,SenhaHashHex FROM Seguranca.Credencial WHERE UsuarioId=${Number(input.admin.id)}`))[0];
 assert.equal(row.SaltHex,input.admin.saltHex);assert.equal(row.SenhaHashHex,input.admin.passwordHashHex);checks.push('original-credential-unchanged');
 const before=(await db.query('SELECT (SELECT COUNT(*) FROM Seguranca.Usuario) Users,(SELECT COUNT(*) FROM Cadastro.Deposito) Depots,(SELECT COUNT(*) FROM Cadastro.Prestador) Providers,(SELECT COUNT(*) FROM Cadastro.TipoServico) Services,(SELECT COUNT(*) FROM Operacao.Contratacao) Contracts,(SELECT COUNT(*) FROM Financeiro.ContratacaoRecibo) Receipts,(SELECT COUNT(*) FROM Financeiro.ContratacaoBaixa) Payments,(SELECT COUNT(*) FROM Seguranca.SessaoWeb) Sessions'))[0];
 assert.equal(Number(before.Users),1);for(const [key,value] of Object.entries(before))if(key!=='Users')assert.equal(Number(value),0,key);checks.push('single-admin-empty-operational-data');
 const publicPage=await fetch(cfg.publicOrigin+'/chapa/');assert.equal(publicPage.status,200);assert.match(await publicPage.text(),/Portal|Control|Jetta/);checks.push('public-https-page');
 assert.equal((await fetch(cfg.publicOrigin+'/chapa/api/auth/me')).status,401);checks.push('public-anonymous-denied');
 await db.query(`INSERT Seguranca.SessaoWeb(UsuarioId,TokenHash,ExpiraEmUtc) VALUES(${Number(input.admin.id)},'${hash}',DATEADD(minute,5,SYSUTCDATETIME()))`);
 const headers={Cookie:cfg.cookieName+'='+token};
 for(const p of ['/api/auth/me','/api/pc01/usuarios','/api/pc04/catalogo','/api/pc04/contratacoes','/api/financeiro/catalogo']){
  const r=await fetch(cfg.publicOrigin+'/chapa'+p,{headers});assert.equal(r.status,200,p+' '+await r.clone().text());
 }checks.push('public-authenticated-admin-queries');
 const wrong=await fetch(cfg.publicOrigin+'/chapa/api/auth/logout',{method:'POST',headers:{...headers,Origin:'https://invalid.example','x-jetta-request':'web','content-type':'application/json'},body:'{}'});assert.equal(wrong.status,403);checks.push('public-cross-origin-denied');
 const logout=await fetch(cfg.publicOrigin+'/chapa/api/auth/logout',{method:'POST',headers:{...headers,Origin:cfg.publicOrigin,'x-jetta-request':'web','content-type':'application/json'},body:'{}'});assert.equal(logout.status,200);
 assert.match(logout.headers.get('set-cookie'),/Secure/);assert.equal((await fetch(cfg.publicOrigin+'/chapa/api/auth/me',{headers})).status,401);checks.push('public-logout-revoked');
 assert.equal((await fetch(cfg.publicOrigin+'/')).status,200);checks.push('existing-root-healthy');
 console.log(JSON.stringify({status:'PASS',checks}));
}finally{await db.query(`DELETE FROM Seguranca.SessaoWeb WHERE TokenHash='${hash}'`);await db.close();}
