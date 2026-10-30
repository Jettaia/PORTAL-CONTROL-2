import {technicalError,emit,safeSqlErrors} from './observability.js';
import {listPolicies,policyImpact,createPolicy} from './b3-operations.js';
import {planningCatalog,PlanningError} from './b3.js';
import {sqlContractError} from './b3-contracts.js';
// Only the catalog and limit policies used by Parâmetros remain public.
export function mountPlanning(app,cfg,{session,sameOrigin}){
 const route=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(error){
  const e=sqlContractError(error);
  if(cfg.b34&&!(e instanceof PlanningError)){emit(cfg,'operation.failure',{errors:safeSqlErrors(e)});return res.status(technicalError(e)?503:500).json({erro:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}
  res.status(e instanceof PlanningError?e.status:400).json({erro:e instanceof PlanningError?e.code:'OPERACAO_RECUSADA'});
 }};
 app.get('/api/b3/catalogo',session,route(r=>planningCatalog(cfg,r.user.id)));
 if(cfg.b33===true){
  app.get('/api/b3/politicas',session,route(r=>listPolicies(cfg,r.user.id)));
  app.post('/api/b3/politicas/impacto',sameOrigin,session,route(r=>policyImpact(cfg,r.user.id,r.body)));
  app.post('/api/b3/politicas',sameOrigin,session,route(r=>createPolicy(cfg,r.user.id,r.rawSession,r.body)));
 }
}
