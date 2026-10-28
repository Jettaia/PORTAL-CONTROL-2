import {pairTablet,activateTablet,issueCodes,recordEvent,listEvents,revokeTablet} from './b4.js';
import {PlanningError} from './b3.js';
import {labOnly} from './b4-codes.js';
export function mountPointing(app,cfg,{session,sameOrigin}){
 if(!cfg.b41)return;labOnly(cfg);
 const error=(res,e)=>res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});
 const run=fn=>async(req,res)=>{try{const result=await fn(req);if(result?.erro)return res.status(result.status||409).json({erro:result.erro});res.json(result);}catch(e){error(res,e);}};
 app.post('/api/b4/tablets',session,sameOrigin,run(req=>{
  if(Object.keys(req.body||{}).join(',')!=='depositoId')throw new PlanningError('CAMPOS_INVALIDOS');
  return pairTablet(cfg,req.user.id,req.rawSession,req.body.depositoId);
 }));
 app.post('/api/b4/participacoes/:id/codigos',session,sameOrigin,run(req=>{
  if(Object.keys(req.body||{}).join(',')!=='validadeMinutos')throw new PlanningError('CAMPOS_INVALIDOS');
  return issueCodes(cfg,req.user.id,req.rawSession,req.params.id,req.body.validadeMinutos);
 }));
 app.get('/api/b4/depositos/:id/apontamentos',session,run(req=>listEvents(cfg,req.user.id,req.params.id)));
 // Explicit credential separation. A tablet never creates a SessaoWeb or receives administrative data.
 app.use('/api/tablet',(req,res,next)=>{if(/(?:^|;\s*)jetta_session=/.test(req.get('cookie')||''))return res.status(403).json({erro:'UTILIZE_PERFIL_EXCLUSIVO_TABLET'});next();});
 app.post('/api/tablet/parear',sameOrigin,async(req,res)=>{
  try{if(Object.keys(req.body||{}).join(',')!=='pareamento')throw new PlanningError('CAMPOS_INVALIDOS');const out=await activateTablet(cfg,req.body.pareamento);
   const cookie=`jetta_tablet=${out.token}; HttpOnly; SameSite=Strict; Path=${cfg.b42?'/':'/api/tablet'}; Max-Age=28800`;res.set('Set-Cookie',cfg.b42?[cookie,'jetta_tablet=; HttpOnly; SameSite=Strict; Path=/api/tablet; Max-Age=0']:cookie);res.json({tabletId:out.tabletId,depositoId:out.depositoId});
  }catch(e){error(res,e);}
 });
 app.post('/api/tablet/apontar',sameOrigin,run(req=>{
  const token=(req.get('cookie')||'').match(/(?:^|;\s*)jetta_tablet=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  // Unknown verifier still generates a persisted denied attempt, without disclosing supplied data.
  return recordEvent(cfg,token||'A'.repeat(43),req.body);
 }));
 app.post('/api/tablet/sair',sameOrigin,async(req,res)=>{try{const token=(req.get('cookie')||'').match(/(?:^|;\s*)jetta_tablet=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];if(token)await revokeTablet(cfg,token);res.set('Set-Cookie',cfg.b42?['jetta_tablet=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','jetta_tablet=; HttpOnly; SameSite=Strict; Path=/api/tablet; Max-Age=0']:'jetta_tablet=; HttpOnly; SameSite=Strict; Path=/api/tablet; Max-Age=0');res.json({ok:true});}catch(e){error(res,e);}});
}
