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
const request=query=>fetch(base+'/api/pc04/contratacoes'+(query?'?'+query:''),{headers:{cookie:'jetta_session='+token}});
try{
 const impossible='9007199254740991',expected=await list(cfg,actor,undefined,{numero:impossible});assert.equal(expected.registros.length,0);
 const live=await request('numero='+impossible);assert.equal(live.status,200);const actual=await live.json();
 console.log({case:'número inexistente',expected:0,actual:actual.registros?.length});
 assert.equal(actual.registros?.length,expected.registros.length,'API ativa está ignorando o filtro Número');
 assert.equal((await request('dataServico=invalida')).status,400,'API ativa deve rejeitar filtro inválido');
 const all=await list(cfg,actor),sample=all.registros[0];assert.ok(sample,'Contratação existente necessária');
 const screenshotFilters={prestador:'Testador dois',situacao:'LIBERADA'};
 const depot=await withDb(cfg,async db=>(await db.query('SELECT CentroCusto FROM Cadastro.Deposito WHERE DepositoId='+Number(sample.DepositoId)))[0]);assert.equal(sample.CentroCusto??null,depot.CentroCusto??null);
 const cases=[{centroCusto:sample.CentroCusto||'__CENTRO_INEXISTENTE__'},{numero:String(sample.Numero)},{prestador:sample.Prestador},{deposito:sample.Deposito},{gestor:sample.GestorResponsavel},{dataServico:sample.DataServico},{valor:String(sample.Valor).replace('.',',')},{situacao:sample.Status},{prestador:sample.Prestador,situacao:sample.Status},screenshotFilters];
 for(const filters of cases){const response=await request(new URLSearchParams(filters));assert.equal(response.status,200);const result=await response.json(),truth=await list(cfg,actor,undefined,filters);assert.deepEqual(result.registros.map(r=>[String(r.ContratacaoId),r.CentroCusto??null]),truth.registros.map(r=>[String(r.ContratacaoId),r.CentroCusto??null]),Object.keys(filters).join('+'));}
 const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1600,height:1000}});
 await context.addCookies([{name:'jetta_session',value:token,url:base+'/api',httpOnly:true,sameSite:'Strict'}]);const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>!!window.jettaAccount?.pc04);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:'contratacoes'})));await page.getByText('Consulta atualizada.',{exact:true}).waitFor();
 assert.equal(await page.locator('.pc04-table th .pc04-column-title').nth(3).textContent(),'Centro de Custo');
 await page.getByLabel('Filtrar por Número',{exact:true}).fill(String(sample.Numero));
 const response=page.waitForResponse(r=>r.url().includes('/api/pc04/contratacoes?numero='));await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await response;
 await page.waitForFunction(id=>{const rows=[...document.querySelectorAll('.pc04-table tbody tr[data-contract]')];return rows.length===1&&rows[0].dataset.contract===id;},String(sample.ContratacaoId));
 assert.equal(await page.locator('.pc04-table tbody tr[data-contract] td').nth(3).textContent(),sample.CentroCusto||'—');
 await page.getByLabel('Filtrar por Número',{exact:true}).fill(impossible);await page.getByLabel('Filtrar por Número',{exact:true}).press('Enter');await page.getByText('Nenhuma contratação encontrada para os filtros informados.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.pc04-table tbody tr[data-contract]').length>0);
 await page.getByLabel('Filtrar por Prestador',{exact:true}).fill(screenshotFilters.prestador);await page.getByLabel('Filtrar por Situação',{exact:true}).selectOption(screenshotFilters.situacao);
 const filteredResponse=page.waitForResponse(r=>r.url().includes('/api/pc04/contratacoes?prestador='));await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await filteredResponse;
 const matching=await list(cfg,actor,undefined,screenshotFilters);
 await page.waitForFunction(ids=>JSON.stringify([...document.querySelectorAll('.pc04-table tbody tr[data-contract]')].map(r=>r.dataset.contract))===JSON.stringify(ids),matching.registros.map(r=>String(r.ContratacaoId)));
 fs.mkdirSync('artifacts/contracts-filters-live',{recursive:true});await page.locator('.pc04-table').screenshot({path:'artifacts/contracts-filters-live/screenshot-case.png'});
 assert.deepEqual(errors,[]);console.log('PASS: API ativa, oito filtros e combinação, CentroCusto vinculado ao depósito vs SQL real; interface real Aplicar/Enter/vazio/Limpar; nenhuma contratação alterada.');
}finally{
 if(browser)await browser.close();
 await withDb(cfg,async db=>{await db.query(`DELETE Seguranca.SessaoWeb WHERE TokenHash=${hash}`);assert.equal(Number((await db.query(`SELECT COUNT(*) N FROM Seguranca.SessaoWeb WHERE TokenHash=${hash}`))[0].N),0);});
 console.log('Sessão temporária de diagnóstico removida.');
}
