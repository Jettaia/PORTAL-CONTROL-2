import fs from 'node:fs';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';import {pilotConfig} from './runtime-config.mjs';import {createPilotApp,initialState} from './app.mjs';
import {backupAndVerify} from './recovery.mjs';
import crypto from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),dir=path.resolve(here,'../secrets/pilot-local'),file=path.join(dir,'runtime.json');
if(!fs.existsSync(file))throw Error('Piloto ainda nao instalado. Nao use o iniciador do laboratorio para dados reais.');
const privateConfig=JSON.parse(fs.readFileSync(file,'utf8')),cfg=pilotConfig(privateConfig);
process.env.JETTA_MFA_KEY_HEX=privateConfig.mfaKey;process.env.JETTA_MFA_ENFORCE_CRITICAL='true';process.env.JETTA_MFA_REQUIRE_PRIVILEGED='true';
const state=await initialState(cfg),url=`http://127.0.0.1:${cfg.port}/`,openUrl=state.needsSetup?url+'pilot/setup#'+privateConfig.setupToken:url;
const open=async()=>{if(!process.argv.includes('--open'))return;
 const edge=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles].filter(Boolean).map(base=>path.join(base,'Microsoft/Edge/Application/msedge.exe')).find(file=>fs.existsSync(file));if(!edge)throw Error('Microsoft Edge instalado nao encontrado');
 const quote=value=>"'"+value.replaceAll("'","''")+"'",args=['--app='+openUrl,'--user-data-dir='+path.join(dir,'browser-profile'),'--no-first-run','--no-default-browser-check'],command='Start-Process -FilePath '+quote(edge)+' -ArgumentList @('+args.map(value=>quote('"'+value+'"')).join(',')+')';
 await new Promise((resolve,reject)=>{const helper=spawn('powershell.exe',['-NoProfile','-Command',command],{windowsHide:true,stdio:'ignore'});helper.once('error',()=>reject(Error('Nao foi possivel abrir a janela do Jetta')));helper.once('close',code=>code===0?resolve():reject(Error('Janela do Jetta nao foi aberta; execute o iniciador novamente')));});
};
const probe=await new Promise(resolve=>{const socket=net.connect({host:cfg.host,port:cfg.port},()=>{socket.destroy();resolve(true);});socket.on('error',()=>resolve(false));});
if(probe){const challenge=crypto.randomBytes(32).toString('hex'),response=await fetch(url+'pilot/identity/'+challenge,{signal:AbortSignal.timeout(5000)}),data=await response.json(),expected=crypto.createHmac('sha256',privateConfig.token).update(challenge).digest('hex');if(!/^[a-f0-9]{64}$/.test(data.proof||'')||!crypto.timingSafeEqual(Buffer.from(data.proof,'hex'),Buffer.from(expected,'hex')))throw Error('Porta ocupada por outro servico; link privado nao enviado');await open();console.log('Piloto ja ativo: '+url);}else{
const backup=await backupAndVerify(privateConfig);console.log('Backup verificado antes da abertura: '+path.basename(backup.file));
const server=createPilotApp(cfg).listen(cfg.port,cfg.host);await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
fs.writeFileSync(path.join(dir,'session.json'),JSON.stringify({pid:process.pid,url,startedUtc:new Date().toISOString(),database:cfg.database},null,2)+'\n');
const stopFile=path.join(dir,'encerrar.sinal');if(fs.existsSync(stopFile))fs.unlinkSync(stopFile);let stopping=false;
async function stop(){if(stopping)return;stopping=true;clearInterval(timer);await new Promise(resolve=>server.close(resolve));await backupAndVerify(privateConfig);console.log('Servidor encerrado; banco preservado e backup verificado.');}
const timer=setInterval(()=>{if(fs.existsSync(stopFile)){fs.unlinkSync(stopFile);stop().catch(()=>{process.exitCode=1;});}},1000);process.on('SIGINT',stop);process.on('SIGTERM',stop);await open();console.log('Piloto local: '+url+' | financeiro simulado | banco persistente');
}
