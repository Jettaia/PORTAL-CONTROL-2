import test from 'node:test';
import assert from 'node:assert/strict';
import {money,planningInput} from '../src/b3.js';
const valid = () => ({depositoId:2,tipoServicoId:3,dataServico:'2026-11-10',inicioPrevisto:'2026-11-10T08:00',fimPrevisto:'2026-11-10T17:00',descricao:'Sintetico'});
test('B3 valor decimal exato sem ponto flutuante', () => { assert.equal(money('1.2'),'1.20'); assert.equal(money('9999999999999999.99'),'9999999999999999.99'); assert.equal(money('0'),'0.00'); for(const v of [1.2,'-1','1e3','1,20','1.234','10000000000000000.00',null]) assert.throws(()=>money(v)); });
test('B3 datas/turnos invalidos e ator declarado recusados', () => { assert.equal(planningInput(valid()).date,'2026-11-10'); for(const change of [{dataServico:'2026-02-30'},{inicioPrevisto:'2026-11-10T25:00'},{fimPrevisto:'2026-11-10T07:00'},{GestorUsuarioId:1},{filialId:1},{descricao:'x'.repeat(501)},{depositoId:'1;DROP TABLE X'}]) assert.throws(()=>planningInput({...valid(),...change})); });
test('B3 permite turno que atravessa meia noite conforme contrato SQL existente', () => { const row=planningInput({...valid(),inicioPrevisto:'2026-11-10T22:00',fimPrevisto:'2026-11-11T06:00'});assert.equal(row.end,'2026-11-11T06:00'); });
