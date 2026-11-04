import {mountFinanceQueue} from './fin01-routes.js';
import {mountPayments} from './pc08-routes.js';
import {mountAdjustments} from './pc10-routes.js';
import {mountStatements} from './pc11-routes.js';
import {mountContracts} from './pc04-routes.js';
import {mountTokens} from './pc05-routes.js';
import {mountProviders} from './pc03-routes.js';
import {mountBranchCatalog} from './pc02-routes.js';
import {mountUserAdmin} from './pc01-routes.js';
import {mountAccessRequests,mountPublicAccessRequest} from './access-request-routes.js';
import {mountFinalLab} from './final-lab-routes.js';
import {mountProvisioning} from './b6-1-routes.js';
import {mountF03} from './b5-3-f03-routes.js';
import {mountF01} from './b5-3-f01-routes.js';
import {mountConsolidation} from './b5-2c-routes.js';
import {mountReadiness} from './b5-2b-routes.js';
import {mountFinanceStabilization} from './b5-2a-routes.js';
import {mountAuthorization} from './b5-2-routes.js';
import {mountWallet} from './b5-1-routes.js';
import {correlationMiddleware,bindSession,emit,safeSqlErrors} from './observability.js';
import {mountPlanning} from './b3-routes.js';
import express from 'express';
import {enroll,verify,status,requireMfaMiddleware} from './mfa-b2b.js';
import {privilegedGate,revokeOwnSessions,validateKeyConfig} from './mfa-b2c.js';
import {newTotpSecret} from './totp.js';
import {issueInvite,activate} from './b25b.js';
import {registerPendingUser,pendingUsers} from './b25.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {configFromEnv} from './config.js';
import {diagnostic} from './db.js';
import {login,logout,findSession,depositsFor} from './auth-db.js';
import {parseSessionCookie,cookieValue,clearCookie} from './security.js';
import {isRoot,catalog,createRole,setRolePermission,assignRole,can} from './rbac.js';
import {withDb} from './auth-db.js';
import {b24Definition,listB24,createB24,updateCatalog,BranchError,validateB24} from './b24a.js';
import {listDeposits,createDeposit,updateDeposit,listUsers,listScope,setScope} from './b24c.js';
export function createApp(cfg){if(cfg.mfaRequired!==false)validateKeyConfig(process.env);const app=express();app.disable('x-powered-by');if(cfg.production)app.set('trust proxy',cfg.trustedProxy);
// SQL Server BIGINT via ODBC: serialize without losing integer precision.
app.set('json replacer', (_key, val) => {
 if(['Ativo','Critica','Sistema'].includes(_key)&&(val==='0'||val==='1'))return val==='1';
 if (typeof val !== 'bigint') return val;
 return val <= BigInt(Number.MAX_SAFE_INTEGER) && val >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(val) : val.toString();
});
app.use(correlationMiddleware(cfg));
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],styleSrc:["'self'"],scriptSrc:["'self'"],imgSrc:["'self'","data:"],connectSrc:["'self'"],formAction:["'self'"]}}}));
app.use('/api/final-lab/anexos',express.json({limit:'3mb'}));
app.use('/api/pc08/pagamentos',express.json({limit:'15mb'}));
app.use('/api/pc10',express.json({limit:'2mb'}));
app.use('/api/financeiro/contratacoes',express.json({limit:'7mb'}));
app.use(express.json({limit:'8kb'}));
app.use('/api',rateLimit({windowMs:60000,limit:90,standardHeaders:'draft-7',legacyHeaders:false}));
const loginLimiter=rateLimit({windowMs:15*60000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
function authorizedDiagnostic(req,res,next){const a=Buffer.from(cfg.token),b=Buffer.from(req.get('x-diagnostic-token')||'');if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(401).json({erro:'Nao autorizado'});next();}
const sameOrigin=(req,res,next)=>{const origin=req.get('origin');const expected=cfg.production?cfg.publicOrigin:`http://${cfg.host}:${cfg.port}`;if(origin!==expected)return res.status(403).json({erro:'Origem nao autorizada'});if(req.get('x-jetta-request')!=='web')return res.status(403).json({erro:'Cabecalho de protecao ausente'});next();};
async function session(req,res,next){try{const token=parseSessionCookie(req.get('cookie')||'',cfg);if(token)bindSession(token);if(!token)return res.status(401).json({erro:'Login necessario'});const user=await findSession(cfg,token);if(!user)return res.status(401).json({erro:'Sessao invalida ou expirada'});req.user=user;req.rawSession=token;next();}catch(e){emit(cfg,'auth.failure',{errors:safeSqlErrors(e)});console.error('Falha sessao:',safeSqlErrors(e));res.status(503).json(cfg.b34?{erro:'ERRO_TECNICO',referencia:res.getHeader('X-Jetta-Correlation')}:{erro:'Servico indisponivel'});}}
// B4 management routes run before the tablet delegation; retain any existing global MFA policy.
const b4Privileged=privilegedGate(cfg,session),b4Critical=requireMfaMiddleware(cfg,session);
// FIN04 retires every old financial API, including reads and exports.
app.use((req,res,next)=>{
 if(cfg.fin01&&/^\/api\/(?:pc08|pc09|pc10|pc11|b51|b52|b52a|b52b|b52c|b53f01|b53f03|b61|final-lab)(?:\/|$)/i.test(req.path)){
  if(['GET','HEAD','OPTIONS'].includes(req.method))return res.status(410).json({erro:'FINANCEIRO_LEGADO_DESATIVADO'});
  return session(req,res,()=>res.status(409).json({erro:'FINANCEIRO_LEGADO_DESATIVADO'}));
 }
 next();
});
app.use((req,res,next)=>{if(!cfg.b41||!/^\/api\/(?:b51|b52|b52b|b52c|b53f01|b53f03|b61|final-lab)(?:\/|$)/.test(req.path))return next();b4Privileged(req,res,()=>b4Critical(req,res,next));});
if(!cfg.fin01){
mountWallet(app,cfg,{session,sameOrigin});
mountAuthorization(app,cfg,{session,sameOrigin});
mountFinanceStabilization(app,cfg,{session,sameOrigin});
mountReadiness(app,cfg,{session,sameOrigin});
mountConsolidation(app,cfg,{session,sameOrigin});
mountF01(app,cfg,{session,sameOrigin});
mountF03(app,cfg,{session,sameOrigin});
mountProvisioning(app,cfg,{session,sameOrigin});
mountFinalLab(app,cfg,{session,sameOrigin});
}
// PC05 tablet has its own restricted credential; management checks MFA in its service.
mountTokens(app,cfg,{session,sameOrigin});
mountPublicAccessRequest(app,cfg,{sameOrigin});
app.use(privilegedGate(cfg,session));
app.use('/api',requireMfaMiddleware(cfg,session));
mountUserAdmin(app,cfg,{session,sameOrigin});
mountAccessRequests(app,cfg,{session,sameOrigin});
mountBranchCatalog(app,cfg,{session,sameOrigin});
mountProviders(app,cfg,{session,sameOrigin});
mountContracts(app,cfg,{session,sameOrigin});
mountFinanceQueue(app,cfg,{session,sameOrigin});
if(!cfg.fin01){
mountPayments(app,cfg,{session,sameOrigin});
mountAdjustments(app,cfg,{session,sameOrigin});
mountStatements(app,cfg,{session});
}
// PC-01 is the sole writer of account roles/depot scope once enabled.
// Keep legacy read APIs and security gates; prevent alternate mutation paths.
app.use('/api',(req,res,next)=>{
 if(cfg.pc01&&['POST','PUT','PATCH','DELETE'].includes(req.method)&&/^\/(?:b23\/(?:perfis|permissoes|usuarios\/perfis)|b24c\/abrangencias|b25\/usuarios-pendentes)(?:\/|$)/.test(req.path))return res.status(409).json({erro:'UTILIZE_ADMINISTRACAO_PC01'});
 next();
});
app.get('/api/health',(req,res)=>res.json(cfg.production?{status:'UP',projeto:'Portal Control'}:{status:'UP',projeto:'Jetta Control',bloco:'B2.3',escopo:'local-auth-piloto'}));
app.post('/api/auth/login',loginLimiter,sameOrigin,async(req,res)=>{
 const {email,senha}=req.body||{};if(typeof email!=='string'||typeof senha!=='string'||email.length>256||senha.length>1024||!email.includes('@'))return res.status(400).json({erro:'Dados invalidos'});
 try{const out=await login(cfg,email,senha);if(!out)return res.status(401).json({erro:'Credenciais invalidas ou acesso temporariamente bloqueado'});
 res.set('Set-Cookie',cookieValue(out.token,cfg));return res.json({usuario:out.user,mfa:{habilitado:cfg.mfaRequired!==false,necessarioParaAcoesSensiveis:cfg.mfaRequired!==false}});
 }catch(e){console.error('Falha login:',safeSqlErrors(e));res.status(503).json({erro:'Servico de login indisponivel'});}
});
app.get('/api/auth/me',session,(req,res)=>res.json({usuario:req.user,mfa:{habilitado:cfg.mfaRequired!==false,necessarioParaAcoesSensiveis:cfg.mfaRequired!==false}}));
app.post('/api/auth/logout',sameOrigin,session,async(req,res)=>{try{await logout(cfg,req.rawSession);res.set('Set-Cookie',clearCookie(cfg));res.json({ok:true});}catch(e){console.error('Falha logout:',safeSqlErrors(e));res.status(503).json({erro:'Nao foi possivel encerrar sessao'});}});
app.get('/api/depositos/permitidos',session,async(req,res)=>{if(!['GESTOR','ADMIN','FINANCEIRO'].includes(req.user.perfil))return res.status(403).json({erro:'Perfil sem acesso a consulta'});try{res.json({depositos:await depositsFor(cfg,req.user)});}catch(e){console.error('Falha depositos:',safeSqlErrors(e));res.status(503).json({erro:'Consulta indisponivel'});}});
app.get('/api/admin/diagnostico',session,(req,res,next)=>{if(req.user.perfil!=='ADMIN')return res.status(403).json({erro:'Apenas ADMIN'});next();},authorizedDiagnostic,async(req,res)=>{try{res.json(await diagnostic(cfg));}catch(e){console.error('Falha SQL:',safeSqlErrors(e));res.status(503).json({erro:'Conexao SQL indisponivel'});}});
// B2.3: RBAC APIs, all privileged mutations require authenticated root and same-origin header.
async function b23Root(req,res,next){try{if(!await isRoot(cfg,req.user.id))return res.status(403).json({erro:'Somente Administrador-raiz'});next();}catch(e){console.error('B23 root:',safeSqlErrors(e));res.status(503).json({erro:'Verificacao indisponivel'});}}
app.get('/api/b23/catalogo',session,b23Root,async(req,res)=>{try{res.json(await catalog(cfg));}catch(e){console.error('B23 catalogo:',safeSqlErrors(e));res.status(503).json({erro:'Catalogo indisponivel'});}});
function b23Mutation(route,fn){app.post(route,sameOrigin,session,b23Root,async(req,res)=>{try{const result=await fn(cfg,req.user.id,req.body||{});res.json({ok:true,resultado:result});}catch(e){console.error('B23 operacao:',safeSqlErrors(e));res.status(400).json({erro:'Operacao recusada: verifique dados, regras e permissao'});}});}
b23Mutation('/api/b23/perfis',createRole);
b23Mutation('/api/b23/permissoes',setRolePermission);
b23Mutation('/api/b23/usuarios/perfis',assignRole);
app.get('/api/b23/minhas-permissoes',session,async(req,res)=>{try{const chaves=['painel.visualizar','depositos.visualizar','atividades.visualizar','financeiro.visualizar','relatorios.exportar'];const permissoes=[];for(const k of chaves)if(await can(cfg,req.user.id,k))permissoes.push(k);res.json({permissoes});}catch(e){res.status(503).json({erro:'Permissoes indisponiveis'});}});
// B2.4-PRE: read-only discovery with root gate. No writes or implicit authorization.
const cadastroObjects=Object.freeze({chapas:'Cadastro.Prestador',usuarios:'Seguranca.Usuario',servicos:'Cadastro.TipoServico'});
app.get('/api/b24/cadastros/:tipo',session,b23Root,async(req,res)=>{
 const type=req.params.tipo;const table=cadastroObjects[type];if(!table)return res.status(404).json({erro:'Cadastro indisponivel'});
 try{const rows=await withDb(cfg,async db=>{
   // No dynamic schema construction from user input; finite server-side allowlist.
   if(type==='usuarios')return db.query('SELECT TOP (100) UsuarioId,Nome,Email,Perfil,Ativo FROM Seguranca.Usuario ORDER BY UsuarioId DESC');
   if(type==='chapas')return db.query('SELECT TOP (100) PrestadorId,Nome,Ativo FROM Cadastro.Prestador ORDER BY PrestadorId DESC');
   return db.query('SELECT TOP (100) TipoServicoId,Nome,Ativo FROM Cadastro.TipoServico ORDER BY TipoServicoId DESC');
 });res.json({tipo:type,registros:rows});}
 catch(e){console.error('B24 consulta:',type,safeSqlErrors(e));res.status(503).json({erro:'Consulta nao disponivel. Validar colunas pelo diagnostico de esquema.'});}
});

// B2.4-A: only authenticated users with explicit noncritical RBAC permission.
// Deny on any auth/DB uncertainty. Same origin enforced on mutations.
app.get('/api/b24a/:tipo',session,async(req,res)=>{
 const d=b24Definition(req.params.tipo);if(!d)return res.status(404).json({erro:'Cadastro inexistente'});
 try{if(!await can(cfg,req.user.id,d.read))return res.status(403).json({erro:'Permissao negada'});
 res.json({podeEditar:await isRoot(cfg,req.user.id)&&req.user.perfil==='ADMIN'&&await can(cfg,req.user.id,d.write),registros:await listB24(cfg,req.params.tipo,req.user.id)});
 }catch(e){console.error('B24A read:',safeSqlErrors(e));res.status(503).json({erro:'Consulta indisponivel'});}
});
app.post('/api/b24a/:tipo',sameOrigin,session,async(req,res)=>{
 const d=b24Definition(req.params.tipo);if(!d)return res.status(404).json({erro:'Cadastro inexistente'});
 try{if(!await can(cfg,req.user.id,d.write))return res.status(403).json({erro:'Permissao negada'});
 try{validateB24(req.params.tipo,req.body);}catch(error){return res.status(400).json({erro:error.message});}const result=await createB24(cfg,req.params.tipo,req.body,req.user.id);res.status(201).json({ok:true,resultado:result});
 }catch(e){console.error('B24A write:',safeSqlErrors(e));res.status(400).json({erro:'Cadastro recusado: confira dados, permissao e duplicidade'});}
});

app.put('/api/b24a/:tipo/:id',sameOrigin,session,async(req,res)=>{try{
 const type=req.params.tipo;if(!['chapas','servicos'].includes(type))return res.status(404).json({erro:'Cadastro inválido.'});
 const permission=b24Definition(type).write;
 if(req.user.perfil!=='ADMIN'||!await isRoot(cfg,req.user.id)||!await can(cfg,req.user.id,permission))return res.status(403).json({erro:'Permissão de administrador necessária.'});
 const mfa=cfg.mfaRequired===false?null:await status(cfg,req.user.id,req.rawSession);if(mfa&&(!mfa.enrolled||!mfa.verified||!mfa.stepUp))return res.status(403).json({erro:'Confirme MFA recente para esta operação',codigo:'MFA_REQUIRED'});
 return res.json(await updateCatalog(cfg,type,req.params.id,req.body,req.user.id));
 }catch(error){if(error instanceof BranchError)return res.status(error.status).json({erro:error.message});console.error('Cadastro update:',safeSqlErrors(error));return res.status(400).json({erro:'Alteração recusada. Confira os campos e atualize a lista.'});}});

// B2.4-C: scope is enforced on every deposit list; no generic user creation before MFA.
app.get('/api/b24c/depositos',session,async(req,res)=>{try{if(!await can(cfg,req.user.id,'depositos.visualizar'))return res.status(403).json({erro:'Permissao negada'});const rootUser=await isRoot(cfg,req.user.id);res.json({registros:await listDeposits(cfg,req.user.id,rootUser)});}catch(e){console.error('B24C list deposits:',safeSqlErrors(e));res.status(503).json({erro:'Consulta indisponivel'});}});
app.post('/api/b24c/depositos',sameOrigin,session,async(req,res)=>{try{if(!await can(cfg,req.user.id,'depositos.cadastrar'))return res.status(403).json({erro:'Permissao negada'});res.status(201).json({resultado:await createDeposit(cfg,req.user.id,req.body,req.rawSession)});}catch(e){console.error('B24C create:',safeSqlErrors(e));res.status(400).json({erro:'Cadastro recusado; confira campos e permissoes'});}});
app.put('/api/b24c/depositos',sameOrigin,session,async(req,res)=>{try{if(!await can(cfg,req.user.id,'depositos.editar')||(req.body?.ativo===false&&!await can(cfg,req.user.id,'depositos.inativar')))return res.status(403).json({erro:'Permissao negada'});res.json({resultado:await updateDeposit(cfg,req.user.id,req.body,req.rawSession)});}catch(e){console.error('B24C update:',safeSqlErrors(e));res.status(400).json({erro:'Alteracao recusada; confira dados/permissoes'});}});
app.get('/api/b24c/usuarios',session,async(req,res)=>{try{if(!await can(cfg,req.user.id,'usuarios.visualizar'))return res.status(403).json({erro:'Permissao negada'});res.json({registros:await listUsers(cfg)});}catch(e){console.error('B24C users:',safeSqlErrors(e));res.status(503).json({erro:'Consulta indisponivel'});}});
app.get('/api/b24c/abrangencias',session,b23Root,async(req,res)=>{try{res.json({registros:await listScope(cfg)});}catch(e){res.status(503).json({erro:'Consulta indisponivel'});}});
app.post('/api/b24c/abrangencias',sameOrigin,session,b23Root,async(req,res)=>{try{res.json({resultado:await setScope(cfg,req.user.id,req.body)});}catch(e){console.error('B24C scope:',safeSqlErrors(e));res.status(400).json({erro:'Operacao negada ou dados invalidos'});}});

// B2.5-A: somente raiz autenticado; cria conta INATIVA, sem credenciais.
app.get('/api/b25/usuarios-pendentes',session,b23Root,async(req,res)=>{try{return res.json({registros:await pendingUsers(cfg)});}catch(e){console.error('B25 list:',safeSqlErrors(e));return res.status(503).json({erro:'Consulta indisponivel'});}});
app.post('/api/b25/usuarios-pendentes',sameOrigin,session,b23Root,async(req,res)=>{try{const row=await registerPendingUser(cfg,req.user.id,req.body);return res.status(201).json({ok:true,resultado:row});}catch(e){console.error('B25 create:', safeSqlErrors(e));
console.error('B25 SQL detalhes:',
  (e.odbcErrors || []).map(x => ({
    state: x.state,
    code: x.code

  }))
);return res.status(400).json({erro:'Cadastro pendente recusado. Confira dados, duplicidade e permissoes.'});}});

// B2.5-B1: convite so para raiz; ativacao sem sessao, token de uso unico.
const activationLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
app.post('/api/b25b/convites',sameOrigin,session,b23Root,async(req,res)=>{
 try{const convite=await issueInvite(cfg,req.user.id,req.body?.usuarioId);return res.status(201).json(convite);}
 catch(e){console.error('Convite B25B1:',safeSqlErrors(e));return res.status(400).json({erro:'Convite nao emitido. Verifique conta pendente e autorizacao.'});}
});
app.post('/api/b25b/ativar',activationLimiter,sameOrigin,async(req,res)=>{
 try{await activate(cfg,req.body?.token,req.body?.senha);return res.json({ok:true});}
 catch(e){console.error('Ativacao B25B1:',safeSqlErrors(e));return res.status(400).json({erro:'Convite invalido, expirado ou dados recusados.'});}
});

// B2.5-B2B: ativacao progressiva, feature flag desligada por padrao.
const mfaLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-7',legacyHeaders:false});
app.get('/api/mfa/status',session,async(req,res)=>{try{res.json(cfg.mfaRequired===false?{enabled:false,enrolled:false,verified:false,stepUp:false}:await status(cfg,req.user.id,req.rawSession));}catch(e){console.error('MFA status:',safeSqlErrors(e));res.status(503).json({erro:'MFA indisponivel'});}});
app.post('/api/mfa/enroll',mfaLimiter,sameOrigin,session,async(req,res)=>{try{res.status(201).json(await enroll(cfg,req.user,req.rawSession));}catch(e){console.error('MFA enroll:',safeSqlErrors(e));res.status(400).json({erro:'Nao foi possivel configurar MFA'});}});
app.post('/api/mfa/verify',mfaLimiter,sameOrigin,session,async(req,res)=>{try{const ok=await verify(cfg,req.user,req.rawSession,req.body?.code,req.body?.purpose);if(!ok)return res.status(401).json({erro:'Codigo invalido ou reutilizado'});res.json({ok:true});}catch(e){console.error('MFA verify:',safeSqlErrors(e));res.status(503).json({erro:'Verificacao MFA indisponivel'});}});
// Revoga TODAS as sessoes do usuario, inclusive a atual, apos MFA recente.
app.post('/api/mfa/revoke-own-sessions',mfaLimiter,sameOrigin,session,async(req,res)=>{try{await revokeOwnSessions(cfg,req.user.id,req.rawSession);res.set('Set-Cookie',clearCookie(cfg));return res.json({ok:true});}catch(e){console.error('B2C revoke:',safeSqlErrors(e));return res.status(403).json({erro:'Revogacao recusada: valide MFA recente'});}});
mountPlanning(app,cfg,{session,sameOrigin});
const root=cfg.publicRoot||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
app.use((req,res,next)=>{
 let resource;try{resource=path.posix.normalize(decodeURIComponent(req.path).replaceAll('\\','/'));}catch{return res.status(400).json({erro:'CAMINHO_INVALIDO'});}
 // NTFS stream suffixes and Win32 trailing dots/spaces can address the same file.
 const legacyResource=resource.split(':',1)[0].replace(/[. ]+$/,'');
 if(!cfg.pc05&&/^\/tablet(?:-pc05)?\.html$/i.test(legacyResource))return res.status(404).json({erro:'Nao encontrado'});
 if(cfg.fin01&&/^\/(?:consolidacao|prontidao|minuta-recibo|regras-financeiras|contratacao-financeira|b5-1(?:-section)?|b5-2(?:b|c)?|b5-3-f0[13]|b6-1|final-lab|pc0[89]|pc1[01])\.(?:html|js|css)$/i.test(legacyResource))return res.status(410).json({erro:'FINANCEIRO_LEGADO_DESATIVADO'});
 next();
});
app.get('/tablet.html',(req,res)=>cfg.pc05?res.sendFile(path.join(root,'tablet-pc05.html')):res.status(404).json({erro:'Nao encontrado'}));
app.use(express.static(root,{index:'index.html',dotfiles:'deny'}));
app.use((req,res)=>res.status(404).json({erro:'Nao encontrado'}));
return app;}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const cfg=configFromEnv();createApp(cfg).listen(cfg.port,cfg.host,()=>console.log('Jetta Control B3: servidor local'));}
