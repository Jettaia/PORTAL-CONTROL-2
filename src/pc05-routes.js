import rateLimit from 'express-rate-limit';
import * as service from './pc05.js';
import {parseSessionCookie} from './security.js';

export function mountTokens(app,cfg,{session,sameOrigin}){
 if(!cfg.pc05)return;
 if(!cfg.pc01||!cfg.pc02||!cfg.pc03||!cfg.pc04)throw Error('PC-05 exige PC-01 a PC-04 provisionados');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'TOKENS_INDISPONIVEIS'});
 const run=fn=>async(req,res)=>{try{const out=await fn(req);if(out?.erro)return res.status(out.status||409).json({erro:out.erro});res.json(out);}catch(e){error(res,e);}};
 app.get('/api/pc05/status',session,(req,res)=>res.json({pc05:true}));
 app.get('/api/pc05/tablets',session,run(req=>service.tablets(cfg,req.user.id)));
 app.post('/api/pc05/tablets',sameOrigin,session,run(req=>service.pair(cfg,req.user.id,req.rawSession,req.body)));
 app.post('/api/pc05/tablets/:id/revogar',sameOrigin,session,run(req=>service.revoke(cfg,req.user.id,req.rawSession,req.params.id,req.body)));
 app.post('/api/pc05/tablets/:id/pareamento',sameOrigin,session,run(req=>service.rePair(cfg,req.user.id,req.rawSession,req.params.id,req.body)));
 app.post('/api/pc05/tablets/:id/cadastro',sameOrigin,session,run(req=>service.updateTablet(cfg,req.user.id,req.rawSession,req.params.id,req.body)));
 app.post('/api/pc05/contratacoes/:id/tokens',sameOrigin,session,run(req=>service.issue(cfg,req.user.id,req.rawSession,req.params.id,req.body)));
 app.use('/api/pc05/tablet',(req,res,next)=>{if((req.get('cookie')||'').split(';').some(part=>part.trim().startsWith((cfg.cookieName||'jetta_session')+'=')))return res.status(403).json({erro:'UTILIZE_PERFIL_EXCLUSIVO_TABLET'});next();});
 const limiter=rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-7',legacyHeaders:false,message:{erro:'TENTATIVAS_EXCEDIDAS'}});
 app.use(['/api/pc05/tablet/habilitar','/api/pc05/tablet/apontar'],limiter);
 const tabletName=cfg.production?'__Secure-jetta_chapa_tablet':'jetta_pc05_tablet';
 const raw=req=>parseSessionCookie(req.get('cookie')||'',{cookieName:tabletName});
 const cookie=(value,age)=>`${tabletName}=${value};${cfg.production?' Secure;':''} HttpOnly; SameSite=Strict; Path=${cfg.production?cfg.basePath:''}/api/pc05/tablet; Max-Age=${age}`;
 app.post('/api/pc05/tablet/habilitar',sameOrigin,async(req,res)=>{try{const out=await service.activate(cfg,req.body);res.set('Set-Cookie',cookie(out.token,34560000)).json({ok:true});}catch(e){error(res,e);}});
 app.get('/api/pc05/tablet/status',async(req,res)=>{try{const token=raw(req),out=await service.status(cfg,token);res.set('Set-Cookie',cookie(token,34560000)).json(out);}catch(e){error(res,e);}});
 app.post('/api/pc05/tablet/apontar',sameOrigin,run(req=>service.consume(cfg,raw(req),req.body)));
 app.post('/api/pc05/tablet/sair',sameOrigin,async(req,res)=>{try{const out=await service.leave(cfg,raw(req));res.set('Set-Cookie',cookie('',0)).json(out);}catch(e){error(res,e);}});
}
