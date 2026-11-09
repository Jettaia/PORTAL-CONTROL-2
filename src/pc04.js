import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError,money} from './b3.js';
import {contractMovements} from './pc10-ledger.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
const json=value=>JSON.stringify(value,(_key,v)=>typeof v==='bigint'?v.toString():v);
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
function identifier(value){if(!['string','number','bigint'].includes(typeof value)||!/^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function date(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))fail('HORARIO_INVALIDO');
 date(value.slice(0,10));return value;
}
function period(start,end,serviceDate){
 timestamp(start);timestamp(end);if(end<=start)fail('PERIODO_INVALIDO');
 if(serviceDate){const next=new Date(serviceDate+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);if(!start.startsWith(serviceDate+'T')||end.slice(0,10)>next.toISOString().slice(0,10))fail('PERIODO_INVALIDO');}
}
function reason(value){if(typeof value!=='string'||!value.trim()||value.trim().length>800)fail('MOTIVO_OBRIGATORIO');return value.trim();}
function version(value){if(!Number.isSafeInteger(value)||value<1)fail('VERSAO_INVALIDA');return value;}
function creationInput(body){
 keys(body,['depositoId','prestadorId','tipoServicoId','gestorId','dataServico','inicioPrevisto','fimPrevisto','valor']);
 const v={depositoId:identifier(body.depositoId),prestadorId:identifier(body.prestadorId),tipoServicoId:identifier(body.tipoServicoId),gestorId:identifier(body.gestorId),dataServico:timestamp(body.inicioPrevisto).slice(0,10),inicioPrevisto:body.inicioPrevisto,fimPrevisto:body.fimPrevisto,valor:money(body.valor)};
 if(body.dataServico!==undefined&&date(body.dataServico)!==v.dataServico)fail('PERIODO_INVALIDO');
 period(v.inicioPrevisto,v.fimPrevisto,v.dataServico);return v;
}
async function actorDb(db,actor,write){
 const uid=identifier(actor),row=(await db.query(`SELECT u.UsuarioId,CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor,CASE WHEN ${roleSql(uid,'FINANCEIRO')} THEN 1 ELSE 0 END Financeiro FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
 if(!row||!yes(row.Adm)&&!yes(row.Gestor)&&(write||!yes(row.Financeiro)))fail('PERMISSAO_NEGADA',403);
 return {admin:yes(row.Adm),operational:yes(row.Adm)||yes(row.Gestor),finance:yes(row.Financeiro)};
}
const scope=(actor,user,alias='c')=>user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito uf WHERE uf.UsuarioId=${identifier(actor)} AND uf.DepositoId=${alias}.DepositoId AND uf.RevogadoEmUtc IS NULL)`;
// Financial permission grants the released view only inside assigned depots.
const visibility=(actor,user)=>user.finance&&!user.admin?`(${scope(actor,user)} AND (${user.operational?'1=1':"c.Status='LIBERADA'"}))`:scope(actor,user);
const responsibleScope=branch=>`((${roleSql('u.UsuarioId','ADMIN')} AND u.Perfil='ADMIN') OR (${roleSql('u.UsuarioId','GESTOR')} AND EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito rf WHERE rf.UsuarioId=u.UsuarioId AND rf.DepositoId=${branch} AND rf.RevogadoEmUtc IS NULL)))`;
const columns=`c.ContratacaoId,c.Numero,c.DepositoId,c.PrestadorId,c.TipoServicoId,p.Nome Prestador,f.Nome Deposito,f.CentroCusto,t.Nome Tipo,
 CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(16),c.InicioPrevisto,126) InicioPrevisto,CONVERT(varchar(16),c.FimPrevisto,126) FimPrevisto,
 CONVERT(varchar(16),c.EntradaReal,126) EntradaReal,CONVERT(varchar(16),c.SaidaReal,126) SaidaReal,c.EntradaOrigem,c.SaidaOrigem,
 CONVERT(varchar(40),c.Valor) Valor,c.Status,c.Versao,c.GestorResponsavelId,g.Nome GestorResponsavel,c.CriadoPor,c.ConferidoPor,CONVERT(varchar(23),c.CriadoEmUtc,126) CriadoEmUtc,
 CONVERT(varchar(23),c.LiberadoEmUtc,126) LiberadoEmUtc,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,CONVERT(varchar(23),c.PagoEmUtc,126) PagoEmUtc,c.LiberacaoBloqueada,
 (SELECT TOP(1) hs.SolicitacaoId FROM Operacao.ContratacaoHorarioSolicitacao hs WHERE hs.ContratacaoId=c.ContratacaoId AND hs.Status='PENDENTE') HorarioPendenteId`;
const joins=' JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito f ON f.DepositoId=c.DepositoId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId JOIN Seguranca.Usuario g ON g.UsuarioId=c.GestorResponsavelId';
export async function record(db,actor,user,id,write=false){
 const row=(await db.query(`SELECT ${columns} FROM Operacao.Contratacao c${write?' WITH(UPDLOCK,HOLDLOCK)':''}${joins} WHERE c.ContratacaoId=${identifier(id)} AND ${write?scope(actor,user):visibility(actor,user)}`))[0];
 if(!row)fail('CONTRATACAO_INDISPONIVEL',404);return row;
}
export async function transaction(cfg,actor,token,write,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;'+(write&&!cfg.pc10&&!cfg.fin01?"IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NOT NULL THROW 55916,N'PC10 provisionado exige escrituracao ativa',1;":''));await db.beginTransaction();
 try{
  if(write){const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);}
  const user=await actorDb(db,actor,write);if(write)await assertMfa(db,actor,token,cfg);const result=await fn(db,user);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627].includes(Number(x.code))))fail('PRESTADOR_JA_CONTRATADO_NA_DATA',409);throw e;}
});}
export async function event(db,actor,id,action,details){
 // The database supplies the identity at the instant of the event. Never accept
 // a display name/profile from a posted form as historical attribution.
 const payload=`JSON_MODIFY(${s(json(details),'max')},'$.ator',JSON_QUERY((SELECT u.Nome nome,u.Perfil cargo FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${identifier(actor)} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)))`;
 await db.query(`INSERT Operacao.ContratacaoEvento(ContratacaoId,Acao,AtorUsuarioId,Versao,Status,Valor,ValorLiberado,DetalhesJson) SELECT ContratacaoId,'${action}',${identifier(actor)},Versao,Status,Valor,ValorLiberado,${payload} FROM Operacao.Contratacao WHERE ContratacaoId=${identifier(id)}`);
 await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Contratacao',${identifier(id)},N'PC04_${action}',${identifier(actor)},${payload})`);
}
// Keep the nvarchar(max) payload last: ODBC fetches unbounded columns after bound columns.
async function contractHistory(db,id){return db.query(`SELECT e.EventoId,e.Acao,e.AtorUsuarioId,e.Versao,e.Status,
 CONVERT(varchar(40),e.Valor) Valor,CONVERT(varchar(40),e.ValorLiberado) ValorLiberado,
 CONVERT(varchar(23),e.CriadoEmUtc,126) CriadoEmUtc,JSON_VALUE(e.DetalhesJson,'$.motivo') Motivo,
 COALESCE(JSON_VALUE(e.DetalhesJson,'$.ator.nome'),u.Nome,N'Usuário não identificado') AtorNome,
 COALESCE(JSON_VALUE(e.DetalhesJson,'$.ator.cargo'),u.Perfil) AtorCargo,
 CASE WHEN JSON_VALUE(e.DetalhesJson,'$.ator.nome') IS NOT NULL AND JSON_VALUE(e.DetalhesJson,'$.ator.cargo') IS NOT NULL THEN 1 ELSE 0 END AtorIdentificacaoHistorica,e.DetalhesJson
 FROM Operacao.ContratacaoEvento e LEFT JOIN Seguranca.Usuario u ON u.UsuarioId=e.AtorUsuarioId
 WHERE e.ContratacaoId=${identifier(id)} ORDER BY e.EventoId`);}
