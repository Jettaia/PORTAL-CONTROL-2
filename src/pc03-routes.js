import * as providers from './pc03.js';
import {intLiteral} from './auth-db.js';
export function mountProviders(app,cfg,{session,sameOrigin},service=providers){
 if(!cfg.pc03)return;if(!cfg.pc01||!cfg.pc02)throw Error('PC-03 exige PC-01 e PC-02 provisionados');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'PRESTADORES_INDISPONIVEIS'});
 const id=value=>{try{return intLiteral(value);}catch{throw Object.assign(Error('IDENTIFICADOR_INVALIDO'),{status:400});}};
 app.get('/api/b24a/chapas',session,async(req,res)=>{try{res.json(await service.read(cfg,req.user.id,req.query.cpf));}catch(e){error(res,e);}});
 for(const editing of [false,true])app[editing?'put':'post']('/api/b24a/chapas'+(editing?'/:id':''),sameOrigin,session,async(req,res)=>{
  try{res.status(editing?200:201).json({ok:true,resultado:await service.save(cfg,req.user.id,req.rawSession,req.body,editing?id(req.params.id):undefined)});}catch(e){error(res,e);}
 });
 app.put('/api/b24a/chapas/:id/filiais/:filial',sameOrigin,session,async(req,res)=>{
  try{res.json(await service.link(cfg,req.user.id,req.rawSession,id(req.params.id),id(req.params.filial),req.body));}catch(e){error(res,e);}
 });
}
