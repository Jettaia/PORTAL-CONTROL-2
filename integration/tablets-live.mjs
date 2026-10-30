import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {withDb,tokenHashLiteral} from '../src/auth-db.js';
import {newToken,hashToken} from '../src/security.js';
import {list} from '../src/pc04.js';

if(process.env.JETTA_FILTERS_LIVE!=='YES')throw Error('Defina JETTA_FILTERS_LIVE=YES para diagnóstico autenticado do piloto local.');
const cfg=pilotConfig(JSON.parse(fs.readFileSync('secrets/pilot-local/runtime.json','utf8'))),base=`http://${cfg.host}:${cfg.port}`;
const token=newToken(),hash=tokenHashLiteral(hashToken(token));let browser;
const actor=await withDb(cfg,async db=>{
 const row=(await db.query("SELECT TOP(1) u.UsuarioId FROM Seguranca.Usuario u JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId WHERE u.Ativo=1 AND u.Perfil='ADMIN' ORDER BY u.UsuarioId"))[0];
 assert.ok(row,'ADMIN existente necessário para diagnóstico');const id=Number(row.UsuarioId);assert.ok(Number.isSafeInteger(id));
 await db.query(`INSERT Seguranca.SessaoWeb(UsuarioId,TokenHash,ExpiraEmUtc) VALUES(${id},${hash},DATEADD(minute,5,SYSUTCDATETIME()))`);return id;
});
try{
 const response=await fetch(base+'/api/pc05/tablets',{headers:{cookie:'jetta_session='+token}});assert.equal(response.status,200);const catalog=await response.json();assert.ok(Array.isArray(catalog.registros)&&Array.isArray(catalog.depositos));
 const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1440,height:1050}});await context.addCookies([{name:'jetta_session',value:token,url:base+'/api',httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.jettaAccount?.pc05===true);await page.locator('#mainNav [data-page=tablets]').evaluate(el=>{el.closest('details').open=true;});await page.locator('#mainNav [data-page=tablets]').click();await page.locator('#tabletsMessage').filter({hasText:'Consulta atualizada.'}).waitFor();assert.equal(await page.locator('#tabletsPage').isVisible(),true);assert.equal(await page.locator('#tabletsDepot option').count(),catalog.depositos.length+1);
 if(catalog.depositos.length){await page.locator('#tabletsDepot').selectOption(String(catalog.depositos[0].DepositoId));assert.ok((await page.locator('#tabletsCostCenter').textContent()).includes(catalog.depositos[0].CentroCusto||'—'));}
 fs.mkdirSync('artifacts/tablets-live',{recursive:true});await page.locator('#tabletsPage').screenshot({path:'artifacts/tablets-live/panel.png'});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'})));await page.locator('#pc04Message').filter({hasText:'Consulta atualizada.'}).waitFor();assert.equal(await page.getByText('Autorizações do tablet',{exact:true}).count(),0);assert.deepEqual(errors,[]);console.log('PASS: painel real Cadastros > Tablets, catálogo depósito/CC, Contratações sem gestão antiga, zero erros JS e nenhuma escrita de negócio.');
}finally{
 if(browser)await browser.close();
 await withDb(cfg,async db=>{await db.query(`DELETE Seguranca.SessaoWeb WHERE TokenHash=${hash}`);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.SessaoWeb WHERE TokenHash=${hash}`))[0].N),0);});
 console.log('Sessão temporária de diagnóstico removida.');
}
