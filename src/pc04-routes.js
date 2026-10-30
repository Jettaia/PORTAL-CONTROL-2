import * as contracts from './pc04.js';
import {comparison} from './pc07.js';

export function mountContracts(app,cfg,{session,sameOrigin},service=contracts){
 if(!cfg.pc04)return;
 if(!cfg.pc01||!cfg.pc02||!cfg.pc03)throw Error('PC-04 exige PC-01, PC-02 e PC-03 provisionados');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'CONTRATACOES_INDISPONIVEIS'});
 app.get('/api/pc04/media',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await comparison(cfg,req.user.id,req.query));}catch(e){error(res,e);}});
 app.get('/api/pc04/catalogo',session,async(req,res)=>{try{res.json(await service.catalog(cfg,req.user.id));}catch(e){error(res,e);}});
 app.get('/api/pc04/horarios-pendentes',session,async(req,res)=>{try{res.json(await service.pendingHours(cfg,req.user.id));}catch(e){error(res,e);}});
 app.post('/api/pc04/contratacoes/:id/horarios/:solicitacao/decidir',sameOrigin,session,async(req,res)=>{try{res.json({ok:true,resultado:await service.decideHours(cfg,req.user.id,req.rawSession,req.params.id,req.params.solicitacao,req.body)});}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes',session,async(req,res)=>{try{res.json(await service.list(cfg,req.user.id,req.query.antes,req.query));}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes/:id',session,async(req,res)=>{try{res.json(await service.detail(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 app.post('/api/pc04/contratacoes',sameOrigin,session,async(req,res)=>{try{res.status(201).json({ok:true,resultado:await service.create(cfg,req.user.id,req.rawSession,req.body)});}catch(e){error(res,e);}});
 for(const action of ['horarios','conferir','revisar','cancelar'])app.post('/api/pc04/contratacoes/:id/'+action,sameOrigin,session,async(req,res)=>{
  try{res.json({ok:true,resultado:await service.change(cfg,req.user.id,req.rawSession,req.params.id,action,req.body)});}catch(e){error(res,e);}
 });
}
