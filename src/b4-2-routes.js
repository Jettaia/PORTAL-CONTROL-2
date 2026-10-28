import {reviewDetail,confer,requestCorrection,decideCorrection,applyCorrection,tablets,governTablet,input,correctionQueue,tabletStatus} from './b4-2.js';
import {PlanningError} from './b3.js';import {labOnly} from './b4-codes.js';
export function mountGovernance(app,cfg,{session,sameOrigin}){
 if(!cfg.b42)return;labOnly(cfg);
 // Root-path HttpOnly cookie identifies a browser dedicated to the tablet. Never grant admin access.
 app.use('/api/tablet',(req,res,next)=>{if(/(?:^|;\s*)jetta_session=/.test(req.get('cookie')||''))return res.status(403).json({erro:'UTILIZE_PERFIL_EXCLUSIVO_TABLET'});next();});
 const allowed=new Set(['/tablet.html','/tablet.js','/tablet.css','/jetta-logo-integrado.png']);
 app.use((req,res,next)=>{if(/(?:^|;\s*)jetta_tablet=/.test(req.get('cookie')||'')&&!allowed.has(req.path)&&!req.path.startsWith('/api/tablet/'))return res.status(403).json({erro:'NAVEGADOR_EXCLUSIVO_TABLET'});next();});
 const run=fn=>async(req,res)=>{try{const r=await fn(req);res.status(r?.status||200).json(r);}catch(e){res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}};
 app.get('/api/tablet/status',run(r=>tabletStatus(cfg,(r.get('cookie')||'').match(/(?:^|;\s*)jetta_tablet=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1]||'A'.repeat(43))));
 app.get('/api/b42/correcoes',session,run(r=>correctionQueue(cfg,r.user.id)));
 app.get('/api/b42/participacoes/:id',session,run(r=>reviewDetail(cfg,r.user.id,r.params.id)));
 app.post('/api/b42/participacoes/:id/conferencia',session,sameOrigin,run(r=>confer(cfg,r.user.id,r.params.id,r.body)));
 app.post('/api/b42/participacoes/:id/correcoes',session,sameOrigin,run(r=>requestCorrection(cfg,r.user.id,r.params.id,r.body)));
 app.post('/api/b42/correcoes/:id/decisao',session,sameOrigin,run(r=>decideCorrection(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
 app.post('/api/b42/correcoes/:id/aplicar',session,sameOrigin,run(r=>{input(r.body,'');return applyCorrection(cfg,r.user.id,r.rawSession,r.params.id);}));
 app.get('/api/b42/depositos/:id/tablets',session,run(r=>tablets(cfg,r.user.id,r.params.id)));
 app.post('/api/b42/tablets/:id/governanca',session,sameOrigin,run(r=>governTablet(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
}
