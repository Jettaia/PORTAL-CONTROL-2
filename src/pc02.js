import crypto from 'node:crypto';
import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {assertAdminDb,assertCoordinatorDb} from './pc01.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const address={centroCusto:['CentroCusto',80],rua:['Rua',200],numero:['Numero',30],bairro:['Bairro',120],cidade:['Cidade',120],estado:['Estado',2],cep:['CEP',8]};
const definitions={depositos:{table:'Cadastro.Deposito',pk:'DepositoId',cols:'DepositoId,Nome,CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP,Ativo',entity:'Deposito'},servicos:{table:'Cadastro.TipoServico',pk:'TipoServicoId',cols:'TipoServicoId,Nome,Descricao,Ativo',entity:'TipoServico'}};
const active=v=>v===true||v===1||v===1n||v==='1';
export function normalizeCatalog(kind,body,editing=false){
 const depot=kind==='depositos',fields=['nome','ativo',...(depot?Object.keys(address):['descricao']),...(editing?['original']:[])];
 if(!definitions[kind]||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k)))fail('CAMPOS_INVALIDOS');
 const text=(key,max,required=true)=>{const v=body[key]??(required?null:'');if(typeof v!=='string'||v.trim().length>max||required&&!v.trim())fail('CAMPO_INVALIDO_'+key.toUpperCase());return v.trim();};
 const value={nome:text('nome',depot?150:120),ativo:body.ativo===undefined&&!editing?true:body.ativo};
 if(typeof value.ativo!=='boolean')fail('SITUACAO_INVALIDA');
 if(depot){
  for(const [key,[,max]] of Object.entries(address))value[key]=text(key,key==='cep'?9:max);
  value.estado=value.estado.toUpperCase();
  if(!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(value.estado))fail('CAMPO_INVALIDO_ESTADO');
  if(!/^\d{5}-?\d{3}$/.test(value.cep))fail('CAMPO_INVALIDO_CEP');
  value.cep=value.cep.replace('-','');
 }else value.descricao=text('descricao',500,false);
 if(editing){
  const original=body.original,keys=['nome',...(depot?Object.keys(address):['descricao']),'ativo'];
  if(!original||typeof original!=='object'||Array.isArray(original)||Object.keys(original).some(k=>!keys.includes(k))||typeof original.ativo!=='boolean'||keys.filter(k=>k!=='ativo').some(k=>typeof original[k]!=='string'||original[k].length>(k==='nome'?(depot?150:120):k==='descricao'?500:address[k][1])))fail('ORIGINAL_INVALIDO');
  value.original=Object.fromEntries(keys.map(k=>[k,original[k]]));
 }
 return value;
}
export async function read(cfg,actor,kind){
 const d=definitions[kind];if(!d)fail('CADASTRO_INVALIDO',404);
 return withDb(cfg,async db=>{
  const uid=n(actor),user=(await db.query(`SELECT u.Perfil,CASE WHEN EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=u.UsuarioId) AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'COORDENADOR')} THEN 1 ELSE 0 END Coordenador FROM Seguranca.Usuario u WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
  if(!user)fail('SESSAO_INVALIDA',401);
  const admin=active(user.Adm),scope=kind==='depositos'&&!admin?` WHERE EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${uid} AND ud.DepositoId=Cadastro.Deposito.DepositoId AND ud.RevogadoEmUtc IS NULL)`:'';
  return {pc02:true,podeEditar:admin||active(user.Coordenador),registros:await db.query(`SELECT ${d.cols} FROM ${d.table}${scope} ORDER BY Nome,${d.pk}`)};
 });
}
export async function save(cfg,actor,token,kind,body,id){
 const d=definitions[kind],editing=id!==undefined,v=normalizeCatalog(kind,body,editing),uid=n(actor),target=editing?n(id):null,depot=kind==='depositos';
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
  try{
   const lock=(await db.query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC02.${kind}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;`))[0];
   if(!lock||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
   let admin=true;
   try{await assertAdminDb(db,actor);}catch(e){if(e.message!=='SOMENTE_ADM')throw e;admin=false;await assertCoordinatorDb(db,actor);}
   await assertMfa(db,actor,token,cfg);
   const scope=depot&&!admin?` AND EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${uid} AND ud.DepositoId=Cadastro.Deposito.DepositoId AND ud.RevogadoEmUtc IS NULL)`:'';
   const row=target?(await db.query(`SELECT ${d.cols} FROM ${d.table} WITH(UPDLOCK,HOLDLOCK) WHERE ${d.pk}=${target}${scope}`))[0]:null;
   if(target&&!row)fail('REGISTRO_INDISPONIVEL',404);
   const previous=row?{nome:row.Nome,ativo:active(row.Ativo),...(depot?Object.fromEntries(Object.entries(address).map(([key,[column]])=>[key,row[column]||''])):{descricao:row.Descricao||''})}:null;
   if(previous&&Object.keys(previous).some(k=>previous[k]!==v.original[k]))fail('REGISTRO_ALTERADO_ATUALIZE',409);
   if((await db.query(`SELECT ${d.pk} FROM ${d.table} WITH(UPDLOCK,HOLDLOCK) WHERE Nome=${s(v.nome,depot?150:120)}${target?` AND ${d.pk}<>${target}`:''}`)).length)fail('NOME_DUPLICADO',409);
   const entries={Nome:s(v.nome,depot?150:120),...(depot?Object.fromEntries(Object.entries(address).map(([key,[column,max]])=>[column,s(v[key],max)])):{Descricao:s(v.descricao,500)}),Ativo:v.ativo?1:0};
   // Codigo is an internal key retained for the historical SQL modules.
   if(depot&&!target)entries.Codigo=s('D'+crypto.randomUUID().replaceAll('-','').slice(0,29),30);
   let result;
   if(target)result=(await db.query(`UPDATE ${d.table} SET ${Object.entries(entries).map(([k,value])=>`${k}=${value}`).join(',')} OUTPUT ${d.cols.split(',').map(k=>'inserted.'+k).join(',')} WHERE ${d.pk}=${target}`))[0];
   else result=(await db.query(`INSERT ${d.table}(${Object.keys(entries).join(',')}) OUTPUT ${d.cols.split(',').map(k=>'inserted.'+k).join(',')} VALUES(${Object.values(entries).join(',')})`))[0];
   // Legacy operational procedures require both grant tables even for root ADM.
   // Administrators inherit all new depots. A coordinator creator receives
   // only the new depot; every other account keeps its assigned scope.
   if(depot&&!target)await db.query(`INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor)
    SELECT u.UsuarioId,${n(result.DepositoId)},${uid} FROM Seguranca.Usuario u JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId
    WHERE u.Ativo=1 AND u.Perfil='ADMIN' AND Seguranca.fn_PC01_TemFuncao(u.UsuarioId,'ADMIN')=1
    AND NOT EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=u.UsuarioId AND ud.DepositoId=${n(result.DepositoId)});
    INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId)
    SELECT u.UsuarioId,${n(result.DepositoId)},${uid} FROM Seguranca.Usuario u JOIN Seguranca.UsuarioRaiz r ON r.UsuarioId=u.UsuarioId
    WHERE u.Ativo=1 AND u.Perfil='ADMIN' AND Seguranca.fn_PC01_TemFuncao(u.UsuarioId,'ADMIN')=1
    AND NOT EXISTS(SELECT 1 FROM Seguranca.GestorDeposito gd WHERE gd.GestorUsuarioId=u.UsuarioId AND gd.DepositoId=${n(result.DepositoId)});`);
   if(depot&&!target&&!admin){
    await db.query(`INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId,ConcedidoPor) VALUES(${uid},${n(result.DepositoId)},${uid});
     IF Seguranca.fn_PC01_TemFuncao(${uid},'GESTOR')=1 INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId,ConcedidoPorUsuarioId) VALUES(${uid},${n(result.DepositoId)},${uid});`);
   }
   const {original,...after}=v;
   await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'${d.entity}',${n(result[d.pk])},N'PC02_${editing?'ATUALIZAR':'CRIAR'}',${uid},${s(JSON.stringify({antes:previous,depois:after}),'max')})`);
   await db.commit();return result;
  }catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
