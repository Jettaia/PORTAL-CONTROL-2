// Real frontend interactions; synthetic HTTP backend. No SQL claim.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());
let role='ADMIN',logged=false,failNext=false;
const rows={filiais:[{FilialId:1,Codigo:'NOR',Nome:'Filial Norte',Endereco:'Rua Norte, 10 — Campinas/SP',Ativo:true}],servicos:[{TipoServicoId:1,Nome:'Carga',Descricao:'Descarga de veículos',Ativo:true}]},writes=[];
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:{id:1,nome:'Conta Teste',perfil:role,pc01:true,pc02:true,funcoes:[role]}});}
 if(req.path==='/api/auth/logout'){logged=false;return res.json({ok:true});}
 if(!logged)return res.status(401).json({erro:'Login necessário'});
 if(req.path==='/api/auth/me')return res.json({usuario:{id:1,nome:'Conta Teste',perfil:role,pc01:true,pc02:true,funcoes:[role]}});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 const match=req.path.match(/^\/api\/b24a\/(filiais|servicos)(?:\/(\d+))?$/);
 if(match){const kind=match[1];if(req.method==='GET')return res.json({pc02:true,podeEditar:role==='ADMIN',registros:rows[kind]});
  writes.push(req.body);if(role!=='ADMIN')return res.sendStatus(403);if(failNext){failNext=false;return res.status(409).json({erro:'Registro alterado em outra tela. Atualize a lista.'});}
  const b=req.body,id=match[2]?Number(match[2]):rows[kind].length+1;
  const row={Nome:b.nome,Ativo:b.ativo??true,...(kind==='filiais'?{FilialId:id,Codigo:b.codigo.toUpperCase(),Endereco:b.endereco,Cidade:b.cidade,Estado:b.estado,CEP:b.cep}:{TipoServicoId:id,Descricao:b.descricao||''})};
  rows[kind]=rows[kind].filter(r=>(r.FilialId||r.TipoServicoId)!==id).concat(row);return res.status(match[2]?200:201).json({ok:true,resultado:row});
 }
 return res.status(403).json({erro:'API fora do recorte visual'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const login=async()=>{await page.locator('#email').fill('conta@example.test');await page.locator('#senha').fill('SenhaSomenteDeTeste!123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});};
 await login();await page.locator('[data-page=filiais]').click();await page.locator('#b24Table table').waitFor();await page.getByText('1 registros carregados, incluindo inativos.').waitFor();
 assert.equal(await page.locator('#b24Endereco').isVisible(),true);
 await page.locator('#b24Nome').fill('Filial Sul');await page.locator('#b24Codigo').fill('sul');await page.locator('#b24Endereco').fill('Avenida Sul, 20');await page.locator('#b24Cidade').fill('Santos');await page.locator('#b24Estado').fill('SP');await page.locator('#b24Cep').fill('11010-000');await page.locator('#b24Form button[type=submit]').click();await page.getByText('Cadastro realizado.',{exact:true}).waitFor();assert.equal(rows.filiais[1].Endereco,'Avenida Sul, 20');assert.equal(rows.filiais[1].Cidade,'Santos');assert.equal(rows.filiais[1].Estado,'SP');assert.equal(rows.filiais[1].CEP,'11010-000');
 await page.locator('#b24Table tr').filter({hasText:'Filial Sul'}).getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await page.locator('#b24Endereco').inputValue(),rows.filiais[1].Endereco);
 await page.locator('#b24Endereco').fill('Avenida Sul, 30 — Santos/SP');failNext=true;await page.locator('#b24Form button[type=submit]').click();await page.getByText(/Operação recusada: Registro alterado/).waitFor();assert.equal(await page.locator('#b24Form button[type=submit]').isEnabled(),true);assert.equal(await page.locator('#b24Endereco').inputValue(),'Avenida Sul, 30 — Santos/SP');
 await page.locator('#b24Form button[type=submit]').click();await page.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();
 await page.locator('#b24Table tr').filter({hasText:'Filial Sul'}).getByRole('button',{name:'Inativar',exact:true}).click();await page.locator('#b24Form button[type=submit]').click();await page.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.equal(rows.filiais[1].Ativo,false);assert.equal(rows.filiais.length,2);
 await page.locator('[data-page=servicos]').click();await page.getByText('1 registros carregados, incluindo inativos.').waitFor();assert.equal(await page.locator('#b24Endereco').isVisible(),false);assert.equal(await page.locator('#b24Endereco').getAttribute('required'),null);
 await page.locator('#b24Nome').fill('Limpeza');await page.locator('#b24Descricao').fill('');await page.locator('#b24Form button[type=submit]').click();await page.getByText('Cadastro realizado.',{exact:true}).waitFor();assert.equal(rows.servicos[1].Descricao,'');
 await page.locator('#b24Table tr').filter({hasText:'Limpeza'}).getByRole('button',{name:'Editar',exact:true}).click();await page.locator('#b24Descricao').fill('Limpeza das instalações');await page.locator('#b24Form button[type=submit]').click();await page.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.equal(rows.servicos[1].Descricao,'Limpeza das instalações');
 fs.mkdirSync('artifacts/pc02',{recursive:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.locator('[data-page=filiais]').evaluate(el=>el.click());await page.getByText('2 registros carregados, incluindo inativos.').waitFor();const size=await page.locator('#b24Form').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify({width,...size}));await page.locator('#cadastrosPage').screenshot({path:`artifacts/pc02/branches-${width}.png`});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});role='GESTOR';await login();await page.locator('[data-page=filiais]').click();await page.getByText('2 registros carregados, incluindo inativos.').waitFor();assert.equal(await page.locator('#b24Form').isVisible(),false);assert.equal(await page.locator('#b24Table button').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',writes:writes.length,viewports:[1440,768,390],scope:'Real UI / synthetic HTTP; SQL pending'}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
