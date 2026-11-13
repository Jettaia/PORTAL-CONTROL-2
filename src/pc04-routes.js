import * as contracts from './pc04.js';
import * as exclusions from './pc04-exclusion.js';
import {comparison} from './pc07.js';
import {contractsWorkbook} from './pc04-export-xlsx.js';
import {contractReportPdf} from './pc04-export-pdf.js';

export function mountContracts(app,cfg,{session,sameOrigin},service=contracts){
 if(!cfg.pc04)return;
 if(!cfg.pc01||!cfg.pc02||!cfg.pc03)throw Error('PC-04 exige PC-01, PC-02 e PC-03 provisionados');
 const error=(res,e)=>res.status(e.status||503).json({erro:e.status?e.message:'CONTRATACOES_INDISPONIVEIS'});
 app.get('/api/pc04/media',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await comparison(cfg,req.user.id,req.query));}catch(e){error(res,e);}});
 app.get('/api/pc04/catalogo',session,async(req,res)=>{try{res.json(await service.catalog(cfg,req.user.id));}catch(e){error(res,e);}});
 app.get('/api/pc04/exclusoes-pendentes',session,async(req,res)=>{try{res.set('Cache-Control','no-store').json(await exclusions.pending(cfg,req.user.id));}catch(e){error(res,e);}});
 for(const [action,fn] of [['excluir',exclusions.remove],['solicitar-exclusao',exclusions.request]])app.post('/api/pc04/contratacoes/:id/'+action,sameOrigin,session,async(req,res)=>{try{res.json({ok:true,resultado:await fn(cfg,req.user.id,req.rawSession,req.params.id,req.body)});}catch(e){error(res,e);}});
 app.post('/api/pc04/contratacoes/:id/exclusao/:solicitacao/recusar',sameOrigin,session,async(req,res)=>{try{res.json({ok:true,resultado:await exclusions.reject(cfg,req.user.id,req.rawSession,req.params.id,req.params.solicitacao,req.body)});}catch(e){error(res,e);}});
 app.get('/api/pc04/horarios-pendentes',session,async(req,res)=>{try{res.json(await service.pendingHours(cfg,req.user.id));}catch(e){error(res,e);}});
 app.post('/api/pc04/contratacoes/:id/horarios/:solicitacao/decidir',sameOrigin,session,async(req,res)=>{try{res.json({ok:true,resultado:await service.decideHours(cfg,req.user.id,req.rawSession,req.params.id,req.params.solicitacao,req.body)});}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes',session,async(req,res)=>{try{res.json(await service.list(cfg,req.user.id,req.query.antes,req.query));}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes/exportar.xlsx',session,async(req,res)=>{try{const report=await service.exportData(cfg,req.user.id,req.query);res.set('Cache-Control','no-store').set('Content-Disposition','attachment; filename="contratacoes-'+report.geradoEmUtc.slice(0,10)+'.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(contractsWorkbook(report));}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes/exportar.pdf',session,async(req,res)=>{try{const {buffer,report}=await contractReportPdf(()=>service.exportData(cfg,req.user.id,req.query,10000));res.set('Cache-Control','no-store').set('Content-Disposition','attachment; filename="contratacoes-'+report.geradoEmUtc.slice(0,10)+'.pdf"').type('application/pdf').send(buffer);}catch(e){error(res,e);}});
 app.get('/api/pc04/contratacoes/:id',session,async(req,res)=>{try{res.json(await service.detail(cfg,req.user.id,req.params.id));}catch(e){error(res,e);}});
 app.post('/api/pc04/contratacoes',sameOrigin,session,async(req,res)=>{try{res.status(201).json({ok:true,resultado:await service.create(cfg,req.user.id,req.rawSession,req.body)});}catch(e){error(res,e);}});
 for(const action of ['previstos','horarios','conferir','revisar','cancelar'])app.post('/api/pc04/contratacoes/:id/'+action,sameOrigin,session,async(req,res)=>{
  try{res.json({ok:true,resultado:await service.change(cfg,req.user.id,req.rawSession,req.params.id,action,req.body)});}catch(e){error(res,e);}
 });
}
