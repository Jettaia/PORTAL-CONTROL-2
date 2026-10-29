import {withDb,nvarcharLiteral,intLiteral} from './auth-db.js';
const defs=Object.freeze({filiais:{table:'Cadastro.Filial',pk:'FilialId',cols:'FilialId,Codigo,Nome,Ativo',read:'filiais.visualizar',write:'filiais.cadastrar'},chapas:{table:'Cadastro.Prestador',pk:'PrestadorId',cols:'PrestadorId,Nome,Telefone,Ativo',read:'prestadores.visualizar',write:'prestadores.cadastrar'},servicos:{table:'Cadastro.TipoServico',pk:'TipoServicoId',cols:'TipoServicoId,Nome,Ativo',read:'servicos.visualizar',write:'servicos.cadastrar'}});
export const b24Definition=type=>defs[type]||null;
export function validateB24(type,body){if(!defs[type])throw Error('Cadastro desconhecido');const nome=String(body?.nome||'').trim();if(!nome||nome.length>120)throw Error('Nome invalido');if(type==='filiais'){if(nome.length<2)throw Error('Nome deve conter pelo menos 2 caracteres');const codigo=String(body?.codigo||'').trim().toUpperCase();if(!/^[A-Z0-9_-]{1,30}$/.test(codigo))throw Error('Codigo invalido');return {nome,codigo};}if(type==='chapas'){const cpf=String(body?.cpf||'').replace(/\D/g,'');if(!/^\d{11}$/.test(cpf))throw Error('CPF deve conter 11 digitos');const telefone=String(body?.telefone||'').trim();if(telefone.length>25)throw Error('Telefone invalido');return{nome,cpf,telefone};}return{nome};}
export async function listB24(cfg,type,actor){const d=b24Definition(type);if(!d)throw Error('Cadastro invalido');const scoped=cfg.pc01&&type==='filiais'&&actor!==undefined;return withDb(cfg,db=>db.query(`SELECT TOP (200) ${d.cols} FROM ${d.table}${scoped?` WHERE EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r WHERE r.UsuarioId=${intLiteral(actor)}) OR EXISTS(SELECT 1 FROM Cadastro.Deposito dep JOIN Seguranca.UsuarioDeposito ud ON ud.DepositoId=dep.DepositoId AND ud.RevogadoEmUtc IS NULL WHERE dep.FilialId=Cadastro.Filial.FilialId AND ud.UsuarioId=${intLiteral(actor)}) OR EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${intLiteral(actor)} AND uf.FilialId=Cadastro.Filial.FilialId AND uf.RevogadoEmUtc IS NULL)`:''} ORDER BY ${d.pk} DESC`));}
export async function createB24(cfg,type,body,userId){
 const v=validateB24(type,body),actor=intLiteral(userId);
 // EXEC recebe variáveis/constantes, não a expressão CONVERT usada pelo literal seguro.
 // Preserva validação, procedimentos, permissões e valores do contrato B2.4A.
 let sql=`DECLARE @B24Ator bigint=${actor},@B24Nome nvarchar(160)=${nvarcharLiteral(v.nome,160)};`;
 if(type==='filiais')sql+=`DECLARE @B24Codigo nvarchar(30)=${nvarcharLiteral(v.codigo,30)};EXEC Cadastro.sp_B24A_CriarFilial @AtorId=@B24Ator,@Codigo=@B24Codigo,@Nome=@B24Nome;`;
 else if(type==='chapas')sql+=`DECLARE @B24CPF nvarchar(11)=${nvarcharLiteral(v.cpf,11)},@B24Telefone nvarchar(25)=${v.telefone?nvarcharLiteral(v.telefone,25):'NULL'};EXEC Cadastro.sp_B24A_CriarPrestador @AtorId=@B24Ator,@Nome=@B24Nome,@CPF=@B24CPF,@Telefone=@B24Telefone;`;
 else sql+='EXEC Cadastro.sp_B24A_CriarTipoServico @AtorId=@B24Ator,@Nome=@B24Nome;';
 return withDb(cfg,db=>db.query(sql));
}

export class BranchError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function validateBranchUpdate(body){const value=validateB24('filiais',body);if(typeof body?.ativo!=='boolean')throw new BranchError('Informe se a filial está ativa.');const original=validateB24('filiais',body?.original);if(typeof body?.original?.ativo!=='boolean')throw new BranchError('Recarregue a filial antes de alterar.');return {...value,ativo:body.ativo,original:{...original,ativo:body.original.ativo}};}
export async function updateBranch(cfg,id,body,actor){
 const v=validateBranchUpdate(body),branchId=intLiteral(id),userId=intLiteral(actor);
 return withDb(cfg,async db=>{await db.query('SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');await db.beginTransaction();try{
  const allowed=(await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u ON u.UsuarioId=r.UsuarioId WHERE r.UsuarioId=${userId} AND u.Ativo=1 AND u.Perfil='ADMIN') AND Seguranca.fn_Pode(${userId},N'filiais.cadastrar')=1 THEN 1 ELSE 0 END Pode`))[0];
  if(Number(allowed?.Pode)!==1)throw new BranchError('Permissão de administrador necessária.',403);
  const target=(await db.query("SELECT DB_NAME() Nome,CONVERT(varchar(64),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE')) Instancia,CONVERT(varchar(20),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_STATE')) Estado"))[0];
  if(!(target.Nome==='JETTA_CONTROL_PILOTO_LOCAL'||/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(target.Nome))||!/^[a-f0-9]{64}$/.test(target.Instancia||'')||target.Estado!=='READY')throw new BranchError('Destino de alteração recusado.',403);
  const row=(await db.query(`SELECT FilialId,Codigo,Nome,Ativo FROM Cadastro.Filial WITH(UPDLOCK,HOLDLOCK) WHERE FilialId=${branchId}`))[0];if(!row)throw new BranchError('Filial não encontrada.',404);
  if(row.Codigo!==v.original.codigo||row.Nome!==v.original.nome||(Number(row.Ativo)===1)!==v.original.ativo)throw new BranchError('A filial foi alterada em outra tela. Atualize a lista antes de editar.',409);
  if((await db.query(`SELECT FilialId FROM Cadastro.Filial WITH(UPDLOCK,HOLDLOCK) WHERE Codigo=${nvarcharLiteral(v.codigo,30)} AND FilialId<>${branchId}`)).length)throw new BranchError('Código já utilizado por outra filial, inclusive inativa. Escolha outro código.',409);
  await db.query(`UPDATE Cadastro.Filial SET Codigo=${nvarcharLiteral(v.codigo,30)},Nome=${nvarcharLiteral(v.nome,150)},Ativo=${v.ativo?1:0} WHERE FilialId=${branchId}`);
  const changes=JSON.stringify({antes:{codigo:row.Codigo,nome:row.Nome,ativo:Number(row.Ativo)===1},depois:{codigo:v.codigo,nome:v.nome,ativo:v.ativo}});
  await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Filial',${branchId},N'${(Number(row.Ativo)===1)===v.ativo?'ALTERAR':v.ativo?'REATIVAR':'INATIVAR'}',${userId},${nvarcharLiteral(changes,2000)})`);
  await db.commit();return {FilialId:id,Codigo:v.codigo,Nome:v.nome,Ativo:v.ativo};
 }catch(error){try{await db.rollback();}catch{}throw error;}});
}

