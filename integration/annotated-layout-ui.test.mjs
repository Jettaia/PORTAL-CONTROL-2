import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';

test('anotações: textos, status vazio e rolagem de 15 contratações',async()=>{
 const app=express();app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser;let count=22;
 try{
  browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});
  const page=await browser.newPage({viewport:{width:1531,height:764}});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   assert.equal(route.request().method(),'GET');const p=new URL(route.request().url()).pathname;
   let body={registros:[],usuarios:[],depositos:[],solicitacoes:[],prestadores:[],tablets:[],proximaPagina:null,podeEditar:true};
   if(p==='/api/auth/me')body={usuario:{id:1,nome:'QA sintético',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true},mfa:{necessarioParaAcoesSensiveis:false}};
   if(p==='/api/conta')body={pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
   if(p==='/api/pc04/catalogo')body={depositos:[],tipos:[],prestadores:[],gestores:[],podeOperar:true,podeAprovarHorarios:true};
   if(p==='/api/pc04/contratacoes')body={registros:Array.from({length:count},(_,i)=>({ContratacaoId:i+1,Numero:i+1,Prestador:i%2?'Ana':'Prestador com nome completo extenso para verificar a quebra de linha',Deposito:'Depósito de teste',CentroCusto:'CC1',GestorResponsavel:'Gestor de teste',DataServico:'2026-11-11',Valor:'100.00',Status:'ABERTA'})),proximaPagina:null};
   if(p==='/api/pc05/status')body={pc05:true};
   if(p==='/api/financeiro/extrato')body={prestadores:[],contratacoes:[],depositos:[],totais:{ValorDevido:'0.00',ValorPago:'0.00',Saldo:'0.00'},totalRegistros:0,proximaPagina:null};
   await route.fulfill({json:body});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.locator('#dashboard').waitFor({state:'visible'});
  for(const target of ['inicio','depositos','chapas','usuarios','perfis','servicos','tablets','pagamentos','extratoprestador','contratacoes']){
   await page.evaluate(t=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:t})),target);
   assert.equal(await page.locator('#breadcrumb').isVisible(),false,target+' sem breadcrumb');
   assert.ok(!await page.getByText('Configure acessos do sistema por perfil e ação.',{exact:true}).isVisible());
   assert.ok(!await page.getByText('O período considera a data do serviço.',{exact:true}).isVisible());
  }
  await page.waitForFunction(()=>document.getElementById('pc04Message')?.textContent==='');
  assert.equal(await page.locator('#pc04Message').evaluate(e=>e.getBoundingClientRect().height),0);
  const wrap=page.locator('.pc04-table');
  for(const width of [1531,700]){
   await page.setViewportSize({width,height:764});await page.evaluate(()=>document.fonts.ready);
   await page.waitForFunction(()=>{const w=document.querySelector('.pc04-table');return w.scrollHeight>w.clientHeight;});
   const bounds=await wrap.evaluate(w=>{const rows=w.querySelectorAll('tbody tr'),top=w.getBoundingClientRect().top;return {height:w.clientHeight,end15:rows[14].getBoundingClientRect().bottom-top,start16:rows[15].getBoundingClientRect().top-top};});
   assert.ok(Math.abs(bounds.height-bounds.end15)<=2,JSON.stringify(bounds));assert.ok(bounds.height<=bounds.start16+1);
   await wrap.focus();await page.keyboard.press('Control+End');
   await page.waitForFunction(()=>{const w=document.querySelector('.pc04-table');return w.scrollTop>0&&w.scrollHeight-w.clientHeight-w.scrollTop<=1;});
   const bottom=await wrap.evaluate(w=>({remaining:w.scrollHeight-w.clientHeight-w.scrollTop,head:w.querySelector('th').getBoundingClientRect().top-w.getBoundingClientRect().top}));
   assert.ok(bottom.remaining<=1);assert.ok(Math.abs(bottom.head)<=1);
   await wrap.evaluate(w=>{w.scrollTop=0;w.scrollLeft=0;});
   const dir='artifacts/annotated-layout-'+process.pid;fs.mkdirSync(dir,{recursive:true});await wrap.screenshot({path:`${dir}/table-${width}.png`});
  }
  count=3;await page.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.pc04-table tbody tr').length===3&&document.getElementById('pc04Message').textContent==='');
  assert.equal(await wrap.evaluate(w=>w.scrollHeight>w.clientHeight),false);
  await page.locator('[data-pc04-filter=inicio]').fill('2026-11-12');await page.locator('[data-pc04-filter=fim]').fill('2026-11-01');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
  await page.getByText('A data final do filtro deve ser igual ou posterior à data inicial.',{exact:true}).waitFor();assert.ok(await page.locator('#pc04Message').evaluate(e=>e.getBoundingClientRect().height)>0);
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
