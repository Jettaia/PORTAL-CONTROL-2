import crypto from 'node:crypto';
import {nvarcharLiteral as s} from './auth-db.js';
import {transaction} from './pc04.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';
import {receiptId as id,receiptScope,receiptCompatible,receiptEligible} from './fin02.js';
const fail=(message,status=400)=>{throw new PlanningError(message,status);};
function keys(body,allowed){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');}
function file(input){
 keys(input,['nome','tipo','conteudoBase64']);
 if(typeof input.nome!=='string'||!input.nome.trim()||input.nome.length>180||/[\x00-\x1f\x7f/\\]/.test(input.nome))fail('NOME_ARQUIVO_INVALIDO');
 const extension=new Map([['application/pdf','.pdf'],['image/png','.png'],['image/jpeg','.jpg']]).get(input.tipo);
 if(!extension||!(input.nome.toLowerCase().endsWith(extension)||input.tipo==='image/jpeg'&&input.nome.toLowerCase().endsWith('.jpeg')))fail('TIPO_ARQUIVO_INVALIDO');
 if(typeof input.conteudoBase64!=='string'||input.conteudoBase64.length>6990508||/[^A-Za-z0-9+/=]/.test(input.conteudoBase64))fail('ARQUIVO_INVALIDO');
 const bytes=Buffer.from(input.conteudoBase64,'base64');if(bytes.toString('base64')!==input.conteudoBase64)fail('ARQUIVO_INVALIDO');if(!bytes.length||bytes.length>5242880)fail('ARQUIVO_LIMITE_5MB');
 const valid=input.tipo==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':input.tipo==='image/png'?bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!valid)fail('CONTEUDO_ARQUIVO_INVALIDO');
 return {...input,bytes,sha:crypto.createHash('sha256').update(bytes).digest('hex')};
}
const paymentSql=key=>`SELECT BaixaId,ContratacaoId,ReciboId,AnexoId,CONVERT(varchar(40),Valor) Valor,CONVERT(varchar(10),DataPagamento,23) DataPagamento,CONVERT(varchar(23),ConfirmadoEmUtc,126) ConfirmadoEmUtc,ConfirmadoPor FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${id(key)} AND DesfeitoEmUtc IS NULL`;
async function view(db,key,user){return {ultimaBaixaId:(await db.query(`SELECT MAX(BaixaId) UltimaBaixaId FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${id(key)}`))[0].UltimaBaixaId,pagamento:(await db.query(paymentSql(key)))[0]||null,anexos:await db.query(`SELECT AnexoId,Nome,Tipo,Tamanho,Sha256,CONVERT(varchar(23),CriadoEmUtc,126) CriadoEmUtc,CriadoPor FROM Financeiro.ContratacaoAnexo WHERE ContratacaoId=${id(key)} ORDER BY AnexoId`),historico:await db.query(`SELECT a.AuditoriaId,a.Acao,a.AtorUsuarioId,COALESCE(JSON_VALUE(a.DetalhesJson,'$.atorNome'),u.Nome) AtorNome,CONVERT(varchar(23),a.DataHoraUtc,126) CriadoEmUtc,a.DetalhesJson FROM Seguranca.Auditoria a LEFT JOIN Seguranca.Usuario u ON u.UsuarioId=a.AtorUsuarioId WHERE ((a.EntidadeId=${id(key)} AND a.Entidade=N'Fin03') OR (a.Entidade=N'ContratacaoRecibo' AND a.Acao=N'FIN02_EMITIR' AND EXISTS(SELECT 1 FROM Financeiro.ContratacaoRecibo r WHERE r.ReciboId=a.EntidadeId AND r.ContratacaoId=${id(key)}))) ORDER BY a.AuditoriaId`),podeOperar:user.admin||user.finance};}
async function visible(db,actor,key,user){if(!(await db.query(`SELECT c.ContratacaoId FROM Operacao.Contratacao c WHERE c.ContratacaoId=${id(key)} AND ${receiptScope(actor,user)}`)).length)fail('CONTRATACAO_INDISPONIVEL',404);}
async function write(cfg,actor,token,key,fn){id(key);return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!user.admin&&!user.finance)fail('PERMISSAO_NEGADA',403);await assertMfa(db,actor,token,cfg);
 const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];if(!lock||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
 await visible(db,actor,key,user);await fn(db,user);return view(db,key,user);
});}
async function audit(db,actor,key,action,details){const payload=`JSON_MODIFY(${s(JSON.stringify(details),'max')},'$.atorNome',(SELECT Nome FROM Seguranca.Usuario WHERE UsuarioId=${id(actor)}))`;await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'Fin03',${id(key)},N'FIN03_${action}',${id(actor)},${payload})`);}
async function insertFile(db,actor,key,receipt,f){return (await db.query(`INSERT Financeiro.ContratacaoAnexo(ContratacaoId,ReciboId,Nome,Tipo,Tamanho,Sha256,CriadoPor,Conteudo) OUTPUT inserted.AnexoId VALUES(${id(key)},${id(receipt)},${s(f.nome.trim(),180)},${s(f.tipo,40)},${f.bytes.length},'${f.sha}',${id(actor)},CONVERT(varbinary(max),?,2))`,[f.bytes.toString('hex')]))[0].AnexoId;}
export async function read(cfg,actor,key){id(key);return transaction(cfg,actor,null,false,async(db,user)=>{await visible(db,actor,key,user);return view(db,key,user);});}
export async function confirm(cfg,actor,token,key,body){
 // Authorization precedes input validation to consistently deny every mutation to readers.
 return write(cfg,actor,token,key,async db=>{
  keys(body,['reciboId','arquivo','baixaAnteriorId']);const receipt=id(body.reciboId),f=file(body.arquivo);
  const origin=(await db.query(`SELECT r.ReciboId,CONVERT(varchar(10),r.DataEmissao,23) DataEmissao,CONVERT(varchar(40),r.ValorLiberado) Valor FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) JOIN Financeiro.ContratacaoRecibo r WITH(UPDLOCK,HOLDLOCK) ON r.ContratacaoId=c.ContratacaoId WHERE c.ContratacaoId=${id(key)} AND r.ReciboId=${receipt} AND ${receiptEligible} AND ${receiptCompatible}`))[0];
  if(!origin)fail('RECIBO_ORIGEM_DIVERGENTE',409);
  const previous=(await db.query(paymentSql(key)))[0];if(previous){const current=(await db.query(`SELECT Sha256 FROM Financeiro.ContratacaoAnexo WHERE AnexoId=${id(previous.AnexoId)}`))[0];if(String(previous.ReciboId)===receipt&&current.Sha256===f.sha)return;fail('PAGAMENTO_JA_CONFIRMADO',409);}
  const latest=(await db.query(`SELECT MAX(BaixaId) UltimaBaixaId FROM Financeiro.ContratacaoBaixa WHERE ContratacaoId=${id(key)}`))[0].UltimaBaixaId;if((latest===null?null:String(latest))!==(body.baixaAnteriorId===null?null:id(body.baixaAnteriorId)))fail('REGISTRO_ALTERADO_ATUALIZE',409);
  if((await db.query(`SELECT PagoEmUtc FROM Operacao.Contratacao WHERE ContratacaoId=${id(key)}`))[0].PagoEmUtc)fail('PAGAMENTO_LEGADO_INCOMPATIVEL',409);
  const attachment=await insertFile(db,actor,key,receipt,f);
  const paid=(await db.query(`INSERT Financeiro.ContratacaoBaixa(ContratacaoId,ReciboId,AnexoId,Valor,DataPagamento,ConfirmadoPor) OUTPUT inserted.BaixaId VALUES(${id(key)},${receipt},${id(attachment)},${origin.Valor},'${origin.DataEmissao}',${id(actor)})`))[0];
  await db.query(`UPDATE Operacao.Contratacao SET PagoEmUtc=SYSUTCDATETIME() WHERE ContratacaoId=${id(key)}`);
  await audit(db,actor,key,'CONFIRMAR',{baixaId:String(paid.BaixaId),reciboId:receipt,anexoId:String(attachment),valor:origin.Valor,dataPagamento:origin.DataEmissao});
 });
}
async function active(db,key,body){const row=(await db.query(paymentSql(key)))[0];if(!row||String(row.BaixaId)!==id(body.baixaId)||String(row.AnexoId)!==id(body.anexoId))fail('REGISTRO_ALTERADO_ATUALIZE',409);return row;}
export async function undo(cfg,actor,token,key,body){return write(cfg,actor,token,key,async db=>{keys(body,['baixaId','anexoId','motivo']);if(typeof body.motivo!=='string'||!body.motivo.trim()||body.motivo.trim().length>800)fail('MOTIVO_OBRIGATORIO');const previous=await active(db,key,body);await db.query(`UPDATE Financeiro.ContratacaoBaixa SET DesfeitoEmUtc=SYSUTCDATETIME(),DesfeitoPor=${id(actor)},MotivoDesfazimento=${s(body.motivo.trim(),800)} WHERE BaixaId=${id(previous.BaixaId)};UPDATE Operacao.Contratacao SET PagoEmUtc=NULL WHERE ContratacaoId=${id(key)}`);await audit(db,actor,key,'DESFAZER',{baixaId:String(previous.BaixaId),anexoId:String(previous.AnexoId),motivo:body.motivo.trim()});});}
export async function replace(cfg,actor,token,key,body){return write(cfg,actor,token,key,async db=>{keys(body,['baixaId','anexoId','arquivo']);const previous=await active(db,key,body),f=file(body.arquivo),attachment=await insertFile(db,actor,key,previous.ReciboId,f);await db.query(`UPDATE Financeiro.ContratacaoBaixa SET AnexoId=${id(attachment)} WHERE BaixaId=${id(previous.BaixaId)}`);await audit(db,actor,key,'SUBSTITUIR',{baixaId:String(previous.BaixaId),anexoAnteriorId:String(previous.AnexoId),anexoId:String(attachment)});});}
export async function attachment(cfg,actor,key,attachmentId){id(key);id(attachmentId);return transaction(cfg,actor,null,false,async(db,user)=>{await visible(db,actor,key,user);const row=(await db.query(`SELECT Nome,Tipo,Conteudo FROM Financeiro.ContratacaoAnexo WHERE AnexoId=${id(attachmentId)} AND ContratacaoId=${id(key)}`))[0];if(!row)fail('ANEXO_INDISPONIVEL',404);return row;});}
