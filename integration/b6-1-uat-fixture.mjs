import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {createActivity,addParticipant} from '../src/b3.js';
import {pairTablet,activateTablet,issueCodes,recordEvent} from '../src/b4.js';
import {canonical,closeParticipation,addOccurrence} from '../src/b4-3.js';
export async function prepareUat(f){
 const {lab,q}=f;assert.match(lab.database,/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/);assert.equal((await q('SELECT DB_NAME() D'))[0].D,lab.database);
 const before={cadastroProcedurePresente:!!(await q("SELECT OBJECT_ID('Cadastro.sp_B24A_CriarPrestador') Id"))[0].Id};
 for(const batch of fs.readFileSync(new URL('b6-1-uat-cadastro.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim()))await q(batch);
 await q("UPDATE Cadastro.Deposito SET FilialId=1,Nome=CASE WHEN DepositoId=1 THEN N'Depósito Norte LAB' ELSE N'Depósito Sul LAB' END;UPDATE Cadastro.Filial SET Nome=N'Filial UAT Jetta - sintética',Codigo='UAT' WHERE FilialId=1;DELETE Cadastro.Filial WHERE FilialId=2;UPDATE Cadastro.TipoServico SET Nome=N'Apoio operacional LAB' WHERE TipoServicoId=1;");
 for(const [u,name]of [[f.g,'Gestor Norte LAB'],[f.g2,'Gestor Sul LAB'],[f.finance,'Financeiro Consolidado LAB'],[f.finance2,'Financeiro Sul LAB']])await q(`UPDATE Seguranca.Usuario SET Nome=N'${name}' WHERE UsuarioId=${u.id}`);
 await q(`IF NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito WHERE UsuarioId=${f.finance.id} AND DepositoId=2) INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId) VALUES(${f.finance.id},2)`);
 for(const key of ['prestadores.visualizar','prestadores.cadastrar','filiais.visualizar','servicos.visualizar']){
  await q(`IF NOT EXISTS(SELECT 1 FROM Seguranca.Permissao WHERE Chave='${key}') INSERT Seguranca.Permissao(Chave,Modulo,Descricao,Critica) VALUES('${key}','CADASTROS',N'Perfil sintetico UAT',0);INSERT Seguranca.PerfilPermissao(PerfilId,PermissaoId) SELECT up.PerfilId,p.PermissaoId FROM Seguranca.UsuarioPerfil up CROSS JOIN Seguranca.Permissao p WHERE up.UsuarioId IN (${f.g.id},${f.g2.id}) AND p.Chave='${key}' AND NOT EXISTS(SELECT 1 FROM Seguranca.PerfilPermissao pp WHERE pp.PerfilId=up.PerfilId AND pp.PermissaoId=p.PermissaoId);`);
 }
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 async function provider(name){const id=await f.provider();await q(`UPDATE Cadastro.Prestador SET Nome=N'${name}' WHERE PrestadorId=${id}`);return id;}
 async function activity(actor,depot,people){const a=(await createActivity(lab.cfg,actor.id,{filialId:1,depositoId:depot,tipoServicoId:1,dataServico:day,inicioPrevisto:day+'T08:00',fimPrevisto:day+'T10:00',descricao:'Demonstração UAT sintética'})).atividadeId,rows=[];for(const [name,value]of people){const pr=await provider(name);await f.inform(pr,day,{actor});const p=(await addParticipant(lab.cfg,actor.id,a,{prestadorId:pr,valorContratado:value})).participacaoId;rows.push({a,p,pr,actor,depot,value,name});}return rows;}
 async function execute(x,review,close){await f.confirm(x);const t=await activateTablet(lab.cfg,(await pairTablet(lab.cfg,x.actor.id,x.actor.token,x.depot)).pareamento),c=await issueCodes(lab.cfg,x.actor.id,x.actor.token,x.p,60);for(const tipo of ['ENTRADA','SAIDA'])await recordEvent(lab.cfg,t.token,{participacaoId:Number(x.p),atividadeId:Number(x.a),prestadorId:x.pr,tipo,codigo:tipo==='ENTRADA'?c.entrada:c.saida,requisicaoId:crypto.randomUUID()});if(review){const {reviewDetail,confer}=await import('../src/b4-2.js');await confer(lab.cfg,x.actor.id,x.p,{decisao:review,motivo:review==='DIVERGENCIA'?'Divergência sintética para análise':'',contextoHash:(await reviewDetail(lab.cfg,x.actor.id,x.p)).contextoHash,requisicaoId:crypto.randomUUID()});}if(close)await closeParticipation(lab.cfg,x.actor.id,x.actor.token,x.p,{versaoDados:(await canonical(lab.cfg,x.actor.id,x.p)).versaoDados,requisicaoId:crypto.randomUUID()});}
 const [ana,bruno]=await activity(f.g,1,[['LAB Ana - fechado regular','120.00'],['LAB Bruno - registrar entrada e saída','180.00']]);await execute(ana,'CONFERIDO',true);await f.confirm(bruno);
 const [carla]=await activity(f.g2,2,[['LAB Carla - Sul fechado','210.00']]);await execute(carla,'CONFERIDO',true);
 const [diego]=await activity(f.g,1,[['LAB Diego - conferir horários','95.00']]);await execute(diego,null,false);
 const [elisa]=await activity(f.g,1,[['LAB Elisa - fechar participação','160.00']]);await execute(elisa,'CONFERIDO',false);
 const [fabio]=await activity(f.g,1,[['LAB Fabio - confirmar contratação','130.00']]);
 const [gabi]=await activity(f.g2,2,[['LAB Gabi - pendência de divergência','145.00']]);await execute(gabi,'DIVERGENCIA',false);
 const available=await provider('LAB Helena - livre para nova atividade');await f.inform(available,day,{start:'14:00',end:'16:00'});
 const profiles=[{label:'Gestor Norte LAB',user:f.g,escopo:'Depósito Norte (1)'},{label:'Gestor Sul LAB',user:f.g2,escopo:'Depósito Sul (2)'},{label:'Financeiro Consolidado LAB',user:f.finance,escopo:'Norte e Sul (1 e 2)'},{label:'Financeiro Sul LAB',user:f.finance2,escopo:'Somente Sul (2)'}];
 return {day,before,profiles,rows:[ana,bruno,carla,diego,elisa,fabio,gabi].map(x=>({atividadeId:String(x.a),participacaoId:String(x.p),prestadorId:String(x.pr),nome:x.name,depositoId:String(x.depot),valor:x.value})),prestadorLivre:String(available)};
}
