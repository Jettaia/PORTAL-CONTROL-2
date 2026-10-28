import express from 'express';import helmet from 'helmet';import rateLimit from 'express-rate-limit';import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createApp} from '../src/server.js';import {withDb,nvarcharLiteral as s} from '../src/auth-db.js';import {hashPassword,hashToken} from '../src/security.js';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function initialState(cfg){return withDb(cfg,async db=>{const row=(await db.query('SELECT CASE WHEN ConsumidoUtc IS NULL THEN 1 ELSE 0 END Pending,AdminEmail FROM Seguranca.PilotoInicializacao WHERE Id=1'))[0];return {needsSetup:Number(row?.Pending)===1,administrator:Number(row?.Pending)===1?row.AdminEmail:undefined,mode:'PILOTO_LOCAL',finance:'SIMULADO'};});}
export async function completeSetup(cfg,body){
 if(typeof body?.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token)||typeof body.password!=='string'||body.password.length<14||body.password.length>128||!/[a-z]/.test(body.password)||!/[A-Z]/.test(body.password)||!/[0-9]/.test(body.password)||!(/[^A-Za-z0-9]/.test(body.password)))throw Error('Use o link privado e uma senha com pelo menos 14 caracteres, maiuscula, minuscula, numero e simbolo.');
 return withDb(cfg,async db=>{await db.query('SET XACT_ABORT ON;SET LOCK_TIMEOUT 5000;');await db.beginTransaction();try{
  const row=(await db.query('SELECT TokenHash,AdminEmail,AdminNome,ConsumidoUtc FROM Seguranca.PilotoInicializacao WITH(UPDLOCK,HOLDLOCK) WHERE Id=1'))[0];
  if(!row||row.ConsumidoUtc||!crypto.timingSafeEqual(Buffer.from(row.TokenHash,'hex'),Buffer.from(hashToken(body.token),'hex')))throw Error('Link de configuracao invalido ou ja utilizado.');
  if(Number((await db.query('SELECT COUNT(*) N FROM Seguranca.Usuario WITH(UPDLOCK,HOLDLOCK)'))[0].N)!==0)throw Error('Inicializacao recusada: contas existentes.');
  const salt=crypto.randomBytes(16).toString('hex'),hash=hashPassword(body.password,salt);
  const id=(await db.query(`INSERT Seguranca.Usuario(Nome,Email,Perfil,Ativo) OUTPUT inserted.UsuarioId VALUES(${s(row.AdminNome,150)},${s(row.AdminEmail)},'ADMIN',1)`))[0].UsuarioId;
  await db.query(`INSERT Seguranca.UsuarioRaiz(UsuarioId) VALUES(${id});INSERT Seguranca.UsuarioPerfil(UsuarioId,PerfilId) SELECT ${id},PerfilId FROM Seguranca.PerfilAcesso WHERE Codigo='PILOTO_ADMIN';INSERT Seguranca.Credencial(UsuarioId,SaltHex,SenhaHashHex) VALUES(${id},'${salt}','${hash}');UPDATE Seguranca.PilotoInicializacao SET ConsumidoUtc=SYSUTCDATETIME() WHERE Id=1;INSERT Seguranca.Auditoria(Entidade,EntidadeId,Acao,AtorUsuarioId) VALUES(N'PilotoLocal',${id},N'INICIALIZACAO',${id});`);
  await db.commit();return {ok:true};
 }catch(error){try{await db.rollback();}catch{}throw error;}});
}
export function createPilotApp(cfg){
 const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],formAction:["'self'"],frameAncestors:["'none'"]}}}));
 app.use((req,res,next)=>{if(req.get('host')!==`127.0.0.1:${cfg.port}`)return res.status(400).send('Host local invalido');res.set('Cache-Control','no-store');next();});
 app.get('/pilot/status',async(req,res)=>{try{res.json(await initialState(cfg));}catch{res.status(503).json({erro:'Banco do piloto indisponivel'});}});
 app.get('/pilot/identity/:challenge',(req,res)=>{if(!/^[a-f0-9]{64}$/.test(req.params.challenge))return res.sendStatus(400);res.json({proof:crypto.createHmac('sha256',cfg.token).update(req.params.challenge).digest('hex')});});
 app.get('/pilot/setup',(req,res)=>res.sendFile(path.join(here,'setup.html')));
 app.get('/pilot/setup.js',(req,res)=>res.sendFile(path.join(here,'setup.js')));
 app.get('/pilot/setup.css',(req,res)=>res.sendFile(path.join(here,'setup.css')));
 app.post('/pilot/setup',rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),express.json({limit:'4kb'}),async(req,res)=>{
  if(req.get('origin')!==`http://127.0.0.1:${cfg.port}`||req.get('x-jetta-request')!=='web')return res.status(403).json({erro:'Origem recusada'});
  try{res.status(201).json(await completeSetup(cfg,req.body));}catch{res.status(400).json({erro:'Configuracao recusada. Confira o link privado, a senha e se a conta ja foi configurada.'});}
 });
 // Inject a persistent-pilot banner without changing the live laboratory's public files.
 app.get('/',(req,res)=>{let html=fs.readFileSync(path.join(here,'../public/index.html'),'utf8');html=html.replace('<body>','<body><aside class="pilot-notice">PILOTO LOCAL · Dados persistentes · Financeiro exclusivamente simulado · <a href="/pilot/setup">Configuração inicial</a></aside>').replace('</head>','<link rel="stylesheet" href="/pilot/setup.css"></head>').replace('Contas ADMIN e DIRETORIA exigem MFA e nao sao ativadas neste bloco.','Diretoria exige MFA após a ativação. Contas ADMIN adicionais não são ativadas neste piloto.').replaceAll('Homologação','Piloto local').replace('Ambiente de homologação','Piloto operacional local').replace('Esta demonstração usa exclusivamente dados fictícios. Obrigações, pagamentos e assinaturas são simulações sem efeito financeiro.','Os cadastros e registros operacionais são persistentes. Obrigações, pagamentos, recibos financeiros e assinaturas permanecem simulados, sem efeito financeiro.').replace('Provisionamentos, pagamentos e extratos','Provisionamento e pagamentos simulados').replace('UX-01 Refinado v1.1.0 · Não liberado para produção','Piloto local 1.0.0-rc1 · Financeiro simulado');res.type('html').send(html);});
 app.use(createApp(cfg));return app;
}
