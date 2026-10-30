import * as payments from './fin03.js';
export function mountSettlements(app,cfg,{session,sameOrigin}){
 const route='/api/financeiro/contratacoes/:id';
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'PAGAMENTO_INDISPONIVEL'});
 for(const [suffix,fn] of [['/pagamento',payments.confirm],['/pagamento/desfazer',payments.undo],['/pagamento/anexo',payments.replace]])app.post(route+suffix,sameOrigin,session,async(req,res)=>{try{res.json(await fn(cfg,req.user.id,req.rawSession,req.params.id,req.body));}catch(e){error(res,e);}});
 app.get(route+'/pagamento',session,async(req,res)=>{try{res.json(await payments.read(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 app.get(route+'/anexos/:anexoId',session,async(req,res)=>{try{const file=await payments.attachment(cfg,req.user.id,req.params.id,req.params.anexoId);res.set('Content-Type',file.Tipo).set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.Nome).replace(/'/g,'%27')).set('Content-Security-Policy',"default-src 'none'; sandbox").set('X-Content-Type-Options','nosniff').send(Buffer.from(file.Conteudo));}catch(e){error(res,e);}});
}
