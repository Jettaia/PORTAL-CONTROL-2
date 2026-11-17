import {intLiteral as n} from './auth-db.js';
import {PlanningError} from './b3.js';
import {transaction,record,event,scope,responsibleScope} from './pc04.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
const id=value=>{if(!['number','string','bigint'].includes(typeof value)||!/^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}};
export async function changeDepot(cfg,actor,token,key,body){
 const contract=id(key);
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['versao','depositoId','gestorId','motivo'].includes(k)))fail('CAMPOS_INVALIDOS');
 const depot=id(body.depositoId),manager=id(body.gestorId);
 if(!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_INVALIDA');
 if(typeof body.motivo!=='string'||!body.motivo.trim()||body.motivo.trim().length>800)fail('MOTIVO_OBRIGATORIO');
 return transaction(cfg,actor,token,true,async(db,user)=>{
  const before=await record(db,actor,user,contract,true);
  if(Number(before.Versao)!==body.versao)fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if(Number(before.LiberacaoBloqueada)===1||before.Status==='LIBERADA')fail('CONTRATACAO_LIBERADA_BLOQUEADA',409);
  if(before.PagoEmUtc)fail('CONTRATACAO_PAGA_PRESERVADA',409);
  if(before.Status!=='ABERTA')fail('CONTRATACAO_CANCELADA',409);
  if(before.HorarioPendenteId)fail('HORARIOS_PENDENTES_APROVACAO',409);
  if(id(before.DepositoId)===depot)fail('DEPOSITO_INALTERADO',409);
  if(!user.admin&&!user.coordinator&&manager!==id(actor))fail('GESTOR_RESPONSAVEL_FIXO',403);
  const target=(await db.query(`SELECT f.DepositoId,f.Nome,f.CentroCusto FROM Cadastro.Deposito f WITH(HOLDLOCK) WHERE f.DepositoId=${depot} AND f.Ativo=1 AND ${scope(actor,user,'f')}`))[0];
  if(!target)fail('DEPOSITO_NAO_AUTORIZADA',403);
  if(!(await db.query(`SELECT p.PrestadorId FROM Cadastro.Prestador p WITH(HOLDLOCK) JOIN Cadastro.PrestadorDeposito pf ON pf.PrestadorId=p.PrestadorId AND pf.DepositoId=${depot} AND pf.RevogadoEmUtc IS NULL WHERE p.PrestadorId=${id(before.PrestadorId)} AND p.Ativo=1`)).length)fail('PRESTADOR_SEM_VINCULO_ATIVO',409);
  if(!(await db.query(`SELECT u.UsuarioId FROM Seguranca.Usuario u WITH(HOLDLOCK) WHERE u.UsuarioId=${manager} AND u.Ativo=1 AND ${responsibleScope(depot)}`)).length)fail('GESTOR_RESPONSAVEL_INDISPONIVEL',403);
  // PC04's transaction application lock serializes creation, deletion and transfer.
  const next=(await db.query(`SELECT COALESCE(MAX(Numero),0)+1 Numero FROM (SELECT Numero FROM Operacao.Contratacao WITH(UPDLOCK,HOLDLOCK) WHERE DepositoId=${depot} UNION ALL SELECT Numero FROM Operacao.ContratacaoNumeroExcluido WHERE DepositoId=${depot} UNION ALL SELECT Numero FROM Operacao.ContratacaoNumeroTransferido WHERE DepositoId=${depot}) numeros`))[0];
  if(!next)throw Error('Numeração de destino indisponível');
  const number=id(next.Numero);
  await db.query(`INSERT Operacao.ContratacaoNumeroTransferido(DepositoId,Numero,ContratacaoId) VALUES(${id(before.DepositoId)},${id(before.Numero)},${contract})`);
  await db.query(`UPDATE Operacao.Contratacao SET DepositoId=${depot},Numero=${number},GestorResponsavelId=${manager},Versao=Versao+1 WHERE ContratacaoId=${contract} AND Versao=${body.versao}`);
  if(cfg.pc05)await db.query(`UPDATE Operacao.ContratacaoToken SET InvalidadoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${contract} AND ConsumidoEmUtc IS NULL AND InvalidadoEmUtc IS NULL`);
  await event(db,actor,contract,'DEPOSITO',{antes:before,motivo:body.motivo.trim(),depositoDepois:{id:depot,nome:target.Nome,centroCusto:target.CentroCusto,numero:number},gestorId:manager});
  return record(db,actor,user,contract,true);
 });
}
