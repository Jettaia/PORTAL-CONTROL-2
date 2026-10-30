// Presentation regression: real pilot surfaces, synthetic HTTP, no SQL writes.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const output=path.join('artifacts','pilot-design',new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(output,{recursive:true});
const longName='Maria Aparecida de Oliveira dos Santos e Silva — Serviços de Carga e Descarga';
const depot={DepositoId:1,Nome:'Centro de Distribuição de São José dos Campos — Unidade Regional',CentroCusto:'CC-OPERACAO-2026',Rua:'Avenida dos Trabalhadores',Numero:'1234',Bairro:'Distrito Industrial',Cidade:'São José dos Campos',Estado:'SP',CEP:'12200-000',Ativo:true};
const provider={PrestadorId:1,Nome:longName,CPF:'12345678901',Telefone:'11999999999',Ativo:true,Versao:1};
const contract={ContratacaoId:1,Numero:101,Prestador:longName,Deposito:depot.Nome,DepositoId:1,CentroCusto:depot.CentroCusto,GestorResponsavel:'Ana Carolina de Almeida',Tipo:'Carga e descarga de mercadorias',TipoServicoId:1,DataServico:'2026-10-30',Valor:'175.25',ValorLiberado:'175.25',LiberadoEmUtc:'2026-10-30T11:00:00.1234567',LiberadoPor:'Ana Carolina',Status:'ABERTA',Situacao:'AGUARDANDO_PAGAMENTO',Versao:1};
let state='full',anonymous=false;const writes=[],errors=[],checks=[];
const account={id:1,nome:'Ana Carolina de Almeida',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
const app=express();app.use(express.json());
app.all('/api/*',(req,res)=>{
 if(anonymous)return res.status(401).json({erro:'SESSAO_NECESSARIA'});
 if(req.method!=='GET')writes.push(req.path);
 if(state==='error'&&req.path==='/api/financeiro/contratacoes')return res.status(503).json({erro:'Consulta temporariamente indisponível. Tente novamente.'});
 const records=state==='empty'?[]:[contract,{...contract,ContratacaoId:2,Numero:102,Prestador:'José da Silva',Status:'LIBERADA',Situacao:'PAGO'}];
 const bodies={
  '/api/auth/me':{usuario:account,mfa:{necessarioParaAcoesSensiveis:false}},
  '/api/conta':account,
  '/api/mfa/status':{enrolled:true,verified:true,stepUp:true},
  '/api/b24a/depositos':{registros:[depot],podeEditar:true},
  '/api/b24a/chapas':{pc03:true,podeEditar:true,adm:true,registros:[provider],filiais:[{...depot,FilialId:1}],depositos:[depot],vinculos:[{PrestadorId:1,DepositoId:1,FilialId:1}]},
  '/api/b24a/servicos':{registros:[{TipoServicoId:1,Nome:'Carga e descarga',Descricao:'Serviço de movimentação de mercadorias',Ativo:true}],podeEditar:true},
  '/api/b24c/usuarios':{registros:[]},
  '/api/pc01/usuarios':{usuarios:[{UsuarioId:1,Nome:account.nome,Email:'ana.carolina@example.test',Perfil:'ADMIN',Ativo:true,FuncoesJson:'[]',DepositosJson:'[]'}],depositos:[depot]},
  '/api/pc04/catalogo':{podeOperar:true,depositos:[depot],prestadores:[provider],tipos:[{TipoServicoId:1,Nome:'Carga e descarga'}],gestores:[{UsuarioId:1,Nome:account.nome}]},
  '/api/pc04/contratacoes':{registros:records},
  '/api/pc04/contratacoes/1':{registro:contract,podeOperar:true,eventos:[]},
  '/api/pc05/status':{pc05:true},
  '/api/pc05/tablets':{registros:[{TabletId:1,Nome:'Portaria principal — recebimento de mercadorias',Deposito:depot.Nome,DepositoId:1,CentroCusto:depot.CentroCusto,Estado:'ATIVO',Ativo:true}],depositos:[depot]},
  '/api/financeiro/catalogo':{podeOperar:true,depositos:[depot],prestadores:[provider]},
  '/api/financeiro/contratacoes':{registros:records,podeOperar:true},
  '/api/financeiro/contratacoes/1':{registro:contract,podeOperar:true},
  '/api/financeiro/contratacoes/1/pagamento':{eventos:[],pagamentos:[]},
  '/api/financeiro/extrato':{prestadores:[{...provider,Prestador:longName,ValorDevido:'350.50',ValorPago:'175.25',Saldo:'175.25'}],totalRegistros:1,totais:{ValorDevido:'350.50',ValorPago:'175.25',Saldo:'175.25'}},
  '/api/b23/catalogo':{perfis:[{PerfilId:1,Codigo:'ADMIN',Nome:'Administrador'}],usuarios:[],permissoes:[],concessoes:[]},
  '/api/b3/catalogo':{b33:true},
  '/api/b3/politicas':{politicas:[],historico:[]},
  '/api/pc05/tablet/status':{ok:true}
 };
 res.json(bodies[req.path]||{});
});
app.get('/tablet.html',(_req,res)=>res.sendFile(path.resolve('public/tablet-pc05.html')));
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
const base=`http://127.0.0.1:${server.address().port}`;
async function stable(){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function capture(name){await stable();await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});}
async function navigate(name,selector){await page.evaluate(name=>window.dispatchEvent(new CustomEvent('jetta:go',{detail:name})),name);await page.locator(selector).first().waitFor({state:'visible'});await stable();}
async function geometry(label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': document overflow');checks.push(label);}
async function sharedButton(selector){
 const style=await page.locator(selector).first().evaluate(el=>({height:el.getBoundingClientRect().height,background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,radius:getComputedStyle(el).borderRadius}));
 assert.ok(style.height>=44,selector+': 44px target');assert.equal(style.background,'rgb(17, 61, 104)',selector+': shared primary');assert.equal(style.color,'rgb(255, 255, 255)');assert.equal(style.radius,'8px');
}
try{
 await page.goto(base);await page.waitForFunction(()=>window.jettaAccount?.fin01&&!document.getElementById('dashboard').hidden);
 await navigate('pagamentos','#fin01Rows tr[data-contract]');await capture('before-or-after-financeiro');
 if(process.argv.includes('--baseline')){console.log('Baseline screenshots: '+output);}
 else{
  // This fails on the incumbent theme: actions and form widths differ per module.
  await sharedButton('#fin01Filters button:not([type=button])');
  assert.ok(await page.locator('#fin01Filters').evaluate(el=>el.offsetWidth>el.parentElement.clientWidth*.8),'financial form uses available width');
  const screens=[['inicio','#homePage'],['depositos','#b24cDepTable table'],['chapas','#pc03Panel table'],['usuarios','#pc01Users table'],['perfis','#rbacRole'],['servicos','#b24Table table'],['tablets','#tabletsRows table'],['contratacoes','.pc04-table tbody tr[data-contract]'],['pagamentos','#fin01Rows tr[data-contract]'],['extratoprestador','#fin05Rows tr'],['limites','#b33PolicyForm'],['diagnostico','#diagForm']];
  for(const width of [1440,1024,390]){
   await page.setViewportSize({width,height:1000});
   for(const [name,selector]of screens){
    await navigate(name,selector);await geometry(name+' '+width);await capture(name+'-'+width);
    const tables=page.locator('.view-section:not([hidden]) table');
    for(let i=0;i<await tables.count();i++){
     const table=tables.nth(i);if(!await table.isVisible())continue;
     assert.equal(await table.locator('th').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(17, 61, 104)',name+': table heading');
     const reachable=await table.evaluate(table=>{let wrap=table.parentElement;while(wrap&&getComputedStyle(wrap).overflowX!=='auto')wrap=wrap.parentElement;if(!wrap)return table.getBoundingClientRect().right<=innerWidth;wrap.scrollLeft=wrap.scrollWidth;const last=table.querySelector('tr:last-child > :last-child');const bounds=wrap.getBoundingClientRect(),cell=last.getBoundingClientRect();const visible=cell.right<=bounds.right+2;wrap.scrollLeft=0;return visible;});assert.ok(reachable,name+': last table column reachable');
    }
   }
   await sharedButton('#diagForm button');
   await navigate('contratacoes','.pc04-table tbody tr[data-contract]');await sharedButton('.pc04-grid button[type=submit]');
   await page.locator('.pc04-table tbody button').first().click();await page.locator('#pc04Detail h3').first().waitFor();await capture('contratacao-detalhe-'+width);await geometry('detail '+width);
  }
  await page.setViewportSize({width:390,height:844});state='empty';await navigate('pagamentos','#fin01Page');await page.locator('#fin01Message').getByText('Consulta atualizada.',{exact:true}).waitFor();await capture('financeiro-vazio-390');assert.equal(await page.locator('#fin01Rows tr[data-contract]').count(),0);
  state='error';await navigate('inicio','#homePage');await navigate('pagamentos','#fin01Page');await page.getByText('Consulta temporariamente indisponível. Tente novamente.',{exact:true}).waitFor();await capture('financeiro-erro-390');await geometry('error 390');
  await page.locator('#toggleSide').click();await page.locator('#mainNav').waitFor({state:'visible'});await capture('menu-mobile');await geometry('menu 390');
  await page.goto(base+'/tablet.html');await page.locator('#operation').waitFor({state:'visible'});for(const width of [768,390]){await page.setViewportSize({width,height:1000});await geometry('tablet '+width);await capture('tablet-'+width);assert.ok(await page.locator('.keypad button').first().evaluate(el=>el.offsetHeight>=54));}
  await page.locator('[data-digit="1"]').click();assert.equal(await page.locator('#code').inputValue(),'1');await page.locator('#erase').click();assert.equal(await page.locator('#code').inputValue(),'');
  anonymous=true;await page.goto(base);await page.locator('#loginBox').waitFor({state:'visible'});
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await capture('login-'+width);await geometry('login '+width);await sharedButton('#loginForm button');}
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS: 12 pilot pages × 3 widths, detail, empty/error, mobile menu, tablet, real shell; zero writes or JS errors.');
 }
}finally{
 fs.writeFileSync(path.join(output,'evidence.json'),JSON.stringify({utc:new Date().toISOString(),theme:'light',data:'synthetic HTTP; real HTML/CSS/JS; long provider/depot visible',sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(['public/index.html','public/pilot-design.css','public/pilot-tokens.css','public/tablet-pc05.css'].filter(f=>fs.existsSync(f)).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),checks,errors,writes},null,2));
 await browser.close();await new Promise(r=>server.close(r));console.log('Evidence: '+output);
}



