import * as adjustments from './pc10.js';
export function mountAdjustments(app,cfg,{session,sameOrigin},service=adjustments){
 if(!cfg.pc10)return;if(!cfg.pc04||!cfg.pc08)throw Error('PC10 exige PC04 e PC08');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'AJUSTES_INDISPONIVEIS'});
 app.get('/api/pc10/contratacoes/:id',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await service.detail(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 app.post('/api/pc10/contratacoes/:id/regularizar',sameOrigin,session,async(req,res)=>{try{res.json(await service.settle(cfg,req.user.id,req.rawSession,req.params.id,req.body));}catch(e){error(res,e);}});
 app.post('/api/pc10/pagamentos/:id/estornar',sameOrigin,session,async(req,res)=>{try{res.json(await service.reverse(cfg,req.user.id,req.rawSession,req.params.id,req.body));}catch(e){error(res,e);}});
 app.get('/api/pc10/movimentos/:id/anexo',session,async(req,res)=>{try{const a=await service.evidence(cfg,req.user.id,req.params.id);res.set({'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store','Content-Disposition':`attachment; filename="evidencia"; filename*=UTF-8''${encodeURIComponent(a.Nome).replace(/'/g,'%27')}`}).send(Buffer.from(a.Conteudo));}catch(e){error(res,e);}});
}
