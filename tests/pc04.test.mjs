import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import odbc from 'odbc';
import {mountContracts} from '../src/pc04-routes.js';

const manager={UsuarioId:1,Adm:0,Gestor:1,Financeiro:0};
const original={ContratacaoId:7,Numero:17,DepositoId:1,PrestadorId:3,TipoServicoId:2,GestorResponsavelId:9,GestorResponsavel:'Gestor escolhido',DataServico:'2026-10-28',InicioPrevisto:'2026-10-28T22:00',FimPrevisto:'2026-10-29T06:00',EntradaReal:null,SaidaReal:null,Valor:'150.00',Status:'ABERTA',Versao:1,CriadoPor:1,ConferidoPor:null,LiberadoEmUtc:null,ValorLiberado:null,PagoEmUtc:null};
const creation={depositoId:1,prestadorId:3,tipoServicoId:2,gestorId:1,dataServico:'2026-10-28',inicioPrevisto:'2026-10-28T22:00',fimPrevisto:'2026-10-29T06:00',valor:'150.00'};

test('PC-04 HTTP e serviço: ciclo individual, publicação e revisão preservam diária e histórico',async t=>{
 const app=express();app.use(express.json());
 mountContracts(app,{pc01:true,pc02:true,pc03:true,pc04:true},{session:(req,res,next)=>{if(!req.get('x-user'))return res.sendStatus(401);req.user={id:req.get('x-user')==='bigint'?1n:req.get('x-user')==='bigint-overflow'?9007199254740992n:1};req.rawSession='pc04-test';next();},sameOrigin:(req,res,next)=>req.get('origin')==='http://local.test'?next():res.sendStatus(403)});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const call=(suffix='',body,headers={},resource='contratacoes')=>fetch(`http://127.0.0.1:${server.address().port}/api/pc04/${resource}${suffix}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-user':'1',origin:'http://local.test',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const prefix=(actor=manager)=>[[],[{R:0}],[actor],[{V:1}]];
 async function run({suffix='',body,status=200,queue,check,inspect,resource,headers={}}){
  let commits=0,rollbacks=0,begins=0;const sql=[];
  const db={query:async statement=>{sql.push(statement);assert.ok(queue.length,'SQL inesperado '+statement);const item=queue.shift();if(item instanceof Error)throw item;return item;},beginTransaction:async()=>{begins++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{}};
  const mock=t.mock.method(odbc,'connect',async()=>db);
  try{const response=await call(suffix,body,headers,resource),result=await response.json();assert.equal(response.status,status,JSON.stringify(result));assert.equal(queue.length,0);assert.equal(commits,begins&&status<400?1:0);assert.equal(rollbacks,begins&&status>=400?1:0);check?.(result);inspect?.(sql);}finally{mock.mock.restore();}
 }
 assert.equal((await call('',creation,{'x-user':''})).status,401);
 assert.equal((await call('',creation,{origin:'http://evil.test'})).status,403);
 await t.test('gestor não atribui outro responsável mesmo por API direta',()=>run({body:{...creation,gestorId:9},status:403,queue:prefix(),check:r=>assert.equal(r.erro,'GESTOR_RESPONSAVEL_FIXO'),inspect:sql=>assert.ok(!sql.some(q=>/^(INSERT|UPDATE)/.test(q)))}));
 await t.test('gestor responsável deve ser escolhido explicitamente',()=>run({body:{...creation,gestorId:undefined},status:400,queue:[],check:r=>assert.equal(r.erro,'IDENTIFICADOR_INVALIDO')}));
 await t.test('gestor responsável sem acesso à deposito não pode ser atribuído',()=>run({body:{...creation,gestorId:9},status:403,queue:[...prefix({...manager,Adm:1}),[{DepositoId:1}],[]],check:r=>assert.equal(r.erro,'GESTOR_RESPONSAVEL_INDISPONIVEL')}));
 await t.test('paginação mantém acesso a contratações antigas sem duplicar',async()=>{
  const rows=Array.from({length:201},(_,i)=>({...original,Numero:Math.ceil((201-i)/2),ContratacaoId:201-i}));let first;
  await run({queue:[[],[manager],rows],check:r=>{first=r.registros;assert.equal(r.registros.length,200);assert.equal(r.proximaPagina,'2');}});
  await run({suffix:'?antes=2',queue:[[],[manager],[rows.at(-1)]],check:r=>{assert.equal(r.proximaPagina,null);assert.deepEqual([...first,...r.registros].map(r=>r.Numero),rows.map(r=>r.Numero));},inspect:sql=>assert.ok(sql.some(s=>s.includes('c.ContratacaoId<2')))});
 });
 await t.test('oito filtros combinados chegam ao SQL antes da paginação e mantêm escopo financeiro',()=>run({suffix:'?antes=20&numero=17&prestador=Pessoa&deposito=Sumare&centroCusto=CC-SUM&gestor=Admin&dataServico=2026-10-28&valor=150%2C00&situacao=LIBERADA',queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[original]],inspect:sql=>{const q=sql.at(-1);for(const pattern of [/f.CentroCusto/,/CHARINDEX\(.*f.CentroCusto/,/c.Numero=17/,/c.ContratacaoId<20/,/CHARINDEX\(.*p.Nome/,/CHARINDEX\(.*f.Nome/,/CHARINDEX\(.*g.Nome/,/c.DataServico='2026-10-28'/,/c.Valor=150.00/,/c.Status='LIBERADA'/,/uf.UsuarioId=1/,/uf.RevogadoEmUtc IS NULL/])assert.match(q,pattern);}}));
 for(const query of ['depositoId=1x','numero=1x','dataServico=2026-02-30','valor=1e3','valor=1.001','situacao=FORJADA','prestador=a&prestador=b','gestor[x]=a','centroCusto=a&centroCusto=b','deposito='+encodeURIComponent('x'.repeat(151))])await t.test('filtro inválido recusado antes do banco: '+query.slice(0,45),()=>run({suffix:'?'+query,status:400,queue:[]}));
 await t.test('texto hostil é literal Unicode e não vira SQL executável',()=>run({suffix:'?prestador='+encodeURIComponent("%_['; DROP TABLE X--"),queue:[[],[manager],[]],inspect:sql=>{assert.match(sql.at(-1),/CHARINDEX\(CONVERT\(nvarchar\(150\), 0x/);assert.ok(!sql.at(-1).includes('DROP TABLE'));}}));
 await t.test('cursor inválido recusado antes do banco',()=>run({suffix:'?antes=invalid',status:400,queue:[]}));
 await t.test('cria acordo individual noturno com responsável escolhido distinto do criador',()=>run({body:{...creation,gestorId:9},status:201,queue:[...prefix({...manager,Adm:1}),[{DepositoId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[{TipoServicoId:2}],[{ContratacaoId:7}],[],[],[original]],check:r=>{assert.equal(r.resultado.Numero,17);assert.equal(r.resultado.GestorResponsavelId,9);assert.equal(r.resultado.CriadoPor,1);}}));
 await t.test('sessão SQL com ator BIGINT cria contratação normalmente',()=>run({headers:{'x-user':'bigint'},body:creation,status:201,queue:[...prefix(),[{DepositoId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[{TipoServicoId:2}],[{ContratacaoId:7}],[],[],[original]],check:r=>assert.equal(r.resultado.ContratacaoId,7)}));
 await t.test('ator BIGINT fora da faixa segura continua recusado',()=>run({headers:{'x-user':'bigint-overflow'},body:creation,status:400,queue:[[],[{R:0}]],check:r=>assert.equal(r.erro,'IDENTIFICADOR_INVALIDO')}));
 await t.test('catálogo de gestores por deposito autorizada',()=>run({resource:'catalogo',queue:[[],[manager],[{DepositoId:1,Nome:'Deposito A'}],[{DepositoId:1,Nome:'Deposito A'}],[{TipoServicoId:2,Nome:'Carga'}],[{PrestadorId:3,Nome:'Pessoa',CPF:'12345678901',DepositoId:1}],[{UsuarioId:9,Nome:'Gestor escolhido',DepositoId:1}]],check:r=>assert.deepEqual(r.gestores,[{UsuarioId:9,Nome:'Gestor escolhido',DepositoId:1}])}));
 await t.test('depósito selecionado usa ID exato e conserva escopo',()=>run({suffix:'?depositoId=2',queue:[[],[manager],[]],inspect:sql=>{assert.match(sql.at(-1),/c.DepositoId=2/);assert.match(sql.at(-1),/uf.UsuarioId=1/);}}));
 await t.test('financeiro não recebe catálogo de gestores operacionais',()=>run({resource:'catalogo',queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[{DepositoId:1,Nome:'Deposito A'}]],check:r=>{assert.equal(r.podeOperar,false);assert.deepEqual(r.gestores,[]);assert.deepEqual(r.depositosFiltro,[{DepositoId:1,Nome:'Deposito A'}]);}}));
 await t.test('não confere antes de ambos horários',()=>run({suffix:'/7/conferir',body:{versao:1},status:409,queue:[...prefix(),[original]],check:r=>assert.equal(r.erro,'HORARIOS_REAIS_OBRIGATORIOS')}));
 for(const role of [manager,{...manager,Adm:1}])await t.test('edita previsão com data derivada: '+(role.Adm?'ADMIN':'GESTOR'),()=>run({suffix:'/7/previstos',body:{versao:1,inicioPrevisto:'2026-10-30T22:00',fimPrevisto:'2026-10-31T06:00'},queue:[...prefix(role),[original],[],[],[],[{...original,DataServico:'2026-10-30',InicioPrevisto:'2026-10-30T22:00',FimPrevisto:'2026-10-31T06:00',Versao:2}]],check:r=>assert.equal(r.resultado.DataServico,'2026-10-30'),inspect:sql=>{assert.match(sql.find(s=>s.startsWith('UPDATE Operacao.Contratacao SET')),/DataServico='2026-10-30'/);assert.ok(sql.some(s=>s.includes("'PREVISTOS'")));}}));
 await t.test('cria sem data separada',()=>run({body:{...creation,dataServico:undefined},status:201,queue:[...prefix(),[{DepositoId:1}],[{UsuarioId:1}],[{PrestadorId:3}],[{TipoServicoId:2}],[{ContratacaoId:7}],[],[],[original]],inspect:sql=>assert.match(sql.find(s=>s.startsWith('INSERT Operacao.Contratacao(')),/'2026-10-28'/)}));
 const timed={...original,EntradaReal:'2026-10-28T22:15',SaidaReal:'2026-10-29T03:00',Versao:2};
 await t.test('gestor solicita horários sem alterar os horários reais',()=>run({suffix:'/7/horarios',body:{versao:1,entradaReal:timed.EntradaReal,saidaReal:timed.SaidaReal,motivo:'Esquecimento'},queue:[...prefix(),[original],[{SolicitacaoId:5}],[],[],[],[{...original,Versao:2,HorarioPendenteId:5}]],check:r=>{assert.equal(r.resultado.HorarioSolicitado,true);assert.equal(r.resultado.EntradaReal,null);},inspect:sql=>{assert.ok(sql.some(s=>s.startsWith('INSERT Operacao.ContratacaoHorarioSolicitacao')));assert.ok(!sql.some(s=>s.startsWith('UPDATE Operacao.Contratacao SET EntradaReal')));}}));
 await t.test('pendência impede conferência apesar de horários válidos antigos',()=>run({suffix:'/7/conferir',body:{versao:2},status:409,queue:[...prefix(),[{...timed,HorarioPendenteId:5}]],check:r=>assert.equal(r.erro,'HORARIOS_PENDENTES_APROVACAO')}));
 await t.test('gestor não decide aprovação',()=>run({suffix:'/7/horarios/5/decidir',body:{versao:2,aprovar:true},status:403,queue:[...prefix()],check:r=>assert.equal(r.erro,'SOMENTE_ADM')}));
 const admin={...manager,Adm:1};
 await t.test('ADMIN grava diretamente sem alterar diária',()=>run({suffix:'/7/horarios',body:{versao:1,entradaReal:timed.EntradaReal,saidaReal:timed.SaidaReal,motivo:'Saída acordada'},queue:[...prefix(admin),[original],[],[],[],[timed]],check:r=>assert.equal(r.resultado.Valor,'150.00'),inspect:sql=>{const update=sql.find(s=>s.startsWith('UPDATE Operacao.Contratacao'));assert.ok(!/Valor\s*=/.test(update));assert.ok(sql.some(s=>s.includes('INSERT Operacao.ContratacaoEvento')));}}));
 const request={SolicitacaoId:5,SolicitanteId:2,Motivo:'Esquecimento',EntradaReal:timed.EntradaReal,SaidaReal:timed.SaidaReal};
 await t.test('ADMIN aprova horários e mantém contratação aberta',()=>run({suffix:'/7/horarios/5/decidir',body:{versao:2,aprovar:true},queue:[...prefix(admin),[{...original,Versao:2,HorarioPendenteId:5}],[request],[],[],[],[],[{...timed,Versao:3}]],check:r=>assert.equal(r.resultado.EntradaReal,timed.EntradaReal),inspect:sql=>{assert.ok(sql.some(s=>s.includes("Status='APROVADA'")));assert.ok(sql.some(s=>s.includes("EntradaOrigem='MANUAL'")));}}));
 await t.test('ADMIN nega sem alterar horários válidos anteriores',()=>run({suffix:'/7/horarios/5/decidir',body:{versao:2,aprovar:false},queue:[...prefix(admin),[{...timed,HorarioPendenteId:5}],[request],[],[],[],[],[{...timed,Versao:3}]],inspect:sql=>{assert.ok(sql.some(s=>s.includes("Status='NEGADA'")));assert.ok(!sql.some(s=>s.startsWith('UPDATE Operacao.Contratacao SET EntradaReal')));}}));
 await t.test('decisão repetida ou de outra contratação não altera estado',()=>run({suffix:'/7/horarios/5/decidir',body:{versao:2,aprovar:true},status:409,queue:[...prefix(admin),[timed],[]],check:r=>assert.equal(r.erro,'SOLICITACAO_INDISPONIVEL')}));
 await t.test('gestor não consulta fila global de horários',()=>run({resource:'horarios-pendentes',status:403,queue:[[],[manager]]}));
 await t.test('ADMIN consulta justificativa na fila',()=>run({resource:'horarios-pendentes',queue:[[],[admin],[request]],check:r=>assert.equal(r.registros[0].Motivo,'Esquecimento')}));
 const released={...timed,Status:'LIBERADA',ConferidoPor:1,LiberadoEmUtc:'2026-10-29T10:00:00',ValorLiberado:'150.00',Versao:3};
 await t.test('conferência publica exatamente valor sem alterar data serviço',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix(),[timed],[],[],[],[released]],check:r=>{assert.equal(r.resultado.ValorLiberado,'150.00');assert.equal(r.resultado.DataServico,creation.dataServico);},inspect:sql=>assert.ok(sql.some(s=>s.includes('ValorLiberado=Valor')))}));
 const revised={...released,Valor:'175.25',Status:'ABERTA',LiberadoEmUtc:null,ValorLiberado:null,ConferidoPor:null,Versao:4};
 await t.test('revisão antes da liberação preserva acordo aberto',()=>run({suffix:'/7/revisar',body:{versao:2,valor:'175.25',motivo:'Acordo corrigido'},queue:[...prefix(),[timed],[],[],[],[revised]],check:r=>{assert.equal(r.resultado.Status,'ABERTA');assert.equal(r.resultado.ValorLiberado,null);},inspect:sql=>assert.ok(sql.some(s=>s.includes('ValorLiberado=NULL')))}));
 await t.test('reconferência após revisão',()=>run({suffix:'/7/conferir',body:{versao:4},queue:[...prefix(),[revised],[],[],[],[{...revised,Status:'LIBERADA',ValorLiberado:'175.25',Versao:5}]],check:r=>assert.equal(r.resultado.ValorLiberado,'175.25')}));
 await t.test('cancela acordo aberto preservando número',()=>run({suffix:'/7/cancelar',body:{versao:2,motivo:'Serviço cancelado'},queue:[...prefix(),[timed],[],[],[],[{...timed,Status:'CANCELADA',ValorLiberado:null,Versao:3}]],check:r=>assert.equal(r.resultado.Numero,17),inspect:sql=>assert.ok(sql.every(s=>!s.startsWith('DELETE')))}));
 const cases=[
  ['financeiro não altera',{suffix:'/7/conferir',body:{versao:1},status:403,queue:[...prefix({UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}).slice(0,3)]}],
  ['ator revogado',{body:creation,status:403,queue:[[],[{R:0}],[]]}],
  ['MFA vencido',{body:creation,status:403,queue:[[],[{R:0}],[manager],[]]}],
  ['trava indisponível',{body:creation,status:409,queue:[[],[{R:-1}]]}],
  ['deposito alheia',{body:creation,status:403,queue:[...prefix(),[]]}],
  ['prestador inativo ou desvinculado não cria',{body:creation,status:409,queue:[...prefix(),[{DepositoId:1}],[{UsuarioId:9}],[]]}],
  ['tipo inativo não cria',{body:creation,status:409,queue:[...prefix(),[{DepositoId:1}],[{UsuarioId:9}],[{PrestadorId:3}],[]]}],
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
  ['gestor não consulta deposito alheia',{suffix:'/7',status:404,queue:[[],[manager],[]]}],
 ];
 for(const [name,scenario]of cases)await t.test(name,()=>run(scenario));
 await t.test('ADM confere em qualquer deposito',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix({UsuarioId:1,Adm:1,Gestor:1,Financeiro:0}),[timed],[],[],[],[released]],inspect:sql=>assert.ok(sql.some(s=>s.includes('c.ContratacaoId=7 AND 1=1')))}));
 for(const role of [manager,admin])for(const action of ['previstos','horarios','revisar','cancelar'])await t.test('liberada bloqueia '+action+' para '+(role.Adm?'ADMIN':'GESTOR'),()=>run({suffix:'/7/'+action,body:{versao:3,...(action==='previstos'?{inicioPrevisto:creation.inicioPrevisto,fimPrevisto:creation.fimPrevisto}:action==='horarios'?{entradaReal:timed.EntradaReal,saidaReal:timed.SaidaReal,motivo:'Correção'}:action==='revisar'?{valor:'175.25',motivo:'Correção'}:{motivo:'Correção'})},status:409,queue:[...prefix(role),[released]],check:r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA'),inspect:sql=>assert.ok(!sql.some(s=>/^UPDATE|^INSERT/.test(s)))}));
 await t.test('bloqueio persistente protege acordo reaberto historicamente',()=>run({suffix:'/7/revisar',body:{versao:2,valor:'200.00',motivo:'Reabertura'},status:409,queue:[...prefix(admin),[{...timed,LiberacaoBloqueada:1}]],check:r=>assert.equal(r.erro,'CONTRATACAO_LIBERADA_BLOQUEADA')}));
 await t.test('financeiro consulta somente liberadas dos depósitos vinculados sem poder operar',()=>run({queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[released]],check:r=>{assert.equal(r.podeOperar,false);assert.equal(r.registros[0].Status,'LIBERADA');},inspect:sql=>{const query=sql.at(-1);assert.match(query,/UsuarioDeposito/);assert.match(query,/RevogadoEmUtc IS NULL/);assert.match(query,/AND \(c.Status='LIBERADA'\)/);}}));
 await t.test('detalhe financeiro retorna evento da liberação',()=>run({suffix:'/7',queue:[[],[{UsuarioId:2,Adm:0,Gestor:0,Financeiro:1}],[released],[{Acao:'CONFERIR',ValorLiberado:'150.00'}]],check:r=>{assert.equal(r.podeOperar,false);assert.equal(r.eventos[0].ValorLiberado,'150.00');}}));
 await t.test('conclusão histórica não exige cadastros/vínculo ativos',()=>run({suffix:'/7/conferir',body:{versao:2},queue:[...prefix(),[timed],[],[],[],[released]],inspect:sql=>assert.ok(sql.filter(s=>s.includes('Cadastro.')).every(s=>!s.includes('Ativo=1')||s.includes('Seguranca.Usuario')))}));
});

