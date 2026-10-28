import {authorizationWallet,authorizationDetail,requestAuthorization,decideAuthorization,prepareObligation} from './b5-2.js';
import {PlanningError} from './b3.js';import {labOnly} from './b4-codes.js';import {emit,safeSqlErrors} from './observability.js';
export function mountAuthorization(app,cfg,{session,sameOrigin}){if(!cfg.b52)return;labOnly(cfg);if(!cfg.b51)throw Error('B5.2 exige B5.1');const run=fn=>async(req,res)=>{try{const result=await fn(req);res.status(result.resultado==='BLOQUEADA_POLITICA'?409:200).json(result);}catch(e){emit(cfg,'b52.failure',{errors:safeSqlErrors(e)});res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO'});}};
 app.get('/api/b52/solicitacoes',session,run(r=>authorizationWallet(cfg,r.user.id,r.query)));
 app.get('/api/b52/participacoes/:id',session,run(r=>authorizationDetail(cfg,r.user.id,r.params.id)));
 for(const[action,fn]of [['solicitacoes',requestAuthorization],['decisoes',decideAuthorization],['preparacao',prepareObligation]])app.post('/api/b52/participacoes/:id/'+action,session,sameOrigin,run(r=>fn(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
}
