import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {buildAssets} from '../production/build-assets.mjs';

test('avatar acompanha login, restauração e encerramento da sessão local e /chapa/',async()=>{
 const generated=fs.mkdtempSync(path.join(os.tmpdir(),'avatar-assets-'));
 buildAssets(generated);
 const app=express();app.use('/chapa',express.static(generated));app.use(express.static('public'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const prefix of process.env.AVATAR_TEST_ORIGIN?['/chapa']:['', '/chapa']){
   const page=await browser.newPage();let logged=false,name='Administrador';const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()).pathname;
    if(url.endsWith('/auth/login'))logged=true;
    if(url.endsWith('/auth/logout'))logged=false;
    if(url.endsWith('/auth/me')||url.endsWith('/auth/login'))return route.fulfill({status:logged?200:401,json:logged?{usuario:{id:1,nome:name,perfil:'GESTOR',funcoes:['GESTOR']},mfa:{necessarioParaAcoesSensiveis:false}}:{erro:'Sem sessão'}});
    await route.fulfill({json:{registros:[],depositos:[],usuarios:[],pc01:false}});
   });
   const url=`${process.env.AVATAR_TEST_ORIGIN||`http://127.0.0.1:${server.address().port}`}${prefix}/`;
   await page.goto(url);
   for(const [next,expected] of [['Administrador','Ad'],['Tiago Ferretti','TF'],['  Tiago   de Ferretti  ','TF'],['Álvaro','Ál'],['T','T'],['','?']]){
    name=next;
    await page.locator('#loginBox').waitFor({state:'visible'});
    await page.locator('#email').fill('avatar@example.test');await page.locator('#senha').fill('synthetic-password');
    await page.locator('#loginForm button[type=submit]').click();
    await page.locator('#dashboard').waitFor({state:'visible'});
    assert.equal(await page.locator('.profile-dot').innerText(),expected,`${prefix}: ${next}`);
    await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});
    assert.equal(await page.locator('.profile-dot').innerText(),expected,'restauração');
    await page.locator('#logout').click();await page.locator('#loginBox').waitFor({state:'visible'});
    assert.equal(await page.locator('.profile-dot').innerText(),'?','logout');
   }
   name='Tiago Ferretti';logged=true;await page.reload();await page.locator('#dashboard').waitFor({state:'visible'});
   await page.evaluate(()=>window.dispatchEvent(new Event('jetta:pc01-session-revoked')));
   await page.locator('#loginBox').waitFor({state:'visible'});
   assert.equal(await page.locator('.profile-dot').innerText(),'?','revogação');
   assert.deepEqual(errors,[]);await page.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));fs.rmSync(generated,{recursive:true,force:true});}
});
