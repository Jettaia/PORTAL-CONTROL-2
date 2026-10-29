import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {roleSql} from './access-policy.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const yes=v=>v===true||v===1||v===1n||v==='1';
const cols='PrestadorId,Nome,CPF,Telefone,CNPJ,Ativo,Versao';
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');};
export function documentNumber(value,size){if(typeof value!=='string'||!(/^[\d.\-/\s]+$/).test(value))fail(size===11?'CPF_INVALIDO':'CNPJ_INVALIDO');const digits=value.replace(/\D/g,'');if(digits.length!==size)fail(size===11?'CPF_INVALIDO':'CNPJ_INVALIDO');return digits;}
function input(body,editing){
 keys(body,['nome','cpf','telefone','cnpj',...(editing?['ativo','versao']:['filiais'])]);
 const text=(key,max)=>{const value=body[key]??'';if(typeof value!=='string'||value.trim().length>max)fail('CAMPO_INVALIDO_'+key.toUpperCase());return value.trim();};
 if(body.cnpj!==undefined&&typeof body.cnpj!=='string')fail('CNPJ_INVALIDO');
 const v={nome:text('nome',160),cpf:documentNumber(body.cpf,11),telefone:text('telefone',25),cnpj:body.cnpj?documentNumber(body.cnpj,14):''};
 if(!/^\S+\s+\S/.test(v.nome))fail('NOME_COMPLETO_OBRIGATORIO');
 if(editing){if(typeof body.ativo!=='boolean'||!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_OU_SITUACAO_INVALIDA');v.ativo=body.ativo;v.versao=body.versao;}
 else{if(!Array.isArray(body.filiais)||!body.filiais.length||body.filiais.length>100||body.filiais.some(id=>typeof id!=='number'||!Number.isSafeInteger(id)||id<1)||new Set(body.filiais).size!==body.filiais.length)fail('FILIAIS_INVALIDAS');v.filiais=[...body.filiais].sort((a,b)=>a-b);}
 return v;
}
async function actorDb(db,actor){
 const uid=n(actor),u=(await db.query(`SELECT u.UsuarioId,CASE WHEN ${roleSql(uid,'ADMIN')} AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm,CASE WHEN ${roleSql(uid,'GESTOR')} THEN 1 ELSE 0 END Gestor FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
 if(!u||!yes(u.Adm)&&!yes(u.Gestor))fail('PERMISSAO_NEGADA',403);return {admin:yes(u.Adm)};
}
const branchScope=(actor,admin,alias='f')=>admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${n(actor)} AND uf.FilialId=${alias}.FilialId AND uf.RevogadoEmUtc IS NULL)`;
async function branchDb(db,actor,admin,id,adding){
 if(!(await db.query(`SELECT f.FilialId FROM Cadastro.Filial f WITH(HOLDLOCK) WHERE f.FilialId=${n(id)}${adding?' AND f.Ativo=1':''} AND ${branchScope(actor,admin)}`)).length)fail('FILIAL_NAO_AUTORIZADA',403);
}
async function audit(db,actor,id,action,details){await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Prestador',${n(id)},N'PC03_${action}',${n(actor)},${s(JSON.stringify(details),'max')})`);}
async function mutate(cfg,actor,token,fn){return withDb(cfg,async db=>{
 await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
 try{
  const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC03',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
  const u=await actorDb(db,actor);await assertMfa(db,actor,token);const result=await fn(db,u.admin);await db.commit();return result;
 }catch(e){try{await db.rollback();}catch{}if(e.odbcErrors?.some(x=>[2601,2627].includes(Number(x.code))))fail('CPF_DUPLICADO',409);throw e;}
});}
export async function read(cfg,actor,cpf){
 const exact=cpf!==undefined?documentNumber(cpf,11):null;
 return withDb(cfg,async db=>{
  const {admin}=await actorDb(db,actor);
  // Exact identity lookup is global; list and links are restricted to actor branches.
  const visible=`EXISTS(SELECT 1 FROM Cadastro.PrestadorFilial pf JOIN Cadastro.Filial f ON f.FilialId=pf.FilialId WHERE pf.PrestadorId=p.PrestadorId AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,admin)})`;
  const registros=await db.query(`SELECT TOP(200) ${cols.split(',').map(c=>'p.'+c).join(',')} FROM Cadastro.Prestador p WHERE ${exact?'p.CPF='+s(exact,11):admin?'1=1':visible} ORDER BY p.Nome,p.PrestadorId`);
  const filiais=await db.query(`SELECT f.FilialId,f.Nome,f.Ativo FROM Cadastro.Filial f WHERE ${branchScope(actor,admin)} ORDER BY f.Nome`);
  const vinculos=registros.length?await db.query(`SELECT pf.PrestadorId,pf.FilialId FROM Cadastro.PrestadorFilial pf JOIN Cadastro.Filial f ON f.FilialId=pf.FilialId WHERE pf.PrestadorId IN(${registros.map(r=>n(r.PrestadorId)).join(',')}) AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,admin)}`):[];
  return {pc03:true,podeEditar:true,adm:admin,registros,filiais,vinculos};
 });
}
export async function save(cfg,actor,token,body,id){
 const editing=id!==undefined,v=input(body,editing),target=editing?n(id):null;
 return mutate(cfg,actor,token,async(db,admin)=>{
  let previous;
  if(editing){
   previous=(await db.query(`SELECT ${cols} FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=${target}`))[0];if(!previous)fail('PRESTADOR_INDISPONIVEL',404);
   if(!admin&&!(await db.query(`SELECT 1 V FROM Cadastro.PrestadorFilial pf JOIN Cadastro.Filial f ON f.FilialId=pf.FilialId WHERE pf.PrestadorId=${target} AND pf.RevogadoEmUtc IS NULL AND ${branchScope(actor,false)}`)).length)fail('PRESTADOR_FORA_ESCOPO',403);
   if(!admin&&(previous.CPF!==v.cpf||yes(previous.Ativo)!==v.ativo))fail('SOMENTE_ADM',403);
   if(Number(previous.Versao)!==v.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  }else for(const branch of v.filiais)await branchDb(db,actor,admin,branch,true);
  if((await db.query(`SELECT PrestadorId FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE CPF=${s(v.cpf,11)}${target?' AND PrestadorId<>'+target:''}`)).length)fail('CPF_DUPLICADO',409);
  let row;
  if(editing)row=(await db.query(`UPDATE Cadastro.Prestador SET Nome=${s(v.nome,160)},CPF=${s(v.cpf,11)},Telefone=${s(v.telefone,25)},CNPJ=${s(v.cnpj,14)},Ativo=${v.ativo?1:0},Versao=Versao+1 OUTPUT ${cols.split(',').map(c=>'inserted.'+c).join(',')} WHERE PrestadorId=${target}`))[0];
  else{
   row=(await db.query(`INSERT Cadastro.Prestador(Nome,CPF,Telefone,CNPJ) OUTPUT ${cols.split(',').map(c=>'inserted.'+c).join(',')} VALUES(${s(v.nome,160)},${s(v.cpf,11)},${s(v.telefone,25)},${s(v.cnpj,14)})`))[0];
   for(const branch of v.filiais)await linkDb(db,actor,row.PrestadorId,branch,true);
  }
  await audit(db,actor,row.PrestadorId,editing?'EDITAR':'CRIAR',{antes:previous||null,depois:v});return row;
 });
}
async function linkDb(db,actor,id,branch,linked){
 const provider=n(id),filial=n(branch),uid=n(actor);
 if(linked)await db.query(`IF EXISTS(SELECT 1 FROM Cadastro.PrestadorFilial WHERE PrestadorId=${provider} AND FilialId=${filial}) UPDATE Cadastro.PrestadorFilial SET RevogadoEmUtc=NULL,RevogadoPor=NULL,ConcedidoPor=${uid},ConcedidoEmUtc=SYSUTCDATETIME() WHERE PrestadorId=${provider} AND FilialId=${filial} AND RevogadoEmUtc IS NOT NULL;ELSE INSERT Cadastro.PrestadorFilial(PrestadorId,FilialId,ConcedidoPor) VALUES(${provider},${filial},${uid});`);
 else await db.query(`UPDATE Cadastro.PrestadorFilial SET RevogadoEmUtc=SYSUTCDATETIME(),RevogadoPor=${uid} WHERE PrestadorId=${provider} AND FilialId=${filial} AND RevogadoEmUtc IS NULL`);
}
export async function link(cfg,actor,token,id,branch,body){
 keys(body,['vinculado']);if(typeof body.vinculado!=='boolean')fail('VINCULO_INVALIDO');n(id);n(branch);
 return mutate(cfg,actor,token,async(db,admin)=>{
  await branchDb(db,actor,admin,branch,body.vinculado);
  const row=(await db.query(`SELECT ${cols} FROM Cadastro.Prestador WITH(UPDLOCK,HOLDLOCK) WHERE PrestadorId=${n(id)}`))[0];if(!row)fail('PRESTADOR_INDISPONIVEL',404);
  if(body.vinculado&&!yes(row.Ativo))fail('PRESTADOR_INATIVO',409);
  await linkDb(db,actor,id,branch,body.vinculado);await audit(db,actor,id,body.vinculado?'VINCULAR':'DESVINCULAR',{filialId:String(branch),vinculado:body.vinculado});return {ok:true};
 });
}
