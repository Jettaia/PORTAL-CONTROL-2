import {transaction,record} from './pc04.js';
import {assertMfa} from './b4.js';
import {intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {PlanningError} from './b3.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
function id(value){if(!['string','number','bigint'].includes(typeof value)||! /^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function input(body,extra=[]){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['versao','motivo',...extra].includes(k)))fail('CAMPOS_INVALIDOS');
 if(!Number.isSafeInteger(body.versao)||body.versao<1)fail('VERSAO_INVALIDA');
 if(typeof body.motivo!=='string'||!body.motivo.trim()||body.motivo.trim().length>800)fail('MOTIVO_OBRIGATORIO');
 return body.motivo.trim();
}
async function write(cfg,actor,token,adminOnly,fn){return transaction(cfg,actor,null,false,async(db,user)=>{
 // Re-read the actual active ADMIN role through PC04; posted roles are never trusted.
 if(adminOnly&&!user.admin)fail('SOMENTE_ADM',403);
 await assertMfa(db,actor,token,cfg);
 const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];
 if(!lock||!Number.isInteger(Number(lock.R))||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
 return fn(db,user);
});}
async function current(db,actor,user,key,version){const row=await record(db,actor,user,key,user.admin);if(Number(row.Versao)!==version)fail('REGISTRO_ALTERADO_ATUALIZE',409);return row;}
async function audit(db,actor,key,action,details){
 const payload=`JSON_MODIFY(${s(JSON.stringify(details,(_k,v)=>typeof v==='bigint'?String(v):v),'max')},'$.ator',JSON_QUERY((SELECT Nome nome,Perfil cargo FROM Seguranca.Usuario WHERE UsuarioId=${id(actor)} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)))`;
 await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Contratacao',${id(key)},N'PC04_${action}',${id(actor)},${payload})`);
}
export async function pending(cfg,actor){return transaction(cfg,actor,null,false,async(db,user)=>{
 const scope=user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito ud WHERE ud.UsuarioId=${id(actor)} AND ud.DepositoId=c.DepositoId AND ud.RevogadoEmUtc IS NULL)${user.operational?'':" AND c.Status='LIBERADA'"}`;
 return {podeExcluir:user.admin,registros:await db.query(`SELECT e.SolicitacaoId,e.ContratacaoId,e.SolicitanteId,e.Motivo,CONVERT(varchar(23),e.CriadoEmUtc,126) CriadoEmUtc,u.Nome Solicitante,u.Perfil SolicitantePerfil,c.Numero,c.Versao,c.Status,p.Nome Prestador,d.Nome Deposito FROM Operacao.ContratacaoExclusaoSolicitacao e JOIN Operacao.Contratacao c ON c.ContratacaoId=e.ContratacaoId JOIN Seguranca.Usuario u ON u.UsuarioId=e.SolicitanteId JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId WHERE e.Status='PENDENTE' AND ${scope} ORDER BY e.CriadoEmUtc,e.SolicitacaoId`)};
});}
export async function request(cfg,actor,token,key,body){
 id(key);const motivo=input(body);
 return write(cfg,actor,token,false,async(db,user)=>{
  if(user.admin)fail('ADMIN_EXCLUI_DIRETAMENTE',409);
  await current(db,actor,user,key,body.versao);
  if((await db.query(`SELECT SolicitacaoId FROM Operacao.ContratacaoExclusaoSolicitacao WHERE ContratacaoId=${id(key)} AND Status='PENDENTE'`)).length)fail('EXCLUSAO_JA_SOLICITADA',409);
  const row=(await db.query(`INSERT Operacao.ContratacaoExclusaoSolicitacao(ContratacaoId,SolicitanteId,Motivo) OUTPUT inserted.SolicitacaoId VALUES(${id(key)},${id(actor)},${s(motivo,800)})`))[0];
  await audit(db,actor,key,'SOLICITAR_EXCLUSAO',{solicitacaoId:String(row.SolicitacaoId),motivo});
  return {ContratacaoId:String(key),SolicitacaoId:String(row.SolicitacaoId)};
 });
}
export async function reject(cfg,actor,token,key,requestId,body){
 id(key);id(requestId);const motivo=input(body);
 return write(cfg,actor,token,true,async(db,user)=>{
  await current(db,actor,user,key,body.versao);
  const row=(await db.query(`SELECT SolicitacaoId FROM Operacao.ContratacaoExclusaoSolicitacao WHERE ContratacaoId=${id(key)} AND SolicitacaoId=${id(requestId)} AND Status='PENDENTE'`))[0];
  if(!row)fail('SOLICITACAO_INDISPONIVEL',409);
  await db.query(`UPDATE Operacao.ContratacaoExclusaoSolicitacao SET Status='NEGADA',DecididoPor=${id(actor)},DecididoEmUtc=SYSUTCDATETIME(),MotivoDecisao=${s(motivo,800)} WHERE SolicitacaoId=${id(requestId)}`);
  await audit(db,actor,key,'RECUSAR_EXCLUSAO',{solicitacaoId:String(requestId),motivo});return {ContratacaoId:String(key)};
 });
}
export async function remove(cfg,actor,token,key,body){
 id(key);const motivo=input(body,['confirmar','solicitacaoId']);if(body.confirmar!==true)fail('CONFIRMACAO_EXCLUSAO_OBRIGATORIA');if(body.solicitacaoId!==undefined)id(body.solicitacaoId);
 return write(cfg,actor,token,true,async(db,user)=>{
  const row=await current(db,actor,user,key,body.versao),contract=id(key);
  if(body.solicitacaoId!==undefined&&!(await db.query(`SELECT SolicitacaoId FROM Operacao.ContratacaoExclusaoSolicitacao WHERE ContratacaoId=${contract} AND SolicitacaoId=${id(body.solicitacaoId)} AND Status='PENDENTE'`)).length)fail('SOLICITACAO_INDISPONIVEL',409);
  // Same application lock as receipts/payments. Child-first deletion, one commit;
  // shared legacy payment headers survive and their total follows remaining items.
  await db.query(`
   DECLARE @payments TABLE(PagamentoId bigint PRIMARY KEY);
   IF OBJECT_ID('Financeiro.PC08Item','U') IS NOT NULL INSERT @payments SELECT DISTINCT PagamentoId FROM Financeiro.PC08Item WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NOT NULL INSERT @payments SELECT DISTINCT PagamentoId FROM Financeiro.PC10Movimento m WHERE ContratacaoId=${contract} AND PagamentoId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM @payments p WHERE p.PagamentoId=m.PagamentoId);
   IF OBJECT_ID('Financeiro.ContratacaoBaixa','U') IS NOT NULL DELETE Financeiro.ContratacaoBaixa WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.ContratacaoAnexo','U') IS NOT NULL DELETE Financeiro.ContratacaoAnexo WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.ContratacaoRecibo','U') IS NOT NULL DELETE Financeiro.ContratacaoRecibo WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC10Movimento','U') IS NOT NULL DELETE Financeiro.PC10Movimento WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC10DocumentoEstado','U') IS NOT NULL DELETE Financeiro.PC10DocumentoEstado WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC08Anexo','U') IS NOT NULL DELETE Financeiro.PC08Anexo WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC08Item','U') IS NOT NULL DELETE Financeiro.PC08Item WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Financeiro.PC08Pagamento','U') IS NOT NULL BEGIN
    UPDATE p SET ValorTotal=COALESCE((SELECT SUM(i.Valor) FROM Financeiro.PC08Item i WHERE i.PagamentoId=p.PagamentoId),0) FROM Financeiro.PC08Pagamento p JOIN @payments x ON x.PagamentoId=p.PagamentoId;
    IF OBJECT_ID('Financeiro.PC10Estorno','U') IS NOT NULL DELETE e FROM Financeiro.PC10Estorno e JOIN @payments x ON x.PagamentoId=e.PagamentoId WHERE NOT EXISTS(SELECT 1 FROM Financeiro.PC08Item i WHERE i.PagamentoId=e.PagamentoId) AND NOT EXISTS(SELECT 1 FROM Financeiro.PC10Movimento m WHERE m.PagamentoId=e.PagamentoId);
    DELETE p FROM Financeiro.PC08Pagamento p JOIN @payments x ON x.PagamentoId=p.PagamentoId WHERE NOT EXISTS(SELECT 1 FROM Financeiro.PC08Item i WHERE i.PagamentoId=p.PagamentoId) AND NOT EXISTS(SELECT 1 FROM Financeiro.PC10Movimento m WHERE m.PagamentoId=p.PagamentoId);
   END;
   IF OBJECT_ID('Seguranca.NotificacaoLeitura','U') IS NOT NULL DELETE l FROM Seguranca.NotificacaoLeitura l JOIN Operacao.ContratacaoHorarioSolicitacao h ON h.SolicitacaoId=l.SolicitacaoId WHERE h.ContratacaoId=${contract};
   IF OBJECT_ID('Operacao.ContratacaoHorarioSolicitacao','U') IS NOT NULL DELETE Operacao.ContratacaoHorarioSolicitacao WHERE ContratacaoId=${contract};
   IF OBJECT_ID('Operacao.ContratacaoToken','U') IS NOT NULL DELETE Operacao.ContratacaoToken WHERE ContratacaoId=${contract};
   DELETE Operacao.ContratacaoExclusaoSolicitacao WHERE ContratacaoId=${contract};
   DELETE Operacao.ContratacaoEvento WHERE ContratacaoId=${contract};
   INSERT Operacao.ContratacaoNumeroExcluido(ContratacaoId,DepositoId,Numero) VALUES(${contract},${id(row.DepositoId)},${id(row.Numero)});
   DELETE Operacao.Contratacao WHERE ContratacaoId=${contract};
  `);
  await audit(db,actor,key,'EXCLUIR',{numero:String(row.Numero),depositoId:String(row.DepositoId),status:row.Status,motivo,registrosFinanceirosExcluidos:true,...(body.solicitacaoId?{solicitacaoId:String(body.solicitacaoId)}:{})});
  return {ContratacaoId:String(key),excluida:true};
 });
}
