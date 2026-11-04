import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {productionConfig} from '../production/config.mjs';
import {createProductionApp} from '../production/app.mjs';
import {buildAssets} from '../production/build-assets.mjs';

test('produção: frontend real mantém recursos e pedidos anônimos dentro de /chapa',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'chapa-browser-'));buildAssets(temp);
 const cfg={...productionConfig({server:'chapa-db',port:3211,database:'JETTA_CONTROL_PILOTO_LOCAL',pilotInstance:'a'.repeat(64),token:'b'.repeat(64),mfaKey:'c'.repeat(64),sqlAuth:{user:'JettaChapaRuntime',password:'synthetic-secret-32-characters-long'},trustedProxy:'10.203.88.2/32',publicOrigin:'https://app.jettatransportes.com.br',basePath:'/chapa'}),trustedProxy:'loopback',publicRoot:temp};
 const server=createProductionApp(cfg).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 let browser;
 try{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
  const page=await browser.newPage(),errors=[],escaped=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==cfg.publicOrigin||!url.pathname.startsWith('/chapa/')){escaped.push(url.pathname);await route.abort();return;}
   const result=await new Promise((resolve,reject)=>{
    const req=http.request('http://127.0.0.1:'+server.address().port+url.pathname+url.search,{method:request.method(),headers:{...request.headers(),host:new URL(cfg.publicOrigin).host,'x-forwarded-proto':'https'}},res=>{
     const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end(request.postDataBuffer());
   });
   responses.push([url.pathname,result.status]);
   const headers={...result.headers};delete headers['transfer-encoding'];delete headers.connection;delete headers['content-length'];
   await route.fulfill({status:result.status,headers,body:result.body});
  });
  const sessionResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/chapa/api/auth/me');
  await page.goto(cfg.publicOrigin+'/chapa/');
  await page.locator('#loginForm').waitFor({state:'visible'});
  await sessionResponse;
  assert.equal(await page.locator('#loginForm').isVisible(),true);
  await page.locator('#accessRequestOpen').click();
  assert.equal(await page.locator('#accessRequestDialog').isVisible(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(escaped,[]);
  assert.ok(responses.some(([p,s])=>p==='/chapa/api/auth/me'&&s===401));
  assert.equal(responses.filter(([p,s])=>!p.startsWith('/chapa/api/')&&s!==200).length,0);
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
});
