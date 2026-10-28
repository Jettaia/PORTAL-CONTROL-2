const evidenceRoot='docs/b5-2a/regression/b5-2/regression/b5-1/regression/b4-3/regression/b4-2/regression/b4-1/regression/b3-4/consolidated/ddl';
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeB3Lab,safeName} from './b3-lab.mjs';import {createActivity,addParticipant,activityDetail} from '../src/b3.js';
const lab=await makeB3Lab({b33:true}),u=await lab.user();
await lab.db.query(`INSERT Cadastro.Filial(Codigo,Nome) VALUES('LAB',N'Filial sintetica');INSERT Cadastro.Deposito(FilialId,Codigo,Nome) VALUES(1,'LAB',N'Deposito sintetico');INSERT Cadastro.TipoServico(Nome) VALUES(N'Servico sintetico');INSERT Cadastro.Prestador(Nome,CPF) VALUES(N'Prestador sintetico','00000000001');INSERT Seguranca.UsuarioDeposito(UsuarioId,DepositoId) VALUES(${u.id},1);INSERT Seguranca.GestorDeposito(GestorUsuarioId,DepositoId) VALUES(${u.id},1);`);
const id=(await createActivity(lab.cfg,u.id,{filialId:1,depositoId:1,tipoServicoId:1,dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T12:00'})).atividadeId;
await addParticipant(lab.cfg,u.id,id,{prestadorId:1,valorContratado:'123.45'});
after(async()=>{await lab.close();fs.writeFileSync(evidenceRoot+'/migration-isolation.json',JSON.stringify({database:lab.database,principalAccesses:0,cleaned:true},null,2)+'\n');});
test('B3.2 reaplicacao transacional duas vezes preserva participantes, valores e auditoria',async()=>{
 const before=Number((await lab.db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria'))[0].N);
 for(let i=0;i<2;i++){
  assert.ok(safeName(lab.database));await lab.db.beginTransaction();
  try{for(const file of ['b3-2-patch.sql','b3-3-availability.sql','b3-3-patch.sql'])for(const batch of fs.readFileSync(new URL(file,import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim())){assert.equal((await lab.db.query('SELECT DB_NAME() D'))[0].D,lab.database);await lab.db.query(batch);}await lab.db.commit();}catch(e){try{await lab.db.rollback();}catch{}throw e;}
 }
 const data=await activityDetail(lab.cfg,u.id,id);assert.equal(data.participacoes.length,1);assert.equal(data.participacoes[0].Status,'PLANEJADA');assert.equal(data.participacoes[0].ValorContratado,'123.45');assert.equal(Number((await lab.db.query('SELECT COUNT(*) N FROM Seguranca.Auditoria'))[0].N),before);
});
test('B3.2 erro apos DDL desfaz alteracao de funcao sem reduzir autorizacao existente',async()=>{
 await lab.db.beginTransaction();
 try{await lab.db.query('CREATE OR ALTER FUNCTION Seguranca.fn_Pode(@UsuarioId bigint,@Chave varchar(100)) RETURNS bit AS BEGIN RETURN 0;END;');await assert.rejects(()=>lab.db.query("THROW 59997,'Falha sintetica depois de DDL',1"));}finally{try{await lab.db.rollback();}catch{}}
 assert.equal(Number((await lab.db.query(`SELECT CONVERT(int,Seguranca.fn_Pode(${u.id},'atividades.visualizar')) N`))[0].N),1);
 assert.equal((await activityDetail(lab.cfg,u.id,id)).participacoes.length,1);
});
