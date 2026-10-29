import * as payments from './pc08.js';
export function mountPayments(app,cfg,{session,sameOrigin},service=payments){
 if(!cfg.pc08)return;if(!cfg.pc04)throw Error('PC08 exige PC04');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'PAGAMENTOS_INDISPONIVEIS'});
 app.get('/api/pc08/painel',session,async(req,res)=>{try{res.json(await service.panel(cfg,req.user.id,req.query));}catch(e){error(res,e);}});
 app.post('/api/pc08/pagamentos',sameOrigin,session,async(req,res)=>{try{res.status(201).json({ok:true,resultado:await service.pay(cfg,req.user.id,req.rawSession,req.body)});}catch(e){error(res,e);}});
 app.get('/api/pc08/anexos/:id',session,async(req,res)=>{try{const a=await service.attachment(cfg,req.user.id,req.params.id);res.set({'Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'no-store','Content-Disposition':`attachment; filename="evidencia"; filename*=UTF-8''${encodeURIComponent(a.Nome).replace(/'/g,'%27')}`}).send(Buffer.from(a.Conteudo));}catch(e){error(res,e);}});
}
