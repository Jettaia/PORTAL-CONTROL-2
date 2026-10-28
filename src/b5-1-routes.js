import {wallet,walletDetail,financeCatalog,evaluate,financialReceipt,exportWallet} from './b5-1.js';
import {PlanningError} from './b3.js';import {labOnly} from './b4-codes.js';
import {emit,safeSqlErrors} from './observability.js';
export function mountWallet(app,cfg,{session,sameOrigin}){
 if(!cfg.b51)return;labOnly(cfg);if(!cfg.b43)throw Error('B5.1 exige B4.3');
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){emit(cfg,'b51.failure',{errors:safeSqlErrors(e)});res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}};
 app.get('/api/b51/catalogo',session,run(r=>financeCatalog(cfg,r.user.id)));
 app.get('/api/b51/carteira',session,run(r=>wallet(cfg,r.user.id,r.query)));
 app.get('/api/b51/participacoes/:id',session,run(r=>walletDetail(cfg,r.user.id,r.params.id)));
 app.get('/api/b51/participacoes/:id/comprovante',session,run(r=>financialReceipt(cfg,r.user.id,r.params.id)));
 app.post('/api/b51/participacoes/:id/avaliacoes',session,sameOrigin,run(r=>evaluate(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
 app.get('/api/b51/carteira.xlsx',session,async(req,res)=>{try{const result=await exportWallet(cfg,req.user.id,req.query);res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="carteira-pre-financeira.xlsx"','X-Jetta-Auditoria':result.auditoriaId});res.send(result.buffer);}catch(e){emit(cfg,'b51.failure',{errors:safeSqlErrors(e)});res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO'});}});
}
