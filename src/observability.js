import {AsyncLocalStorage} from 'node:async_hooks';
import crypto from 'node:crypto';
const context=new AsyncLocalStorage(),sessionKey=crypto.randomBytes(32);
export function observerEnabled(cfg){return typeof cfg.observe==='function'&&/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(cfg.database);}
export function safeSqlErrors(error){return (error?.odbcErrors||[]).map(e=>({state:String(e.state||'').slice(0,5),code:Number(e.code)||0}));}
export function emit(cfg,event,fields={}){if(!observerEnabled(cfg))return;const c=context.getStore()||{};try{cfg.observe({event,observedMs:Math.round(performance.now()),requestId:c.requestId||null,sessionRef:c.sessionRef||null,...fields});}catch{/* Diagnostics must not change business outcomes. */}}
export function bindSession(token){const c=context.getStore();if(c)c.sessionRef=crypto.createHmac('sha256',sessionKey).update(token).digest('hex').slice(0,24);}
export function correlationMiddleware(cfg){return(req,res,next)=>{
 if(!observerEnabled(cfg))return next();
 const requestId=crypto.randomUUID(),start=performance.now();res.setHeader('X-Jetta-Correlation',requestId);
 context.run({requestId},()=>{res.once('finish',()=>emit(cfg,'http.finish',{requestId,route:typeof req.route?.path==='string'?req.route.path:'UNMATCHED',method:req.method,status:res.statusCode,durationMs:Math.round(performance.now()-start)}));next();});
};}
function operation(sql){const text=String(sql);const proc=text.match(/\bEXEC\s+(?:@\w+\s*=\s*)?((?:Operacao|Seguranca)\.sp_[A-Za-z0-9_]+)/i);return proc?proc[1]:/\bUPDATE\b/i.test(text)?'SQL_UPDATE':/\bINSERT\b/i.test(text)?'SQL_INSERT':/^\s*SET\b/i.test(text)?'SQL_SET':'SQL_READ';}
export function sqlMetadata(sql){
 const raw=String(sql),clean=raw.replace(/--[^\r\n]*/g,' ').replace(/\/\*[\s\S]*?\*\//g,' ').replace(/N?'(?:''|[^'])*'/gi,'?').replace(/0x[0-9a-f]*/gi,'?').replace(/\b\d+(?:\.\d+)?\b/g,'?').replace(/\s+/g,' ').trim();
 const known=[['FIN_ELIGIBILITY',/Financeiro\.fn_ElegibilidadePreFinanceira/i],['APPLOCK',/sp_getapplock/i],['FIN_REQUEST',/Financeiro\.SolicitacaoAutorizacao/i],['FIN_DECISION',/Financeiro\.DecisaoAutorizacao/i],['FIN_ASSESSMENT',/Financeiro\.AvaliacaoCarteira/i],['FIN_REFERENCE',/Financeiro\.ReferenciaCarteira/i],['B43_PROOF',/Operacao\.ComprovanteServico/i],['B43_OCCURRENCE',/Operacao\.OcorrenciaParticipacao/i],['AUDIT',/Seguranca\.Auditoria/i],['MFA_CHECK',/Seguranca\.MfaTotp/i],['RBAC_CHECK',/Seguranca\.PerfilPermissao/i],['CONTEXT',/Operacao\.Participacao/i]];
 const tag=raw.match(/\/\*JETTA:(FIN_ELIGIBILITY|PAGE_KEYS)\*\//)?.[1],operationId=tag||known.find(([,rx])=>rx.test(clean))?.[0]||'OTHER';
 const lockInfo=operationId==='APPLOCK'?{lockGroup:raw.includes(Buffer.from('JettaControl.B41.B51-ESCRITA-AUDITADA','utf16le').toString('hex'))?'FINANCIAL':'OTHER',lockMode:/@LockMode='Shared'/.test(raw)?'Shared':'Exclusive'}:{};
 return {operationId,...lockInfo,shapeHash:crypto.createHash('sha256').update(clean).digest('hex'),...(operationId==='FIN_ELIGIBILITY'?{parameterTypes:['bigint','char(64)','nvarchar(max)','bit']}:{}),parameterValuesRecorded:false};
}
export async function observeConnection(cfg,db){
 if(!observerEnabled(cfg))return db;
 const connectionId=crypto.randomUUID();const originalQuery=db.query.bind(db);
 const spid=Number((await originalQuery('SELECT @@SPID AS S'))[0].S);
 let sequence=0;for(const method of ['query','beginTransaction','commit','rollback','close']){
  const original=db[method].bind(db);db[method]=async(...args)=>{
   const stage=method==='query'?operation(args[0]):method,start=performance.now(),queryId=++sequence,meta=method==='query'?sqlMetadata(args[0]):{operationId:method};emit(cfg,'sql.begin',{connectionId,spid,stage,queryId,...meta});
   try{const value=await original(...args);emit(cfg,'sql.end',{connectionId,spid,stage,queryId,...meta,...(meta.operationId==='APPLOCK'?{lockResult:Number(value?.[0]?.R)}:{}),durationMs:Math.round(performance.now()-start),ok:true});return value;}
   catch(error){emit(cfg,'sql.end',{connectionId,spid,stage,queryId,...meta,durationMs:Math.round(performance.now()-start),ok:false,errors:safeSqlErrors(error)});throw error;}
  };
 }
 return db;
}
export function technicalError(error){return error?.code==='SQL_CAPACITY'||safeSqlErrors(error).some(e=>e.code===1205||e.code===1222||e.state.startsWith('08')||e.state==='HYT00'||e.state==='HYT01');}
