import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {b24Definition,validateB24,validateBranchUpdate,updateBranch} from '../src/b24a.js';
import {normalizeCatalog,save} from '../src/pc02.js';

const depot={nome:'Depósito teste',centroCusto:'CC-1',rua:'Rua teste',numero:'1',bairro:'Centro',cidade:'Campinas',estado:'SP',cep:'13010000'};
const original={...depot,ativo:true};
const edit={...depot,nome:'Depósito atualizado',ativo:false,original};

test('QA-02: cadastro de filial permanece aposentado',async()=>{
 assert.equal(b24Definition('filiais'),null);
 assert.throws(()=>validateB24('filiais',{nome:'Filial teste',codigo:'1'}),/Cadastro desconhecido/);
 assert.throws(()=>validateBranchUpdate({nome:'Filial nova',codigo:'2',ativo:false,original}),e=>e.status===404);
 await assert.rejects(()=>updateBranch(),e=>e.status===404);
});

test('QA-02: depósito usa centro de custo/endereço e edição exige situação booleana e original completo',()=>{
 assert.deepEqual(normalizeCatalog('depositos',depot),original);
 assert.deepEqual(normalizeCatalog('depositos',edit,true),edit);
 for(const delta of [{codigo:'1'},{filialId:1}])assert.throws(()=>normalizeCatalog('depositos',{...depot,...delta}));
 for(const key of ['centroCusto','rua','numero','bairro','cidade','estado','cep'])assert.throws(()=>normalizeCatalog('depositos',{...depot,[key]:''}));
 assert.throws(()=>normalizeCatalog('depositos',{...edit,ativo:'false'},true));
 assert.throws(()=>normalizeCatalog('depositos',{...edit,original:undefined},true));
 assert.throws(()=>normalizeCatalog('depositos',{...edit,original:{nome:depot.nome,ativo:true}},true));
});

test('QA-02: edição de depósito preserva concorrência no serviço real',async t=>{
 const current={DepositoId:1,Nome:depot.nome,CentroCusto:depot.centroCusto,Rua:depot.rua,Numero:depot.numero,Bairro:depot.bairro,Cidade:depot.cidade,Estado:depot.estado,CEP:depot.cep,Ativo:1};
 const scenarios=[['nome',{Nome:'Alterado em outra tela'}],['centro de custo',{CentroCusto:'CC-concorrente'}],['endereço',{Rua:'Rua concorrente'}],['situação',{Ativo:0}],['original atual',null]];
 for(const [name,change] of scenarios)await t.test(name,async sub=>{
  const row={...current,...change},updated={...current,Nome:edit.nome,Ativo:0};
  const responses=[[],[{R:0}],[{UsuarioId:1}],[{V:1}],[row],...(!change?[[],[updated],[]]:[])];
  const queries=[];let begins=0,commits=0,rollbacks=0,closes=0;
  sub.mock.method(odbc,'connect',async()=>({
   query:async sql=>{queries.push(sql);assert.ok(responses.length,'Consulta inesperada');return responses.shift();},
   beginTransaction:async()=>{begins++;},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{closes++;}
  }));
  const action=()=>save({driver:'test',server:'test',database:'test'},1,'synthetic-session','depositos',edit,1);
  if(change){
   await assert.rejects(action,e=>e.status===409&&e.message==='REGISTRO_ALTERADO_ATUALIZE');
   assert.equal(queries.some(sql=>/^(UPDATE|INSERT)\b/.test(sql)),false,'conflito não envia escrita');
  }else{
   assert.deepEqual(await action(),updated);
   assert.equal(queries.filter(sql=>sql.startsWith('UPDATE Cadastro.Deposito')).length,1);
   assert.equal(queries.filter(sql=>sql.startsWith('INSERT Seguranca.Auditoria')).length,1);
  }
  assert.equal(begins,1);assert.equal(commits,change?0:1);assert.equal(rollbacks,change?1:0);assert.equal(closes,1);assert.equal(responses.length,0);
 });
});
