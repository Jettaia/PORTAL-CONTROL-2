import * as users from './pc01.js';
import {intLiteral} from './auth-db.js';
export function mountUserAdmin(app,cfg,{session,sameOrigin},service=users){
 if(!cfg.pc01)return;
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'ADMINISTRACAO_INDISPONIVEL'});
 const admin=async(req,res,next)=>{try{await service.assertAdmin(cfg,req.user.id,req.rawSession,req.user.perfil);next();}catch(e){error(res,e);}};
 app.get('/api/pc01/usuarios',session,admin,async(req,res)=>{try{res.json(await service.catalog(cfg));}catch(e){error(res,e);}});
 const save=creating=>async(req,res)=>{
  try{
   let id;if(!creating){try{id=intLiteral(req.params.id);}catch{ return res.status(400).json({erro:'IDENTIFICADOR_INVALIDO'});}}
   await service.assertMfa(cfg,req.user.id,req.rawSession,req);
   res.status(creating?201:200).json(await service.save(cfg,req.user.id,req.rawSession,req.body,id));
  }catch(e){error(res,e);}
 };
 app.post('/api/pc01/usuarios',sameOrigin,session,admin,save(true));
 app.put('/api/pc01/usuarios/:id',sameOrigin,session,admin,save(false));
 app.post('/api/pc01/minha-senha',sameOrigin,session,async(req,res)=>{
  try{res.json(await service.changeOwnPassword(cfg,req.user.id,req.rawSession,req.body));}catch(e){error(res,e);}
 });
 app.post('/api/pc01/usuarios/:id/senha',sameOrigin,session,admin,async(req,res)=>{
  try{
   let id;try{id=intLiteral(req.params.id);}catch{return res.status(400).json({erro:'IDENTIFICADOR_INVALIDO'});}
   await service.assertMfa(cfg,req.user.id,req.rawSession,req);
   res.json(await service.resetPassword(cfg,req.user.id,req.rawSession,req.body,id));
  }catch(e){error(res,e);}
 });
}
