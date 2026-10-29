// Production UI with synthetic HTTP. Does not certify SQL persistence or auth.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.join(process.env.JETTA_PLAYWRIGHT_ROOT,'playwright'));
const app=express();app.use(express.json());let role='GESTOR',logged=false,conflict=false;
const person={PrestadorId:7,Nome:'Pessoa Compartilhada',CPF:'12345678901',Telefone:'',CNPJ:'',Ativo:true,Versao:1};let links=[];const writes=[];
app.all('/api/*',(req,res)=>{
 const user={id:1,nome:'Conta Teste',perfil:role,funcoes:[role],pc01:true,pc02:true,pc03:true};
 if(req.path==='/api/auth/login'){logged=true;return res.json({usuario:user});}
 if(req.path==='/api/auth/logout'){logged=false;return res.json({ok:true});}
 if(!logged)return res.sendStatus(401);
 if(req.path==='/api/auth/me')return res.json({usuario:user});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/b24a/chapas'&&req.method==='GET')return role==='FINANCEIRO'?res.status(403).json({erro:'PERMISSAO_NEGADA'}):res.json({pc03:true,podeEditar:true,adm:role==='ADMIN',registros:role==='ADMIN'||req.query.cpf||links.length?[person]:[],filiais:[{FilialId:1,Nome:'Filial Norte',Ativo:1}],vinculos:links});
 if(req.path.startsWith('/api/b24a/chapas')&&req.method!=='GET'){
  writes.push(req.body);if(conflict){conflict=false;return res.status(409).json({erro:'REGISTRO_ALTERADO_ATUALIZE'});}
  if(req.path.endsWith('/filiais/1'))links=req.body.vinculado?[{PrestadorId:7,FilialId:1}]:[];
  else if(req.method==='POST'){if(!req.body.filiais.length)return res.status(400).json({erro:'FILIAIS_INVALIDAS'});Object.assign(person,{Nome:req.body.nome,CPF:req.body.cpf.replace(/\D/g,''),Versao:1});links=[{PrestadorId:7,FilialId:1}];}
  else Object.assign(person,{Nome:req.body.nome,Telefone:req.body.telefone,CNPJ:req.body.cnpj,CPF:req.body.cpf,Ativo:req.body.ativo,Versao:person.Versao+1});
  return res.status(req.method==='POST'?201:200).json({ok:true,resultado:person});
 }
 if(req.path==='/api/b3/catalogo')return res.json({pc03:true,atorId:1,podeCriar:true,b32:false,b33:false,b34:false,depositos:[{DepositoId:1,FilialId:1,Nome:'Depósito Norte',Filial:'Norte'},{DepositoId:2,FilialId:2,Nome:'Depósito Sul',Filial:'Sul'}],servicos:[],prestadores:[{PrestadorId:11,Nome:'Pessoa Norte',FilialId:1},{PrestadorId:12,Nome:'Pessoa Sul',FilialId:2}]});
 if(req.path==='/api/b3/atividades')return res.json({atividades:[1,2].map(id=>({AtividadeId:id,DataServico:'2026-10-28',Filial:id===1?'Norte':'Sul',Deposito:'Depósito',Servico:'Carga',Status:'PLANEJADA'}))});
 if(/^\/api\/b3\/atividades\/[12]$/.test(req.path)){const id=Number(req.path.at(-1));return res.json({atividade:{AtividadeId:id,FilialId:id,Filial:id===1?'Norte':'Sul',Deposito:'Depósito',Servico:'Carga',Status:'PLANEJADA',InicioPrevisto:'2026-10-28T08:00',FimPrevisto:'2026-10-28T12:00',GestorUsuarioId:1},participacoes:[]});}
 if(req.path==='/api/b24a/servicos')return res.json({pc02:true,podeEditar:role==='ADMIN',registros:[]});
 return res.status(403).json({erro:'Fora do recorte visual'});
});
app.use(express.static('public'));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const login=async()=>{await page.locator('#email').fill('teste@example.test');await page.locator('#senha').fill('SenhaDeTeste!123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});};
 await login();await page.locator('[data-page=chapas]').click();const panel=page.locator('#pc03Panel');await panel.getByText('Nenhum prestador encontrado.',{exact:true}).waitFor();assert.equal(await page.locator('#b24Form').isVisible(),false);assert.equal(await page.locator('#b24Vincular').isVisible(),false);
 await panel.locator('form').first().locator('input').fill(person.CPF);await panel.getByRole('button',{name:'Buscar CPF',exact:true}).click();await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();
 assert.equal(await panel.getByRole('button',{name:'Editar',exact:true}).count(),0);
 await panel.getByRole('button',{name:'Vincular Filial Norte',exact:true}).click();await panel.getByText('Vínculo atualizado. Histórico preservado.',{exact:true}).waitFor();assert.equal(links.length,1);
 await panel.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await panel.locator('#pc03_cpf').getAttribute('readonly'),'');
 await panel.locator('#pc03_nome').fill('Pessoa Atualizada');conflict=true;await panel.getByRole('button',{name:'Salvar alterações',exact:true}).click();await panel.getByText(/Operação recusada: Outra pessoa alterou/).waitFor();assert.equal(await panel.locator('#pc03_nome').inputValue(),'Pessoa Atualizada');
 await panel.getByRole('button',{name:'Salvar alterações',exact:true}).click();await panel.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.equal(person.Nome,'Pessoa Atualizada');
 await panel.getByRole('button',{name:'Remover Filial Norte',exact:true}).click();await panel.getByText('Vínculo atualizado. Histórico preservado.',{exact:true}).waitFor();assert.equal(links.length,0);assert.equal(await panel.getByText('Pessoa Atualizada',{exact:true}).count(),1);
 // No category/address/bank, empty optionals and initial branch required.
 await panel.locator('#pc03_nome').fill('Pessoa Nova');await panel.locator('#pc03_cpf').fill('12345678902');await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();await panel.getByText('Operação recusada: Selecione ao menos uma filial.',{exact:true}).waitFor();
 await panel.locator('input[name=filial]').check();await panel.getByRole('button',{name:'Cadastrar prestador',exact:true}).click();await panel.getByText('Prestador cadastrado.',{exact:true}).waitFor();assert.equal(writes.at(-1).cnpj,'');
 // ADM correction/inactivation, roundtrip to PC02 and back.
 await page.locator('#logout').click();role='ADMIN';await login();await page.locator('[data-page=chapas]').click();await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();await panel.getByRole('button',{name:'Editar',exact:true}).click();assert.equal(await panel.locator('#pc03_cpf').getAttribute('readonly'),null);await panel.locator('#pc03_cpf').fill('12345678903');await panel.locator('select').selectOption('0');await panel.getByRole('button',{name:'Salvar alterações',exact:true}).click();await panel.getByText('Alterações salvas. Histórico preservado.',{exact:true}).waitFor();assert.equal(person.Ativo,false);await panel.getByRole('button',{name:'Remover Filial Norte',exact:true}).click();await panel.getByText('Vínculo atualizado. Histórico preservado.',{exact:true}).waitFor();assert.equal(await panel.getByRole('button',{name:'Vincular Filial Norte',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Atualizar lista',exact:true}).isVisible(),false);
 await page.locator('[data-page=servicos]').click();await page.getByText('0 registros carregados, incluindo inativos.').waitFor();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('#b24Form').isVisible(),true);
 await page.locator('[data-page=chapas]').click();await panel.getByText('1 prestadores encontrados.',{exact:true}).waitFor();
 fs.mkdirSync('artifacts/pc03',{recursive:true});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`artifacts/pc03/providers-${width}.png`,fullPage:true});assert.ok(await panel.locator('form').last().evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Form overflow '+width);}
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).click();await page.locator('[data-page=planejamento]').click();await page.locator('#b3Activities table').waitFor();
 await page.locator('#b3Activities tr').filter({hasText:'Norte'}).getByRole('button',{name:'Abrir atividade'}).click();await page.locator('#b3Detail').waitFor({state:'visible'});assert.deepEqual(await page.locator('#b3Prestador option').allTextContents(),['Selecione','Pessoa Norte']);
 await page.locator('#b3Activities tr').filter({hasText:'Sul'}).getByRole('button',{name:'Abrir atividade'}).click();await page.locator('#b3DetailTitle').filter({hasText:'Atividade 2'}).waitFor();assert.deepEqual(await page.locator('#b3Prestador option').allTextContents(),['Selecione','Pessoa Sul']);
 await page.locator('#logout').click();role='FINANCEIRO';await login();await page.locator('[data-page=chapas]').click();await panel.getByText('PERMISSAO_NEGADA',{exact:true}).waitFor();assert.equal(await panel.locator('form').last().isVisible(),false);assert.equal(await panel.locator('table').count(),0);
 assert.deepEqual(errors,[]);console.log('PC03 visual PASS: CPF/link/unlink/edit/conflict/create/admin/finance/PC02/1440-768-390');
}finally{await browser.close();server.close();}
