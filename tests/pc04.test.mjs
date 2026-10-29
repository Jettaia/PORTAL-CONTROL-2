import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountContracts} from '../src/pc04-routes.js';

const manager={UsuarioId:1,Adm:0,Gestor:1,Financeiro:0};
const original={ContratacaoId:7,Numero:17,FilialId:1,PrestadorId:3,TipoServicoId:2,GestorResponsavelId:9,GestorResponsavel:'Gestor escolhido',DataServico:'2026-10-28',InicioPrevisto:'2026-10-28T22:00',FimPrevisto:'2026-10-29T06:00',EntradaReal:null,SaidaReal:null,Valor:'150.00',Status:'ABERTA',Versao:1,CriadoPor:1,ConferidoPor:null,LiberadoEmUtc:null,ValorLiberado:null,PagoEmUtc:null};
const creation={filialId:1,prestadorId:3,tipoServicoId:2,gestorId:9,dataServico:'2026-10-28',inicioPrevisto:'2026-10-28T22:00',fimPrevisto:'2026-10-29T06:00',valor:'150.00'};

test('PC-04 HTTP e serviço: ciclo individual, publicação e revisão preservam diária e histórico',async t=>{
 const app=express();app.use(express.json());
 mountContracts(app,{pc01:true,pc02:true,pc03:true,pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:1};req.rawSession='pc04-test';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(suffix='',body,headers={},resource='contratacoes')=>fetch(`http://127.0.0.1:${server.address().port}/api/pc04/${resource}${suffix}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user':'1',origin:'http://local.test',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const prefix=(actor=manager)=>[[],[{R:0}],[actor],[{V:1}]];
 async function run({suffix='',body,status=200,queue,check,inspect,resource}){
  let commits=0,rollbacks=0,begins=0;const sql=[];
  const db={query:async statement=>{sql.push(statement);assert.ok(queue.length,'SQL inesperado '+statement);const item=queue.shift();if(item instanceof Error)throw item;return item;},beginTransaction:async()=>{begins++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await call(suffix,body,{},resource),result=await response.json();assert.equal(response.status,status,JSON.stringify(result));assert.equal(queue.length,0);assert.equal(commits,begins&&status<400?1:0);assert.equal(rollbacks,begins&&status>=400?1:0);check?.(result);inspect?.(sql);}finally{mock.mock.restore();}
 }
 assert.equal((await call('',creation,{'x-user':''})).status,401);
 assert.equal((await call('',creation,{origin:'http://evil.test'})).status,403);
 await t.test('gestor responsável deve ser escolhido explicitamente',()=>run({body:{...creation,gestorId:undefined},status:400,queue:[],check:r=>assert.equal(r.erro,'IDENTIFICADOR_INVALIDO')}));
 await t.test('gestor responsável sem acesso à filial não pode ser atribuído',()=>run({body:{...creation,gestorId:9},status:403,queue:[...prefix(),[{FilialId:1}],[]],check:r=>assert.equal(r.erro,'GESTOR_RESPONSAVEL_INDISPONIVEL')}));
 await t.test('paginação mantém acesso a contratações antigas sem duplicar',async()=>{
  const rows=Array.from({length:201},(_,i)=>({...original,Numero:201-i,ContratacaoId:201-i}));let first;
  await run({queue:[[],[manager],rows],check:r=>{first=r.registros;assert.equal(r.registros.length,200);assert.equal(r.proximaPagina,'2');}});
  await run({suffix:'?antes=2',queue:[[],[manager],[rows.at(-1)]],check:r=>{assert.equal(r.proximaPagina,null);assert.deepEqual([...first,...r.registros].map(r=>r.Numero),rows.map(r=>r.Numero));},inspect:sql=>assert.ok(sql.some(s=>s.includes('c.Numero<2')))});
 });
 await t.test('cursor inválido recusado antes do banco',()=>run({suffix:'?antes=invalid',status:400,queue:[]}));
 await t.test('cria acordo individual noturno com responsável escolhido distinto do criador',()=>run({body:creation,status:201,queue:[...prefix(),[{FilialId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[{TipoServicoId:2}],[],[],[{ContratacaoId:7}],[],[],[original]],check:r=>{assert.equal(r.resultado.Numero,17);assert.equal(r.resultado.GestorResponsavelId,9);assert.equal(r.resultado.CriadoPor,1);}}));
 await t.test('catálogo de gestores por filial autorizada',()=>run({resource:'catalogo',queue:[[],[manager],[{FilialId:1,Nome:'Filial A'}],[{TipoServicoId:2,Nome:'Carga'}],[{PrestadorId:3,Nome:'Pessoa',CPF:'12345678901',FilialId:1}],[{UsuarioId:9,Nome:'Gestor escolhido',FilialId:1}]],check:r=>assert.deepEqual(r.gestores,[{UsuarioId:9,Nome:'Gestor escolhido',FilialId:1}])}));
 await t.test('financeiro não recebe catálogo de gestores operacionais',()=>run({resource:'catalogo',queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}]],check:r=>{assert.equal(r.podeOperar,false);assert.deepEqual(r.gestores,[]);}}));
 await t.test('não confere antes de ambos horários',()=>run({suffix:'/7/conferir',body:{versao:1},status:409,queue:[...prefix(),[original]],check:r=>assert.equal(r.erro,'HORARIOS_REAIS_OBRIGATORIOS')}));
 const timed={...original,EntradaReal:'2026-10-28T22:15',SaidaReal:'2026-10-29T03:00',Versao:2};
 await t.test('saída antecipada mantém diária; horários têm motivo e autor',()=>run({suffix:'/7/horarios',body:{versao:1,entradaReal:timed.EntradaReal,saidaReal:timed.SaidaReal,motivo:'Saída acordada'},queue:[...prefix(),[original],[],[],[],[timed]],check:r=>assert.equal(r.resultado.Valor,'150.00'),inspect:sql=>{const update=sql.find(s=>s.startsWith('UPDATE Operacao.Contratacao'));assert.ok(!/Valor\s*=/.test(update));assert.ok(sql.some(s=>s.includes('INSERT Operacao.ContratacaoEvento')));}}));
 const released={...timed,Status:'LIBERADA',ConferidoPor:1,LiberadoEmUtc:'2026-10-29T10:00:00',ValorLiberado:'150.00',Versao:3};
 await t.test('conferência publica exatamente valor sem alterar data serviço',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix(),[timed],[],[],[],[released]],check:r=>{assert.equal(r.resultado.ValorLiberado,'150.00');assert.equal(r.resultado.DataServico,creation.dataServico);},inspect:sql=>assert.ok(sql.some(s=>s.includes('ValorLiberado=Valor')))}));
 const revised={...released,Valor:'175.25',Status:'ABERTA',LiberadoEmUtc:null,ValorLiberado:null,ConferidoPor:null,Versao:4};
 await t.test('revisão despublica e exige nova conferência',()=>run({suffix:'/7/revisar',body:{versao:3,valor:'175.25',motivo:'Acordo corrigido'},queue:[...prefix(),[released],[],[],[],[revised]],check:r=>{assert.equal(r.resultado.Status,'ABERTA');assert.equal(r.resultado.ValorLiberado,null);},inspect:sql=>assert.ok(sql.some(s=>s.includes('ValorLiberado=NULL')))}));
 await t.test('reconferência após revisão',()=>run({suffix:'/7/conferir',body:{versao:4},queue:[...prefix(),[revised],[],[],[],[{...revised,Status:'LIBERADA',ValorLiberado:'175.25',Versao:5}]],check:r=>assert.equal(r.resultado.ValorLiberado,'175.25')}));
 await t.test('cancela preservando número e removendo valor liberado',()=>run({suffix:'/7/cancelar',body:{versao:3,motivo:'Serviço cancelado'},queue:[...prefix(),[released],[],[],[],[{...released,Status:'CANCELADA',ValorLiberado:null,Versao:4}]],check:r=>assert.equal(r.resultado.Numero,17),inspect:sql=>assert.ok(sql.every(s=>!s.startsWith('DELETE')))}));
 const cases=[
  ['financeiro não altera',{suffix:'/7/conferir',body:{versao:1},status:403,queue:[...prefix({UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}).slice(0,3)]}],
  ['ator revogado',{body:creation,status:403,queue:[[],[{R:0}],[]]}],
  ['MFA vencido',{body:creation,status:403,queue:[[],[{R:0}],[manager],[]]}],
  ['trava indisponível',{body:creation,status:409,queue:[[],[{R:-1}]]}],
  ['filial alheia',{body:creation,status:403,queue:[...prefix(),[]]}],
  ['prestador inativo ou desvinculado não cria',{body:creation,status:409,queue:[...prefix(),[{FilialId:1}],[{UsuarioId:9}],[]]}],
  ['tipo inativo não cria',{body:creation,status:409,queue:[...prefix(),[{FilialId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[]]}],
  ['duplicidade global não revela filial conflitante',{body:creation,status:409,queue:[...prefix(),[{FilialId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[{TipoServicoId:2}],[{ContratacaoId:9}]],check:r=>assert.equal(r.erro,'PRESTADOR_JA_CONTRATADO_NA_DATA')}],
  ['participação legada na mesma data também impede contratação nativa',{body:creation,status:409,queue:[...prefix(),[{FilialId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[{TipoServicoId:2}],[],[{ParticipacaoId:5}]],check:r=>assert.equal(r.erro,'PRESTADOR_JA_CONTRATADO_NA_DATA')}],
  ['versão desatualizada',{suffix:'/7/conferir',body:{versao:1},status:409,queue:[...prefix(),[timed]]}],
  ['registro fora do escopo',{suffix:'/7/cancelar',body:{versao:1,motivo:'Teste'},status:404,queue:[...prefix(),[]]}],
  ['pago preservado',{suffix:'/7/cancelar',body:{versao:3,motivo:'Teste'},status:409,queue:[...prefix(),[{...released,PagoEmUtc:'2026-10-29T11:00:00'}]]}],
  ['cancelado imutável',{suffix:'/7/revisar',body:{versao:1,valor:'200',motivo:'Teste'},status:409,queue:[...prefix(),[{...original,Status:'CANCELADA'}]]}],
  ['falha auditoria reverte atualização e evento',{suffix:'/7/conferir',body:{versao:2},status:503,queue:[...prefix(),[timed],[],[],Error('audit unavailable')]}],
  ['motivo vazio',{suffix:'/7/horarios',body:{versao:1,entradaReal:timed.EntradaReal,saidaReal:timed.SaidaReal,motivo:' '},status:400,queue:[]}],
  ['valor com fração excessiva',{body:{...creation,valor:'150.001'},status:400,queue:[]}],
  ['valor numérico não textual',{body:{...creation,valor:150},status:400,queue:[]}],
  ['data inexistente',{body:{...creation,dataServico:'2026-02-30'},status:400,queue:[]}],
  ['mais de um dia seguinte',{body:{...creation,fimPrevisto:'2026-10-30T00:00'},status:400,queue:[]}],
  ['fim anterior ao início',{body:{...creation,fimPrevisto:'2026-10-28T20:00'},status:400,queue:[]}],
  ['campo vencimento não permitido',{body:{...creation,vencimento:'2026-11-10'},status:400,queue:[]}],
  ['horários invertidos',{suffix:'/7/horarios',body:{versao:1,entradaReal:timed.SaidaReal,saidaReal:timed.EntradaReal,motivo:'Teste'},status:400,queue:[]}],
  ['identificador forjado',{suffix:'/7x/conferir',body:{versao:1},status:400,queue:[]}],
  ['financeiro não vê contratação não liberada',{suffix:'/7',status:404,queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[]]}],
  ['gestor não consulta filial alheia',{suffix:'/7',status:404,queue:[[],[manager],[]]}],
 ];
 for(const [name,scenario]of cases)await t.test(name,()=>run(scenario));
 await t.test('ADM confere em qualquer filial',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix({UsuarioId:1,Adm:1,Gestor:1,Financeiro:0}),[timed],[],[],[],[released]],inspect:sql=>assert.ok(sql.some(s=>s.includes('c.ContratacaoId=7 AND 1=1')))}));
 await t.test('horário corrigido após liberação remove elegibilidade',()=>run({suffix:'/7/horarios',body:{versao:3,entradaReal:timed.EntradaReal,saidaReal:'2026-10-29T04:00',motivo:'Conferência de horário'},queue:[...prefix(),[released],[],[],[],[{...timed,SaidaReal:'2026-10-29T04:00',Versao:4}]],check:r=>{assert.equal(r.resultado.Status,'ABERTA');assert.equal(r.resultado.ValorLiberado,null);},inspect:sql=>assert.ok(sql.some(s=>s.includes("Status='ABERTA',ValorLiberado=NULL")))}));
 await t.test('financeiro consulta somente liberadas sem poder operar',()=>run({queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[released]],check:r=>{assert.equal(r.podeOperar,false);assert.equal(r.registros[0].Status,'LIBERADA');},inspect:sql=>assert.ok(sql.some(s=>s.includes("WHERE ((1=0) OR c.Status='LIBERADA')")))}));
 await t.test('detalhe financeiro retorna evento da liberação',()=>run({suffix:'/7',queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[released],[{Acao:'CONFERIR',ValorLiberado:'150.00'}]],check:r=>{assert.equal(r.podeOperar,false);assert.equal(r.eventos[0].ValorLiberado,'150.00');}}));
 await t.test('conclusão histórica não exige cadastros/vínculo ativos',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix(),[timed],[],[],[],[released]],inspect:sql=>assert.ok(sql.filter(s=>s.includes('Cadastro.')).every(s=>!s.includes('Ativo=1')||s.includes('Seguranca.Usuario')))}));
});

