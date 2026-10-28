import {abilities,detail,command,upload,download,wallet,exportWallet,management} from './final-lab.js';
import {PlanningError} from './b3.js';import {labOnly} from './b4-codes.js';import {emit,safeSqlErrors} from './observability.js';
export function mountFinalLab(app,cfg,{session,sameOrigin}){if(!cfg.finalLab)return;labOnly(cfg);
 app.use('/api/final-lab',(req,res,next)=>{if(/(?:^|;\s*)jetta_tablet=/.test(req.get('cookie')||''))return res.status(403).json({erro:'TABLET_SEM_ACESSO_FINANCEIRO'});next();});
 const run=fn=>async(req,res)=>{try{const result=await fn(req);if(result.buffer){res.set({'Content-Type':result.mime||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="'+(result.nome||'relatorio-final-lab.xlsx')+'"','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"});res.send(result.buffer);}else res.json(result);}catch(e){emit(cfg,'finalLab.failure',{errors:safeSqlErrors(e)});res.status(e instanceof PlanningError?e.status:503).json({erro:e instanceof PlanningError?e.code:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')});}};
 app.get('/api/final-lab/acessos',session,run(r=>abilities(cfg,r.user.id)));
 app.get('/api/final-lab/carteira',session,run(r=>wallet(cfg,r.user.id,r.query)));
 app.get('/api/final-lab/relatorio.xlsx',session,run(r=>exportWallet(cfg,r.user.id,r.query)));
 app.get('/api/final-lab/gestao',session,run(r=>management(cfg,r.user.id,r.query)));
 app.get('/api/final-lab/participacoes/:id',session,run(r=>detail(cfg,r.user.id,r.params.id)));
 app.post('/api/final-lab/participacoes/:id/comandos',session,sameOrigin,run(r=>command(cfg,r.user.id,r.rawSession,r.params.id,r.body)));
 app.post('/api/final-lab/anexos',session,sameOrigin,run(r=>upload(cfg,r.user.id,r.rawSession,r.body)));
 app.get('/api/final-lab/anexos/:id',session,run(r=>download(cfg,r.user.id,r.rawSession,r.params.id)));
}