export async function catalog(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 const depositosFiltro=await db.query(`SELECT f.DepositoId,f.Nome FROM Cadastro.Deposito f WHERE ${scope(actor,user,'f')} ORDER BY f.Nome,f.DepositoId`);
 if(!user.operational)return {depositosFiltro,pc04:true,podeOperar:false,podeAprovarHorarios:false,depositos:[],tipos:[],prestadores:[],gestores:[]};
 return {depositosFiltro,pc04:true,podeOperar:true,podeAprovarHorarios:user.admin,depositos:await db.query(`SELECT f.DepositoId,f.Nome FROM Cadastro.Deposito f WHERE f.Ativo=1 AND ${scope(actor,user,'f')} ORDER BY f.Nome`),tipos:await db.query('SELECT TipoServicoId,Nome FROM Cadastro.TipoServico WHERE Ativo=1 ORDER BY Nome'),prestadores:await db.query(`SELECT p.PrestadorId,p.Nome,p.CPF,pf.DepositoId FROM Cadastro.Prestador p JOIN Cadastro.PrestadorDeposito pf ON pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL JOIN Cadastro.Deposito f ON f.DepositoId=pf.DepositoId AND f.Ativo=1 WHERE p.Ativo=1 AND ${scope(actor,user,'f')} ORDER BY p.Nome,pf.DepositoId`),gestores:await db.query(`SELECT u.UsuarioId,u.Nome,f.DepositoId FROM Seguranca.Usuario u CROSS JOIN Cadastro.Deposito f WHERE u.Ativo=1 AND f.Ativo=1 AND ${scope(actor,user,'f')} AND ${responsibleScope('f.DepositoId')} ORDER BY u.Nome,u.UsuarioId,f.DepositoId`)};
});}
function listFilters(filters){
 keys(filters,['antes','numero','prestador','deposito','depositoId','centroCusto','gestor','dataServico','inicio','fim','valor','situacao']);
 const predicates=[];
 for(const [key,raw] of Object.entries(filters)){
  if(typeof raw!=='string')fail('FILTRO_INVALIDO');
  const value=raw.trim();if(!value||key==='antes')continue;
  if(key==='numero')predicates.push('c.Numero='+identifier(value));
  else if(key==='depositoId')predicates.push('c.DepositoId='+identifier(value));
  else if(key==='inicio')predicates.push("c.DataServico>='"+date(value)+"'");
  else if(key==='fim')predicates.push("c.DataServico<='"+date(value)+"'");
  else if(key==='dataServico')predicates.push("c.DataServico='"+date(value)+"'");
  else if(key==='valor')predicates.push('c.Valor='+money(value.replace(',','.')));
  else if(key==='situacao'){if(!['ABERTA','LIBERADA','CANCELADA'].includes(value))fail('FILTRO_INVALIDO');predicates.push("c.Status='"+value+"'");}
  else{if(value.length>150||value.includes('\0'))fail('FILTRO_INVALIDO');const column={prestador:'p.Nome',deposito:'f.Nome',centroCusto:'f.CentroCusto',gestor:'g.Nome'}[key];predicates.push('CHARINDEX('+s(value,150)+','+column+' COLLATE Latin1_General_100_CI_AI)>0');}
 }
 if(filters.inicio?.trim()&&filters.fim?.trim()&&filters.inicio.trim()>filters.fim.trim())fail('PERIODO_FILTRO_INVALIDO');
 return predicates.length?' AND '+predicates.join(' AND '):'';
}
export async function list(cfg,actor,antes,filters={}){
 const filtered=listFilters(filters);
 const before=antes===undefined?'':` AND c.ContratacaoId<${identifier(antes)}`;
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const rows=await db.query(`SELECT TOP(201) ${columns} FROM Operacao.Contratacao c${joins} WHERE ${visibility(actor,user)}${filtered}${before} ORDER BY c.ContratacaoId DESC`),registros=rows.slice(0,200);
  return {pc04:true,podeOperar:user.operational,registros,proximaPagina:rows.length>200?String(registros.at(-1).ContratacaoId):null};
 });
}
// Export uses the very same filter/visibility predicates, with one consistent read across all pages.
export async function exportData(cfg,actor,filters={},maxRows=100000){
 keys(filters,['numero','prestador','deposito','depositoId','centroCusto','gestor','dataServico','inicio','fim','valor','situacao']);
 const filtered=listFilters(filters);if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>100000)fail('LIMITE_INVALIDO');
 return transaction(cfg,actor,null,false,async(db,user)=>{
  const registros=await db.query(`SELECT TOP(${maxRows+1}) c.ContratacaoId,c.Numero,p.Nome Prestador,f.Nome Deposito,f.CentroCusto,g.Nome GestorResponsavel,
   CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(40),c.Valor) Valor,c.Status
   FROM Operacao.Contratacao c${joins} WHERE ${visibility(actor,user)}${filtered} ORDER BY c.ContratacaoId DESC`);
  if(registros.length>maxRows)fail('EXPORTACAO_MUITOS_REGISTROS',413);
  let depotName;if(filters.depositoId?.trim())depotName=(await db.query(`SELECT f.Nome FROM Cadastro.Deposito f WHERE f.DepositoId=${identifier(filters.depositoId.trim())} AND ${scope(actor,user,'f')}`))[0]?.Nome;
  const used=Object.fromEntries(Object.entries(filters).map(([key,value])=>[key,value.trim()]).filter(([,value])=>value));
  const labels={numero:'Número',prestador:'Prestador',deposito:'Depósito',depositoId:'Depósito',centroCusto:'Centro de custo',gestor:'Gestor responsável',dataServico:'Data do serviço',inicio:'Serviço desde',fim:'Serviço até',valor:'Valor (R$)',situacao:'Situação'};
  const filtrosTexto=Object.entries(used).map(([key,value])=>labels[key]+': '+(key==='depositoId'?(depotName||'ID '+value):['dataServico','inicio','fim'].includes(key)?value.split('-').reverse().join('/'):value)).join('; ')||'Todos os registros autorizados, sem filtros adicionais';
  const cents=registros.reduce((sum,row)=>sum+BigInt(String(row.Valor).replace('.','')),0n),total=String(cents/100n)+'.'+String(cents%100n).padStart(2,'0');
  const instant=cfg.exportNow?cfg.exportNow():new Date(),geradoEmUtc=instant.toISOString();
  const geradoEm=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(instant)+' (Brasília)';
  return {registros,filtros:used,filtrosTexto,geradoEmUtc,geradoEm,quantidade:registros.length,total};
 });
}
export async function detail(cfg,actor,id){identifier(id);return transaction(cfg,actor,null,false,async(db,user)=>{
 const row=await record(db,actor,user,id);return {registro:row,pc10:cfg.pc10===true&&!cfg.fin01,podeOperar:user.operational&&(user.admin||await branchAllowed(db,actor,row.DepositoId)),podeAprovarHorarios:user.admin,solicitacoesHorarios:user.operational?await db.query(`SELECT hs.SolicitacaoId,CONVERT(varchar(16),hs.EntradaReal,126) EntradaReal,CONVERT(varchar(16),hs.SaidaReal,126) SaidaReal,hs.Motivo,hs.SolicitanteId,u.Nome Solicitante,hs.Status,hs.DecididoPor,CONVERT(varchar(23),hs.DecididoEmUtc,126) DecididoEmUtc FROM Operacao.ContratacaoHorarioSolicitacao hs JOIN Seguranca.Usuario u ON u.UsuarioId=hs.SolicitanteId WHERE hs.ContratacaoId=${identifier(id)} ORDER BY hs.SolicitacaoId DESC`):[],...(cfg.pc05?{pc05:true,entradaTokenUsada:(await db.query(`SELECT TOP(1) 1 V FROM Operacao.ContratacaoToken WHERE ContratacaoId=${identifier(id)} AND Tipo='ENTRADA' AND ConsumidoEmUtc IS NOT NULL`)).length>0}:{}),eventos:await contractHistory(db,id)};
});}
async function branchAllowed(db,actor,branch){return (await db.query(`SELECT 1 V FROM Seguranca.UsuarioDeposito WHERE UsuarioId=${identifier(actor)} AND DepositoId=${identifier(branch)} AND RevogadoEmUtc IS NULL`)).length>0;}
export async function create(cfg,actor,token,body){const v=creationInput(body);return transaction(cfg,actor,token,true,async(db,user)=>{
 if(!user.admin&&v.gestorId!==identifier(actor))fail('GESTOR_RESPONSAVEL_FIXO',403);
 if(!(await db.query(`SELECT f.DepositoId FROM Cadastro.Deposito f WITH(HOLDLOCK) WHERE f.DepositoId=${v.depositoId} AND f.Ativo=1 AND ${scope(actor,user,'f')}`)).length)fail('DEPOSITO_NAO_AUTORIZADA',403);
 if(!(await db.query(`SELECT u.UsuarioId FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${v.gestorId} AND u.Ativo=1 AND ${responsibleScope(v.depositoId)}`)).length)fail('GESTOR_RESPONSAVEL_INDISPONIVEL',403);
 if(!(await db.query(`SELECT p.PrestadorId FROM Cadastro.Prestador p WITH(HOLDLOCK) JOIN Cadastro.PrestadorDeposito pf ON pf.PrestadorId=p.PrestadorId AND pf.DepositoId=${v.depositoId} AND pf.RevogadoEmUtc IS NULL WHERE p.PrestadorId=${v.prestadorId} AND p.Ativo=1`)).length)fail('PRESTADOR_SEM_VINCULO_ATIVO',409);
 if(!(await db.query(`SELECT TipoServicoId FROM Cadastro.TipoServico WITH(HOLDLOCK) WHERE TipoServicoId=${v.tipoServicoId} AND Ativo=1`)).length)fail('TIPO_INATIVO',409);
 // transaction() holds the PC04 application lock through commit; canceled rows retain their number.
 const inserted=(await db.query(`INSERT Operacao.Contratacao(Numero,DepositoId,PrestadorId,TipoServicoId,GestorResponsavelId,DataServico,InicioPrevisto,FimPrevisto,Valor,CriadoPor) OUTPUT inserted.ContratacaoId SELECT COALESCE(MAX(Numero),0)+1,${v.depositoId},${v.prestadorId},${v.tipoServicoId},${v.gestorId},'${v.dataServico}','${v.inicioPrevisto}:00','${v.fimPrevisto}:00',${v.valor},${identifier(actor)} FROM Operacao.Contratacao WITH(UPDLOCK,HOLDLOCK) WHERE DepositoId=${v.depositoId}`))[0];
 if(!inserted)throw Error('Contratação não persistida');await event(db,actor,inserted.ContratacaoId,'CRIAR',{dados:v});return record(db,actor,user,inserted.ContratacaoId,true);
});}
export async function change(cfg,actor,token,id,action,body){
 identifier(id);const fields={previstos:['inicioPrevisto','fimPrevisto'],horarios:['entradaReal','saidaReal','motivo'],conferir:[],revisar:['valor','motivo'],cancelar:['motivo']};
 if(!Object.hasOwn(fields,action))fail('ACAO_INVALIDA');keys(body,['versao',...fields[action]]);version(body.versao);
 const why=['conferir','previstos'].includes(action)?null:reason(body.motivo),amount=action==='revisar'?money(body.valor):null;
 if(action==='horarios')period(body.entradaReal,body.saidaReal);
 if(action==='previstos')period(body.inicioPrevisto,body.fimPrevisto,timestamp(body.inicioPrevisto).slice(0,10));
 return transaction(cfg,actor,token,true,async(db,user)=>{
  const previous=await record(db,actor,user,id,true);
  if(Number(previous.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(yes(previous.LiberacaoBloqueada)||previous.Status==='LIBERADA')fail('CONTRATACAO_LIBERADA_BLOQUEADA',409);
  if(previous.PagoEmUtc)fail('CONTRATACAO_PAGA_PRESERVADA',409);
  if(previous.Status==='CANCELADA')fail('CONTRATACAO_CANCELADA',409);
  if(previous.HorarioPendenteId&&['horarios','conferir','previstos'].includes(action))fail('HORARIOS_PENDENTES_APROVACAO',409);
  let set;
  const unrelease="Status='ABERTA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL";
  if(action==='previstos'){
   const serviceDate=body.inicioPrevisto.slice(0,10);
   // Consumed tokens and real punches retain their original service-day context.
   if((previous.EntradaReal||previous.SaidaReal)&&serviceDate!==previous.DataServico)fail('DATA_COM_HORARIOS_REAIS',409);
   set=`DataServico='${serviceDate}',InicioPrevisto='${body.inicioPrevisto}:00',FimPrevisto='${body.fimPrevisto}:00'`;
  }else if(action==='horarios'){
   period(body.entradaReal,body.saidaReal,previous.DataServico);
   if(!user.admin){
    const request=(await db.query(`INSERT Operacao.ContratacaoHorarioSolicitacao(ContratacaoId,EntradaReal,SaidaReal,Motivo,SolicitanteId) OUTPUT inserted.SolicitacaoId VALUES(${identifier(id)},'${body.entradaReal}:00','${body.saidaReal}:00',${s(why,800)},${identifier(actor)})`))[0];
    if(!request)throw Error('Solicitacao nao persistida');
    await db.query(`UPDATE Operacao.Contratacao SET Versao=Versao+1 WHERE ContratacaoId=${identifier(id)} AND Versao=${body.versao}`);
    if(cfg.pc05)await invalidateTokens(db,id);
    await event(db,actor,id,'HORARIO_SOL',{solicitacaoId:String(request.SolicitacaoId),entradaReal:body.entradaReal,saidaReal:body.saidaReal,motivo:why});
    return {...await record(db,actor,user,id,true),HorarioSolicitado:true};
   }
   set=`EntradaReal='${body.entradaReal}:00',SaidaReal='${body.saidaReal}:00',EntradaOrigem='MANUAL',SaidaOrigem='MANUAL',${unrelease}`;
  }else if(action==='conferir'){
   if(previous.Status==='LIBERADA')fail('CONTRATACAO_JA_LIBERADA',409);
   if(!previous.EntradaReal||!previous.SaidaReal)fail('HORARIOS_REAIS_OBRIGATORIOS',409);
   set=`Status='LIBERADA',LiberacaoBloqueada=1,ValorLiberado=Valor,LiberadoEmUtc=SYSUTCDATETIME(),ConferidoPor=${identifier(actor)}`;
  }else if(action==='revisar')set=`Valor=${amount},${unrelease}`;
  else set="Status='CANCELADA',ValorLiberado=NULL,LiberadoEmUtc=NULL,ConferidoPor=NULL";
  if(cfg.pc10&&!cfg.fin01)await contractMovements(db,actor,previous,action,previous.Valor,why);
  await db.query(`UPDATE Operacao.Contratacao SET ${set},Versao=Versao+1 WHERE ContratacaoId=${identifier(id)} AND Versao=${body.versao}`);
  if(action==='cancelar'&&previous.HorarioPendenteId)await db.query(`UPDATE Operacao.ContratacaoHorarioSolicitacao SET Status='CANCELADA',DecididoPor=${identifier(actor)},DecididoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${identifier(id)} AND Status='PENDENTE'`);
  if(cfg.pc05&&['horarios','cancelar','conferir','previstos'].includes(action))await invalidateTokens(db,id);
  await event(db,actor,id,action.toUpperCase(),{antes:previous,motivo:why,...(action==='previstos'?{inicioPrevisto:body.inicioPrevisto,fimPrevisto:body.fimPrevisto,dataServico:body.inicioPrevisto.slice(0,10)}:{}),...(action==='horarios'?{entradaReal:body.entradaReal,saidaReal:body.saidaReal,origem:'MANUAL'}:{}),...(action==='revisar'?{valor:amount}:{})});
  return record(db,actor,user,id,true);
 });
}
async function invalidateTokens(db,id){await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${identifier(id)} AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);}
export async function pendingHours(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!user.admin)fail('SOMENTE_ADM',403);
 return {registros:await db.query(`SELECT hs.SolicitacaoId,c.ContratacaoId,c.Numero,c.Versao,p.Nome Prestador,d.Nome Deposito,CONVERT(varchar(16),hs.EntradaReal,126) EntradaReal,CONVERT(varchar(16),hs.SaidaReal,126) SaidaReal,hs.Motivo,hs.SolicitanteId,u.Nome Solicitante FROM Operacao.ContratacaoHorarioSolicitacao hs JOIN Operacao.Contratacao c ON c.ContratacaoId=hs.ContratacaoId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId JOIN Seguranca.Usuario u ON u.UsuarioId=hs.SolicitanteId WHERE hs.Status='PENDENTE' AND c.Status='ABERTA' AND c.LiberacaoBloqueada=0 ORDER BY hs.CriadoEmUtc,hs.SolicitacaoId`)};
});}
export async function decideHours(cfg,actor,token,id,requestId,body){
 identifier(id);identifier(requestId);keys(body,['versao','aprovar']);version(body.versao);if(typeof body.aprovar!=='boolean')fail('DECISAO_INVALIDA');
 return transaction(cfg,actor,token,true,async(db,user)=>{
  if(!user.admin)fail('SOMENTE_ADM',403);
  const previous=await record(db,actor,user,id,true);
  if(Number(previous.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(yes(previous.LiberacaoBloqueada)||previous.Status==='LIBERADA')fail('CONTRATACAO_LIBERADA_BLOQUEADA',409);
  if(previous.Status!=='ABERTA'||previous.PagoEmUtc)fail('CONTRATACAO_FECHADA',409);
  const request=(await db.query(`SELECT SolicitacaoId,SolicitanteId,Motivo,CONVERT(varchar(16),EntradaReal,126) EntradaReal,CONVERT(varchar(16),SaidaReal,126) SaidaReal FROM Operacao.ContratacaoHorarioSolicitacao WITH(UPDLOCK,HOLDLOCK) WHERE SolicitacaoId=${identifier(requestId)} AND ContratacaoId=${identifier(id)} AND Status='PENDENTE'`))[0];
  if(!request)fail('SOLICITACAO_INDISPONIVEL',409);
  period(request.EntradaReal,request.SaidaReal,previous.DataServico);
  await db.query(`UPDATE Operacao.ContratacaoHorarioSolicitacao SET Status='${body.aprovar?'APROVADA':'NEGADA'}',DecididoPor=${identifier(actor)},DecididoEmUtc=SYSUTCDATETIME() WHERE SolicitacaoId=${identifier(requestId)} AND ContratacaoId=${identifier(id)} AND Status='PENDENTE'`);
  await db.query(`UPDATE Operacao.Contratacao SET ${body.aprovar?`EntradaReal='${request.EntradaReal}:00',SaidaReal='${request.SaidaReal}:00',EntradaOrigem='MANUAL',SaidaOrigem='MANUAL',`:''}Versao=Versao+1 WHERE ContratacaoId=${identifier(id)} AND Versao=${body.versao}`);
  if(cfg.pc05&&body.aprovar)await invalidateTokens(db,id);
  await event(db,actor,id,body.aprovar?'HORARIO_APROV':'HORARIO_NEGADO',{solicitacaoId:String(requestId),solicitanteId:String(request.SolicitanteId),entradaReal:request.EntradaReal,saidaReal:request.SaidaReal,motivo:request.Motivo});
  return record(db,actor,user,id,true);
 });
}