const catalogEdits=Object.freeze({chapas:{table:'Cadastro.Prestador',pk:'PrestadorId',entity:'Prestador',permission:'prestadores.cadastrar'},servicos:{table:'Cadastro.TipoServico',pk:'TipoServicoId',entity:'TipoServico',permission:'servicos.cadastrar'},tiposprestador:{table:'Cadastro.TipoPrestador',pk:'TipoPrestadorId',entity:'TipoPrestador',permission:'tiposprestador.cadastrar'}});
export async function updateCatalog(cfg,type,id,body,actor){
 const definition=catalogEdits[type];if(!definition)throw new BranchError('Cadastro inválido.',404);const nome=String(body?.nome||'').trim();if(nome.length<2||nome.length>120||typeof body?.ativo!=='boolean'||typeof body?.original?.nome!=='string'||typeof body?.original?.ativo!=='boolean')throw new BranchError('Confira nome, situação e registro original.');
 const telefone=String(body?.telefone||'').trim();if(telefone.length>25)throw new BranchError('Telefone inválido.');const rowId=intLiteral(id),userId=intLiteral(actor),{table,pk,entity,permission}=definition;
 return withDb(cfg,async db=>{await db.query('SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');await db.beginTransaction();try{
 const target=(await db.query("SELECT DB_NAME() Nome,CONVERT(varchar(64),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_INSTANCE')) Instancia,CONVERT(varchar(20),(SELECT value FROM sys.extended_properties WHERE class=0 AND name='JETTA_PILOT_STATE')) Estado"))[0];if(!(target.Nome==='JETTA_CONTROL_PILOTO_LOCAL'||/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(target.Nome))||!/^[a-f0-9]{64}$/.test(target.Instancia||'')||target.Estado!=='READY')throw new BranchError('Destino recusado.',403);
 const allowed=(await db.query(`SELECT CASE WHEN EXISTS(SELECT 1 FROM Seguranca.UsuarioRaiz r JOIN Seguranca.Usuario u ON u.UsuarioId=r.UsuarioId WHERE r.UsuarioId=${userId} AND u.Ativo=1 AND u.Perfil='ADMIN') AND Seguranca.fn_Pode(${userId},N'${permission}')=1 THEN 1 ELSE 0 END Pode`))[0];if(Number(allowed?.Pode)!==1)throw new BranchError('Permissão de administrador necessária.',403);
 const row=(await db.query(`SELECT Nome,Ativo${type==='chapas'?',Telefone':''} FROM ${table} WITH(UPDLOCK,HOLDLOCK) WHERE ${pk}=${rowId}`))[0];if(!row)throw new BranchError('Registro não encontrado.',404);
 if(row.Nome!==body.original.nome||(Number(row.Ativo)===1)!==body.original.ativo||(type==='chapas'&&(row.Telefone||'')!==(body.original.telefone||'')))throw new BranchError('Registro alterado em outra tela. Atualize a lista.',409);
 if(type!=='chapas'&&(await db.query(`SELECT ${pk} FROM ${table} WITH(UPDLOCK,HOLDLOCK) WHERE Nome=${nvarcharLiteral(nome,120)} AND ${pk}<>${rowId}`)).length)throw new BranchError('Nome já cadastrado, inclusive em registros inativos.',409);
 await db.query(`UPDATE ${table} SET Nome=${nvarcharLiteral(nome,120)},Ativo=${body.ativo?1:0}${type==='chapas'?',Telefone='+nvarcharLiteral(telefone,25):''} WHERE ${pk}=${rowId}`);
 const detail=JSON.stringify({antes:{nome:row.Nome,ativo:Number(row.Ativo)===1,...(type==='chapas'?{telefone:row.Telefone||''}:{})},depois:{nome,ativo:body.ativo,...(type==='chapas'?{telefone}:{})}});
 await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'${entity}',${rowId},N'${(Number(row.Ativo)===1)===body.ativo?'ALTERAR':body.ativo?'REATIVAR':'INATIVAR'}',${userId},${nvarcharLiteral(detail,2000)})`);await db.commit();return {ok:true};
 }catch(error){try{await db.rollback();}catch{}throw error;}});
}
