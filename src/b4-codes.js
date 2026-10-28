import {isPilot} from './pilot-target.js';
import crypto from 'node:crypto';
import {PlanningError} from './b3.js';
export const randomCode=()=>crypto.randomBytes(16).toString('base64url');
export const randomTablet=()=>crypto.randomBytes(32).toString('base64url');
export function verifier(secret,context){
 if(typeof secret!=='string'||!/^[A-Za-z0-9_-]{22,43}$/.test(secret))throw new PlanningError('CODIGO_INVALIDO');
 if(typeof context!=='string'||!context.length||context.length>200)throw new PlanningError('CONTEXTO_INVALIDO');
 return crypto.createHash('sha256').update('JETTA:B4.1\0'+context+'\0'+secret).digest('hex');
}
export function commandInput(body){
 if(!body||Array.isArray(body)||Object.keys(body).sort().join(',')!=='atividadeId,codigo,participacaoId,prestadorId,requisicaoId,tipo')throw new PlanningError('CAMPOS_INVALIDOS');
 const v={...body};
 for(const k of ['atividadeId','participacaoId','prestadorId'])if(!Number.isSafeInteger(v[k])||v[k]<1)throw new PlanningError('CONTEXTO_INVALIDO');
 if(!['ENTRADA','SAIDA'].includes(v.tipo)||typeof v.requisicaoId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.requisicaoId))throw new PlanningError('COMANDO_INVALIDO');
 verifier(v.codigo,'validacao');return v;
}
export const codeContext=(generation,participation,activity,provider,depot,type)=>`${String(generation).toLowerCase()}:${participation}:${activity}:${provider}:${depot}:${type}`;
export function labOnly(cfg){if(cfg.b41!==true||(!/^JETTA_CONTROL_B3_TEST_[a-f0-9]{12}$/.test(cfg.database)&&!isPilot(cfg)))throw new PlanningError('B4_SOMENTE_LABORATORIO',404);}
