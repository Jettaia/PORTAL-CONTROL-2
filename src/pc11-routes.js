import * as statements from './pc11.js';
export function mountStatements(app,cfg,{session},service=statements){
 if(!cfg.pc11)return;if(!cfg.pc04||!cfg.pc08||!cfg.pc10)throw Error('PC11 exige PC04, PC08 e PC10');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'EXTRATO_INDISPONIVEL'});
 app.get('/api/pc11/extrato',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await service.statement(cfg,req.user.id,req.query));}catch(e){error(res,e);}});
 app.get('/api/pc11/pagamentos/:id',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await service.group(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 for(const [resource,kind] of [['contratacoes','pagamento'],['movimentos','movimento']])app.get(`/api/pc11/${resource}/:id/anexo`,session,async(req,res)=>{
  try{const a=await service.evidence(cfg,req.user.id,req.params.id,kind);res.set({'Cache-Control':'no-store','Content-Type':'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':`attachment; filename="evidencia"; filename*=UTF-8''${encodeURIComponent(a.Nome).replace(/'/g,'%27')}`}).send(Buffer.from(a.Conteudo));}catch(e){error(res,e);}
 });
}
