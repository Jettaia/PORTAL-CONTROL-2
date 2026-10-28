import {portfolio,serviceDetail,receiptDraft,exportPortfolio,provisioningCatalog} from './b6-1.js';
import {PlanningError} from './b3.js';import {labOnly} from './b4-codes.js';import {emit,safeSqlErrors} from './observability.js';
export function mountProvisioning(app,cfg,{session}){if(!cfg.b61)return;labOnly(cfg);if(!cfg.b53f01||!cfg.b52)throw Error('B6.1 exige contratos B5.3-F01/B5.2');
 app.use('/api/b61',(req,res,next)=>{if(/(?:^|;\s*)jetta_tablet=/.test(req.get('cookie')||''))return res.status(403).json({erro:'TABLET_SEM_ACESSO_GERENCIAL'});next();});
 const run=fn=>async(req,res)=>{try{const data=await fn(req);if(data.buffer){res.set({'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="provisionamento-gerencial.xlsx"','X-Jetta-Auditoria':data.auditoriaId});res.send(data.buffer);}else res.json(data);}catch(e){emit(cfg,'b61.failure',{errors:safeSqlErrors(e)});res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}};
 app.get('/api/b61/carteira',session,run(r=>portfolio(cfg,r.user.id,r.query)));
 app.get('/api/b61/catalogo',session,run(r=>provisioningCatalog(cfg,r.user.id)));
 app.get('/api/b61/exportar',session,run(r=>exportPortfolio(cfg,r.user.id,r.query)));
 app.get('/api/b61/participacoes/:id',session,run(r=>serviceDetail(cfg,r.user.id,r.params.id)));
 app.get('/api/b61/participacoes/:id/minuta',session,run(r=>receiptDraft(cfg,r.user.id,r.params.id)));
}
