import test from 'node:test';import assert from 'node:assert/strict';
import {hexLiteral,validNewPassword} from '../src/b25b.js';
test('senha nova aceita 6 a 128 caracteres e preserva composição',()=>{
 for(const length of [6,13,14,128])assert.equal(validNewPassword('Aa1!'+'b'.repeat(length-4)),true,`aceita ${length}`);
 for(const password of ['Aa1!b','Aa1!'+'b'.repeat(125),'abcdef','ABC123','Abc123','Abc!de',null])assert.equal(validNewPassword(password),false);
});
test('hex SQL restrito',()=>{assert.equal(hexLiteral('a'.repeat(64),64),`'${'a'.repeat(64)}'`);assert.throws(()=>hexLiteral("a';DROP TABLE x;--",64));});
test('senha robusta',()=>{assert.equal(validNewPassword('SenhaTesteForte!2026'),true);assert.equal(validNewPassword('12345678901234'),false);assert.equal(validNewPassword('abc'),false);});
