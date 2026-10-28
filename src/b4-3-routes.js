import {canonical,closeParticipation,addOccurrence,receipt} from './b4-3.js';
import {PlanningError} from './b3.js';
import {labOnly} from './b4-codes.js';
export function mountClosure(app,cfg,{session,sameOrigin}){
 if(!cfg.b43)return;labOnly(cfg);if(!cfg.b42)throw Error('B4.3 exige B4.2');
 const run=fn=>async(req,res)=>{try{res.json(await fn(req));}catch(e){res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}};
 app.get('/api/b43/participacoes/:id',session,run(r=>canonical(cfg,r.user.id,r.params.id)));
 app.get('/api/b43/participacoes/:id/contrato-b5',session,run(r=>canonical(cfg,r.user.id,r.params.id)));
 app.get('/api/b43/participacoes/:id/comprovante',session,run(r=>receipt(cfg,r.user.id,r.params.id)));
 app.post('/api/b43/participacoes/:id/fechamento',session,sameOrigin,run(r=>closeParticipation(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
 app.post('/api/b43/participacoes/:id/ocorrencias',session,sameOrigin,run(r=>addOccurrence(cfg,r.user.id,r.params.id,r.body)));
}
