import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {makeB3Lab} from './b3-lab.mjs';import {login} from '../src/auth-db.js';import {enroll,verify} from '../src/mfa-b2b.js';import {hotp} from '../src/totp.js';
import {createActivity,addParticipant} from '../src/b3.js';import {createPolicy,informAvailability} from '../src/b3-operations.js';import {confirmParticipation} from '../src/b3-contracts.js';
export function decode(s){let a=0,b=0,r=[];for(const c of s){a=(a<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);b+=5;if(b>=8){b-=8;r.push((a>>b)&255);}}return Buffer.from(r);}
export async function fixture({b34=false,observe}={}){
 process.env.JETTA_MFA_KEY_HEX=crypto.randomBytes(32).toString('hex');delete process.env.JETTA_MFA_REQUIRE_PRIVILEGED;delete process.env.JETTA_MFA_ENFORCE_CRITICAL;
 const lab=await makeB3Lab({b33:true}),q=s=>lab.db.query(s);lab.cfg.b34=b34;if(observe)lab.cfg.observe=observe;
 try{
 const admin=await lab.user('ADMIN',['atividades.visualizar','limites.configurar']),g=await lab.user('GESTOR',['atividades.visualizar','atividades.criar','atividades.confirmar']),g2=await lab.user('GESTOR',['atividades.visualizar','atividades.criar','atividades.confirmar']),no=await lab.user('ADMIN',['atividades.visualizar']);
 await q("INSERT Cadastro.Filial(Codigo,Nome) VALUES('A',N'Filial A'),('B',N'Filial B');INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(1,'A',N'Deposito A'),(2,'B',N'Deposito reservado');INSERT Cadastro.TipoServico(Nome) VALUES(N'Servico sintetico');");
 for(const [u,dep] of [[g,1],[g2,2]])await q(`INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId) VALUES(${u.id},${dep});INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId) VALUES(${u.id},${dep});`);
 async function authenticate(u){u.token=(await login(lab.cfg,u.email,u.password)).token;const setup=await enroll(lab.cfg,u,u.token);u.secret=decode(setup.secret);const remaining=30000-Date.now()%30000;if(remaining<12000)await new Promise(r=>setTimeout(r,remaining+100));assert.equal(await verify(lab.cfg,u,u.token,hotp(u.secret,Math.floor(Date.now()/30000)-1),'ENROLL'),true);}
 for(const u of [admin,g,g2,no])await authenticate(u);
 const policy=(from='2026-01-01',until='2026-12-31')=>({modo:'DIAS_CONTRATADOS',limiteDias:2,janelaDias:30,vigenteDesde:from,vigenteAte:until});
 await createPolicy(lab.cfg,admin.id,admin.token,policy());
 let seq=0;
 const provider=async()=>Number((await q(`INSERT Cadastro.Prestador(Nome,CPF) OUTPUT inserted.PrestadorId VALUES(N'Prestador sintetico','${String(++seq).padStart(11,'0')}')`))[0].PrestadorId);
 const interval=(pr,date,{actor=g,start='08:00',end='10:00'}={})=>({prestadorId:pr,depositoId:actor===g2?2:1,inicio:date+'T'+start,fim:date+'T'+end});
 const inform=(pr,date,options={})=>informAvailability(lab.cfg,(options.actor||g).id,{...interval(pr,date,options),estado:options.state||'DISPONIVEL',requisicaoId:options.key||crypto.randomUUID()});
 async function plan(pr,date,options={}){const actor=options.actor||g,v=interval(pr,date,options),a=(await createActivity(lab.cfg,actor.id,{filialId:v.depositoId,depositoId:v.depositoId,tipoServicoId:1,dataServico:date,inicioPrevisto:v.inicio,fimPrevisto:v.fim})).atividadeId,p=(await addParticipant(lab.cfg,actor.id,a,{prestadorId:pr,valorContratado:'100.00'})).participacaoId;return {a,p,actor};}
 const confirm=x=>confirmParticipation(lab.cfg,x.actor.id,x.actor.token,x.p,{});
 return {lab,q,admin,g,g2,no,policy,provider,interval,inform,plan,confirm};
 }catch(e){await lab.close();throw e;}
}
