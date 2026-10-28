import test from 'node:test';import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {b4Fixture} from './b4-1-fixture.mjs';import {pairTablet,activateTablet,issueCodes,recordEvent} from '../src/b4.js';
const evidence={utc:new Date().toISOString(),principalAccesses:0};
await test('B4.2 upgrade preserva eventos B4.1, invalida autorização legada e rollback não deixa objetos parciais',async()=>{
 const enabled=process.env.JETTA_B42_EVIDENCE;delete process.env.JETTA_B42_EVIDENCE;let f;try{f=await b4Fixture();}finally{if(enabled!==undefined)process.env.JETTA_B42_EVIDENCE=enabled;}
 const {lab,g,q}=f;evidence.database=lab.database;
 try{const x=await f.contracted(),a=await activateTablet(lab.cfg,(await pairTablet(lab.cfg,g.id,g.token,1)).pareamento),c=await issueCodes(lab.cfg,g.id,g.token,x.p,60),cmd={participacaoId:Number(x.p),atividadeId:Number(x.a),prestadorId:x.pr,tipo:'ENTRADA',codigo:c.entrada,requisicaoId:crypto.randomUUID()};await recordEvent(lab.cfg,a.token,cmd);
 const snapshot=async()=>Array.from(await q(`SELECT EventoId,Tipo,CONVERT(varchar(23),InstanteUtc,126) InstanteUtc FROM Operacao.EventoApontamento WHERE ParticipacaoId=${x.p}`));const before=await snapshot();const batches=fs.readFileSync(new URL('b4-2-schema.sql',import.meta.url),'utf8').split(/^\s*GO\s*$/im).filter(x=>x.trim());
 await lab.db.beginTransaction();try{for(const b of batches)await q(b);await assert.rejects(()=>q("THROW 54599,N'Falha sintetica de migracao',1"));}finally{try{await lab.db.rollback();}catch{}}
 assert.equal((await q("SELECT OBJECT_ID('Operacao.ConferenciaApontamento','U') T,COL_LENGTH('Operacao.TabletApontamento','DispositivoId') C"))[0].T,null);assert.equal((await q("SELECT COL_LENGTH('Operacao.TabletApontamento','DispositivoId') C"))[0].C,null);assert.deepEqual(await snapshot(),before);
 for(let i=0;i<2;i++){await lab.db.beginTransaction();try{for(const b of batches)await q(b);await lab.db.commit();}catch(e){await lab.db.rollback();throw e;}}
 lab.cfg.b42=true;assert.deepEqual(await snapshot(),before);assert.equal((await recordEvent(lab.cfg,a.token,{...cmd,requisicaoId:crypto.randomUUID()})).status,401);evidence.preservedOriginals=true;evidence.legacyAuthorizationDenied=true;evidence.ddlRollback=true;
 }finally{await lab.close();evidence.cleanupVerified=true;fs.mkdirSync('docs/b5-2b/regression/regression/b5-2/regression/b5-1/regression/b4-3/regression/b4-2',{recursive:true});fs.writeFileSync('docs/b5-2b/regression/regression/b5-2/regression/b5-1/regression/b4-3/regression/b4-2/migration-evidence.json',JSON.stringify(evidence,null,2)+'\n');}
});
