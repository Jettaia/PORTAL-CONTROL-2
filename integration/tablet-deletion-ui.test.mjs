import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import {chromium} from 'playwright';

test('Admin exclui revogado com confirmação; Gestor e ativos não oferecem exclusão',async t=>{
 const app=express();app.use(express.json());
 app.get('/fixture',(_req,res)=>res.send(fs.readFileSync('public/index.html','utf8').replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g,(full,src)=>src==='/tablets.js'?full:'')));
 app.use(express.static('public'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined,headless:true});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(2500);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let rows=[{TabletId:5,Nome:'Antigo',Estado:'REVOGADO'},{TabletId:6,Nome:'Atual',Estado:'ATIVO'}],writes=0,deny=false;
 await page.route('**/api/pc05/tablets**',async route=>{
  if(route.request().method()==='POST'){
   assert.equal(new URL(route.request().url()).pathname,'/api/pc05/tablets/5/excluir');assert.deepEqual(route.request().postDataJSON(),{});writes++;
   if(deny)return route.fulfill({status:403,json:{erro:'SOMENTE_ADM'}});
   rows=rows.filter(r=>r.TabletId!==5);
  }
  await route.fulfill({json:{registros:rows,depositos:[]}});
 });
 await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 const login=async perfil=>{await page.evaluate(perfil=>{window.dispatchEvent(new CustomEvent('jetta:auth',{detail:{pc05:true,perfil,funcoes:[perfil]}}));document.getElementById('dashboard').hidden=false;document.getElementById('tabletsPage').hidden=false;window.dispatchEvent(new Event('jetta:tablets'));},perfil);await page.getByText('Antigo',{exact:true}).waitFor();};
 await login('GESTOR');assert.equal(await page.getByRole('button',{name:/^Excluir /}).count(),0);
 await login('ADMIN');const remove=page.getByRole('button',{name:'Excluir Antigo',exact:true});await remove.waitFor();
 assert.equal(await page.getByRole('button',{name:'Excluir Atual',exact:true}).count(),0);
 page.once('dialog',async d=>{assert.match(d.message(),/Antigo/);await d.dismiss();});await remove.click();assert.equal(writes,0);assert.ok(await page.getByText('Antigo',{exact:true}).isVisible());
 deny=true;page.once('dialog',d=>d.accept());await remove.click();await page.getByText('Somente Admin pode excluir tablets.',{exact:true}).waitFor();assert.ok(await page.getByText('Antigo',{exact:true}).isVisible());
 deny=false;page.once('dialog',d=>d.accept());await remove.click();await page.getByText('Tablet excluído.',{exact:true}).waitFor();assert.equal(writes,2);assert.equal(await page.getByText('Antigo',{exact:true}).count(),0);assert.ok(await page.getByText('Atual',{exact:true}).isVisible());
 assert.deepEqual(errors,[]);
});
