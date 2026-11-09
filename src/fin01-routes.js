import {mountReceipts} from './fin02-routes.js';
import {mountSettlements} from './fin03-routes.js';
import * as finance from './fin01.js';
import {statement} from './fin05.js';
import {financeWorkbook,financeReportPdf} from './fin01-export.js';
export function mountFinanceQueue(app,cfg,{session,sameOrigin},service=finance){
 if(!cfg.fin01)return;if(!cfg.pc04)throw Error('FIN01 exige PC04');
 mountReceipts(app,cfg,{session,sameOrigin});
 mountSettlements(app,cfg,{session,sameOrigin});
 const run=fn=>async(req,res)=>{try{res.set('Cache-Control','no-store').json(await fn(req));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'FINANCEIRO_INDISPONIVEL'});}};
 app.get('/api/financeiro/catalogo',session,run(r=>service.catalog(cfg,r.user.id)));
 app.get('/api/financeiro/extrato',session,run(r=>statement(cfg,r.user.id,r.query)));
 app.get('/api/financeiro/contratacoes',session,run(r=>service.list(cfg,r.user.id,r.query)));
 app.get('/api/financeiro/contratacoes/exportar.xlsx',session,async(req,res)=>{try{const report=await service.exportData(cfg,req.user.id,req.query);res.set('Cache-Control','no-store').set('Content-Disposition','attachment; filename="financeiro-'+report.geradoEmUtc.slice(0,10)+'.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(financeWorkbook(report));}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'FINANCEIRO_INDISPONIVEL'});}});
 app.get('/api/financeiro/contratacoes/exportar.pdf',session,async(req,res)=>{try{const {buffer,report}=await financeReportPdf(()=>service.exportData(cfg,req.user.id,req.query,10000));res.set('Cache-Control','no-store').set('Content-Disposition','attachment; filename="financeiro-'+report.geradoEmUtc.slice(0,10)+'.pdf"').type('application/pdf').send(buffer);}catch(e){res.status(e.status||503).json({erro:e.status?e.message:'FINANCEIRO_INDISPONIVEL'});}});
 app.get('/api/financeiro/contratacoes/:id',session,run(r=>service.detail(cfg,r.user.id,r.params.id)));
}
