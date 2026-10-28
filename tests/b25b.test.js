import test from 'node:test';import assert from 'node:assert/strict';
import {hexLiteral,validNewPassword} from '../src/b25b.js';
test('hex SQL restrito',()=>{assert.equal(hexLiteral('a'.repeat(64),64),`'${'a'.repeat(64)}'`);assert.throws(()=>hexLiteral("a';DROP TABLE x;--",64));});
test('senha robusta',()=>{assert.equal(validNewPassword('SenhaTesteForte!2026'),true);assert.equal(validNewPassword('12345678901234'),false);assert.equal(validNewPassword('abc'),false);});
