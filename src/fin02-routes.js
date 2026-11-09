import crypto from 'node:crypto';
import * as receipts from './fin02.js';
import * as batches from './fin02-batch.js';
export function mountReceipts(app,cfg,{session,sameOrigin}){
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'RECIBO_INDISPONIVEL'});
 const route='/api/financeiro/contratacoes/:id/recibo';
 app.get('/api/financeiro/recibos/estilo.css',session,(_req,res)=>res.set('Cache-Control','no-store').type('css').send(batches.printStyle));
 app.get('/api/financeiro/recibos/previa',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await batches.preview(cfg,req.user.id,req.query));}catch(e){error(res,e);}});
 app.post('/api/financeiro/recibos/gerar',sameOrigin,session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await batches.generate(cfg,req.user.id,req.rawSession,req.body));}catch(e){error(res,e);}});
 app.post('/api/financeiro/recibos/impressao',sameOrigin,session,async(req,res)=>{try{const result=await batches.printMany(cfg,req.user.id,req.body);res.set('Content-Security-Policy',result.csp).set('Cache-Control','no-store').type('html').send(result.html);}catch(e){error(res,e);}});
 app.post(route,sameOrigin,session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await receipts.issue(cfg,req.user.id,req.rawSession,req.params.id,req.body));}catch(e){error(res,e);}});
 app.get(route,session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await receipts.read(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 app.get(route+'/impressao',session,async(req,res)=>{try{const html=await receipts.read(cfg,req.user.id,req.params.id,true);const hashes=[...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match=>"'sha256-"+crypto.createHash('sha256').update(match[1]).digest('base64')+"'");res.set('Content-Security-Policy',"default-src 'none'; style-src "+(hashes.join(' ')||"'none'")+"; base-uri 'none'; frame-ancestors 'none'; form-action 'none'").set('Cache-Control','no-store').type('html').send(html);}catch(e){error(res,e);}});
}
