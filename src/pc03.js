import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
const cols='PrestadorId,Nome,CPF,Telefone,CNPJ,Ativo,Versao';
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
export function documentNumber(value){if(typeof value!=='string'||!(/^[\d.\-/\s]+$/).test(value))fail('DOCUMENTO_INVALIDO');const digits=value.replace(/\D/g,'');if(![11,14].includes(digits.length))fail('DOCUMENTO_INVALIDO');return digits;}
function input(body,editing){
 keys(body,['nome','documento','cpf','telefone','cnpj',...(editing?['ativo','versao']:['depositos'])]);
 const text=(key,max)=>{const value=body[key]??'';if(typeof value!=='string'||value.trim().length>max)fail('CAMPO_INVALIDO_'+key.toUpperCase());return value.trim();};
 if(body.cnpj!==undefined&&typeof body.cnpj!=='string')fail('CNPJ_INVALIDO');
 if(body.documento!==undefined&&(body.cpf!==undefined||body.cnpj!==undefined)||body.cpf&&body.cnpj)fail('DOCUMENTO_UNICO_OBRIGATORIO');
 const v={nome:text('nome',160),cpf:documentNumber(body.documento??body.cpf??body.cnpj),telefone:text('telefone',25),cnpj:''};
 if(!/^\S+\s+\S/.test(v.nome))fail('NOME_COMPLETO_OBRIGATORIO');
 if(editing){if(typeof body.ativo!=='boolean'||!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_OU_SITUACAO_INVALIDA');v.ativo=body.ativo;v.versao=body.versao;}
 else{if(!Array.isArray(body.depositos)||!body.depositos.length||body.depositos.length>100||body.depositos.some(id=>typeof id!=='number'||!Number.isSafeInteger(id)||id<1)||new Set(body.depositos).size!==body.depositos.length)fail('DEPOSITOS_INVALIDAS');v.depositos=[...body.depositos].sort((a,b)=>a-b);}
 return v;
}
async function actorDb(db,actor){
 const uid=n(actor),u=(await db.query(`SELECT u.UsuarioId,CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
 if(!u||!yes(u.Adm)&&!yes(u.Gestor))fail('PERMISSAO_NEGADA',403);return {admin:yes(u.Adm)};
}
const branchScope=(actor,admin,alias='f')=>admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito uf WHERE uf.UsuarioId=${n(actor)} AND uf.DepositoId=${alias}.DepositoId AND uf.RevogadoEmUtc IS NULL)`;
async function branchDb(db,actor,admin,id,adding){
 if(!(await db.query(`SELECT f.DepositoId FROM Cadastro.Deposito f WITH(HOLDLOCK) WHERE f.DepositoId=${n(id)}${adding?' AND f.Ativo=1':''} AND ${branchScope(actor,admin)}`)).length)fail('DEPOSITO_NAO_AUTORIZADA',403);
}
async function audit(db,actor,id,action,details){await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Prestador',${n(id)},N'PC03_${action}',${n(actor)},${s(JSON.stringify(details,(_key,value)=>typeof value==='bigint'?value.toString():value),'max')})`);}
async function mutate(cfg,actor,token,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{
  const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC03',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
  const u=await actorDb(db,actor);await assertMfa(db,actor,token,cfg);const result=await fn(db,u.admin);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627].includes(Number(x.code))))fail('CPF_DUPLICADO',409);throw e;}
});}
export async function read(cfg,actor,documento){
 const exact=documento!==undefined?documentNumber(documento):null;
 return withDb(cfg,async db=>{
  const {admin}=await actorDb(db,actor);
  // Exact identity lookup follows the same depot boundary as the list.
  const visible=`EXISTS(SELECT 1 FROM Cadastro.PrestadorDeposito pf JOIN Cadastro.Deposito f ON f.DepositoId=pf.DepositoId WHERE pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,admin)})`;
  const registros=await db.query(`SELECT ${cols.split(',').map(c=>'p.'+c).join(',')} FROM Cadastro.Prestador p WHERE ${admin?'1=1':visible}${exact?' AND p.CPF='+s(exact,14):''} ORDER BY p.Nome,p.PrestadorId`);
  const depositos=await db.query(`SELECT f.DepositoId,f.Nome,f.Ativo FROM Cadastro.Deposito f WHERE ${branchScope(actor,admin)} ORDER BY f.Nome`);
  const vinculos=registros.length?await db.query(`SELECT pf.PrestadorId,pf.DepositoId FROM Cadastro.PrestadorDeposito pf JOIN Cadastro.Deposito f ON f.DepositoId=pf.DepositoId WHERE pf.PrestadorId IN(${registros.map(r=>n(r.PrestadorId)).join(',')}) AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,admin)}`):[];
  return {pc03:true,podeEditar:true,adm:admin,registros,depositos,vinculos};
 });
}
export async function save(cfg,actor,token,body,id){
 const editing=id!==undefined,v=input(body,editing),target=editing?n(id):null;
 return mutate(cfg,actor,token,async(db,admin)=>{
  let previous;
  if(editing){
   previous=(await db.query(`SELECT ${cols} FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=${target}`))[0];if(!previous)fail('PRESTADOR_INDISPONIVEL',404);
   if(!admin&&!(await db.query(`SELECT 1 V FROM Cadastro.PrestadorDeposito pf JOIN Cadastro.Deposito f ON f.DepositoId=pf.DepositoId WHERE pf.PrestadorId=${target} AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,false)}`)).length)fail('PRESTADOR_FORA_ESCOPO',403);
   if(!admin&&(previous.CPF!==v.cpf||yes(previous.Ativo)!==v.ativo))fail('SOMENTE_ADM',403);
   if(Number(previous.Versao)!==v.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  }else for(const branch of v.depositos)await branchDb(db,actor,admin,branch,true);
  if((await db.query(`SELECT PrestadorId FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE CPF=${s(v.cpf,14)}${target?' AND PrestadorId<>'+target:''}`)).length)fail('CPF_DUPLICADO',409);
  let row;
  if(editing)row=(await db.query(`UPDATE Cadastro.Prestador SET Nome=${s(v.nome,160)},CPF=${s(v.cpf,14)},Telefone=${s(v.telefone,25)},CNPJ=${s(v.cnpj,14)},Ativo=${v.ativo?1:0},Versao=Versao+1 OUTPUT ${cols.split(',').map(c=>'inserted.'+c).join(',')} WHERE PrestadorId=${target}`))[0];
  else{
   row=(await db.query(`INSERT Cadastro.Prestador(Nome,CPF,Telefone,CNPJ) OUTPUT ${cols.split(',').map(c=>'inserted.'+c).join(',')} VALUES(${s(v.nome,160)},${s(v.cpf,14)},${s(v.telefone,25)},${s(v.cnpj,14)})`))[0];
   for(const branch of v.depositos)await linkDb(db,actor,row.PrestadorId,branch,true);
  }
  await audit(db,actor,row.PrestadorId,editing?'EDITAR':'CRIAR',{antes:previous||null,depois:v});return row;
 });
}
async function linkDb(db,actor,id,branch,linked){
 const provider=n(id),deposito=n(branch),uid=n(actor);
 if(linked)await db.query(`IF EXISTS(SELECT 1 FROM Cadastro.PrestadorDeposito WHERE PrestadorId=${provider} AND DepositoId=${deposito}) UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=NULL,RevogadoPor=NULL,ConcedidoPor=${uid},ConcedidoEmUtc=SYSUTCDATETIME() WHERE PrestadorId=${provider} AND DepositoId=${deposito} AND RevogadoEmUtc IS NOT NULL;ELSE INSERT Cadastro.PrestadorDeposito(PrestadorId,DepositoId,ConcedidoPor) VALUES(${provider},${deposito},${uid});`);
 else await db.query(`UPDATE Cadastro.PrestadorDeposito SET RevogadoEmUtc=SYSUTCDATETIME(),RevogadoPor=${uid} WHERE PrestadorId=${provider} AND DepositoId=${deposito} AND RevogadoEmUtc IS NULL`);
}
export async function link(cfg,actor,token,id,branch,body){
 keys(body,['vinculado']);if(typeof body.vinculado!=='boolean')fail('VINCULO_INVALIDO');n(id);n(branch);
 return mutate(cfg,actor,token,async(db,admin)=>{
  await branchDb(db,actor,admin,branch,body.vinculado);
  // Existing-provider links must start from a provider already visible to this
  // manager. Guessing an ID from another depot cannot import its identity.
  if(!admin&&!(await db.query(`SELECT 1 V FROM Cadastro.PrestadorDeposito pf WITH(HOLDLOCK) JOIN Cadastro.Deposito f ON f.DepositoId=pf.DepositoId AND f.Ativo=1 WHERE pf.PrestadorId=${n(id)} AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,false)}`)).length)fail('PRESTADOR_FORA_ESCOPO',403);
  const row=(await db.query(`SELECT ${cols} FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=${n(id)}`))[0];if(!row)fail('PRESTADOR_INDISPONIVEL',404);
  if(body.vinculado&&!yes(row.Ativo))fail('PRESTADOR_INATIVO',409);
  await linkDb(db,actor,id,branch,body.vinculado);await audit(db,actor,id,body.vinculado?'VINCULAR':'DESVINCULAR',{depositoId:String(branch),vinculado:body.vinculado});return {ok:true};
 });
}
