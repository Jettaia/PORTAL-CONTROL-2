import {prepareAdmin} from '../integration/final-lab-admin-fixture.mjs';
import {prepareUat} from '../integration/b6-1-uat-fixture.mjs';
import {completeSynthetic} from '../integration/final-lab-scenario.mjs';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {hotp} from '../src/totp.js';
import {createApp} from '../src/server.js';
import {finalFixture} from '../integration/final-lab-fixture.mjs';
if(!process.argv.includes('--synthetic-lab'))throw Error('Exige --synthetic-lab; nao aceita banco existente.');
process.env.JETTA_B3_RUN_SQL_TESTS='YES';process.env.JETTA_FINAL_RECORDS='YES';process.env.JETTA_FINAL_SCHEMA='YES';
for(const n of ['B41','B42','B43','B51','B52','B52A','B52B','B52C','F01','F03'])process.env['JETTA_'+n+'_EVIDENCE']='YES';
const dir=path.resolve('secrets/final-lab'),out=path.resolve('docs/final-lab');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const lockFile=path.join(dir,'instance.lock');
if(fs.existsSync(lockFile)){const owner=JSON.parse(fs.readFileSync(lockFile,'utf8'));let alive=false;try{process.kill(owner.pid,0);alive=true;}catch{}if(alive){console.log('Laboratorio ja ativo ou em preparacao. Acessos: '+path.join(dir,'acessos-locais.html'));if(process.argv.includes('--open')&&fs.existsSync(path.join(dir,'acessos-locais.html')))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process -FilePath '"+path.join(dir,'acessos-locais.html').replaceAll("'","''")+"'"],{windowsHide:true,stdio:'ignore'}).unref();process.exit(0);}fs.unlinkSync(lockFile);}
fs.writeFileSync(lockFile,JSON.stringify({pid:process.pid,createdUtc:new Date().toISOString()}),{flag:'wx'});
process.on('exit',()=>{if(fs.existsSync(lockFile)&&JSON.parse(fs.readFileSync(lockFile,'utf8')).pid===process.pid)fs.unlinkSync(lockFile);});
const f=await finalFixture(),{lab}=f;
const stopFile=path.join(dir,'encerrar.sinal'),card=path.join(dir,'acessos-locais.html');if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);
let server,timer,stopping=false;
const session={status:'PREPARANDO',aprovacaoUsuario:'PENDENTE',database:lab.database,pid:process.pid,createdUtc:new Date().toISOString(),principalAccesses:0,cartaoPrivado:card};
const save=()=>fs.writeFileSync(path.join(out,'demo-session.json'),JSON.stringify(session,null,2)+'\n');
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await lab.close();session.status='ENCERRADA';session.cleanupVerified=true;save();if(fs.existsSync(lockFile))fs.unlinkSync(lockFile);fs.writeFileSync(card,'<!doctype html><meta charset="utf-8"><h1>Laboratório encerrado</h1>');if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);}
try{
 await prepareAdmin(f);const operation=await prepareUat(f);
 const x=await completeSynthetic(f),y=await f.finalReady();
 await f.cmd(y,f.finance,'PROVISIONAR',{motivo:'Cenario gerencial para homologacao'});

 server=createApp(lab.cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));lab.cfg.port=server.address().port;
 session.url='http://127.0.0.1:'+lab.cfg.port+'/';session.status='DISPONIVEL_PARA_HOMOLOGACAO';session.participacoes={completa:String(x.p),provisionada:String(y.p)};session.operacao=operation.rows;save();
 const profiles=[['Gestor',f.g],['Financeiro',f.finance],['Configurador',f.configurator],['Validador',f.validator],['Aprovador',f.approver],['Arquivo',f.archivist],['Diretoria',f.director],['Administrador',f.admin]];
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
 function update(){fs.writeFileSync(card,`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Acessos privados LAB</title><style>body{font:16px/1.5 Arial;max-width:1000px;margin:30px auto;padding:20px;background:#edf3f6;color:#12344f}article{background:white;padding:18px;margin:12px 0;border-radius:10px}code{overflow-wrap:anywhere}a{color:#174e8a}</style><h1>Jetta Control — acessos fictícios privados</h1><p>Não compartilhar este cartão. Senhas e MFA pertencem somente ao banco descartável.</p><p><a href="${session.url}">Abrir portal</a> · <a href="${session.url}tablet.html">Tablet: usar janela exclusiva</a></p><p>MFA muda a cada 30 segundos. Após login, use um código novo para confirmar ação sensível. As permissões continuam independentes.</p>${profiles.map(([name,u])=>`<article><h2>${name}</h2><p>E-mail: <code>${esc(u.email)}</code></p><p>Senha fictícia: <code>${esc(u.password)}</code></p><p>MFA atual: <code>${hotp(u.secret,Math.floor(Date.now()/30000))}</code></p></article>`).join('')}<p>Sem aprovação pessoal, validade fiscal, pagamento ou quitação real. Encerrar: criar encerrar.sinal nesta pasta.</p></html>`);if(fs.existsSync(stopFile))stop().catch(console.error);}
 update();timer=setInterval(update,2000);if(process.argv.includes('--open'))spawn('powershell.exe',['-NoProfile','-Command',"Start-Process -FilePath '"+card.replaceAll("'","''")+"'"],{windowsHide:true,stdio:'ignore'}).unref();console.log('LAB pronto: '+session.url+' | cartão privado: '+card);
 process.on('SIGINT',()=>stop().catch(console.error));process.on('SIGTERM',()=>stop().catch(console.error));
}catch(e){await stop();throw e;}
