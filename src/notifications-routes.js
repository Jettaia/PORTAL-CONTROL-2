import * as notifications from './notifications.js';
export function mountNotifications(app,cfg,{session,sameOrigin},service=notifications){
 if(!cfg.pc04)return;
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'NOTIFICACOES_INDISPONIVEIS'});
 app.get('/api/notificacoes',session,async(req,res)=>{try{res.json(await service.list(cfg,req.user.id,req.query.antes));}catch(e){error(res,e);}});
 app.post('/api/notificacoes/:id/lida',sameOrigin,session,async(req,res)=>{try{res.json(await service.markRead(cfg,req.user.id,req.params.id,req.body));}catch(e){error(res,e);}});
}
