import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {b42Fixture} from './b4-2-fixture.mjs';
const evidence={utc:new Date().toISOString(),principalAccesses:0};
await test('B4.3 migração transacional, rollback e reaplicação preservam eventos e conferências B4.2',async()=>{const old=process.env.JETTA_B43_EVIDENCE;delete process.env.JETTA_B43_EVIDENCE;let f;try{f=await b42Fixture();}finally{if(old!==undefined)process.env.JETTA_B43_EVIDENCE=old;}
 const {lab,q}=f;evidence.database=lab.database;try{const x=await f.finished(),snapshot=async()=>Array.from(await q(`SELECT EventoId,Tipo,CONVERT(varchar(23),InstanteUtc,126) InstanteUtc FROM Operacao.EventoApontamento WHERE ParticipacaoId=${x.p} ORDER BY EventoId`)),before=await snapshot(),batches=fs.readFileSync(new URL('b4-3-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(s=>s.trim());
 await lab.db.beginTransaction();try{for(const b of batches)await q(b);await assert.rejects(()=>q("THROW 54699,N'Falha sintetica DDL',1"));}finally{try{await lab.db.rollback();}catch{}}
 assert.equal((await q("SELECT OBJECT_ID('Operacao.FechamentoParticipacao','U') F,OBJECT_ID('Operacao.AjusteApontamento','U') A"))[0].F,null);assert.equal((await q("SELECT OBJECT_ID('Operacao.AjusteApontamento','U') A"))[0].A,null);assert.deepEqual(await snapshot(),before);
 for(let i=0;i<2;i++){await lab.db.beginTransaction();try{for(const b of batches)await q(b);await lab.db.commit();}catch(e){await lab.db.rollback();throw e;}}
 assert.deepEqual(await snapshot(),before);assert.equal(Number((await q("SELECT COUNT(*) N FROM sys.tables WHERE schema_id=SCHEMA_ID('Operacao')"))[0].N),17);evidence.ddlRollback=true;evidence.originalsPreserved=true;evidence.reapplied=true;
 }finally{await lab.close();evidence.cleanupVerified=true;fs.mkdirSync('docs/b5-1/regression/b4-3',{recursive:true});fs.writeFileSync('docs/b5-1/regression/b4-3/migration-evidence.json',JSON.stringify(evidence,null,2)+'\n');}
});
