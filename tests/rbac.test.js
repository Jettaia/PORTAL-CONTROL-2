import test from 'node:test';import assert from 'node:assert/strict';import {asInt,asText} from '../src/rbac.js';
test('ids seguros',()=>{assert.equal(asInt(23),23);assert.throws(()=>asInt('1;DROP TABLE X'));assert.throws(()=>asInt(Number.MAX_SAFE_INTEGER+10))});
test('texto codificado em hex unicode',()=>{const v=asText("x'); DROP TABLE X;--",120);assert.match(v,/^CONVERT\(nvarchar\(120\), 0x[a-f0-9]+\)$/);assert.doesNotMatch(v,/DROP TABLE/)});
