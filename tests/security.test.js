import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {hashPassword,passwordValid,newToken,hashToken,parseSessionCookie} from '../src/security.js';
test('scrypt valida somente senha correta',()=>{const salt=crypto.randomBytes(16).toString('hex'),hash=hashPassword('senha-de-teste-muito-forte',salt);assert.ok(passwordValid('senha-de-teste-muito-forte',salt,hash));assert.equal(passwordValid('incorreta',salt,hash),false);});
test('token aleatorio e hash deterministico',()=>{const a=newToken(),b=newToken();assert.equal(a.length,64);assert.notEqual(a,b);assert.equal(hashToken(a),hashToken(a));});
test('cookie session parser',()=>{assert.equal(parseSessionCookie('foo=1; jetta_session='+('a'.repeat(64))), 'a'.repeat(64));assert.equal(parseSessionCookie('foo=1'),null);});
