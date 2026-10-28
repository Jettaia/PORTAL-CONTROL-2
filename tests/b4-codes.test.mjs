import test from 'node:test';import assert from 'node:assert/strict';
import {randomCode,randomTablet,verifier,commandInput,codeContext,labOnly} from '../src/b4-codes.js';
test('B4 criptografia: códigos de 128 bits distintos e autorização de 256 bits',()=>{
 const values=Array.from({length:1000},randomCode);assert.equal(new Set(values).size,1000);
 assert.ok(values.every(x=>Buffer.from(x,'base64url').length===16));assert.equal(Buffer.from(randomTablet(),'base64url').length,32);
});
test('B4 verificador vincula geração, participação, atividade, prestador, depósito e finalidade',()=>{
 const secret=randomCode(),a=['generation',1,2,3,4,'ENTRADA'];const hash=verifier(secret,codeContext(...a));
 for(let i=0;i<a.length;i++){const b=[...a];b[i]=String(b[i])+'different';assert.notEqual(verifier(secret,codeContext(...b)),hash);}
 assert.equal(hash.length,64);assert.ok(!hash.includes(secret));
});
test('B4 rejeita campos inesperados, relógio do cliente e identificadores inválidos',()=>{
 const v={atividadeId:1,participacaoId:2,prestadorId:3,tipo:'ENTRADA',codigo:randomCode(),requisicaoId:'9c3c5e50-43ba-40d4-a9a7-07cf2d09bb7f'};
 assert.deepEqual(commandInput(v),v);for(const change of [{horario:'2026-01-01'},{tipo:'CANCELAR'},{prestadorId:-1},{codigo:'1234'},{requisicaoId:'invalid'}])assert.throws(()=>commandInput({...v,...change}));
});
test('B4 trava o recurso fora do banco efêmero e não ativa por versão ou ambiente',()=>{
 for(const cfg of [{database:'JETTA_CONTROL',b41:true},{database:'JETTA_CONTROL_B3_TEST_abcdef123456'},{database:'JETTA_CONTROL_B3_TEST_abcdef123456_extra',b41:true}])assert.throws(()=>labOnly(cfg));
 assert.doesNotThrow(()=>labOnly({database:'JETTA_CONTROL_B3_TEST_abcdef123456',b41:true}));
});
