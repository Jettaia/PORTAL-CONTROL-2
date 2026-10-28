import test from 'node:test';import assert from 'node:assert/strict';import {normalizeUser} from '../src/b25-validate.js';
test('pre-cadastro normaliza email',()=>{const x=normalizeUser({nome:'Maria da Silva',email:' Maria@EXAMPLE.COM ',perfil:'GESTOR'});assert.equal(x.email,'maria@example.com');});
test('perfil base arbitrario negado',()=>assert.throws(()=>normalizeUser({nome:'Maria da Silva',email:'maria@example.com',perfil:'ROOT'})));
test('email invalido negado',()=>assert.throws(()=>normalizeUser({nome:'Maria da Silva',email:'invalido',perfil:'GESTOR'})));
