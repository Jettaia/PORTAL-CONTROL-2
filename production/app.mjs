import express from 'express';
import helmet from 'helmet';
import {createApp} from '../src/server.js';

export function createProductionApp(cfg){
 if(cfg.production!==true||cfg.basePath!=='/chapa'||!cfg.publicRoot)throw Error('Runtime de produção incompleto');
 const app=express();app.disable('x-powered-by');app.enable('strict routing');app.set('trust proxy',cfg.trustedProxy);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],formAction:["'self'"],frameAncestors:["'none'"]}}}));
 app.use((req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(req.get('host')!==new URL(cfg.publicOrigin).host||!req.secure)return res.status(400).json({erro:'REQUISICAO_INVALIDA'});
  next();
 });
 app.get(cfg.basePath,(_req,res)=>res.redirect(308,cfg.basePath+'/'));
 app.use(cfg.basePath,(req,res,next)=>{
  let resource;try{resource=decodeURIComponent(req.path).replaceAll('\\','/');}catch{return res.status(400).json({erro:'CAMINHO_INVALIDO'});}
  if(/^\/(?:pilot|api\/(?:admin|final-lab|b51|b52|b52a|b52b|b52c|b53f01|b53f03|b61))(?:\/|$)/i.test(resource))return res.status(404).json({erro:'Nao encontrado'});
  next();
 },createApp(cfg));
 app.use((_req,res)=>res.status(404).json({erro:'Nao encontrado'}));
 app.use((error,_req,res,_next)=>{
  const status=[400,413,415].includes(error?.status)?error.status:500;
  res.status(status).json({erro:status===500?'SERVICO_INDISPONIVEL':'REQUISICAO_INVALIDA'});
 });
 return app;
}
