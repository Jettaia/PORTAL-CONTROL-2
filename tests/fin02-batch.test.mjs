import test from 'node:test';
import assert from 'node:assert/strict';
import odbc from 'odbc';
import {preview,generate} from '../src/fin02-batch.js';

test('lote soma centavos sem arredondamento e aceita chave válida não hexadecimal',async t=>{
 const finance={UsuarioId:1,Adm:0,Gestor:0,Financeiro:1};
 const cfg={token:'chave-de-teste-nao-hexadecimal-com-40-caracteres',mfaRequired:false,fin02BatchNow:()=>1000};
 const row={ContratacaoId:1,Numero:4,DepositoId:1,PrestadorId:1,TipoServicoId:1,Versao:1,DataServico:'2026-11-09',LiberadoEmUtc:'2026-11-09T10:00:00.0000000',ValorLiberado:'9007199254740999.91',ReciboId:null};
 let queue=[[],[finance],[row,{...row,ContratacaoId:2,Numero:5,ValorLiberado:'0.09'}]],commits=0,rollbacks=0,writes=0;
 const db={query:async sql=>{if(/^INSERT|^UPDATE|^DELETE/.test(sql))writes++;assert.ok(queue.length,'Consulta inesperada');return queue.shift();},beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{rollbacks++;},close:async()=>{}};
 t.mock.method(odbc,'connect',async()=>db);
 const result=await preview(cfg,1,{inicio:'2026-11-01',fim:'2026-11-30'});
 assert.equal(result.total,'9007199254741000.00');assert.equal(result.quantidade,2);assert.equal(result.registros[0].ValorLiberado,row.ValorLiberado);assert.equal(queue.length,0);assert.equal(commits,1);
 queue=[[],[finance],[{V:1}]];
 await assert.rejects(()=>generate({...cfg,fin02BatchNow:()=>1000+15*60000},1,'session',{previa:result.previa}),e=>e.status===409&&e.message==='PREVIA_EXPIRADA');assert.equal(queue.length,0);
 queue=[[],[finance],[{V:1}]];
 await assert.rejects(()=>generate(cfg,1,'session',{previa:result.previa+'x'}),e=>e.status===400&&e.message==='PREVIA_INVALIDA');assert.equal(queue.length,0);
 queue=[[],[finance],[{V:1}]];
 await assert.rejects(()=>generate(cfg,2,'session',{previa:result.previa}),e=>e.status===403&&e.message==='PREVIA_DE_OUTRO_USUARIO');assert.equal(queue.length,0);
 queue=[[],[finance],[]];
 await assert.rejects(()=>generate(cfg,1,'session',{previa:result.previa}),e=>e.status===401&&e.message==='SESSAO_INVALIDA');assert.equal(queue.length,0);assert.equal(writes,0);assert.equal(rollbacks,1);
 queue=[[],[finance],[]];
 await assert.rejects(()=>generate({...cfg,mfaRequired:true},1,'session',{previa:result.previa}),e=>e.status===403&&e.message==='MFA_RECENTE_OBRIGATORIO');assert.equal(queue.length,0);assert.equal(writes,0);
});
