import path from 'node:path';import {createRequire} from 'node:module';
import {detail,upload} from '../src/final-lab.js';import {binaryHash} from '../src/final-lab-files.js';import {key} from './b5-3-f03-harness.mjs';
export async function completeSynthetic(f,reference='LAB-DEMO-PAGAMENTO'){
 const {lab}=f,x=await f.finalReady();
 for(const [u,acao,dados]of [[f.finance,'PROVISIONAR',{motivo:'Cenario ficticio completo'}],[f.configurator,'PROPOR_VALIDACAO',f.packet()],[f.validator,'VALIDAR_CENARIO',{motivo:'Cenario ficticio independente',referencia:'LAB-DEMO'}],[f.finance,'PREPARAR_OBRIGACAO',{motivo:'Preparacao ficticia'}],[f.approver,'LIBERAR',{motivo:'Liberacao ficticia independente'}],[f.finance,'PROGRAMAR',{data:'2026-10-28',meio:'SIMULACAO_MANUAL',referencia:reference}]])await f.cmd(x,u,acao,dados);
 const require=createRequire(import.meta.url),sharp=require(path.join(lab.cfg.finalLabToolsRoot,'sharp'));
 async function attach(finalidade,reciboId,text){const bytes=await sharp(Buffer.from(`<svg width="600" height="160"><rect width="600" height="160" fill="white"/><text x="20" y="60" font-size="20">LAB - SINTETICO SEM VALIDADE</text><text x="20" y="110">${text}</text></svg>`)).png().toBuffer(),d=await detail(lab.cfg,f.finance.id,x.p);return upload(lab.cfg,f.finance.id,f.finance.token,{participacaoId:String(x.p),versao:d.versao,requisicaoId:key(),finalidade,reciboId,nome:'arquivo-sintetico.png',mime:'image/png',base64:bytes.toString('base64'),sha256:binaryHash(bytes),sintetico:true});}
 let d=await attach('EVIDENCIA_PAGAMENTO_SIMULADO',null,'Evidencia ficticia');
 await f.cmd(x,f.finance,'REGISTRAR_PAGAMENTO',{data:'2026-10-28',meio:'SIMULACAO_MANUAL',referencia:reference,valor:'90.00',anexoId:d.anexos.at(-1).id});
 await f.cmd(x,f.finance,'RECIBO_EMITIR',{tipo:'EMITIDO_APOS_PAGAMENTO',anteriorId:null});d=await detail(lab.cfg,f.finance.id,x.p);
 d=await attach('ASSINATURA_SINTETICA',d.recibos.at(-1).id,'Assinatura ficticia');
 await f.cmd(x,f.archivist,'RECEBER_ASSINATURA',{anexoId:d.anexos.at(-1).id,reciboId:d.recibos.at(-1).id,signatario:'Signatario ficticio',identificacaoMascarada:'LAB-DEMO',dataAssinatura:'2026-10-28',referenciaConferencia:'LAB-DEMO'});
 return x;
}
