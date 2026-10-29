import * as catalog from './pc02.js';
import {intLiteral} from './auth-db.js';
export function mountBranchCatalog(app,cfg,{session,sameOrigin},service=catalog){
 if(!cfg.pc02)return;
 if(!cfg.pc01)throw Error('PC-02 exige PC-01 provisionado e ativo');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'CADASTRO_INDISPONIVEL'});
 for(const kind of ['filiais','servicos']){
  app.get('/api/b24a/'+kind,session,async(req,res)=>{try{res.json(await service.read(cfg,req.user.id,kind,req));}catch(e){error(res,e);}});
  const save=editing=>async(req,res)=>{
   try{
    if(req.user.perfil!=='ADMIN')return res.status(403).json({erro:'SOMENTE_ADM'});
    let id;if(editing){try{id=intLiteral(req.params.id);}catch{return res.status(400).json({erro:'IDENTIFICADOR_INVALIDO'});}}
    res.status(editing?200:201).json({ok:true,resultado:await service.save(cfg,req.user.id,req.rawSession,kind,req.body,id,req)});
   }catch(e){error(res,e);}
  };
  app.post('/api/b24a/'+kind,sameOrigin,session,save(false));
  app.put('/api/b24a/'+kind+'/:id',sameOrigin,session,save(true));
 }
}
