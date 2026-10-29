import {transaction,record} from './pc04.js';
import {intLiteral as n} from './auth-db.js';
import {PlanningError,money} from './b3.js';

const fail=(message,status=400)=>{throw new PlanningError(message,status);};
function id(value){if(typeof value!=='string'||!/^\d+$/.test(value))fail('IDENTIFICADOR_INVALIDO');try{return n(value);}catch{fail('IDENTIFICADOR_INVALIDO');}}
function serviceDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'2000-01-01'||value>'9998-12-31')fail('DATA_INVALIDA');
 const parsed=new Date(value+'T00:00:00Z');if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value)fail('DATA_INVALIDA');return value;
}
const cents=value=>BigInt(money(value).replace('.',''));
const decimal=value=>(value/100n).toString()+'.'+(value%100n).toString().padStart(2,'0');

// Read-only comparison: a high price never changes authorization or contract eligibility.
export async function comparison(cfg,actor,query){
 const allowed=['filialId','tipoServicoId','dataServico','valor','contratacaoId'];
 if(Object.keys(query).some(k=>!allowed.includes(k)))fail('CAMPOS_INVALIDOS');
 const branch=id(query.filialId),type=id(query.tipoServicoId),date=serviceDate(query.dataServico),amount=cents(query.valor),own=query.contratacaoId===undefined?null:id(query.contratacaoId);
 return transaction(cfg,actor,null,false,async(db,user)=>{
  if(!user.operational)fail('PERMISSAO_NEGADA',403);
  const scope=user.admin?'1=1':`EXISTS(SELECT 1 FROM Seguranca.UsuarioFilial uf WHERE uf.UsuarioId=${n(actor)} AND uf.FilialId=f.FilialId AND uf.RevogadoEmUtc IS NULL)`;
  if(!(await db.query(`SELECT f.FilialId FROM Cadastro.Filial f WHERE f.FilialId=${branch} AND ${scope}`)).length)fail('FILIAL_NAO_AUTORIZADA',403);
  if(own){
   const previous=await record(db,actor,user,own,true);
   if(String(previous.FilialId)!==branch||String(previous.TipoServicoId)!==type||previous.DataServico!==date)fail('CONTEXTO_INVALIDO');
  }
  const rows=await db.query(`SELECT TOP(20) CONVERT(varchar(40),c.ValorLiberado) Valor FROM Operacao.Contratacao c WHERE c.FilialId=${branch} AND c.TipoServicoId=${type} AND c.Status='LIBERADA' AND c.ValorLiberado IS NOT NULL AND c.DataServico>=DATEADD(day,-90,CONVERT(date,'${date}',23)) AND c.DataServico<CONVERT(date,'${date}',23)${own?` AND c.ContratacaoId<>${own}`:''} ORDER BY c.DataServico DESC,c.ContratacaoId DESC`);
  const count=rows.length,base={quantidade:count,janelaDias:90,limite:20,minimo:5};
  if(count<5)return {...base,media:null,acima:false};
  const sum=rows.reduce((total,row)=>total+cents(row.Valor),0n),size=BigInt(count);
  return {...base,media:decimal((sum*2n+size)/(size*2n)),acima:amount*size>sum};
 });
}
