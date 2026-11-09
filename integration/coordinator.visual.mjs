// Real frontend interactions with synthetic HTTP responses. SQL covered separately.
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import {chromium} from 'playwright';
const app=express();app.use(express.json());let user=null,accounts=[],writes=[],pending=true,requester=7;
const admin={id:1,nome:'Admin Teste',perfil:'ADMIN',funcoes:['ADMIN'],pc01:true,pc02:true,pc03:true,pc04:true,pc05:true,fin01:true};
const coordinator={...admin,id:9,nome:'Coordenador Teste',perfil:'COORDENADOR',funcoes:['COORDENADOR'],depositos:['1','2']};
const deposits=[{DepositoId:1,Nome:'Depósito A',CentroCusto:'1001',Ativo:true},{DepositoId:2,Nome:'Depósito B',CentroCusto:'1002',Ativo:true}];
const row=()=>({ContratacaoId:1,Numero:1,Prestador:'Prestador Teste',Deposito:'Depósito A',CentroCusto:'1001',Tipo:'Diária',GestorResponsavel:'Gestor Teste',GestorResponsavelId:7,DataServico:'2026-11-10',InicioPrevisto:'2026-11-10T08:00',FimPrevisto:'2026-11-10T12:00',Valor:'100.00',Status:'ABERTA',Versao:1,HorarioPendenteId:pending?1:null,EntradaReal:pending?null:'2026-11-10T08:10',SaidaReal:pending?null:'2026-11-10T12:10'});
app.all('/api/*',(req,res)=>{
 if(req.path==='/api/auth/login'){user=req.body.email.startsWith('admin')?admin:coordinator;return res.json({usuario:user});}
 if(req.path==='/api/auth/logout'){user=null;return res.json({ok:true});}
 if(!user)return res.status(401).json({erro:'SESSAO_INVALIDA'});
 if(req.path==='/api/auth/me')return res.json({usuario:user});
 if(req.path==='/api/mfa/status')return res.json({enrolled:true,verified:true,stepUp:true});
 if(req.path==='/api/pc01/solicitacoes')return res.json({solicitacoes:[]});
 if(req.path==='/api/pc01/usuarios'){
  if(req.method==='GET')return res.json({usuarios:accounts,depositos:deposits});
  writes.push(req.body);accounts=[{UsuarioId:9,Nome:req.body.nome,Email:req.body.email,Perfil:'COORDENADOR',Ativo:true,FuncoesJson:JSON.stringify(req.body.funcoes.map(r=>({Codigo:'PC01_'+r}))),DepositosJson:JSON.stringify(req.body.depositos.map(id=>({DepositoId:id})))}];return res.status(201).json({usuarioId:9});
 }
 if(req.path==='/api/pc04/catalogo')return res.json({podeOperar:true,podeAprovarHorarios:true,depositos:deposits,depositosFiltro:deposits,tipos:[{TipoServicoId:1,Nome:'Diária'}],prestadores:[{PrestadorId:1,DepositoId:1,Nome:'Prestador Teste',CPF:'12345678901'}],gestores:[{UsuarioId:7,Nome:'Gestor Teste',DepositoId:1},{UsuarioId:8,Nome:'Outra Gestora',DepositoId:2}]});
 if(req.path==='/api/pc05/status')return res.json({pc05:true});
 if(req.path==='/api/pc04/media')return res.json({media:null,quantidade:0,minimo:3});
 if(req.path==='/api/pc04/horarios-pendentes')return res.json({registros:pending?[{...row(),SolicitacaoId:1,SolicitanteId:requester,Solicitante:'Gestor Teste',Motivo:'Tablet indisponível'}]:[]});
 if(req.path==='/api/pc04/contratacoes'){
  if(req.method==='GET')return res.json({registros:[row()]});writes.push(req.body);return res.status(201).json({resultado:row()});
 }
 if(req.path==='/api/pc04/contratacoes/1')return res.json({registro:row(),podeOperar:true,podeAprovarHorarios:true,podeRegistrarHorariosDireto:false,solicitacoesHorarios:pending?[{SolicitacaoId:1,SolicitanteId:requester,Solicitante:'Gestor Teste',Status:'PENDENTE',EntradaReal:'2026-11-10T08:10',SaidaReal:'2026-11-10T12:10',Motivo:'Tablet indisponível'}]:[],eventos:[]});
 if(req.path==='/api/pc04/contratacoes/1/horarios/1/decidir'){writes.push(req.body);pending=false;return res.json({resultado:row()});}
 if(req.path==='/api/financeiro/catalogo')return res.json({depositos:deposits,prestadores:[],podeOperar:false});
 if(req.path==='/api/financeiro/contratacoes')return res.json({registros:[],podeOperar:false});
 return res.status(403).json({erro:'PERMISSAO_NEGADA'});
});
app.use(express.static('public'));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const login=async email=>{await page.locator('#email').fill(email);await page.locator('#senha').fill('SyntheticOnly!Pass123');await page.locator('#loginForm button').click();await page.locator('#dashboard').waitFor({state:'visible'});};
 await login('admin@example.test');await page.locator('[data-page=usuarios]').click();await page.locator('[name=deposito][value="2"]').waitFor();
 await page.locator('#pc01Nome').fill('Coordenador Teste');await page.locator('#pc01Email').fill('coord@example.test');await page.locator('#pc01Password').fill('SyntheticOnly!Pass123');
 await page.locator('[name=funcao][value=COORDENADOR]').check();await page.locator('[name=deposito][value="1"]').check();await page.locator('[name=deposito][value="2"]').check();
 assert.ok((await page.locator('#pc01Branches').textContent()).includes('CC 1001'));
 await page.locator('#pc01Save').click();await page.getByRole('button',{name:'Editar Coordenador Teste',exact:true}).waitFor();assert.deepEqual(writes[0].funcoes,['COORDENADOR']);assert.deepEqual(writes[0].depositos,[1,2]);
 assert.ok((await page.locator('#pc01Users').textContent()).includes('Coordenador'));
 await page.getByRole('button',{name:'Editar Coordenador Teste',exact:true}).click();assert.equal(await page.locator('[name=funcao][value=COORDENADOR]').isChecked(),true);
 await page.locator('#logout').click();await login('coord@example.test');
 assert.equal(await page.locator('[data-page=perfis]').isVisible(),false);assert.equal(await page.locator('[data-page=diagnostico]').isVisible(),false);
 await page.locator('[data-page=usuarios]').click();assert.equal(await page.locator('#pc01Panel').isVisible(),false);assert.equal(await page.locator('#pc01PasswordPanel').isVisible(),true);
 await page.locator('#mainNav summary').filter({hasText:'Operação'}).evaluate(el=>el.parentElement.open=true);await page.locator('[data-page=contratacoes]').click();await page.locator('#pc04Message').filter({hasText:'Consulta atualizada.'}).waitFor();
 assert.equal(await page.locator('#pc04_gestorId').isEnabled(),true);await page.locator('#pc04_gestorId').selectOption('7');
 await page.locator('#pc04_depositoId').selectOption('2');assert.equal(await page.locator('#pc04_gestorId option[value="7"]').count(),0);await page.locator('#pc04_depositoId').selectOption('1');
 await page.getByRole('button',{name:'Abrir solicitação 1',exact:true}).click();await page.getByRole('button',{name:'Aprovar horários',exact:true}).waitFor();
 await page.getByRole('button',{name:'Aprovar horários',exact:true}).click();await page.getByText('Horários aprovados.',{exact:true}).waitFor();assert.equal(pending,false);assert.equal(writes.at(-1).aprovar,true);
 // Same authenticated profile, own request: no approval actions; direct edits still request review.
 pending=true;requester=9;await page.getByRole('button',{name:'Atualizar consulta',exact:true}).click();await page.locator('#pc04Message').filter({hasText:'Consulta atualizada.'}).waitFor();await page.getByRole('button',{name:'Abrir solicitação 1',exact:true}).click();
 await page.getByText('Aguardando aprovação da supervisão. Os horários válidos só mudam após a aprovação.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Aprovar horários',exact:true}).count(),0);
 await page.locator('#mainNav summary').filter({hasText:'Financeiro'}).click();await page.locator('[data-page=pagamentos]').click();await page.locator('#fin01Rows').waitFor();assert.equal(await page.getByRole('button',{name:'Gerar recibos do período',exact:true}).isVisible(),false);
 fs.mkdirSync('artifacts/coordinator',{recursive:true});await page.locator('#mainNav summary').filter({hasText:'Operação'}).evaluate(el=>el.parentElement.open=true);await page.locator('[data-page=contratacoes]').click();await page.locator('#pc04Message').filter({hasText:'Consulta atualizada.'}).waitFor();await page.screenshot({path:'artifacts/coordinator/desktop.png',fullPage:true});
 await page.setViewportSize({width:768,height:1024});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'artifacts/coordinator/tablet.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: ADMIN cadastra coordenador, CC/depósitos, troca de sessão, gestor selecionável, aprovação, autoaprovação oculta e financeiro consulta.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
