import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {productionConfig} from '../production/config.mjs';
import {createProductionApp} from '../production/app.mjs';
import {buildAssets} from '../production/build-assets.mjs';
import {connectionString} from '../src/auth-db.js';
import {cookieValue,clearCookie,parseSessionCookie} from '../src/security.js';

async function request(url,options={}){
 return new Promise((resolve,reject)=>{const req=http.request(url,{method:options.method||'GET',headers:options.headers},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});req.on('error',reject);req.end(options.body);});
}

const privateConfig=()=>({server:'chapa-db',port:3211,database:'JETTA_CONTROL_PILOTO_LOCAL',pilotInstance:'a'.repeat(64),token:'b'.repeat(64),mfaKey:'c'.repeat(64),sqlAuth:{user:'JettaChapaRuntime',password:'secret-with-;and-}braces-strong'},trustedProxy:'172.31.32.2',publicOrigin:'https://app.jettatransportes.com.br',basePath:'/chapa'});

test('produção mantém configuração fechada e SQL autenticado com TLS validado',()=>{
 const cfg=productionConfig(privateConfig());
 const cs=connectionString(cfg);
 assert.match(cs,/Encrypt=Yes;TrustServerCertificate=No/);
 assert.match(cs,/UID=\{JettaChapaRuntime\}/);
 assert.match(cs,/PWD=\{secret-with-;and-}}braces-strong\}/);
 assert.doesNotMatch(cs,/Trusted_Connection=Yes/);
 for(const patch of [{server:'remote.invalid'},{database:'master'},{publicOrigin:'http://app.jettatransportes.com.br'},{basePath:'/api'},{trustedProxy:'0.0.0.0/0'},{sqlAuth:{user:'sa',password:'a'.repeat(40)}}])assert.throws(()=>productionConfig({...privateConfig(),...patch}));
});

test('sessões de produção têm nome e caminho isolados e não aceitam cookie antigo',()=>{
 const cfg=productionConfig(privateConfig()),token='a'.repeat(64);
 const cookie=cookieValue(token,cfg);
 assert.match(cookie,/^__Secure-jetta_chapa_session=/);
 assert.match(cookie,/; Secure;/);assert.match(cookie,/; HttpOnly;/);assert.match(cookie,/; SameSite=Strict;/);assert.match(cookie,/; Path=\/chapa;/);
 assert.equal(parseSessionCookie(cookie,cfg),token);
 assert.equal(parseSessionCookie('jetta_session='+token,cfg),null);
 assert.match(clearCookie(cfg),/^__Secure-jetta_chapa_session=;.*Path=\/chapa; Max-Age=0/);
 assert.match(cookieValue(token),/^jetta_session=.*Path=\/api;/);
});

test('HTTP real isola /chapa, recusa origem/proxy e serve recursos prefixados',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chapa-http-'));
 buildAssets(temp);
 const cfg={...productionConfig(privateConfig()),trustedProxy:'loopback',publicRoot:temp};
 const server=createProductionApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 const headers={host:'app.jettatransportes.com.br','x-forwarded-proto':'https'};
 try{
  const page=await request(base+'/chapa/',{headers});assert.equal(page.status,200);
  const html=await page.text();assert.match(html,/src="\/chapa\/app.js"/);assert.doesNotMatch(html,/src="\/app.js"/);
  assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);assert.match(page.headers.get('strict-transport-security'),/max-age=/);
  const js=await (await request(base+'/chapa/app.js',{headers})).text();assert.match(js,/\/chapa\/api\/auth\/login/);
  const fin=await (await request(base+'/chapa/fin01.js',{headers})).text();assert.match(fin,/join\('\/'\)/);
  assert.equal((await request(base+'/chapa',{headers,redirect:'manual'})).headers.get('location'),'/chapa/');
  for(const p of ['/api/health','/','/chapax/api/health','/chapa/pilot/setup','/chapa/api/admin/diagnostico','/chapa/api/final-lab/status'])assert.equal((await request(base+p,{headers})).status,404,p);
  assert.equal((await request(base+'/chapa/api/health',{headers})).status,200);
  assert.equal((await request(base+'/chapa/api/auth/me',{headers})).status,401);
  assert.equal((await request(base+'/chapa/api/pc05/tablet/status',{headers:{...headers,cookie:'__Secure-jetta_chapa_session='+('a'.repeat(64))}})).status,403);
  assert.equal((await request(base+'/chapa/',{headers:{...headers,host:'evil.invalid'}})).status,400);
  assert.equal((await request(base+'/chapa/',{headers:{...headers,'x-forwarded-proto':'http'}})).status,400);
  const post=async patch=>request(base+'/chapa/api/auth/login',{method:'POST',headers:{...headers,'content-type':'application/json','x-jetta-request':'web',origin:cfg.publicOrigin,...patch},body:'{}'});
  assert.equal((await post({origin:'https://evil.invalid'})).status,403);
  assert.equal((await post({'x-jetta-request':''})).status,403);
  assert.equal((await post({})).status,400);
  assert.equal((await request(base+'/chapa/api/pc01/usuarios',{method:'POST',headers:{...headers,origin:cfg.publicOrigin,'x-jetta-request':'web','content-type':'application/json'},body:'{}'})).status,401);
 }finally{await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
});
