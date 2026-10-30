import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pilotConfig} from '../pilot-local/runtime-config.mjs';
import {withDb,tokenHashLiteral} from '../src/auth-db.js';
import {newToken,hashToken} from '../src/security.js';
import {list} from '../src/pc04.js';

if(process.env.JETTA_DEPOT_FILTER_LIVE!=='YES')throw Error('Defina JETTA_DEPOT_FILTER_LIVE=YES para diagnóstico autenticado do piloto local.');
const cfg=pilotConfig(JSON.parse(fs.readFileSync('secrets/pilot-local/runtime.json','utf8'))),base=`http://${cfg.host}:${cfg.port}`;
const token=newToken(),hash=tokenHashLiteral(hashToken(token));let browser;
const actor=await withDb(cfg,async db=>{
 const row=(await db.query("SELECT TOP(1) u.UsuarioId FROM Seguranca.Usuario u JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId WHERE u.Ativo=1 AND u.Perfil='ADMIN' ORDER BY u.UsuarioId"))[0];
 assert.ok(row,'ADMIN existente necessário para diagnóstico');const id=Number(row.UsuarioId);assert.ok(Number.isSafeInteger(id));
 await db.query(`INSERT Seguranca.SessaoWeb(UsuarioId,TokenHash,ExpiraEmUtc) VALUES(${id},${hash},DATEADD(minute,5,SYSUTCDATETIME()))`);return id;
});
const request=query=>fetch(base+'/api/pc04/contratacoes'+(query?'?'+query:''),{headers:{cookie:'jetta_session='+token}});
try{
 const catalogResponse=await fetch(base+'/api/pc04/catalogo',{headers:{cookie:'jetta_session='+token}});assert.equal(catalogResponse.status,200);const catalog=await catalogResponse.json();assert.ok(catalog.depositosFiltro.length);
 for(const depot of catalog.depositosFiltro){const r=await request('depositoId='+depot.DepositoId);assert.equal(r.status,200);assert.ok((await r.json()).registros.every(row=>String(row.DepositoId)===String(depot.DepositoId)));}
 assert.equal((await request('depositoId=invalido')).status,400);
 const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.addCookies([{name:'jetta_session',value:token,url:base+'/api',httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>!!window.jettaAccount?.pc04);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'})));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
 const selector=()=>page.getByLabel('Filtrar por Depósito',{exact:true});assert.equal(await selector().evaluate(el=>el.tagName),'SELECT');assert.deepEqual(await selector().locator('option').allTextContents(),['Todos',...catalog.depositosFiltro.map(d=>d.Nome)]);
 const depot=catalog.depositosFiltro[0];const response=page.waitForResponse(r=>r.url().includes('/api/pc04/contratacoes?depositoId='));await selector().selectOption(String(depot.DepositoId));const result=await(await response).json();
 await page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('.pc04-table tbody tr[data-contract]')].map(r=>r.dataset.contract))===JSON.stringify(ids),result.registros.map(r=>String(r.ContratacaoId)));
 assert.equal(await selector().inputValue(),String(depot.DepositoId));fs.mkdirSync('artifacts/depot-filter-live',{recursive:true});await page.locator('.pc04-table').screenshot({path:'artifacts/depot-filter-live/table.png'});
 const clearResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/pc04/contratacoes');await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await clearResponse;await page.waitForFunction(()=>document.querySelector('[data-pc04-filter=depositoId]')?.value==='');assert.deepEqual(errors,[]);
 console.log('PASS: API real por ID, opções autorizadas, seletor real aplica automaticamente sem botão, limpar; nenhuma contratação alterada.');
}finally{
 if(browser)await browser.close();
 await withDb(cfg,async db=>{await db.query(`DELETE Seguranca.SessaoWeb WHERE TokenHash=${hash}`);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.SessaoWeb WHERE TokenHash=${hash}`))[0].N),0);});
 console.log('Sessão temporária removida.');
}
