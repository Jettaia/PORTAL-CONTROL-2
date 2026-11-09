import {renderReceipt} from './fin02-document.js';
import {intLiteral as n,nvarcharLiteral as s} from './auth-db.js';
import {transaction} from './pc04.js';
import {assertMfa} from './b4.js';
import {PlanningError} from './b3.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
export function receiptId(value){if(!['string','number','bigint'].includes(typeof value)||! /^[1-9]\d*$/.test(String(value)))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
export const receiptScope=(actor,user)=>user.admin||user.finance?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioDeposito fd WHERE fd.UsuarioId=${receiptId(actor)} AND fd.DepositoId=c.DepositoId AND fd.RevogadoEmUtc IS NULL)`;
export const receiptEligible="c.Status='LIBERADA' AND c.ValorLiberado IS NOT NULL AND c.LiberadoEmUtc IS NOT NULL";
// FIN03 must require this full predicate under the same contract lock before settlement.
// A stale document remains readable; it never silently becomes a new issue.
export const receiptCompatible=`r.VersaoOrigem=c.Versao AND r.DepositoId=c.DepositoId AND r.PrestadorId=c.PrestadorId AND r.TipoServicoId=c.TipoServicoId AND r.DataServico=c.DataServico AND r.ValorLiberado=c.ValorLiberado AND r.LiberadoEmUtc=c.LiberadoEmUtc`;
const readSql=key=>`SELECT r.ReciboId,r.ContratacaoId,r.VersaoOrigem,CONVERT(varchar(10),r.DataEmissao,23) DataEmissao,CONVERT(varchar(23),r.EmitidoEmUtc,126) EmitidoEmUtc,r.EmitidoPor,r.SnapshotJson FROM Financeiro.ContratacaoRecibo r WHERE r.ContratacaoId=${receiptId(key)}`;
const unpack=row=>{if(!row)fail('RECIBO_INDISPONIVEL',404);const {SnapshotJson,...rest}=row;return {...rest,Snapshot:JSON.parse(SnapshotJson)};};
export async function read(cfg,actor,key,document=false){receiptId(key);return transaction(cfg,actor,null,false,async(db,user)=>{
 if(!(await db.query(`SELECT c.ContratacaoId FROM Operacao.Contratacao c WHERE c.ContratacaoId=${receiptId(key)} AND ${receiptScope(actor,user)}`)).length)fail('CONTRATACAO_INDISPONIVEL',404);
 if(document){
  const receipt=unpack((await db.query(readSql(key)))[0]);
  // Legacy snapshots lack depot identification. Enrich only missing fields for
  // display, keeping the issued financial data and persisted snapshot intact.
  const fields=['Deposito','Rua','NumeroEndereco','Bairro','CEP'];
  if(fields.some(field=>!Object.hasOwn(receipt.Snapshot,field))){
   const depot=(await db.query(`SELECT d.Nome Deposito,d.Rua,d.Numero NumeroEndereco,d.Bairro,d.CEP FROM Financeiro.ContratacaoRecibo r JOIN Cadastro.Deposito d ON d.DepositoId=r.DepositoId WHERE r.ContratacaoId=${receiptId(key)}`))[0];
   for(const field of fields)if(!Object.hasOwn(receipt.Snapshot,field))receipt.Snapshot[field]=depot?.[field];
  }
  return renderReceipt(receipt);
 }
 return {recibo:unpack((await db.query(readSql(key)))[0]),podeOperar:user.admin||user.finance};
});}
export async function issue(cfg,actor,token,key,body,expected=null){
 receiptId(key);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)fail('CAMPOS_INVALIDOS');
 // Use the existing actor/transaction boundary in read mode: PC04 write mode
 // intentionally excludes FINANCEIRO. Financial authorization and lock follow here.
 return transaction(cfg,actor,null,false,async(db,user)=>{
  if(!user.admin&&!user.finance)fail('PERMISSAO_NEGADA',403);
  await assertMfa(db,actor,token,cfg);
  const lock=(await db.query("DECLARE @r int;EXEC @r=sys.sp_getapplock @Resource='JettaControl.PC04',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000;SELECT @r R;"))[0];
  if(!lock||Number(lock.R)<0)fail('OPERACAO_OCUPADA',409);
  const origin=(await db.query(`SELECT c.ContratacaoId,c.Numero,c.Versao,c.DepositoId,c.PrestadorId,c.TipoServicoId,CONVERT(varchar(10),c.DataServico,23) DataServico,CONVERT(varchar(40),c.ValorLiberado) ValorLiberado,CONVERT(varchar(27),c.LiberadoEmUtc,126) LiberadoEmUtc,p.Nome Prestador,t.Nome Tipo,d.Cidade,d.Estado,d.CentroCusto,d.Nome Deposito,d.Rua,d.Numero NumeroEndereco,d.Bairro,d.CEP FROM Operacao.Contratacao c WITH(UPDLOCK,HOLDLOCK) JOIN Cadastro.Prestador p ON p.PrestadorId=c.PrestadorId JOIN Cadastro.TipoServico t ON t.TipoServicoId=c.TipoServicoId JOIN Cadastro.Deposito d ON d.DepositoId=c.DepositoId WHERE c.ContratacaoId=${receiptId(key)} AND ${receiptEligible}`))[0];
  if(!origin)fail('CONTRATACAO_INDISPONIVEL',404);
  if(expected&&[['versao','Versao'],['depositoId','DepositoId'],['prestadorId','PrestadorId'],['tipoServicoId','TipoServicoId'],['dataServico','DataServico'],['valor','ValorLiberado'],['liberadoEmUtc','LiberadoEmUtc']].some(([key,column])=>String(expected[key])!==String(origin[column])))fail('PREVIA_ALTERADA',409);
  const previous=(await db.query(readSql(key)))[0];
  if(previous){if(!(await db.query(`SELECT 1 V FROM Financeiro.ContratacaoRecibo r JOIN Operacao.Contratacao c ON c.ContratacaoId=r.ContratacaoId WHERE c.ContratacaoId=${receiptId(key)} AND ${receiptCompatible}`)).length)fail('RECIBO_ORIGEM_DIVERGENTE',409);return {recibo:unpack(previous),podeOperar:true,jaExistia:true};}
  const instant=cfg.fin02Now?cfg.fin02Now():new Date();
  const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);
  const snapshot={Numero:String(origin.Numero),ValorLiberado:origin.ValorLiberado,Prestador:origin.Prestador,Tipo:origin.Tipo,DataServico:origin.DataServico,Cidade:origin.Cidade,Estado:origin.Estado,CentroCusto:origin.CentroCusto,Deposito:origin.Deposito,Rua:origin.Rua,NumeroEndereco:origin.NumeroEndereco,Bairro:origin.Bairro,CEP:origin.CEP,Pagador:'JETTA TRANSPORTES E LOGISTICA LTDA',CnpjPagador:'15.387.508/0001-61'};
  if([snapshot.Prestador,snapshot.Tipo,snapshot.Cidade,snapshot.Estado].some(v=>typeof v!=='string'||!v.trim()))fail('DADOS_ORIGEM_INVALIDOS',409);
  const json=JSON.stringify(snapshot),document=renderReceipt({ContratacaoId:String(key),VersaoOrigem:origin.Versao,DataEmissao:local,EmitidoEmUtc:instant.toISOString().slice(0,23),EmitidoPor:actor,Snapshot:snapshot});
  await db.query(`INSERT Financeiro.ContratacaoRecibo(ContratacaoId,VersaoOrigem,DepositoId,PrestadorId,TipoServicoId,DataServico,ValorLiberado,LiberadoEmUtc,DataEmissao,EmitidoEmUtc,EmitidoPor,SnapshotJson,DocumentoHtml) VALUES(${receiptId(key)},${receiptId(origin.Versao)},${receiptId(origin.DepositoId)},${receiptId(origin.PrestadorId)},${receiptId(origin.TipoServicoId)},'${origin.DataServico}',${origin.ValorLiberado},'${origin.LiberadoEmUtc}','${local}','${instant.toISOString().slice(0,23)}',${receiptId(actor)},${s(json,'max')},${s(document,'max')})`);
  const row=unpack((await db.query(readSql(key)))[0]);
  await db.query(`INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId,DetalhesJson) VALUES(N'ContratacaoRecibo',${receiptId(row.ReciboId)},N'FIN02_EMITIR',${receiptId(actor)},${s(JSON.stringify({contratacaoId:String(key),reciboId:String(row.ReciboId),versao:Number(origin.Versao),dataEmissao:local,snapshot}),'max')})`);
  return {recibo:row,podeOperar:true};
 });
}
