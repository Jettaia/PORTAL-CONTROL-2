import rateLimit from 'express-rate-limit';
import {requestAccess,listRequests,approveRequest,rejectRequest} from './access-requests.js';
import {assertAdmin} from './pc01.js';
export function mountAccessRequests(app,cfg,{session,sameOrigin}){
 if(!cfg.pc01)return;
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'SOLICITACOES_INDISPONIVEIS'});
 const admin=async(req,res,next)=>{try{await assertAdmin(cfg,req.user.id);next();}catch(e){error(res,e);}};
 app.get('/api/pc01/solicitacoes',session,admin,async(req,res)=>{try{res.json(await listRequests(cfg));}catch(e){error(res,e);}});
 for(const [action,fn,status] of [['aprovar',approveRequest,201],['recusar',rejectRequest,200]])app.post('/api/pc01/solicitacoes/:id/'+action,sameOrigin,session,admin,async(req,res)=>{try{res.status(status).json(await fn(cfg,req.user.id,req.rawSession,req.params.id,req.body));}catch(e){error(res,e);}});
}
export function mountPublicAccessRequest(app,cfg,{sameOrigin}){
 if(!cfg.pc01)return;
 app.post('/api/acesso/solicitacoes',sameOrigin,rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res)=>{try{res.status(202).json(await requestAccess(cfg,req.body));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'SOLICITACOES_INDISPONIVEIS'});}});
}
