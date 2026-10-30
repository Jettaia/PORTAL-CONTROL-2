import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCatalog,read,save} from '../src/pc02.js';
import odbc from 'odbc';
const depot={nome:'Depósito Norte',centroCusto:'CC-001',rua:'Rua Norte',numero:'10',bairro:'Centro',cidade:'Campinas',estado:'sp',cep:'13010-000'};
test('depósito exige CC e endereço completo e normaliza UF/CEP',()=>{
 const v=normalizeCatalog('depositos',depot);assert.equal(v.estado,'SP');assert.equal(v.cep,'13010000');
 for(const key of ['nome','centroCusto','rua','numero','bairro','cidade','estado','cep'])assert.throws(()=>normalizeCatalog('depositos',{...depot,[key]:''}));
 for(const delta of [{estado:'XX'},{cep:'123'},{codigo:'legacy'},{filialId:1},{endereco:'Rua única'}])assert.throws(()=>normalizeCatalog('depositos',{...depot,...delta}));
 assert.throws(()=>normalizeCatalog('filiais',depot));
});
test('gestor e financeiro consultam exclusivamente depósitos atribuídos no serviço real',async t=>{
 for(const perfil of ['GESTOR','FINANCEIRO'])await t.test(perfil,async()=>{
  const queries=[],queue=[[{Perfil:perfil,Adm:0}],[]];const mock=t.mock.method(odbc,'connect',async()=>({query:async sql=>{queries.push(sql);return queue.shift();},close:async()=>{}}));
  try{const result=await read({driver:'test',server:'test',database:'test'},7,'depositos');assert.equal(result.podeEditar,false);assert.match(queries[1],/UsuarioDeposito ud/);assert.match(queries[1],/ud.UsuarioId=7/);assert.match(queries[1],/ud.RevogadoEmUtc IS NULL/);}finally{mock.mock.restore();}
 });
});
test('gravação real envia campos do depósito sem vínculo de filial e audita',async t=>{
 const queries=[],queue=[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[],[{DepositoId:8}],[],[]];let committed=false;
 const mock=t.mock.method(odbc,'connect',async()=>({query:async sql=>{queries.push(sql);assert.ok(queue.length);return queue.shift();},beginTransaction:async()=>{},commit:async()=>{committed=true;},rollback:async()=>{},close:async()=>{}}));
 try{const row=await save({driver:'test',server:'test',database:'test'},1,'test','depositos',depot);assert.equal(row.DepositoId,8);const insert=queries.find(q=>q.startsWith('INSERT Cadastro.Deposito'));assert.match(insert,/CentroCusto,Rua,Numero,Bairro,Cidade,Estado,CEP/);assert.doesNotMatch(insert,/Filial|Endereco/);const grants=queries.find(q=>q.startsWith('INSERT Seguranca.UsuarioDeposito'));assert.match(grants,/UsuarioRaiz/);assert.match(grants,/u.Perfil='ADMIN'/);assert.match(grants,/u.Ativo=1/);assert.match(grants,/INSERT Seguranca.GestorDeposito/);assert.equal(committed,true);assert.equal(queue.length,0);}finally{mock.mock.restore();}
});
