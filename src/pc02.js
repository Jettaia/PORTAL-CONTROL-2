import {withDb,intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {assertAdminDb} from './pc01.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const definitions={filiais:{table:'Cadastro.Filial',pk:'FilialId',cols:'FilialId,Codigo,Nome,Endereco,Ativo',entity:'Filial'},servicos:{table:'Cadastro.TipoServico',pk:'TipoServicoId',cols:'TipoServicoId,Nome,Descricao,Ativo',entity:'TipoServico'}};
const active=v=>v===true||v===1||v===1n||v==='1';
export function normalizeCatalog(kind,body,editing=false){
 const fields=['nome','ativo',...(kind==='filiais'?['codigo','endereco']:['descricao']),...(editing?['original']:[])];
 if(!definitions[kind]||!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!fields.includes(k)))fail('CAMPOS_INVALIDOS');
 const text=(key,max,required=true)=>{const v=body[key]??(required?null:'');if(typeof v!=='string'||v.trim().length>(max)||required&&!v.trim())fail('CAMPO_INVALIDO_'+key.toUpperCase());return v.trim();};
 const value={nome:text('nome',120),ativo:body.ativo===undefined&&!editing?true:body.ativo};
 if(typeof value.ativo!=='boolean')fail('SITUACAO_INVALIDA');
 if(kind==='filiais'){
  value.codigo=text('codigo',30).toUpperCase();if(!/^[A-Z0-9_-]{1,30}$/.test(value.codigo))fail('CODIGO_INVALIDO');
  value.endereco=text('endereco',400);
 }else value.descricao=text('descricao',500,false);
 if(editing){
  // Existing rows may not have an address yet. Preserve that original value for CAS.
  const original=body.original,keys=kind==='filiais'?['nome','codigo','endereco','ativo']:['nome','descricao','ativo'];
  if(!original||typeof original!=='object'||Array.isArray(original)||Object.keys(original).some(k=>!keys.includes(k))||typeof original.ativo!=='boolean'||keys.filter(k=>k!=='ativo').some(k=>typeof original[k]!=='string'||original[k].length>(k==='endereco'?400:k==='descricao'?500:k==='codigo'?30:150)))fail('ORIGINAL_INVALIDO');
  value.original=Object.fromEntries(keys.map(k=>[k,original[k]]));
 }
 return value;
}
export async function read(cfg,actor,kind){
 const d=definitions[kind];if(!d)fail('CADASTRO_INVALIDO',404);
 return withDb(cfg,async db=>{
  const uid=n(actor),user=(await db.query(`SELECT u.Perfil,CASE WHEN EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=u.UsuarioId) AND u.Perfil='ADMIN' THEN 1 ELSE 0 END Adm FROM Seguranca.Usuario u WHERE u.UsuarioId=${uid} AND u.Ativo=1`))[0];
  if(!user)fail('SESSAO_INVALIDA',401);
  const admin=active(user.Adm);
  // Lists include inactive records; operational selectors use planningCatalog.
  const scope=kind==='filiais'&&!admin&&user.Perfil!=='FINANCEIRO'?` WHERE EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${uid} AND uf.FilialId=Cadastro.Filial.FilialId AND uf.RevogadoEmUtc IS NULL)`:'';
  return {pc02:true,podeEditar:admin,registros:await db.query(`SELECT ${d.cols} FROM ${d.table}${scope} ORDER BY Nome,${d.pk}`)};
 });
}
export async function save(cfg,actor,token,kind,body,id){
 const d=definitions[kind],editing=id!==undefined,v=normalizeCatalog(kind,body,editing),uid=n(actor),target=editing?n(id):null;
 return withDb(cfg,async db=>{
  await db.query('SET NOCOUNT ON;SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');await db.beginTransaction();
  try{
   const lock=(await db.query(`DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC02.${kind}',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;`))[0];
   if(!lock||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
   await assertAdminDb(db,actor);await assertMfa(db,actor,token);
   const row=target?(await db.query(`SELECT ${d.cols} FROM ${d.table} WITH(UPDLOCK,HOLDLOCK) WHERE ${d.pk}=${target}`))[0]:null;
   if(target&&!row)fail('REGISTRO_INDISPONIVEL',404);
   const previous=row?{nome:row.Nome,ativo:active(row.Ativo),...(kind==='filiais'?{codigo:row.Codigo,endereco:row.Endereco||''}:{descricao:row.Descricao||''})}:null;
   if(previous&&Object.keys(previous).some(k=>previous[k]!==v.original[k]))fail('REGISTRO_ALTERADO_ATUALIZE',409);
   const unique=kind==='filiais'?'Codigo':'Nome',uniqueValue=kind==='filiais'?v.codigo:v.nome;
   if((await db.query(`SELECT ${d.pk} FROM ${d.table} WITH(UPDLOCK,HOLDLOCK) WHERE ${unique}=${s(uniqueValue,kind==='filiais'?30:120)}${target?` AND ${d.pk}<>${target}`:''}`)).length)fail(kind==='filiais'?'CODIGO_DUPLICADO':'NOME_DUPLICADO',409);
   const entries=kind==='filiais'?{Codigo:s(v.codigo,30),Nome:s(v.nome,120),Endereco:s(v.endereco,400),Ativo:v.ativo?1:0}:{Nome:s(v.nome,120),Descricao:s(v.descricao,500),Ativo:v.ativo?1:0};
   let result;
   if(target)result=(await db.query(`UPDATE ${d.table} SET ${Object.entries(entries).map(([k,value])=>`${k}=${value}`).join(',')} OUTPUT ${d.cols.split(',').map(k=>'inserted.'+k).join(',')} WHERE ${d.pk}=${target}`))[0];
   else result=(await db.query(`INSERT ${d.table}(${Object.keys(entries).join(',')}) OUTPUT ${d.cols.split(',').map(k=>'inserted.'+k).join(',')} VALUES(${Object.values(entries).join(',')})`))[0];
   const {original,...after}=v;
   await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'${d.entity}',${n(result[d.pk])},N'PC02_${editing?'ATUALIZAR':'CRIAR'}',${uid},${s(JSON.stringify({antes:previous,depois:after}),'max')})`);
   await db.commit();return result;
  }catch(e){try{await db.rollback();}catch{}throw e;}
 });
}
