import {intLiteral as n,nvarcharLiteral as s} from './auth-db.js';

export const cents=v=>{if(typeof v!=='string'||! /^-?\d+\.\d{2}$/.test(v))throw Error('Decimal financeiro inválido');return BigInt(v.replace('.',''));};
export const decimal=v=>`${v<0n?'-':''}${(v<0n?-v:v)/100n}.${String((v<0n?-v:v)%100n).padStart(2,'0')}`;
export async function movement(db,{contract,key,type,value,actor,version,day=null,payment=null,reason=null}){
 await db.query(`INSERT Financeiro.PC10Movimento(ContratacaoId,Chave,Tipo,Valor,AtorUsuarioId,Versao,DataEfetiva,PagamentoId,Motivo) VALUES(${n(contract)},${s(key,120)},${s(type,30)},${value},${n(actor)},${n(version)},${day?`'${day}'`:"CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'E. South America Standard Time')"},${payment?n(payment):'NULL'},${reason?s(reason,800):'NULL'})`);
}
// Called inside PC04's transaction and application lock, before the state update.
export async function contractMovements(db,actor,previous,action,amount,reason){
 const id=previous.ContratacaoId,version=Number(previous.Versao)+1;
 if(previous.Status==='LIBERADA'){
  await movement(db,{contract:id,key:`C:${id}:${version}:RETIRADA`,type:'RETIRADA',value:decimal(-cents(previous.ValorLiberado)),actor,version,reason});
 }
 if(['revisar','cancelar','horarios'].includes(action)&&(previous.Status==='LIBERADA'||previous.PagoEmUtc)){
  // Cutoff tombstone: PC09 must retain snapshots through this version and require a new signature.
  await db.query(`INSERT Financeiro.PC10DocumentoEstado(ContratacaoId,Versao,Estado,ExigeNovaAssinatura,Motivo,AtorUsuarioId) VALUES(${n(id)},${n(previous.Versao)},${s(action==='cancelar'?'CANCELADO':'SUBSTITUIDO',20)},1,${s(reason||'Correção dos horários',800)},${n(actor)})`);
 }
 if(action==='conferir')await movement(db,{contract:id,key:`C:${id}:${version}:LIBERACAO`,type:'LIBERACAO',value:amount,actor,version});
}
